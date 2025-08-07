/**
 * What: API Gateway entrypoint server with World-Class Logging
 * Why: Wires Fastify to the modular gateway pipeline with structured logging, OpenTelemetry, and observability
 * How: Uses Suuupra Global Logger with wide events, distributed tracing, and multi-language support
 */

import fastify from 'fastify';
import jwt from '@fastify/jwt';
import { randomUUID } from 'crypto';
import { createLogger, LogLevel } from '../../../shared/libs/logging/node';
import { OpenTelemetryManager, SpanStatusCode } from '../../../shared/libs/logging/observability/opentelemetry';
// Type extensions are loaded automatically via tsconfig

declare const require: any;
let obs: any = {};
try { obs = require('../../../shared/libs/node/observability'); } catch {}
const { exposeMetricsRoute, httpRequestDuration, httpRequestsTotal, httpServerErrorsTotal } = obs;
import type { IncomingMessage } from 'http';
import { handleGatewayProxy } from './services';
import { registerAdminRoutes, initializeConfigManager } from './admin/api';
import { gatewayConfig } from './config/gatewayConfig';

// Initialize world-class logger with best practices
const logger = createLogger({
  service: 'api-gateway',
  version: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  level: process.env.LOG_LEVEL ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] : LogLevel.INFO,
  format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  security: {
    maskPII: true,
    encryptLogs: false,
  },
  openTelemetry: {
    enabled: true,
  },
  performance: {
    async: true,
    bufferSize: 1000,
    flushInterval: 5000,
  },
});

// Initialize OpenTelemetry for distributed tracing and metrics
const otelManager = new OpenTelemetryManager({
  serviceName: 'api-gateway',
  serviceVersion: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  tracing: {
    enabled: true,
    otlp: {
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    },
  },
  metrics: {
    enabled: true,
    prometheus: {
      port: 9091, // Different port to avoid conflicts
      endpoint: '/otel-metrics',
    },
  },
});

const app = fastify({ 
  logger: false, // Disable Fastify's built-in logger to use our global logger
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
  genReqId: () => randomUUID(),
});
const port = Number(process.env.PORT || 8080);

// Optional JWT plugin (enabled if secret provided)
if (process.env.JWT_SECRET) {
  app.register(jwt, { secret: process.env.JWT_SECRET });
}

// Logging middleware with request correlation
app.addHook('onRequest', async (req, reply) => {
  const requestId = Array.isArray(req.headers['x-request-id']) 
    ? req.headers['x-request-id'][0] 
    : req.headers['x-request-id'] || req.id;
  const traceContext = otelManager.getCurrentTraceContext();
  
  // Create request logger with context
  (req as any).logger = logger.withRequestId(requestId).withContext({
    traceId: traceContext?.traceId,
    spanId: traceContext?.spanId,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    method: req.method,
    url: req.url,
  });

  // Set response headers
  reply.header('x-request-id', requestId);
  if (traceContext) {
    reply.header('x-trace-id', traceContext.traceId);
  }

  // CORS headers
  reply.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-tenant-id, x-correlation-id, x-request-id');
  reply.header('Access-Control-Allow-Credentials', 'true');

  // Log incoming request
  (req as any).logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
  });
});

// Response logging
app.addHook('onResponse', async (req, reply) => {
  const duration = (reply as any).elapsedTime ?? reply.getResponseTime?.();
  
  if ((req as any).logger) {
    (req as any).logger.info('Request completed', {
      statusCode: reply.statusCode,
      duration,
      contentLength: reply.getHeader('content-length'),
    });

    // Record metrics
    otelManager.recordDuration('http_request', duration, {
      method: req.method,
      status_code: reply.statusCode.toString(),
      route: (req as any).routeOptions?.url || req.url,
    });
  }
});

// Error logging
app.addHook('onError', async (req, reply, error) => {
  if ((req as any).logger) {
    (req as any).logger.error('Request error', error, {
      statusCode: reply.statusCode,
      method: req.method,
      url: req.url,
    });
  }
});

app.options('*', async (_req, reply) => { reply.status(204).send(); });

// Initialize config manager
initializeConfigManager(gatewayConfig);

// Metrics endpoint
exposeMetricsRoute(app, 'api-gateway');

app.get('/healthz', async (req, reply) => {
  const healthData = { 
    ok: true, 
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
  };
  
  logger.debug('Health check', healthData);
  return healthData;
});

// Register admin API if enabled
if (gatewayConfig.admin.apiEnabled) {
  registerAdminRoutes(app);
}

// Wildcard proxy route: /:service/* → matched/forwarded in handleGatewayProxy
app.all<{ Params: { service: string } }>('/:service/*', async (request, reply) => {
  const timer = (request as any).logger.startTimer('gateway_proxy_operation');
  const endTimer = httpRequestDuration?.startTimer?.({ service: 'api-gateway', route: '/:service/*', method: request.method });
  
  try {
    // Create span for this operation
    const span = otelManager.createHttpSpan(request.method, request.url, {
      'gateway.operation': 'proxy',
      'gateway.service': request.params.service,
    });

    (request as any).logger.info('Proxying request', {
      targetService: request.params.service,
      operation: 'proxy',
      path: request.url,
    });

    const { response, correlationId } = await handleGatewayProxy(request);

    // Forward status and headers
    const status = response.statusCode || 200;
    reply.header('x-correlation-id', correlationId);
    const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade']);
    const headers = (response.headers || {}) as Record<string, any>;
    for (const [k, v] of Object.entries(headers)) {
      if (!hopByHop.has(k.toLowerCase())) reply.header(k, v as any);
    }
    const routeId = String((headers['x-gateway-route-id'] as any) || 'unknown');
    reply.status(status);
    reply.send(response as unknown as IncomingMessage);

    // Log successful proxy operation
    const duration = timer.end({
      success: true,
      targetService: request.params.service,
      statusCode: status,
      routeId,
    });

    // Wide event logging for proxy operation
    (request as any).logger.info('Gateway proxy completed', {
      eventType: 'gateway_proxy',
      targetService: request.params.service,
      routeId,
      statusCode: status,
      duration,
      success: true,
    });

    // Set span status
    otelManager.setSpanStatus(span, status >= 400 ? 'ERROR' : 'INFO', 'Gateway proxy completed');
    span.setAttributes({
      'http.status_code': status,
      'gateway.route_id': routeId,
      'gateway.duration_ms': duration,
    });
    span.end();

    httpRequestsTotal?.inc?.({ service: 'api-gateway', route: routeId, method: request.method, status: String(status) });
    endTimer?.({ status: String(status) });

  } catch (err: any) {
    const statusCode = err?.statusCode || 502;
    
    // Log error with context
    (request as any).logger.error('Gateway proxy failed', err, {
      targetService: request.params.service,
      statusCode,
      operation: 'proxy',
      errorType: err?.constructor?.name || 'UnknownError',
    });

    // Security logging for potential attacks
    if (statusCode === 404 || statusCode === 403) {
      (request as any).logger.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'medium',
        ip: request.ip,
        details: {
          requestedService: request.params.service,
          path: request.url,
          userAgent: request.headers['user-agent'],
          statusCode,
        },
      });
    }

    const duration = timer.end({
      success: false,
      error: true,
      targetService: request.params.service,
      statusCode,
    });

    reply.status(statusCode).send({ 
      error: 'Gateway Error', 
      message: err?.message || 'Upstream request failed',
      requestId: request.headers['x-request-id'] || request.id,
    });

    httpRequestsTotal?.inc?.({ service: 'api-gateway', route: 'error', method: request.method, status: String(statusCode) });
    httpServerErrorsTotal?.inc?.({ service: 'api-gateway', route: 'error' });
    endTimer?.({ status: String(statusCode) });
  }
});

export async function start() {
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info('API Gateway started successfully', {
      port,
      host: '0.0.0.0',
      service: 'api-gateway',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: {
        openTelemetry: true,
        structuredLogging: true,
        distributedTracing: true,
        metrics: true,
      },
    });
  } catch (error) {
    logger.fatal('Failed to start API Gateway', error as Error, {
      port,
      host: '0.0.0.0',
    });
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info('Received shutdown signal, gracefully shutting down', { signal });
  
  try {
    await app.close();
    await logger.flush();
    await otelManager.shutdown();
    
    logger.info('API Gateway shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Allow direct run
if (require.main === module) {
  start().catch((e) => {
    logger.fatal('Failed to start API Gateway', e as Error);
    process.exit(1);
  });
}


