/**
 * What: Shared observability helpers for Node services (metrics + tracing)
 * Why: Consistent, easy adoption across services with minimal boilerplate
 * How: Prefer prom-client if available; fallback to no-op metrics otherwise
 */

// Use dynamic require to avoid type resolution errors if prom-client isn't installed in a consumer yet
declare const require: any;
let client: any = null;
try {
  client = require("prom-client");
} catch (err) {
  console.warn("[observability] prom-client not available, using no-op implementation");
}


export const metricsRegistry = client
  ? new client.Registry()
  : {
      contentType: "text/plain",
      metrics: async () => "# no metrics (prom-client not installed)\n",
      registerMetric: (_: any) => {},
    };

if (client) {
  client.collectDefaultMetrics({ register: metricsRegistry });
}

export const httpRequestDuration = client
  ? new client.Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["service", "route", "method", "status"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    })
  : null;
if (httpRequestDuration && metricsRegistry.registerMetric)
  metricsRegistry.registerMetric(httpRequestDuration);

export const httpRequestsTotal = client
  ? new client.Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["service", "route", "method", "status"],
    })
  : null;
if (httpRequestsTotal && metricsRegistry.registerMetric)
  metricsRegistry.registerMetric(httpRequestsTotal);

export const httpServerErrorsTotal = client
  ? new client.Counter({
      name: "http_server_errors_total",
      help: "Total number of HTTP 5xx errors",
      labelNames: ["service", "route"],
    })
  : null;
if (httpServerErrorsTotal && metricsRegistry.registerMetric)
  metricsRegistry.registerMetric(httpServerErrorsTotal);

export function exposeMetricsRoute(fastify: any, _serviceName: string) {
  fastify.get("/metrics", async (_req: any, reply: any) => {
    reply.header("Content-Type", metricsRegistry.contentType);
    reply.send(await metricsRegistry.metrics());
  });
}
