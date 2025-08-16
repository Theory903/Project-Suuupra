import client from 'prom-client';
import { logger } from './logger';

// Create a Registry to register the metrics
export const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics for Content Service
export const httpRequestsTotal = new client.Counter({
  name: 'content_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  registers: [register]
});

export const httpRequestDuration = new client.Histogram({
  name: 'content_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register]
});

export const contentOperationsTotal = new client.Counter({
  name: 'content_operations_total',
  help: 'Total number of content operations',
  labelNames: ['operation', 'content_type', 'status', 'tenant_id'],
  registers: [register]
});

export const uploadOperationsTotal = new client.Counter({
  name: 'content_uploads_total',
  help: 'Total number of upload operations',
  labelNames: ['operation', 'status', 'tenant_id'],
  registers: [register]
});

export const uploadDuration = new client.Histogram({
  name: 'content_upload_duration_seconds',
  help: 'Duration of upload operations in seconds',
  labelNames: ['operation', 'tenant_id'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
  registers: [register]
});

export const uploadFileSize = new client.Histogram({
  name: 'content_upload_file_size_bytes',
  help: 'Size of uploaded files in bytes',
  labelNames: ['content_type', 'tenant_id'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600, 1073741824, 10737418240],
  registers: [register]
});

export const searchQueriesTotal = new client.Counter({
  name: 'content_search_queries_total',
  help: 'Total number of search queries',
  labelNames: ['query_type', 'tenant_id'],
  registers: [register]
});

export const searchDuration = new client.Histogram({
  name: 'content_search_duration_seconds',
  help: 'Duration of search queries in seconds',
  labelNames: ['query_type', 'tenant_id'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register]
});

export const searchResultsCount = new client.Histogram({
  name: 'content_search_results_count',
  help: 'Number of search results returned',
  labelNames: ['query_type', 'tenant_id'],
  buckets: [0, 1, 5, 10, 20, 50, 100, 200, 500],
  registers: [register]
});

export const elasticsearchSyncEvents = new client.Counter({
  name: 'content_elasticsearch_sync_events_total',
  help: 'Total number of Elasticsearch sync events',
  labelNames: ['operation', 'status', 'tenant_id'],
  registers: [register]
});

export const elasticsearchSyncLag = new client.Gauge({
  name: 'content_elasticsearch_sync_lag_seconds',
  help: 'Elasticsearch sync lag in seconds',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const indexingDLQTotal = new client.Counter({
  name: 'content_indexing_dlq_total',
  help: 'Total number of items added to the indexing DLQ',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const websocketConnections = new client.Gauge({
  name: 'content_websocket_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const websocketMessages = new client.Counter({
  name: 'content_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['message_type', 'direction', 'tenant_id'],
  registers: [register]
});

export const databaseConnections = new client.Gauge({
  name: 'content_database_connections',
  help: 'Number of database connections',
  labelNames: ['database', 'state'],
  registers: [register]
});

export const databaseQueryDuration = new client.Histogram({
  name: 'content_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['collection', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register]
});

export const cacheOperations = new client.Counter({
  name: 'content_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'],
  registers: [register]
});

export const jobsProcessed = new client.Counter({
  name: 'content_jobs_processed_total',
  help: 'Total number of background jobs processed',
  labelNames: ['job_type', 'status'],
  registers: [register]
});

export const jobDuration = new client.Histogram({
  name: 'content_job_duration_seconds',
  help: 'Duration of background jobs in seconds',
  labelNames: ['job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
  registers: [register]
});

export const contentByStatus = new client.Gauge({
  name: 'content_by_status',
  help: 'Number of content items by status',
  labelNames: ['status', 'content_type', 'tenant_id'],
  registers: [register]
});

export const contentByType = new client.Gauge({
  name: 'content_by_type',
  help: 'Number of content items by type',
  labelNames: ['content_type', 'tenant_id'],
  registers: [register]
});

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode.toString();
    const tenantId = req.user?.tenantId || 'unknown';
    
    // Record metrics
    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
      tenant_id: tenantId
    });
    
    httpRequestDuration.observe({
      method,
      route,
      status_code: statusCode,
      tenant_id: tenantId
    }, duration);
  });
  
  next();
};

// Helper functions for recording metrics
export const recordContentOperation = (
  operation: string,
  contentType: string,
  status: string,
  tenantId: string
) => {
  contentOperationsTotal.inc({
    operation,
    content_type: contentType,
    status,
    tenant_id: tenantId
  });
};

export const recordUploadOperation = (
  operation: string,
  status: string,
  tenantId: string,
  duration?: number,
  fileSize?: number,
  contentType?: string
) => {
  uploadOperationsTotal.inc({
    operation,
    status,
    tenant_id: tenantId
  });
  
  if (duration) {
    uploadDuration.observe({
      operation,
      tenant_id: tenantId
    }, duration);
  }
  
  if (fileSize && contentType) {
    uploadFileSize.observe({
      content_type: contentType,
      tenant_id: tenantId
    }, fileSize);
  }
};

export const recordSearchOperation = (
  queryType: string,
  tenantId: string,
  duration: number,
  resultCount: number
) => {
  searchQueriesTotal.inc({
    query_type: queryType,
    tenant_id: tenantId
  });
  
  searchDuration.observe({
    query_type: queryType,
    tenant_id: tenantId
  }, duration);
  
  searchResultsCount.observe({
    query_type: queryType,
    tenant_id: tenantId
  }, resultCount);
};

export const recordElasticsearchSync = (
  operation: string,
  status: string,
  tenantId: string,
  lag?: number
) => {
  elasticsearchSyncEvents.inc({
    operation,
    status,
    tenant_id: tenantId
  });
  
  if (lag !== undefined) {
    elasticsearchSyncLag.set({
      tenant_id: tenantId
    }, lag);
  }
};

export const recordWebSocketActivity = (
  messageType: string,
  direction: 'in' | 'out',
  tenantId: string
) => {
  websocketMessages.inc({
    message_type: messageType,
    direction,
    tenant_id: tenantId
  });
};

export const updateWebSocketConnections = (tenantId: string, count: number) => {
  websocketConnections.set({
    tenant_id: tenantId
  }, count);
};

export const recordDatabaseQuery = (
  collection: string,
  operation: string,
  duration: number
) => {
  databaseQueryDuration.observe({
    collection,
    operation
  }, duration);
};

export const recordCacheOperation = (operation: string, result: 'hit' | 'miss') => {
  cacheOperations.inc({
    operation,
    result
  });
};

export const recordIndexingDLQ = (tenantId: string) => {
  indexingDLQTotal.inc({ tenant_id: tenantId });
};

export const recordJobProcessing = (
  jobType: string,
  status: 'success' | 'failure',
  duration?: number
) => {
  jobsProcessed.inc({
    job_type: jobType,
    status
  });
  
  if (duration) {
    jobDuration.observe({
      job_type: jobType
    }, duration);
  }
};

// Update content statistics
export const updateContentStatistics = async () => {
  try {
    const { Content } = await import('@/models/Content');
    
    // Get content counts by status and type
    const pipeline = [
      {
        $match: { deleted: false }
      },
      {
        $group: {
          _id: {
            status: '$status',
            contentType: '$contentType',
            tenantId: '$tenantId'
          },
          count: { $sum: 1 }
        }
      }
    ];
    
    const results = await Content.aggregate(pipeline);
    
    // Reset gauges
    contentByStatus.reset();
    contentByType.reset();
    
    // Update metrics
    results.forEach((result: any) => {
      const { status, contentType, tenantId } = result._id;
      const count = result.count;
      
      contentByStatus.set({
        status,
        content_type: contentType,
        tenant_id: tenantId
      }, count);
      
      contentByType.set({
        content_type: contentType,
        tenant_id: tenantId
      }, count);
    });
    
  } catch (error) {
    logger.error('Failed to update content statistics', error as Error);
  }
};

// Initialize metrics collection
export const initializeMetrics = () => {
  logger.info('Initializing metrics collection...');
  
  // Update content statistics every 5 minutes
  setInterval(updateContentStatistics, 5 * 60 * 1000);
  
  // Initial statistics update
  updateContentStatistics();
  
  logger.info('Metrics collection initialized');
};
