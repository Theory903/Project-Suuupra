/**
 * OpenTelemetry Integration for Suuupra Global Logger
 * 
 * Provides seamless integration between structured logging and OpenTelemetry
 * for distributed tracing, metrics, and observability.
 */

// Simplified OpenTelemetry integration - install packages as needed
declare const require: any;

// Optional OpenTelemetry imports - gracefully handle missing packages
let NodeSDK: any = null;
let Resource: any = null;
let trace: any = { getTracer: () => ({ startSpan: () => ({ end: () => {}, setAttributes: () => {}, setStatus: () => {} }) }) };
let context: any = { active: () => ({}), with: (ctx: any, fn: any) => fn() };
let metrics: any = { getMeter: () => ({ createCounter: () => ({ add: () => {} }), createHistogram: () => ({ record: () => {} }), createUpDownCounter: () => ({ add: () => {} }) }) };

try {
  const otelApi = require('@opentelemetry/api');
  trace = otelApi.trace;
  context = otelApi.context;
  metrics = otelApi.metrics;
} catch (e) {
  console.warn('OpenTelemetry API not available, using no-op implementation');
}

// Enum values for compatibility
export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

export enum SpanKind {
  INTERNAL = 0,
  SERVER = 1,
  CLIENT = 2,
  PRODUCER = 3,
  CONSUMER = 4,
}

export interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment: string;
  
  // Tracing Configuration
  tracing?: {
    enabled: boolean;
    endpoint?: string;
    jaeger?: {
      endpoint: string;
    };
    otlp?: {
      endpoint: string;
      headers?: Record<string, string>;
    };
  };
  
  // Metrics Configuration
  metrics?: {
    enabled: boolean;
    prometheus?: {
      port: number;
      endpoint: string;
    };
    otlp?: {
      endpoint: string;
      headers?: Record<string, string>;
    };
  };
  
  // Resource Configuration
  resource?: {
    attributes?: Record<string, string>;
  };
}

export class OpenTelemetryManager {
  private sdk?: any;
  private config: OpenTelemetryConfig;
  private tracer: any;
  private meter: any;
  
  // Metrics
  private logCounter: any;
  private errorCounter: any;
  private durationHistogram: any;
  private activeSpansGauge: any;

  constructor(config: OpenTelemetryConfig) {
    this.config = config;
    this.initializeSDK();
    this.initializeMetrics();
  }

  private initializeSDK(): void {
    // Simplified initialization - no-op if packages not available
    console.log(`Initializing OpenTelemetry for ${this.config.serviceName}`);
    
    // Get tracer and meter (will be no-op if not available)
    this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
    this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);
  }

  private initializeMetrics(): void {
    if (!this.config.metrics?.enabled) return;

    // Log entry counter
    this.logCounter = this.meter.createCounter('suuupra_log_entries_total', {
      description: 'Total number of log entries',
    });

    // Error counter
    this.errorCounter = this.meter.createCounter('suuupra_log_errors_total', {
      description: 'Total number of error log entries',
    });

    // Duration histogram for timed operations
    this.durationHistogram = this.meter.createHistogram('suuupra_operation_duration_ms', {
      description: 'Duration of operations in milliseconds',
      boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    });

    // Active spans gauge
    this.activeSpansGauge = this.meter.createUpDownCounter('suuupra_active_spans_total', {
      description: 'Number of active spans',
    });
  }

  /**
   * Create a new span for logging operations
   */
  createLoggingSpan(
    operationName: string,
    attributes?: Record<string, any>
  ): any {
    return this.tracer.startSpan(operationName, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'suuupra.component': 'logger',
        ...attributes,
      },
    });
  }

  /**
   * Create a span for HTTP requests
   */
  createHttpSpan(
    method: string,
    url: string,
    attributes?: Record<string, any>
  ): any {
    return this.tracer.startSpan(`HTTP ${method}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.url': url,
        'suuupra.component': 'http',
        ...attributes,
      },
    });
  }

  /**
   * Create a span for database operations
   */
  createDatabaseSpan(
    operation: string,
    table: string,
    attributes?: Record<string, any>
  ): any {
    return this.tracer.startSpan(`DB ${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.operation': operation,
        'db.sql.table': table,
        'suuupra.component': 'database',
        ...attributes,
      },
    });
  }

  /**
   * Record log entry metrics
   */
  recordLogEntry(level: string, service: string): void {
    if (!this.logCounter) return;

    this.logCounter.add(1, {
      level: level.toLowerCase(),
      service,
      environment: this.config.environment,
    });

    if (level === 'ERROR' || level === 'FATAL') {
      this.errorCounter?.add(1, {
        level: level.toLowerCase(),
        service,
        environment: this.config.environment,
      });
    }
  }

  /**
   * Record operation duration
   */
  recordDuration(
    operationName: string,
    duration: number,
    attributes?: Record<string, any>
  ): void {
    if (!this.durationHistogram) return;

    this.durationHistogram.record(duration, {
      operation: operationName,
      service: this.config.serviceName,
      environment: this.config.environment,
      ...attributes,
    });
  }

  /**
   * Get current trace context
   */
  getCurrentTraceContext(): {
    traceId: string;
    spanId: string;
    traceFlags: string;
  } | null {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) return null;

    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags.toString(),
    };
  }

  /**
   * Set span status and attributes for logging
   */
  setSpanStatus(span: any, level: string, message: string, error?: Error): void {
    if (level === 'ERROR' || level === 'FATAL') {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error?.message || message,
      });
      
      if (error) {
        span.recordException(error);
      }
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.setAttributes({
      'log.severity': level,
      'log.message': message,
    });
  }

  /**
   * Create wide event span with rich context
   */
  createWideEventSpan(
    eventType: string,
    requestId: string,
    userId?: string,
    attributes?: Record<string, any>
  ): any {
    return this.tracer.startSpan(`Event: ${eventType}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'suuupra.event_type': eventType,
        'suuupra.request_id': requestId,
        'suuupra.user_id': userId,
        'suuupra.component': 'wide_event',
        ...attributes,
      },
    });
  }

  /**
   * Instrument a function with tracing
   */
  instrument<T>(
    name: string,
    fn: (span: any) => Promise<T> | T,
    attributes?: Record<string, any>
  ): Promise<T> {
    return this.tracer.startActiveSpan(name, { attributes }, async (span: any) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Add baggage to current context
   */
  setBaggage(key: string, value: string): void {
    // Implementation would use OpenTelemetry baggage API
    // This allows passing context across service boundaries
  }

  /**
   * Get baggage from current context
   */
  getBaggage(key: string): string | undefined {
    // Implementation would use OpenTelemetry baggage API
    return undefined;
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }
}

// Express middleware for OpenTelemetry integration
export function createOpenTelemetryMiddleware(otelManager: OpenTelemetryManager) {
  return (req: any, res: any, next: any) => {
    const span = otelManager.createHttpSpan(req.method, req.url, {
      'http.route': req.route?.path,
      'http.user_agent': req.get('User-Agent'),
      'http.remote_addr': req.ip,
    });

    // Add span to request for later use
    req.span = span;
    req.otelManager = otelManager;

    // Record metrics
    otelManager.recordLogEntry('INFO', 'http');

    res.on('finish', () => {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response.size': res.get('Content-Length') || 0,
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
    });

    next();
  };
}

// Fastify plugin for OpenTelemetry integration
export function createOpenTelemetryPlugin(otelManager: OpenTelemetryManager) {
  return async function (fastify: any, options: any) {
    fastify.addHook('onRequest', async (request: any, reply: any) => {
      const span = otelManager.createHttpSpan(request.method, request.url, {
        'http.route': request.routerPath,
        'http.user_agent': request.headers['user-agent'],
        'http.remote_addr': request.ip,
      });

      request.span = span;
      request.otelManager = otelManager;

      // Record metrics
      otelManager.recordLogEntry('INFO', 'http');
    });

    fastify.addHook('onResponse', async (request: any, reply: any) => {
      if (request.span) {
        request.span.setAttributes({
          'http.status_code': reply.statusCode,
          'http.response_time': (reply as any).elapsedTime,
        });

        if (reply.statusCode >= 400) {
          request.span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${reply.statusCode}`,
          });
        } else {
          request.span.setStatus({ code: SpanStatusCode.OK });
        }

        request.span.end();
      }
    });
  };
}

// Utility functions
export function createTraceContext(traceId?: string, spanId?: string): any {
  // Implementation would create OpenTelemetry trace context
  return context.active();
}

export function withTraceContext<T>(ctx: any, fn: () => T): T {
  return context.with(ctx, fn);
}

export function getActiveSpan(): any {
  return trace.getActiveSpan();
}

export function createSpan(name: string, attributes?: Record<string, any>): any {
  const tracer = trace.getTracer('default');
  return tracer.startSpan(name, { attributes });
}

// Enums and class are already exported above
