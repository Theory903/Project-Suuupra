// OpenTelemetry Application Instrumentation - Production Ready
// File: observability/application-instrumentation.ts

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { metrics, trace, SpanStatusCode } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

// Initialize OpenTelemetry SDK with comprehensive instrumentation
export function initializeObservability() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'unknown-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'suuupra-platform',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown-instance',
    }),
    
    // Comprehensive auto-instrumentation
    instrumentations: getNodeAutoInstrumentations({
      // Disable noisy instrumentations
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
      
      // Configure HTTP instrumentation
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Ignore health check requests
          return req.url?.includes('/health') || 
                 req.url?.includes('/metrics') ||
                 req.url?.includes('/ready');
        },
        requestHook: (span, request) => {
          span.setAttributes({
            'http.request.header.user_agent': request.headers['user-agent'],
            'http.request.header.x_forwarded_for': request.headers['x-forwarded-for'],
            'http.request.header.x_request_id': request.headers['x-request-id'],
          });
        },
        responseHook: (span, response) => {
          span.setAttributes({
            'http.response.header.content_type': response.headers['content-type'],
            'http.response.size': response.headers['content-length'],
          });
        },
      },
      
      // Configure Express instrumentation
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        ignoreLayers: [
          // Ignore middleware layers we don't want to trace
          (name) => name === 'helmet',
          (name) => name === 'cors',
        ],
      },
      
      // Configure database instrumentations
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
      
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
        dbStatementSerializer: (cmdName, cmdArgs) => {
          // Sanitize sensitive data in Redis commands
          if (cmdName.toLowerCase().includes('auth')) {
            return `${cmdName} [REDACTED]`;
          }
          return `${cmdName} ${cmdArgs.join(' ')}`;
        },
      },
      
      // Configure Kafka instrumentation
      '@opentelemetry/instrumentation-kafkajs': {
        enabled: true,
        producerHook: (span, info) => {
          span.setAttributes({
            'messaging.kafka.partition': info.partition,
            'messaging.kafka.topic': info.topic,
          });
        },
        consumerHook: (span, info) => {
          span.setAttributes({
            'messaging.kafka.consumer.group': info.groupId,
            'messaging.kafka.partition': info.partition,
          });
        },
      },
    }),
    
    // Trace exporter configuration
    traceProcessor: new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 
             'http://tempo.monitoring.svc.cluster.local:4318/v1/traces',
      })
    ),
    
    // Metrics reader configuration
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
             'http://otel-collector.monitoring.svc.cluster.local:4318/v1/metrics',
      }),
      exportIntervalMillis: 10000, // Export every 10 seconds
    }),
  });

  // Start the SDK
  sdk.start();
  
  // Also setup Prometheus metrics endpoint
  const prometheusExporter = new PrometheusExporter({
    port: parseInt(process.env.METRICS_PORT || '9090'),
    endpoint: '/metrics',
  });
  
  return sdk;
}

// Business Metrics Collection
export class BusinessMetrics {
  private meter = metrics.getMeter('suuupra-business-metrics');
  
  // Revenue tracking
  public revenueCounter = this.meter.createCounter('revenue_total', {
    description: 'Total revenue in cents',
    unit: 'cents',
  });
  
  // User engagement metrics
  public activeUsersGauge = this.meter.createObservableGauge('active_users_current', {
    description: 'Currently active users',
    unit: 'users',
  });
  
  // Course enrollment metrics
  public enrollmentCounter = this.meter.createCounter('course_enrollments_total', {
    description: 'Total course enrollments',
    unit: 'enrollments',
  });
  
  // Payment success metrics
  public paymentAttempts = this.meter.createCounter('payments_attempted_total', {
    description: 'Total payment attempts',
    unit: 'attempts',
  });
  
  public paymentCompletions = this.meter.createCounter('payments_completed_total', {
    description: 'Total successful payments',
    unit: 'completions',
  });
  
  // Live streaming metrics
  public liveViewersGauge = this.meter.createObservableGauge('live_class_viewers_current', {
    description: 'Current live class viewers',
    unit: 'viewers',
  });
  
  // User activity events
  public userActivityCounter = this.meter.createCounter('user_activity_events_total', {
    description: 'User activity events',
    unit: 'events',
  });
  
  constructor() {
    // Setup callback for active users gauge
    this.activeUsersGauge.addCallback(async (observableResult) => {
      // Get active user count from Redis or database
      const premiumUsers = await this.getActiveUserCount('premium');
      const freeUsers = await this.getActiveUserCount('free');
      
      observableResult.observe(premiumUsers, { tier: 'premium' });
      observableResult.observe(freeUsers, { tier: 'free' });
    });
    
    // Setup callback for live viewers gauge
    this.liveViewersGauge.addCallback(async (observableResult) => {
      const viewers = await this.getLiveViewerCount();
      observableResult.observe(viewers);
    });
  }
  
  // Record a payment
  public recordPayment(amount: number, currency: string, success: boolean, paymentMethod: string) {
    const attributes = { currency, payment_method: paymentMethod };
    
    this.paymentAttempts.add(1, attributes);
    
    if (success) {
      this.paymentCompletions.add(1, attributes);
      this.revenueCounter.add(amount * 100, attributes); // Convert to cents
    }
  }
  
  // Record course enrollment
  public recordEnrollment(courseId: string, userId: string, tier: string) {
    this.enrollmentCounter.add(1, {
      course_id: courseId,
      user_tier: tier,
    });
  }
  
  // Record user activity
  public recordUserActivity(userId: string, activityType: string, metadata?: Record<string, any>) {
    this.userActivityCounter.add(1, {
      activity_type: activityType,
      user_tier: metadata?.tier || 'unknown',
    });
  }
  
  private async getActiveUserCount(tier: string): Promise<number> {
    // Implementation would connect to Redis/database
    // This is a placeholder
    return Math.floor(Math.random() * 1000);
  }
  
  private async getLiveViewerCount(): Promise<number> {
    // Implementation would connect to live streaming service
    // This is a placeholder
    return Math.floor(Math.random() * 500);
  }
}

// Custom Tracing Utilities
export class TracingUtils {
  private tracer = trace.getTracer('suuupra-custom-tracer');
  
  // Create a span with business context
  public createBusinessSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, {
      attributes: {
        'business.operation': true,
        ...attributes,
      },
    });
  }
  
  // Trace a function execution with error handling
  public async traceFunction<T>(
    spanName: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.tracer.startSpan(spanName, { attributes });
    
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }
  
  // Trace database operations
  public traceDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceFunction(
      `db.${operation}`,
      fn,
      {
        'db.operation': operation,
        'db.table': table,
        'db.system': 'postgresql',
      }
    );
  }
  
  // Trace external API calls
  public traceExternalCall<T>(
    serviceName: string,
    endpoint: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceFunction(
      `external.${serviceName}`,
      fn,
      {
        'external.service': serviceName,
        'external.endpoint': endpoint,
        'external.type': 'http',
      }
    );
  }
  
  // Add correlation ID to current span
  public addCorrelationId(correlationId: string) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        'correlation.id': correlationId,
        'business.correlation_id': correlationId,
      });
    }
  }
  
  // Add user context to current span
  public addUserContext(userId: string, userTier: string, organizationId?: string) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        'user.id': userId,
        'user.tier': userTier,
        'user.organization_id': organizationId || 'unknown',
      });
    }
  }
}

// Error Tracking with OpenTelemetry
export class ErrorTracker {
  private tracer = trace.getTracer('suuupra-error-tracker');
  
  public recordError(
    error: Error,
    context?: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    const span = this.tracer.startSpan('error.recorded');
    
    span.recordException(error);
    span.setAttributes({
      'error.severity': severity,
      'error.type': error.constructor.name,
      'error.handled': true,
      ...context,
    });
    
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    
    span.end();
  }
  
  public recordBusinessError(
    errorType: string,
    message: string,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    const span = this.tracer.startSpan(`business.error.${errorType}`);
    
    span.setAttributes({
      'error.business_type': errorType,
      'error.message': message,
      'user.id': userId || 'anonymous',
      'error.handled': true,
      ...metadata,
    });
    
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message,
    });
    
    span.end();
  }
}

// Express.js Middleware for Request Tracing
export function createTracingMiddleware() {
  const tracingUtils = new TracingUtils();
  const businessMetrics = new BusinessMetrics();
  
  return (req: any, res: any, next: any) => {
    // Extract or generate correlation ID
    const correlationId = req.headers['x-correlation-id'] || 
                         req.headers['x-request-id'] ||
                         `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add correlation ID to tracing
    tracingUtils.addCorrelationId(correlationId);
    
    // Extract user context from JWT or session
    const userId = req.user?.id;
    const userTier = req.user?.tier;
    const organizationId = req.user?.organizationId;
    
    if (userId) {
      tracingUtils.addUserContext(userId, userTier, organizationId);
      
      // Record user activity
      businessMetrics.recordUserActivity(userId, 'api_request', {
        endpoint: req.path,
        method: req.method,
        tier: userTier,
      });
    }
    
    // Set correlation ID header in response
    res.setHeader('X-Correlation-ID', correlationId);
    
    next();
  };
}

// Usage Example in Express App
export function setupExpressApp() {
  const express = require('express');
  const app = express();
  
  // Initialize observability
  const sdk = initializeObservability();
  
  // Create business metrics and tracing utilities
  const businessMetrics = new BusinessMetrics();
  const tracingUtils = new TracingUtils();
  const errorTracker = new ErrorTracker();
  
  // Add tracing middleware
  app.use(createTracingMiddleware());
  
  // Example business endpoint with full observability
  app.post('/api/v1/payments', async (req: any, res: any) => {
    try {
      const result = await tracingUtils.traceFunction(
        'payment.process',
        async () => {
          // Payment processing logic
          const payment = await processPayment(req.body);
          
          // Record business metrics
          businessMetrics.recordPayment(
            payment.amount,
            payment.currency,
            payment.status === 'completed',
            payment.method
          );
          
          return payment;
        },
        {
          'payment.amount': req.body.amount,
          'payment.currency': req.body.currency,
          'payment.method': req.body.method,
        }
      );
      
      res.json(result);
    } catch (error) {
      errorTracker.recordError(error as Error, {
        endpoint: '/api/v1/payments',
        user_id: req.user?.id,
      }, 'high');
      
      res.status(500).json({ error: 'Payment processing failed' });
    }
  });
  
  return app;
}

// Export singleton instances
export const businessMetrics = new BusinessMetrics();
export const tracingUtils = new TracingUtils();
export const errorTracker = new ErrorTracker();

// Helper function placeholder
async function processPayment(paymentData: any) {
  // Placeholder for actual payment processing
  return {
    id: 'payment-123',
    amount: paymentData.amount,
    currency: paymentData.currency,
    method: paymentData.method,
    status: 'completed',
  };
}
