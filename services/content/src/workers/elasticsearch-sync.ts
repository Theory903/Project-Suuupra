import { ChangeStream, ChangeStreamDocument } from 'mongodb';
import { Redis } from 'ioredis';
import { Content } from '@/models/Content';
import { Category } from '@/models/Category';
import { ElasticsearchService } from '@/services/elasticsearch';
import { logger, ContextLogger } from '@/utils/logger';
import { config } from '@/config';

export class ElasticsearchSyncWorker {
  private changeStream?: ChangeStream;
  private redis: Redis;
  private esService: ElasticsearchService;
  private contextLogger: ContextLogger;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(redis: Redis, esService: ElasticsearchService) {
    this.redis = redis;
    this.esService = esService;
    this.contextLogger = new ContextLogger({ worker: 'elasticsearch-sync' });
  }

  // Start the sync worker
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.contextLogger.warn('Elasticsearch sync worker is already running');
      return;
    }

    this.contextLogger.info('Starting Elasticsearch sync worker...');
    this.isRunning = true;

    try {
      await this.startChangeStream();
      this.contextLogger.info('Elasticsearch sync worker started successfully');
    } catch (error) {
      this.contextLogger.error('Failed to start sync worker', error as Error);
      this.isRunning = false;
      throw error;
    }
  }

  // Stop the sync worker
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.contextLogger.info('Stopping Elasticsearch sync worker...');
    this.isRunning = false;

    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = undefined;
    }

    this.contextLogger.info('Elasticsearch sync worker stopped');
  }

  // Start change stream monitoring
  private async startChangeStream(): Promise<void> {
    try {
      // Get resume token if available
      const resumeToken = await this.getResumeToken();
      
      const pipeline = [
        {
          $match: {
            $or: [
              { operationType: 'insert' },
              { operationType: 'update' },
              { operationType: 'delete' },
              { operationType: 'replace' }
            ],
            'ns.coll': 'contents'
          }
        }
      ];

      const options: any = {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      };

      if (resumeToken) {
        options.resumeAfter = resumeToken;
        this.contextLogger.info('Resuming change stream from token', { resumeToken });
      }

      this.changeStream = Content.watch(pipeline, options);

      this.changeStream.on('change', this.handleChange.bind(this));
      this.changeStream.on('error', this.handleError.bind(this));
      this.changeStream.on('close', this.handleClose.bind(this));
      this.changeStream.on('end', this.handleEnd.bind(this));

      this.contextLogger.info('Change stream started successfully');
    } catch (error) {
      this.contextLogger.error('Failed to start change stream', error as Error);
      throw error;
    }
  }

  // Handle change stream events
  private async handleChange(change: ChangeStreamDocument): Promise<void> {
    try {
      const { operationType, documentKey, fullDocument, fullDocumentBeforeChange } = change;
      const contentId = documentKey._id;

      this.contextLogger.debug('Processing change stream event', {
        operationType,
        contentId,
        resumeToken: change._id
      });

      // Store resume token for fault tolerance
      await this.storeResumeToken(change._id);

      switch (operationType) {
        case 'insert':
        case 'replace':
          if (fullDocument) {
            await this.indexContent(fullDocument);
          }
          break;

        case 'update':
          if (fullDocument) {
            // Check if the document was soft deleted
            if (fullDocument.deleted) {
              await this.deleteContentFromIndex(contentId, fullDocument.tenantId);
            } else {
              await this.indexContent(fullDocument);
            }
          }
          break;

        case 'delete':
          if (fullDocumentBeforeChange) {
            await this.deleteContentFromIndex(contentId, fullDocumentBeforeChange.tenantId);
          }
          break;

        default:
          this.contextLogger.warn('Unhandled change stream operation', { operationType });
      }

      // Update sync metrics
      await this.updateSyncMetrics();

    } catch (error) {
      this.contextLogger.error('Error processing change stream event', error as Error, {
        change: change
      });

      // Add to dead letter queue for manual retry
      await this.addToDeadLetterQueue(change, error as Error);
    }
  }

  // Index content in Elasticsearch
  private async indexContent(content: any): Promise<void> {
    try {
      // Skip if content is deleted or not published
      if (content.deleted || content.status !== 'published') {
        await this.deleteContentFromIndex(content._id, content.tenantId);
        return;
      }

      // Enrich content with category information
      let categoryInfo = null;
      if (content.categoryId) {
        const category = await Category.findById(content.categoryId);
        if (category) {
          categoryInfo = {
            id: category.id,
            name: category.name,
            path: await category.getFullPath()
          };
        }
      }

      // Transform content for Elasticsearch
      const esDocument = {
        id: content._id,
        tenant_id: content.tenantId,
        title: content.title,
        description: content.description,
        content_type: content.contentType,
        status: content.status,
        version: content.version,
        category: categoryInfo,
        tags: content.tags || [],
        metadata: content.metadata || {},
        file_info: content.fileInfo,
        created_by: content.createdBy,
        created_at: content.createdAt,
        updated_at: content.updatedAt,
        published_at: content.publishedAt,
        view_count: content.metadata?.viewCount || 0,
        engagement_score: content.metadata?.engagementScore || 0.0
      };

      // Index the document
      await this.esService.index({
        id: content._id,
        body: esDocument,
        tenantId: content.tenantId
      });

      this.contextLogger.debug('Content indexed successfully', {
        contentId: content._id,
        tenantId: content.tenantId
      });

    } catch (error) {
      this.contextLogger.error('Failed to index content', error as Error, {
        contentId: content._id
      });
      throw error;
    }
  }

  // Delete content from Elasticsearch index
  private async deleteContentFromIndex(contentId: string, tenantId: string): Promise<void> {
    try {
      await this.esService.delete({
        id: contentId,
        tenantId: tenantId
      });

      this.contextLogger.debug('Content deleted from index successfully', {
        contentId,
        tenantId
      });

    } catch (error) {
      this.contextLogger.error('Failed to delete content from index', error as Error, {
        contentId,
        tenantId
      });
      throw error;
    }
  }

  // Handle change stream errors
  private async handleError(error: Error): Promise<void> {
    this.contextLogger.error('Change stream error', error);

    if (this.isRunning && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;

      this.contextLogger.info('Attempting to reconnect change stream', {
        attempt: this.reconnectAttempts,
        delay
      });

      setTimeout(async () => {
        try {
          if (this.changeStream) {
            await this.changeStream.close();
          }
          await this.startChangeStream();
          this.reconnectAttempts = 0;
        } catch (reconnectError) {
          this.contextLogger.error('Failed to reconnect change stream', reconnectError as Error);
        }
      }, delay);
    } else {
      this.contextLogger.error('Max reconnect attempts reached, stopping sync worker');
      await this.stop();
    }
  }

  // Handle change stream close
  private handleClose(): void {
    this.contextLogger.warn('Change stream closed');
  }

  // Handle change stream end
  private handleEnd(): void {
    this.contextLogger.warn('Change stream ended');
  }

  // Store resume token in Redis
  private async storeResumeToken(token: any): Promise<void> {
    try {
      await this.redis.set(
        'es-sync:resume-token',
        JSON.stringify(token),
        'EX',
        86400 // 24 hours
      );
    } catch (error) {
      this.contextLogger.error('Failed to store resume token', error as Error);
    }
  }

  // Get resume token from Redis
  private async getResumeToken(): Promise<any> {
    try {
      const token = await this.redis.get('es-sync:resume-token');
      return token ? JSON.parse(token) : null;
    } catch (error) {
      this.contextLogger.error('Failed to get resume token', error as Error);
      return null;
    }
  }

  // Update sync metrics
  private async updateSyncMetrics(): Promise<void> {
    try {
      await Promise.all([
        this.redis.incr('es-sync:events-processed'),
        this.redis.set('es-sync:last-processed', Date.now())
      ]);
    } catch (error) {
      this.contextLogger.error('Failed to update sync metrics', error as Error);
    }
  }

  // Add failed event to dead letter queue
  private async addToDeadLetterQueue(change: ChangeStreamDocument, error: Error): Promise<void> {
    try {
      const dlqEntry = {
        change,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        timestamp: new Date().toISOString(),
        retryCount: 0
      };

      await this.redis.lpush(
        'es-sync:dlq',
        JSON.stringify(dlqEntry)
      );

      // Limit DLQ size
      await this.redis.ltrim('es-sync:dlq', 0, 999);

      try {
        const { recordIndexingDLQ } = await import('@/utils/metrics');
        const tenantId = (change.fullDocument?.tenantId) || (change.fullDocumentBeforeChange?.tenantId) || 'unknown';
        recordIndexingDLQ(String(tenantId));
      } catch (metricError) {
        this.contextLogger.error('Failed to record DLQ metric', metricError as Error);
      }

    } catch (dlqError) {
      this.contextLogger.error('Failed to add to dead letter queue', dlqError as Error);
    }
  }

  // Process dead letter queue
  public async processDLQ(maxItems: number = 10): Promise<void> {
    this.contextLogger.info('Processing dead letter queue', { maxItems });

    try {
      for (let i = 0; i < maxItems; i++) {
        const entry = await this.redis.rpop('es-sync:dlq');
        if (!entry) break;

        try {
          const dlqEntry = JSON.parse(entry);
          
          // Retry the failed operation
          await this.handleChange(dlqEntry.change);
          
          this.contextLogger.info('Successfully reprocessed DLQ entry', {
            changeId: dlqEntry.change._id
          });
          
        } catch (retryError) {
          this.contextLogger.error('Failed to reprocess DLQ entry', retryError as Error);
          
          // Put back in queue with incremented retry count
          const dlqEntry = JSON.parse(entry);
          dlqEntry.retryCount = (dlqEntry.retryCount || 0) + 1;
          
          if (dlqEntry.retryCount < 3) {
            await this.redis.lpush('es-sync:dlq', JSON.stringify(dlqEntry));
          } else {
            this.contextLogger.warn('Max retries exceeded for DLQ entry', {
              changeId: dlqEntry.change._id
            });
          }
        }
      }
    } catch (error) {
      this.contextLogger.error('Error processing dead letter queue', error as Error);
    }
  }

  // Get sync status
  public async getSyncStatus(): Promise<any> {
    try {
      const [eventsProcessed, lastProcessed, dlqLength] = await Promise.all([
        this.redis.get('es-sync:events-processed'),
        this.redis.get('es-sync:last-processed'),
        this.redis.llen('es-sync:dlq')
      ]);

      return {
        isRunning: this.isRunning,
        eventsProcessed: parseInt(eventsProcessed || '0', 10),
        lastProcessed: lastProcessed ? new Date(parseInt(lastProcessed, 10)) : null,
        dlqLength: dlqLength,
        reconnectAttempts: this.reconnectAttempts
      };
    } catch (error) {
      this.contextLogger.error('Failed to get sync status', error as Error);
      return {
        isRunning: this.isRunning,
        error: error.message
      };
    }
  }

  // Manual reindex operation
  public async reindexTenant(tenantId: string): Promise<void> {
    this.contextLogger.info('Starting manual reindex for tenant', { tenantId });

    try {
      // Find all published content for the tenant
      const contents = await Content.find({
        tenantId,
        status: 'published',
        deleted: false
      }).populate('categoryId');

      const documents = [];
      for (const content of contents) {
        let categoryInfo = null;
        if (content.categoryId) {
          const category = await Category.findById(content.categoryId);
          if (category) {
            categoryInfo = {
              id: category.id,
              name: category.name,
              path: await category.getFullPath()
            };
          }
        }

        documents.push({
          id: content._id,
          body: {
            id: content._id,
            tenant_id: content.tenantId,
            title: content.title,
            description: content.description,
            content_type: content.contentType,
            status: content.status,
            version: content.version,
            category: categoryInfo,
            tags: content.tags || [],
            metadata: content.metadata || {},
            file_info: content.fileInfo,
            created_by: content.createdBy,
            created_at: content.createdAt,
            updated_at: content.updatedAt,
            published_at: content.publishedAt,
            view_count: content.metadata?.viewCount || 0,
            engagement_score: content.metadata?.engagementScore || 0.0
          }
        });
      }

      // Bulk index documents
      if (documents.length > 0) {
        await this.esService.bulkIndex(documents, tenantId);
      }

      this.contextLogger.info('Manual reindex completed', {
        tenantId,
        documentsIndexed: documents.length
      });

    } catch (error) {
      this.contextLogger.error('Manual reindex failed', error as Error, { tenantId });
      throw error;
    }
  }
}
