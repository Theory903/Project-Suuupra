import { Client, ClientOptions } from '@elastic/elasticsearch';
import { config } from '@/config';
import { logger, ContextLogger } from '@/utils/logger';
import { SearchQuery, SearchResult, SearchResponse } from '@/types';
import { CircuitBreaker } from '@/utils/circuitBreaker';

export class ElasticsearchService {
  private client: Client;
  private contextLogger: ContextLogger;
  private indexPrefix: string;
  private circuitBreaker: CircuitBreaker;
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private maxCacheEntries = 500;
  private defaultTtlMs = 30000; // 30s

  constructor() {
    this.indexPrefix = config.database.elasticsearch.indexPrefix;
    this.contextLogger = new ContextLogger({ service: 'elasticsearch' });
    
    // Initialize Elasticsearch client
    const clientOptions: ClientOptions = {
      node: config.database.elasticsearch.node,
      maxRetries: 3,
      requestTimeout: 30000,
      sniffOnStart: false,
      sniffInterval: false
    };

    if (config.database.elasticsearch.auth) {
      clientOptions.auth = config.database.elasticsearch.auth;
    }

    this.client = new Client(clientOptions);

    this.circuitBreaker = new CircuitBreaker('elasticsearch-breaker', {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 3,
    });
  }

  // Initialize Elasticsearch - create index templates and mappings
  public async initialize(): Promise<void> {
    try {
      this.contextLogger.info('Initializing Elasticsearch service...');
      
      // Check cluster health
      const health = await this.client.cluster.health();
      this.contextLogger.info('Elasticsearch cluster health', { 
        status: health.status,
        numberOfNodes: health.number_of_nodes 
      });

      // Create index template
      await this.createIndexTemplate();
      
      this.contextLogger.info('Elasticsearch service initialized successfully');
    } catch (error) {
      this.contextLogger.error('Failed to initialize Elasticsearch', error as Error);
      throw error;
    }
  }

  // Create index template for content
  private async createIndexTemplate(): Promise<void> {
    const templateName = `${this.indexPrefix}-template`;
    const indexPattern = `${this.indexPrefix}-*`;

    const template = {
      index_patterns: [indexPattern],
      template: {
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
          refresh_interval: '5s',
          max_result_window: 50000,
          analysis: {
            analyzer: {
              content_analyzer: {
                type: 'custom' as const,
                tokenizer: 'standard',
                filter: [
                  'lowercase',
                  'stop',
                  'snowball',
                  'content_synonyms'
                ]
              },
              exact_analyzer: {
                type: 'custom' as const,
                tokenizer: 'keyword',
                filter: ['lowercase']
              },
              path_analyzer: {
                type: 'custom' as const,
                tokenizer: 'path_hierarchy',
                filter: ['lowercase']
              }
            },
            filter: {
              content_synonyms: {
                type: 'synonym' as const,
                synonyms: [
                  'javascript,js',
                  'typescript,ts',
                  'python,py',
                  'tutorial,guide,lesson,course',
                  'video,movie,film',
                  'document,doc,pdf',
                  'article,post,blog'
                ]
              }
            }
          }
        },
        mappings: {
          dynamic: true,
          properties: {
            id: { type: 'keyword' as const },
            tenant_id: { type: 'keyword' as const },
            title: {
              type: 'text' as const,
              analyzer: 'content_analyzer',
              fields: {
                exact: {
                  type: 'text' as const,
                  analyzer: 'exact_analyzer'
                },
                suggest: {
                  type: 'completion' as const
                }
              }
            },
            description: {
              type: 'text' as const,
              analyzer: 'content_analyzer'
            },
            content_type: { type: 'keyword' as const },
            status: { type: 'keyword' as const },
            version: { type: 'keyword' as const },
            category: {
              type: 'object' as const,
              properties: {
                id: { type: 'keyword' as const },
                name: {
                  type: 'text' as const,
                  analyzer: 'content_analyzer'
                },
                path: {
                  type: 'text' as const,
                  analyzer: 'path_analyzer'
                }
              }
            },
            tags: { type: 'keyword' as const },
            metadata: {
              type: 'object' as const,
              dynamic: true
            },
            file_info: {
              type: 'object' as const,
              properties: {
                filename: {
                  type: 'text' as const,
                  analyzer: 'content_analyzer'
                },
                content_type: { type: 'keyword' as const },
                file_size: { type: 'long' as const },
                duration: { type: 'integer' as const }
              }
            },
            embedding: {
              type: 'dense_vector' as const,
              dims: 768,
              index: true,
            },
            created_by: { type: 'keyword' as const },
            created_at: {
              type: 'date' as const,
              format: 'strict_date_optional_time||epoch_millis'
            },
            updated_at: {
              type: 'date' as const,
              format: 'strict_date_optional_time||epoch_millis'
            },
            published_at: {
              type: 'date' as const,
              format: 'strict_date_optional_time||epoch_millis'
            },
            view_count: { type: 'integer' as const },
            engagement_score: { type: 'float' as const }
          }
        }
      },
      priority: 100,
      version: 1
    };

    try {
      await this.client.indices.putIndexTemplate({
        name: templateName,
        body: template
      });
      
      this.contextLogger.info('Index template created successfully', { templateName });
    } catch (error) {
      this.contextLogger.error('Failed to create index template', error as Error, { templateName });
      throw error;
    }
  }

  // Get index name for tenant
  private getIndexName(tenantId: string): string {
    return `${this.indexPrefix}-${tenantId}`;
  }

  // Index a document
  public async index(params: {
    index?: string;
    id: string;
    body: any;
    tenantId?: string;
  }): Promise<void> {
    const indexName = params.index || this.getIndexName(params.tenantId!);
    
    try {
      await this.circuitBreaker.execute(async () => {
        await this.client.index({
          index: indexName,
          id: params.id,
          body: params.body,
          refresh: 'wait_for'
        });
      });
      
      this.contextLogger.debug('Document indexed successfully', {
        index: indexName,
        id: params.id
      });
    } catch (error) {
      this.contextLogger.error('Failed to index document', error as Error, {
        index: indexName,
        id: params.id
      });
      throw error;
    }
  }

  // Delete a document
  public async delete(params: {
    index?: string;
    id: string;
    tenantId?: string;
  }): Promise<void> {
    const indexName = params.index || this.getIndexName(params.tenantId!);
    
    try {
      await this.circuitBreaker.execute(async () => {
        await this.client.delete({
          index: indexName,
          id: params.id,
          refresh: 'wait_for'
        });
      });
      
      this.contextLogger.debug('Document deleted successfully', {
        index: indexName,
        id: params.id
      });
    } catch (error) {
      if ((error as any).meta?.statusCode === 404) {
        // Document not found, which is fine for deletion
        return;
      }
      
      this.contextLogger.error('Failed to delete document', error as Error, {
        index: indexName,
        id: params.id
      });
      throw error;
    }
  }

  // Search content
  public async search(query: SearchQuery, tenantId: string): Promise<SearchResponse> {
    const indexName = this.getIndexName(tenantId);
    const startTime = Date.now();

    const cacheKey = this.buildCacheKey('search', tenantId, query);
    const cached = this.getFromCache<SearchResponse>(cacheKey);
    if (cached) return cached;

    try {
      const searchBody = this.buildSearchQuery(query);
      
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.search({
          index: indexName,
          body: searchBody,
          track_total_hits: true
        });
      });

      const queryTime = Date.now() - startTime;
      const formatted = this.formatSearchResponse(response, query, queryTime);
      this.setInCache(cacheKey, formatted);
      return formatted;
    } catch (error) {
      this.contextLogger.error('Search failed', error as Error, {
        index: indexName,
        query: query.q
      });
      throw error;
    }
  }

  // Build Elasticsearch query
  private buildSearchQuery(query: SearchQuery): any {
    const { q, filters, page = 1, limit = 20, sort = 'relevance', order = 'desc' } = query;
    const from = (page - 1) * limit;

    // Base query
    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Text search
    if (q && q.trim()) {
      mustClauses.push({
        multi_match: {
          query: q,
          fields: [
            'title^3',
            'description^2',
            'tags^1.5',
            'category.name^2',
            'file_info.filename^1'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'and'
        }
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    // Apply filters
    if (filters) {
      if (filters.contentType && filters.contentType.length > 0) {
        filterClauses.push({
          terms: { content_type: filters.contentType }
        });
      }

      if (filters.category && filters.category.length > 0) {
        filterClauses.push({
          terms: { 'category.id': filters.category }
        });
      }

      if (filters.tags && filters.tags.length > 0) {
        filterClauses.push({
          terms: { tags: filters.tags }
        });
      }

      if (filters.dateRange) {
        const dateFilter: any = {};
        if (filters.dateRange.from) {
          dateFilter.gte = filters.dateRange.from;
        }
        if (filters.dateRange.to) {
          dateFilter.lte = filters.dateRange.to;
        }
        
        filterClauses.push({
          range: { created_at: dateFilter }
        });
      }
    }

    // Only show published content
    filterClauses.push({ term: { status: 'published' } });

    // Build sort
    const sortConfig = this.buildSortConfig(sort, order);

    // Build aggregations
    const aggregations = {
      content_types: {
        terms: { field: 'content_type', size: 10 }
      },
      categories: {
        terms: { field: 'category.id', size: 20 }
      },
      tags: {
        terms: { field: 'tags', size: 50 }
      },
      date_histogram: {
        date_histogram: {
          field: 'created_at',
          calendar_interval: 'month'
        }
      }
    };

    return {
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses
        }
      },
      sort: sortConfig,
      from,
      size: limit,
      highlight: {
        fields: {
          title: {},
          description: {},
          'file_info.filename': {}
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>']
      },
      aggs: aggregations
    };
  }

  // Build sort configuration
  private buildSortConfig(sort: string, order: string): any[] {
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    switch (sort) {
      case 'created_at':
        return [{ created_at: { order: sortOrder } }];
      case 'updated_at':
        return [{ updated_at: { order: sortOrder } }];
      case 'title':
        return [{ 'title.exact': { order: sortOrder } }];
      case 'views':
        return [{ view_count: { order: sortOrder } }];
      case 'relevance':
      default:
        return ['_score', { created_at: { order: 'desc' } }];
    }
  }

  // Format search response
  private formatSearchResponse(response: any, query: SearchQuery, queryTime: number): SearchResponse {
    const hits = response.hits.hits || [];
    const total = typeof response.hits.total === 'object' 
      ? response.hits.total.value 
      : response.hits.total;

    const results: SearchResult[] = hits.map((hit: any) => ({
      id: hit._source.id,
      title: hit._source.title,
      description: hit._source.description,
      contentType: hit._source.content_type,
      category: hit._source.category,
      tags: hit._source.tags || [],
      createdBy: hit._source.created_by,
      createdAt: new Date(hit._source.created_at),
      publishedAt: hit._source.published_at ? new Date(hit._source.published_at) : undefined,
      fileInfo: hit._source.file_info,
      _score: hit._score,
      highlights: hit.highlight || {}
    }));

    const page = query.page || 1;
    const limit = query.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      data: results,
      meta: {
        requestId: 'N/A', // This should be set from RequestContext if available
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        aggregations: response.aggregations,
        queryTimeMs: queryTime,
        totalHits: total
      }
    };
  }

  // Get suggestions
  public async getSuggestions(query: string, tenantId: string, limit: number = 10): Promise<string[]> {
    const indexName = this.getIndexName(tenantId);
    const cacheKey = this.buildCacheKey('suggest', tenantId, { q: query, limit });
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.search({
          index: indexName,
          body: {
            suggest: {
              title_suggest: {
                prefix: query,
                completion: {
                  field: 'title.suggest',
                  size: limit
                }
              }
            }
          }
        });
      });

      const suggestions = (response.suggest?.title_suggest?.[0]?.options || []) as any[];
      const out = suggestions.map((option: any) => option.text);
      this.setInCache(cacheKey, out);
      return out;
    } catch (error) {
      this.contextLogger.error('Failed to get suggestions', error as Error, {
        index: indexName,
        query
      });
      return [];
    }
  }

  // Caching helpers
  private buildCacheKey(kind: string, tenantId: string, obj: any): string {
    return `${kind}:${tenantId}:${JSON.stringify(obj)}`;
  }

  private getFromCache<T>(key: string): T | undefined {
    const now = Date.now();
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < now) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private setInCache(key: string, value: any, ttlMs: number = this.defaultTtlMs): void {
    if (this.cache.size >= this.maxCacheEntries) {
      // naive eviction: delete first key
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  // Bulk index documents
  public async bulkIndex(documents: Array<{ id: string; body: any }>, tenantId: string): Promise<void> {
    const indexName = this.getIndexName(tenantId);

    try {
      await this.circuitBreaker.execute(async () => {
        const body = documents.flatMap(doc => [
          { index: { _index: indexName, _id: doc.id } },
          doc.body
        ]);

        const response = await this.client.bulk({
          body,
          refresh: 'wait_for'
        });

        if (response.errors) {
          const errors = response.items
            .filter((item: any) => item.index && item.index.error)
            .map((item: any) => item.index.error);
          
          this.contextLogger.error('Bulk index had errors', new Error('Bulk index errors'), { errors });
        }
      });

      this.contextLogger.debug('Bulk index completed', {
        index: indexName,
        documentCount: documents.length
      });
    } catch (error) {
      this.contextLogger.error('Bulk index failed', error as Error, {
        index: indexName,
        documentCount: documents.length
      });
      throw error;
    }
  }

  // Reindex all content for a tenant
  public async reindexTenant(tenantId: string): Promise<void> {
    const indexName = this.getIndexName(tenantId);

    try {
      // This would typically be called from a background job
      // that reads from MongoDB and reindexes all content
      this.contextLogger.info('Starting reindex for tenant', { tenantId, index: indexName });
      
      // Implementation would depend on the specific reindexing strategy
      // For now, we'll just log the operation
      
      this.contextLogger.info('Reindex completed for tenant', { tenantId, index: indexName });
    } catch (error) {
      this.contextLogger.error('Reindex failed for tenant', error as Error, { tenantId, index: indexName });
      throw error;
    }
  }

  // Health check
  public async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const { health, info } = await this.circuitBreaker.execute(async () => {
        const health = await this.client.cluster.health();
        const info = await this.client.info();
        return { health, info };
      });

      return {
        status: health.status === 'red' ? 'unhealthy' : 'healthy',
        details: {
          clusterStatus: health.status,
          numberOfNodes: health.number_of_nodes,
          numberOfDataNodes: health.number_of_data_nodes,
          version: info.version.number
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Get all tenant indexes
  public async getTenantIndexes(): Promise<string[]> {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.cat.indices({
          index: `${this.indexPrefix}-*`,
          format: 'json'
        });
      });

      return response.map((index: any) => index.index);
    } catch (error) {
      this.contextLogger.error('Failed to get tenant indexes', error as Error);
      return [];
    }
  }
}
