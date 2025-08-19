"use strict";
/**
 * What: API Gateway entrypoint server with World-Class Logging
 * Why: Wires Fastify to the modular gateway pipeline with structured logging, OpenTelemetry, and observability
 * How: Uses Suuupra Global Logger with wide events, distributed tracing, and multi-language support
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = start;
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const crypto_1 = require("crypto");
const node_1 = require("../../../shared/libs/logging/node");
const opentelemetry_1 = require("../../../shared/libs/logging/observability/opentelemetry");
let obs = {};
try {
    obs = require('../../../shared/libs/node/observability');
}
catch { }
const { exposeMetricsRoute, httpRequestDuration, httpRequestsTotal, httpServerErrorsTotal } = obs;
const services_1 = require("./services");
const api_1 = require("./admin/api");
const gatewayConfig_1 = require("./config/gatewayConfig");
// Initialize world-class logger with best practices
const logger = (0, node_1.createLogger)({
    service: 'api-gateway',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    level: process.env.LOG_LEVEL ? node_1.LogLevel[process.env.LOG_LEVEL] : node_1.LogLevel.INFO,
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
const otelManager = new opentelemetry_1.OpenTelemetryManager({
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
const app = (0, fastify_1.default)({
    logger: false, // Disable Fastify's built-in logger to use our global logger
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => (0, crypto_1.randomUUID)(),
});
const port = Number(process.env.PORT || 8080);
// Optional JWT plugin (enabled if secret provided)
if (process.env.JWT_SECRET) {
    app.register(jwt_1.default, { secret: process.env.JWT_SECRET });
}
// Logging middleware with request correlation
app.addHook('onRequest', async (req, reply) => {
    const requestId = Array.isArray(req.headers['x-request-id'])
        ? req.headers['x-request-id'][0]
        : req.headers['x-request-id'] || req.id;
    const traceContext = otelManager.getCurrentTraceContext();
    // Create request logger with context
    req.logger = logger.withRequestId(requestId).withContext({
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
    req.logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
    });
});
// Response logging
app.addHook('onResponse', async (req, reply) => {
    const duration = reply.elapsedTime ?? reply.getResponseTime?.();
    if (req.logger) {
        req.logger.info('Request completed', {
            statusCode: reply.statusCode,
            duration,
            contentLength: reply.getHeader('content-length'),
        });
        // Record metrics
        otelManager.recordDuration('http_request', duration, {
            method: req.method,
            status_code: reply.statusCode.toString(),
            route: req.routeOptions?.url || req.url,
        });
    }
});
// Error logging
app.addHook('onError', async (req, reply, error) => {
    if (req.logger) {
        req.logger.error('Request error', error, {
            statusCode: reply.statusCode,
            method: req.method,
            url: req.url,
        });
    }
});
app.options('*', async (_req, reply) => { reply.status(204).send(); });
// Initialize config manager
(0, api_1.initializeConfigManager)(gatewayConfig_1.gatewayConfig);
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
if (gatewayConfig_1.gatewayConfig.admin.apiEnabled) {
    (0, api_1.registerAdminRoutes)(app);
}
// Wildcard proxy route: /:service/* → matched/forwarded in handleGatewayProxy
app.all('/:service/*', async (request, reply) => {
    const timer = request.logger.startTimer('gateway_proxy_operation');
    const endTimer = httpRequestDuration?.startTimer?.({ service: 'api-gateway', route: '/:service/*', method: request.method });
    try {
        // Create span for this operation
        const span = otelManager.createHttpSpan(request.method, request.url, {
            'gateway.operation': 'proxy',
            'gateway.service': request.params.service,
        });
        request.logger.info('Proxying request', {
            targetService: request.params.service,
            operation: 'proxy',
            path: request.url,
        });
        const { response, correlationId } = await (0, services_1.handleGatewayProxy)(request);
        // Forward status and headers and stream body to client
        const status = response.statusCode || 200;
        reply.header('x-correlation-id', correlationId);
        const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade']);
        const headers = (response.headers || {});
        for (const [k, v] of Object.entries(headers)) {
            if (!hopByHop.has(k.toLowerCase()))
                reply.header(k, v);
        }
        const routeId = String(headers['x-gateway-route-id'] || 'unknown');
        // Use hijack to stream the upstream response directly to the client
        reply.hijack();
        reply.raw.writeHead(status);
        response.pipe(reply.raw);
        response.on('end', () => {
            try {
                reply.raw.end();
            }
            catch { }
        });
        // early return since we took over the socket
        return;
        // Log successful proxy operation
        const duration = timer.end({
            success: true,
            targetService: request.params.service,
            statusCode: status,
            routeId,
        });
        // Wide event logging for proxy operation
        request.logger.info('Gateway proxy completed', {
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
    }
    catch (err) {
        const statusCode = err?.statusCode || 502;
        // Log error with context
        request.logger.error('Gateway proxy failed', err, {
            targetService: request.params.service,
            statusCode,
            operation: 'proxy',
            errorType: err?.constructor?.name || 'UnknownError',
        });
        // Security logging for potential attacks
        if (statusCode === 404 || statusCode === 403) {
            request.logger.logSecurityEvent({
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
async function start() {
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
    }
    catch (error) {
        logger.fatal('Failed to start API Gateway', error, {
            port,
            host: '0.0.0.0',
        });
        process.exit(1);
    }
}
// Graceful shutdown
async function gracefulShutdown(signal) {
    logger.info('Received shutdown signal, gracefully shutting down', { signal });
    try {
        await app.close();
        await logger.flush();
        await otelManager.shutdown();
        logger.info('API Gateway shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
    }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Allow direct run
if (require.main === module) {
    start().catch((e) => {
        logger.fatal('Failed to start API Gateway', e);
        process.exit(1);
    });
}
