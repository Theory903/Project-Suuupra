/**
 * What: Extended Prometheus metrics for API Gateway with detailed labels
 * Why: Comprehensive observability for rate limiting, circuit breakers, and queue depths
 * How: Custom metrics beyond the shared observability library
 */

declare const require: any;
let client: any = null;
try { client = require('prom-client'); } catch {}

// Import shared metrics
const { metricsRegistry } = require('../../../../shared/libs/node/observability');

// Rate limiter metrics
export const rateLimiterHits = client
  ? new client.Counter({
      name: 'gateway_rate_limiter_hits_total',
      help: 'Total number of rate limiter hits',
      labelNames: ['route_id', 'limit_key', 'action'], // action: allowed, blocked
    })
  : null;

export const rateLimiterTokens = client
  ? new client.Gauge({
      name: 'gateway_rate_limiter_tokens_remaining',
      help: 'Remaining tokens in rate limiter buckets',
      labelNames: ['route_id', 'limit_key'],
    })
  : null;

// Circuit breaker metrics
export const circuitBreakerState = client
  ? new client.Gauge({
      name: 'gateway_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['service_name'],
    })
  : null;

export const circuitBreakerEvents = client
  ? new client.Counter({
      name: 'gateway_circuit_breaker_events_total',
      help: 'Circuit breaker events',
      labelNames: ['service_name', 'event'], // event: open, close, half_open, failure, success
    })
  : null;

// Retry metrics
export const retryAttempts = client
  ? new client.Counter({
      name: 'gateway_retry_attempts_total',
      help: 'Total retry attempts',
      labelNames: ['route_id', 'attempt_number'],
    })
  : null;

// Queue metrics for AI endpoints
export const queueDepth = client
  ? new client.Gauge({
      name: 'gateway_queue_depth',
      help: 'Current queue depth for AI endpoints',
      labelNames: ['route_id'],
    })
  : null;

export const queueWaitTime = client
  ? new client.Histogram({
      name: 'gateway_queue_wait_time_seconds',
      help: 'Time spent waiting in queue',
      labelNames: ['route_id'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    })
  : null;

export const concurrentRequests = client
  ? new client.Gauge({
      name: 'gateway_concurrent_requests',
      help: 'Current number of concurrent requests per route',
      labelNames: ['route_id'],
    })
  : null;

// Auth metrics
export const authAttempts = client
  ? new client.Counter({
      name: 'gateway_auth_attempts_total',
      help: 'Authentication attempts',
      labelNames: ['route_id', 'auth_type', 'result'], // auth_type: jwt, api_key; result: success, failure
    })
  : null;

// Discovery metrics
export const discoveryQueries = client
  ? new client.Counter({
      name: 'gateway_discovery_queries_total',
      help: 'Service discovery queries',
      labelNames: ['service_name', 'provider', 'result'], // result: success, failure
    })
  : null;

export const healthCheckResults = client
  ? new client.Counter({
      name: 'gateway_health_check_results_total',
      help: 'Health check results',
      labelNames: ['service_name', 'instance', 'result'], // result: healthy, unhealthy
    })
  : null;

export const activeInstances = client
  ? new client.Gauge({
      name: 'gateway_active_instances',
      help: 'Number of active service instances',
      labelNames: ['service_name'],
    })
  : null;

// Streaming metrics
export const streamingConnections = client
  ? new client.Gauge({
      name: 'gateway_streaming_connections',
      help: 'Active streaming connections',
      labelNames: ['route_id', 'connection_type'], // connection_type: sse, websocket
    })
  : null;

export const streamingBytes = client
  ? new client.Counter({
      name: 'gateway_streaming_bytes_total',
      help: 'Total bytes streamed',
      labelNames: ['route_id', 'direction'], // direction: inbound, outbound
    })
  : null;

// Admin API metrics
export const adminApiRequests = client
  ? new client.Counter({
      name: 'gateway_admin_api_requests_total',
      help: 'Admin API requests',
      labelNames: ['method', 'endpoint', 'status'],
    })
  : null;

export const configReloads = client
  ? new client.Counter({
      name: 'gateway_config_reloads_total',
      help: 'Configuration reloads',
      labelNames: ['result'], // result: success, failure
    })
  : null;

// Register all metrics
const customMetrics = [
  rateLimiterHits,
  rateLimiterTokens,
  circuitBreakerState,
  circuitBreakerEvents,
  retryAttempts,
  queueDepth,
  queueWaitTime,
  concurrentRequests,
  authAttempts,
  discoveryQueries,
  healthCheckResults,
  activeInstances,
  streamingConnections,
  streamingBytes,
  adminApiRequests,
  configReloads,
].filter(Boolean);

if (metricsRegistry && metricsRegistry.registerMetric) {
  for (const metric of customMetrics) {
    metricsRegistry.registerMetric(metric);
  }
}

// Helper functions for common metric operations
export function recordRateLimitHit(routeId: string, key: string, allowed: boolean) {
  rateLimiterHits?.inc?.({ route_id: routeId, limit_key: key, action: allowed ? 'allowed' : 'blocked' });
}

export function recordAuthAttempt(routeId: string, authType: string, success: boolean) {
  authAttempts?.inc?.({ route_id: routeId, auth_type: authType, result: success ? 'success' : 'failure' });
}

export function recordRetryAttempt(routeId: string, attemptNumber: number) {
  retryAttempts?.inc?.({ route_id: routeId, attempt_number: String(attemptNumber) });
}

export function updateQueueDepth(routeId: string, depth: number) {
  queueDepth?.set?.({ route_id: routeId }, depth);
}

export function updateConcurrentRequests(routeId: string, count: number) {
  concurrentRequests?.set?.({ route_id: routeId }, count);
}

export function recordCircuitBreakerEvent(serviceName: string, event: string) {
  circuitBreakerEvents?.inc?.({ service_name: serviceName, event });
}

export function updateCircuitBreakerState(serviceName: string, state: number) {
  circuitBreakerState?.set?.({ service_name: serviceName }, state);
}
