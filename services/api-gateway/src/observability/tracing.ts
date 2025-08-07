/**
 * What: OpenTelemetry tracing for API Gateway with W3C trace context
 * Why: Distributed tracing across gateway and upstream services for observability
 * How: Auto-instrumentation with custom spans and trace context propagation
 */

import { FastifyRequest } from 'fastify';

// Dynamic imports to avoid hard dependencies
declare const require: any;
let otel: any = null;
let api: any = null;
let resources: any = null;
let autoInstrumentations: any = null;
let httpInstrumentation: any = null;

try {
  otel = require('@opentelemetry/sdk-node');
  api = require('@opentelemetry/api');
  resources = require('@opentelemetry/resources');
  autoInstrumentations = require('@opentelemetry/auto-instrumentations-node');
  httpInstrumentation = require('@opentelemetry/instrumentation-http');
} catch (error) {
  console.warn('OpenTelemetry dependencies not available, tracing disabled');
}

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  endpoint?: string;
  environment?: string;
  enableAutoInstrumentation?: boolean;
}

let tracingInitialized = false;
let tracer: any = null;

export function initializeTracing(config: TracingConfig): void {
  if (!otel || tracingInitialized) return;

  try {
    const resource = resources.Resource.default().merge(
      new resources.Resource({
        [resources.SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [resources.SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || '1.0.0',
        [resources.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment || 'development',
      })
    );

    const instrumentations = [];
    
    if (config.enableAutoInstrumentation && autoInstrumentations) {
      instrumentations.push(autoInstrumentations.getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }, // Disable noisy fs instrumentation
      }));
    }

    if (httpInstrumentation) {
      instrumentations.push(new httpInstrumentation.HttpInstrumentation({
        requestHook: (span: any, request: any) => {
          // Add custom attributes for gateway requests
          if (request.url) {
            span.setAttributes({
              'gateway.request.url': request.url,
              'gateway.request.method': request.method,
            });
          }
        },
        responseHook: (span: any, response: any) => {
          span.setAttributes({
            'gateway.response.status_code': response.statusCode,
          });
        },
      }));
    }

    const sdk = new otel.NodeSDK({
      resource,
      instrumentations,
    });

    sdk.start();
    tracer = api.trace.getTracer(config.serviceName, config.serviceVersion);
    tracingInitialized = true;

    console.log(`OpenTelemetry tracing initialized for ${config.serviceName}`);
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
  }
}

export function createSpan(name: string, attributes?: Record<string, any>): any {
  if (!tracer) return null;

  const span = tracer.startSpan(name, {
    attributes: {
      'service.name': 'api-gateway',
      ...attributes,
    },
  });

  return span;
}

export function createGatewaySpan(
  req: FastifyRequest,
  routeId: string,
  serviceName: string
): any {
  if (!tracer) return null;

  const span = tracer.startSpan('gateway.request', {
    attributes: {
      'http.method': req.method,
      'http.url': req.raw.url,
      'http.user_agent': req.headers['user-agent'],
      'gateway.route.id': routeId,
      'gateway.target.service': serviceName,
      'gateway.correlation.id': req.headers['x-correlation-id'],
    },
  });

  // Extract trace context from incoming headers
  const activeContext = api.propagation.extract(api.context.active(), req.headers);
  api.context.with(activeContext, () => {
    api.trace.setSpan(api.context.active(), span);
  });

  return span;
}

export function createUpstreamSpan(
  parentSpan: any,
  serviceName: string,
  method: string,
  url: string
): any {
  if (!tracer || !parentSpan) return null;

  const span = tracer.startSpan('gateway.upstream', {
    parent: parentSpan,
    attributes: {
      'http.method': method,
      'http.url': url,
      'upstream.service.name': serviceName,
      'span.kind': 'client',
    },
  });

  return span;
}

export function addSpanAttributes(span: any, attributes: Record<string, any>): void {
  if (!span) return;
  span.setAttributes(attributes);
}

export function addSpanEvent(span: any, name: string, attributes?: Record<string, any>): void {
  if (!span) return;
  span.addEvent(name, attributes);
}

export function finishSpan(span: any, error?: Error): void {
  if (!span) return;

  if (error) {
    span.recordException(error);
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: error.message,
    });
  } else {
    span.setStatus({ code: api.SpanStatusCode.OK });
  }

  span.end();
}

export function injectTraceContext(headers: Record<string, any>, span?: any): void {
  if (!api || !span) return;

  // Inject trace context into outgoing headers
  const context = api.trace.setSpan(api.context.active(), span);
  api.propagation.inject(context, headers);
}

export function extractTraceContext(headers: Record<string, any>): any {
  if (!api) return null;
  return api.propagation.extract(api.context.active(), headers);
}

// Middleware helper for automatic span creation
export function withTracing<T>(
  name: string,
  operation: (span: any) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  if (!tracer) {
    // If tracing is not available, just run the operation
    return operation(null);
  }

  const span = createSpan(name, attributes);
  
  return api.context.with(api.trace.setSpan(api.context.active(), span), async () => {
    try {
      const result = await operation(span);
      finishSpan(span);
      return result;
    } catch (error) {
      finishSpan(span, error as Error);
      throw error;
    }
  });
}

// Common span names
export const SPAN_NAMES = {
  GATEWAY_REQUEST: 'gateway.request',
  GATEWAY_AUTH: 'gateway.auth',
  GATEWAY_RATE_LIMIT: 'gateway.rate_limit',
  GATEWAY_TRANSFORM: 'gateway.transform',
  GATEWAY_CONTEXT_INJECTION: 'gateway.context_injection',
  GATEWAY_CIRCUIT_BREAKER: 'gateway.circuit_breaker',
  GATEWAY_UPSTREAM: 'gateway.upstream',
  GATEWAY_STREAMING: 'gateway.streaming',
} as const;
