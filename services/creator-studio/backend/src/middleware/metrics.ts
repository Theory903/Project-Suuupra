import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Create metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

const contentMetrics = new Gauge({
  name: 'content_total',
  help: 'Total number of content items',
  labelNames: ['status', 'category'],
});

const creatorMetrics = new Gauge({
  name: 'creators_total',
  help: 'Total number of creators',
  labelNames: ['status', 'plan'],
});

const uploadMetrics = new Counter({
  name: 'uploads_total',
  help: 'Total number of uploads',
  labelNames: ['status', 'file_type'],
});

const processingMetrics = new Gauge({
  name: 'processing_queue_size',
  help: 'Size of processing queues',
  labelNames: ['queue_name'],
});

// Register metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(activeConnections);
register.registerMetric(contentMetrics);
register.registerMetric(creatorMetrics);
register.registerMetric(uploadMetrics);
register.registerMetric(processingMetrics);

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Increment active connections
  activeConnections.inc();

  // Override res.end to capture metrics when request completes
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    
    // Decrement active connections
    activeConnections.dec();

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Helper functions to update business metrics
export const updateContentMetrics = (status: string, category: string, value: number = 1) => {
  contentMetrics.set({ status, category }, value);
};

export const updateCreatorMetrics = (status: string, plan: string, value: number = 1) => {
  creatorMetrics.set({ status, plan }, value);
};

export const incrementUploadMetrics = (status: string, fileType: string) => {
  uploadMetrics.inc({ status, file_type: fileType });
};

export const updateProcessingQueueMetrics = (queueName: string, size: number) => {
  processingMetrics.set({ queue_name: queueName }, size);
};
