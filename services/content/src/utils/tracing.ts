import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { config } from '@/config';
import { logger } from './logger';

// Initialize OpenTelemetry SDK
let sdk: NodeSDK | null = null;

export const initializeTracing = () => {
  try {
    logger.info('Initializing OpenTelemetry tracing...');

    // Create resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.service.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'suuupra',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.service.environment,
    });

    // Configure exporters
    const exporters: any[] = [];
    
    // Jaeger exporter (if configured)
    if (config.observability.jaegerEndpoint) {
      exporters.push(new JaegerExporter({
        endpoint: config.observability.jaegerEndpoint,
      }));
    }
    
    // OTLP exporter (default)
    exporters.push(new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }));

    // Create SDK
    const primaryExporter = exporters[0] || new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

    sdk = new (NodeSDK as any)({
      resource,
      spanProcessor: new (BatchSpanProcessor as any)(primaryExporter),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable file system instrumentation for performance
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span: any, request: any) => {
              span.setAttributes({
                'http.request.header.user-agent': request.headers['user-agent'] || '',
                'http.request.header.x-tenant-id': request.headers['x-tenant-id'] || '',
              });
            },
          },
          '@opentelemetry/instrumentation-mongodb': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    if (sdk) {
      (sdk as any).start();
    }
    
    logger.info('OpenTelemetry tracing initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry tracing:', error);
  }
};

export const shutdownTracing = async () => {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry tracing shut down successfully');
    } catch (error) {
      logger.error('Error shutting down OpenTelemetry tracing:', error);
    }
  }
};

// Tracer instance
const tracer = trace.getTracer(config.service.serviceName, process.env.npm_package_version || '1.0.0');

// Helper functions for manual instrumentation
export const createSpan = (
  name: string,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
    parent?: any;
  } = {}
) => {
  const span = tracer.startSpan(name, {
    kind: options.kind || SpanKind.INTERNAL,
    attributes: options.attributes || {},
  } as any, options.parent);
  
  return span;
};

export const withSpan = async <T>(
  name: string,
  fn: (span: any) => Promise<T>,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> => {
  const span = createSpan(name, options);
  
  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    
    if (error instanceof Error) {
      span.recordException(error);
    }
    
    throw error;
  } finally {
    span.end();
  }
};

// Content-specific tracing helpers
export const traceContentOperation = async <T>(
  operation: string,
  contentId: string,
  tenantId: string,
  fn: (span: any) => Promise<T>
): Promise<T> => {
  return withSpan(`content.${operation}`, fn, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'content.id': contentId,
      'content.operation': operation,
      'tenant.id': tenantId,
    },
  });
};

export const traceUploadOperation = async <T>(
  operation: string,
  uploadId: string,
  contentId: string,
  tenantId: string,
  fn: (span: any) => Promise<T>
): Promise<T> => {
  return withSpan(`upload.${operation}`, fn, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'upload.id': uploadId,
      'upload.operation': operation,
      'content.id': contentId,
      'tenant.id': tenantId,
    },
  });
};

export const traceSearchOperation = async <T>(
  query: string,
  tenantId: string,
  fn: (span: any) => Promise<T>
): Promise<T> => {
  return withSpan('search.query', fn, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'search.query': query,
      'tenant.id': tenantId,
    },
  });
};

export const traceDatabaseOperation = async <T>(
  collection: string,
  operation: string,
  fn: (span: any) => Promise<T>
): Promise<T> => {
  return withSpan(`db.${collection}.${operation}`, fn, {
    kind: SpanKind.CLIENT,
    attributes: {
      'db.system': 'mongodb',
      'db.collection.name': collection,
      'db.operation': operation,
    },
  });
};

export const traceElasticsearchOperation = async <T>(
  index: string,
  operation: string,
  fn: (span: any) => Promise<T>
): Promise<T> => {
  return withSpan(`elasticsearch.${operation}`, fn, {
    kind: SpanKind.CLIENT,
    attributes: {
      'db.system': 'elasticsearch',
      'elasticsearch.index': index,
      'elasticsearch.operation': operation,
    },
  });
};

export const traceS3Operation = async <T>(
  bucket: string,
  key: string,
  operation: string,
  fn: (span: any) => Promise<T>
): Promise<T> => {
  return withSpan(`s3.${operation}`, fn, {
    kind: SpanKind.CLIENT,
    attributes: {
      'aws.s3.bucket': bucket,
      'aws.s3.key': key,
      'aws.s3.operation': operation,
    },
  });
};

export const traceWebSocketOperation = async <T>(
  event: string,
  userId: string,
  tenantId: string,
  fn: (span: any) => Promise<T>
): Promise<T> => {
  return withSpan(`websocket.${event}`, fn, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'websocket.event': event,
      'user.id': userId,
      'tenant.id': tenantId,
    },
  });
};

// Middleware to add trace context to requests
export const tracingMiddleware = (req: any, res: any, next: any) => {
  const span = trace.getActiveSpan();
  
  if (span && req.user) {
    span.setAttributes({
      'user.id': req.user.userId,
      'tenant.id': req.user.tenantId,
      'request.id': req.requestId || req.user.requestId,
    });
  }
  
  next();
};

// Add trace ID to logs
export const getTraceId = (): string | undefined => {
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    return spanContext.traceId;
  }
  return undefined;
};

// Baggage helpers for passing tenant context
export const setTenantContext = (tenantId: string) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes({
      'tenant.id': tenantId,
    });
  }
};

export const getTenantContext = (): string | undefined => {
  return undefined;
};
