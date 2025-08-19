"use strict";
/**
 * OpenTelemetry Integration for Suuupra Global Logger
 *
 * Provides seamless integration between structured logging and OpenTelemetry
 * for distributed tracing, metrics, and observability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenTelemetryManager = exports.SpanKind = exports.SpanStatusCode = void 0;
exports.createOpenTelemetryMiddleware = createOpenTelemetryMiddleware;
exports.createOpenTelemetryPlugin = createOpenTelemetryPlugin;
exports.createTraceContext = createTraceContext;
exports.withTraceContext = withTraceContext;
exports.getActiveSpan = getActiveSpan;
exports.createSpan = createSpan;
// Optional OpenTelemetry imports - gracefully handle missing packages
let NodeSDK = null;
let Resource = null;
let trace = { getTracer: () => ({ startSpan: () => ({ end: () => { }, setAttributes: () => { }, setStatus: () => { } }) }) };
let context = { active: () => ({}), with: (ctx, fn) => fn() };
let metrics = { getMeter: () => ({ createCounter: () => ({ add: () => { } }), createHistogram: () => ({ record: () => { } }), createUpDownCounter: () => ({ add: () => { } }) }) };
try {
    const otelApi = require('@opentelemetry/api');
    trace = otelApi.trace;
    context = otelApi.context;
    metrics = otelApi.metrics;
}
catch (e) {
    console.warn('OpenTelemetry API not available, using no-op implementation');
}
// Enum values for compatibility
var SpanStatusCode;
(function (SpanStatusCode) {
    SpanStatusCode[SpanStatusCode["UNSET"] = 0] = "UNSET";
    SpanStatusCode[SpanStatusCode["OK"] = 1] = "OK";
    SpanStatusCode[SpanStatusCode["ERROR"] = 2] = "ERROR";
})(SpanStatusCode || (exports.SpanStatusCode = SpanStatusCode = {}));
var SpanKind;
(function (SpanKind) {
    SpanKind[SpanKind["INTERNAL"] = 0] = "INTERNAL";
    SpanKind[SpanKind["SERVER"] = 1] = "SERVER";
    SpanKind[SpanKind["CLIENT"] = 2] = "CLIENT";
    SpanKind[SpanKind["PRODUCER"] = 3] = "PRODUCER";
    SpanKind[SpanKind["CONSUMER"] = 4] = "CONSUMER";
})(SpanKind || (exports.SpanKind = SpanKind = {}));
class OpenTelemetryManager {
    constructor(config) {
        this.config = config;
        this.initializeSDK();
        this.initializeMetrics();
    }
    initializeSDK() {
        // Simplified initialization - no-op if packages not available
        console.log(`Initializing OpenTelemetry for ${this.config.serviceName}`);
        // Get tracer and meter (will be no-op if not available)
        this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
        this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);
    }
    initializeMetrics() {
        if (!this.config.metrics?.enabled)
            return;
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
    createLoggingSpan(operationName, attributes) {
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
    createHttpSpan(method, url, attributes) {
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
    createDatabaseSpan(operation, table, attributes) {
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
    recordLogEntry(level, service) {
        if (!this.logCounter)
            return;
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
    recordDuration(operationName, duration, attributes) {
        if (!this.durationHistogram)
            return;
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
    getCurrentTraceContext() {
        const activeSpan = trace.getActiveSpan();
        if (!activeSpan)
            return null;
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
    setSpanStatus(span, level, message, error) {
        if (level === 'ERROR' || level === 'FATAL') {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error?.message || message,
            });
            if (error) {
                span.recordException(error);
            }
        }
        else {
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
    createWideEventSpan(eventType, requestId, userId, attributes) {
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
    instrument(name, fn, attributes) {
        return this.tracer.startActiveSpan(name, { attributes }, async (span) => {
            try {
                const result = await fn(span);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            }
            catch (error) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
                span.recordException(error);
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    /**
     * Add baggage to current context
     */
    setBaggage(key, value) {
        // Implementation would use OpenTelemetry baggage API
        // This allows passing context across service boundaries
    }
    /**
     * Get baggage from current context
     */
    getBaggage(key) {
        // Implementation would use OpenTelemetry baggage API
        return undefined;
    }
    /**
     * Shutdown OpenTelemetry SDK
     */
    async shutdown() {
        if (this.sdk) {
            await this.sdk.shutdown();
        }
    }
}
exports.OpenTelemetryManager = OpenTelemetryManager;
// Express middleware for OpenTelemetry integration
function createOpenTelemetryMiddleware(otelManager) {
    return (req, res, next) => {
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
            }
            else {
                span.setStatus({ code: SpanStatusCode.OK });
            }
            span.end();
        });
        next();
    };
}
// Fastify plugin for OpenTelemetry integration
function createOpenTelemetryPlugin(otelManager) {
    return async function (fastify, options) {
        fastify.addHook('onRequest', async (request, reply) => {
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
        fastify.addHook('onResponse', async (request, reply) => {
            if (request.span) {
                request.span.setAttributes({
                    'http.status_code': reply.statusCode,
                    'http.response_time': reply.elapsedTime,
                });
                if (reply.statusCode >= 400) {
                    request.span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: `HTTP ${reply.statusCode}`,
                    });
                }
                else {
                    request.span.setStatus({ code: SpanStatusCode.OK });
                }
                request.span.end();
            }
        });
    };
}
// Utility functions
function createTraceContext(traceId, spanId) {
    // Implementation would create OpenTelemetry trace context
    return context.active();
}
function withTraceContext(ctx, fn) {
    return context.with(ctx, fn);
}
function getActiveSpan() {
    return trace.getActiveSpan();
}
function createSpan(name, attributes) {
    const tracer = trace.getTracer('default');
    return tracer.startSpan(name, { attributes });
}
// Enums and class are already exported above
