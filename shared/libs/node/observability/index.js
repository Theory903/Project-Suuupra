"use strict";
/**
 * What: Shared observability helpers for Node services (metrics + tracing)
 * Why: Consistent, easy adoption across services with minimal boilerplate
 * How: Prefer prom-client if available; fallback to no-op metrics otherwise
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServerErrorsTotal = exports.httpRequestsTotal = exports.httpRequestDuration = exports.metricsRegistry = void 0;
exports.exposeMetricsRoute = exposeMetricsRoute;
let client = null;
try {
    client = require("prom-client");
}
catch (err) {
    console.warn("[observability] prom-client not available, using no-op implementation");
}
exports.metricsRegistry = client
    ? new client.Registry()
    : {
        contentType: "text/plain",
        metrics: async () => "# no metrics (prom-client not installed)\n",
        registerMetric: (_) => { },
    };
if (client) {
    client.collectDefaultMetrics({ register: exports.metricsRegistry });
}
exports.httpRequestDuration = client
    ? new client.Histogram({
        name: "http_request_duration_seconds",
        help: "HTTP request duration in seconds",
        labelNames: ["service", "route", "method", "status"],
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    })
    : null;
if (exports.httpRequestDuration && exports.metricsRegistry.registerMetric)
    exports.metricsRegistry.registerMetric(exports.httpRequestDuration);
exports.httpRequestsTotal = client
    ? new client.Counter({
        name: "http_requests_total",
        help: "Total number of HTTP requests",
        labelNames: ["service", "route", "method", "status"],
    })
    : null;
if (exports.httpRequestsTotal && exports.metricsRegistry.registerMetric)
    exports.metricsRegistry.registerMetric(exports.httpRequestsTotal);
exports.httpServerErrorsTotal = client
    ? new client.Counter({
        name: "http_server_errors_total",
        help: "Total number of HTTP 5xx errors",
        labelNames: ["service", "route"],
    })
    : null;
if (exports.httpServerErrorsTotal && exports.metricsRegistry.registerMetric)
    exports.metricsRegistry.registerMetric(exports.httpServerErrorsTotal);
function exposeMetricsRoute(fastify, _serviceName) {
    fastify.get("/metrics", async (_req, reply) => {
        reply.header("Content-Type", exports.metricsRegistry.contentType);
        reply.send(await exports.metricsRegistry.metrics());
    });
}
