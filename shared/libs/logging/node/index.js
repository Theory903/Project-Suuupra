"use strict";
/**
 * Suuupra Global Logger - Node.js/TypeScript Implementation
 *
 * Features:
 * - High-performance structured logging
 * - Wide events for Observability 2.0
 * - OpenTelemetry integration
 * - Multi-transport support
 * - PII masking and security
 * - Context propagation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = exports.SuuupraLogger = void 0;
exports.createRequestContext = createRequestContext;
exports.runWithContext = runWithContext;
exports.getContext = getContext;
exports.createLogger = createLogger;
exports.expressLoggingMiddleware = expressLoggingMiddleware;
exports.fastifyLoggingPlugin = fastifyLoggingPlugin;
const async_hooks_1 = require("async_hooks");
const crypto_1 = require("crypto");
const perf_hooks_1 = require("perf_hooks");
let trace = { getActiveSpan: () => null };
let otelContext = { active: () => ({}) };
let SpanStatusCode = { OK: 1, ERROR: 2 };
try {
    const otelApi = require('@opentelemetry/api');
    trace = otelApi.trace;
    otelContext = otelApi.context;
    SpanStatusCode = otelApi.SpanStatusCode;
}
catch (e) {
    // OpenTelemetry not available - use no-op implementations
}
const types_1 = require("../core/types");
// Context storage for request correlation
const contextStorage = new async_hooks_1.AsyncLocalStorage();
class SuuupraLogger {
    constructor(config = {}) {
        this.transports = [];
        this.tracer = trace.getTracer('suuupra-logger');
        this.config = {
            service: 'unknown-service',
            environment: process.env.NODE_ENV || 'development',
            level: types_1.LogLevel.INFO,
            format: 'json',
            destination: 'console',
            performance: {
                async: true,
                bufferSize: 1000,
                flushInterval: 5000,
            },
            security: {
                maskPII: true,
                encryptLogs: false,
            },
            sampling: {
                enabled: false,
                rate: 1.0,
                strategy: 'random',
            },
            openTelemetry: {
                enabled: true,
            },
            ...config,
        };
        this.context = {
            service: this.config.service,
            environment: this.config.environment,
            version: this.config.version,
            instanceId: process.env.INSTANCE_ID || (0, crypto_1.randomUUID)(),
            region: process.env.AWS_REGION || process.env.REGION,
        };
        this.initializeTransports();
    }
    initializeTransports() {
        // Console transport (always enabled)
        this.transports.push(new ConsoleTransport(this.config));
        // File transport
        if (this.config.file) {
            this.transports.push(new FileTransport(this.config));
        }
        // HTTP transport for log forwarding
        if (this.config.http) {
            this.transports.push(new HttpTransport(this.config));
        }
    }
    shouldLog(level) {
        return level >= this.config.level;
    }
    createLogEntry(level, message, data, error, additionalContext) {
        const timestamp = new Date().toISOString();
        const currentContext = contextStorage.getStore() || {};
        const entry = {
            timestamp,
            level,
            message: this.config.security?.maskPII ? this.maskPII(message) : message,
            context: {
                ...this.context,
                ...currentContext,
                ...additionalContext,
            },
            data: this.config.security?.maskPII ? this.maskDataPII(data) : data,
        };
        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code,
            };
        }
        return entry;
    }
    createWideEvent(eventType, data = {}) {
        const currentContext = contextStorage.getStore() || {};
        const timestamp = new Date().toISOString();
        return {
            eventId: (0, crypto_1.randomUUID)(),
            eventType,
            timestamp,
            requestId: currentContext.requestId || (0, crypto_1.randomUUID)(),
            traceId: currentContext.traceId || (0, crypto_1.randomUUID)(),
            spanId: currentContext.spanId,
            service: this.context.service,
            version: this.context.version,
            environment: this.context.environment,
            instanceId: this.context.instanceId,
            region: this.context.region,
            dimensions: data,
        };
    }
    maskPII(text) {
        // Email masking
        text = text.replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[EMAIL]');
        // Credit card masking
        text = text.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]');
        // SSN masking
        text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
        // Phone number masking
        text = text.replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]');
        return text;
    }
    maskDataPII(data) {
        if (!data)
            return data;
        const masked = { ...data };
        const piiFields = ['password', 'token', 'secret', 'key', 'ssn', 'creditCard'];
        for (const field of piiFields) {
            if (masked[field]) {
                masked[field] = '[REDACTED]';
            }
        }
        return masked;
    }
    async writeToTransports(entry) {
        const promises = this.transports
            .filter(transport => transport.shouldLog(entry.level))
            .map(transport => transport.write(entry));
        if (this.config.performance?.async) {
            // Fire and forget for performance
            Promise.all(promises).catch(console.error);
        }
        else {
            await Promise.all(promises);
        }
    }
    // Core logging methods
    trace(message, data, context) {
        if (this.shouldLog(types_1.LogLevel.TRACE)) {
            const entry = this.createLogEntry(types_1.LogLevel.TRACE, message, data, undefined, context);
            this.writeToTransports(entry);
        }
    }
    debug(message, data, context) {
        if (this.shouldLog(types_1.LogLevel.DEBUG)) {
            const entry = this.createLogEntry(types_1.LogLevel.DEBUG, message, data, undefined, context);
            this.writeToTransports(entry);
        }
    }
    info(message, data, context) {
        if (this.shouldLog(types_1.LogLevel.INFO)) {
            const entry = this.createLogEntry(types_1.LogLevel.INFO, message, data, undefined, context);
            this.writeToTransports(entry);
        }
    }
    warn(message, data, context) {
        if (this.shouldLog(types_1.LogLevel.WARN)) {
            const entry = this.createLogEntry(types_1.LogLevel.WARN, message, data, undefined, context);
            this.writeToTransports(entry);
        }
    }
    error(message, error, data, context) {
        if (this.shouldLog(types_1.LogLevel.ERROR)) {
            const entry = this.createLogEntry(types_1.LogLevel.ERROR, message, data, error, context);
            this.writeToTransports(entry);
        }
    }
    fatal(message, error, data, context) {
        if (this.shouldLog(types_1.LogLevel.FATAL)) {
            const entry = this.createLogEntry(types_1.LogLevel.FATAL, message, data, error, context);
            this.writeToTransports(entry);
        }
    }
    // Context management
    withContext(context) {
        const newLogger = new SuuupraLogger(this.config);
        newLogger.context = { ...this.context, ...context };
        return newLogger;
    }
    withRequestId(requestId) {
        return this.withContext({ requestId });
    }
    withUserId(userId) {
        return this.withContext({ userId });
    }
    withTraceId(traceId) {
        return this.withContext({ traceId });
    }
    // Performance logging
    startTimer(name) {
        const startTime = perf_hooks_1.performance.now();
        return {
            end: (data) => {
                const duration = perf_hooks_1.performance.now() - startTime;
                this.logDuration(name, duration, data);
            },
            getDuration: () => perf_hooks_1.performance.now() - startTime,
        };
    }
    logDuration(name, duration, data) {
        this.info(`Timer: ${name}`, {
            timer: name,
            duration,
            ...data,
        });
    }
    // Structured logging helpers
    logRequest(request, response) {
        const wideEvent = this.createWideEvent('http_request', {
            http: {
                method: request.method,
                url: request.url,
                statusCode: response?.statusCode,
                duration: response?.duration,
                ip: request.ip,
                userAgent: request.userAgent,
            },
        });
        this.info('HTTP Request', wideEvent);
    }
    logDatabaseQuery(query) {
        this.info('Database Query', {
            database: {
                operation: query.operation,
                table: query.table,
                duration: query.duration,
                rowsAffected: query.rowsAffected,
                // Be careful not to log sensitive query data
                query: query.query ? '[QUERY]' : undefined,
            },
            error: query.error ? {
                name: query.error.name,
                message: query.error.message,
            } : undefined,
        });
    }
    logSecurityEvent(event) {
        this.warn('Security Event', {
            security: {
                type: event.type,
                severity: event.severity,
                userId: event.userId,
                ip: event.ip,
                details: event.details,
            },
        });
    }
    // Lifecycle methods
    async flush() {
        const promises = this.transports.map(transport => transport.flush());
        await Promise.all(promises);
    }
    async close() {
        await this.flush();
        const promises = this.transports.map(transport => transport.close());
        await Promise.all(promises);
    }
}
exports.SuuupraLogger = SuuupraLogger;
// Transport implementations
class LogTransport {
    constructor(config) {
        this.config = config;
    }
    shouldLog(level) {
        return level >= this.config.level;
    }
}
class ConsoleTransport extends LogTransport {
    async write(entry) {
        const output = this.config.format === 'json'
            ? JSON.stringify(entry)
            : this.formatForConsole(entry);
        if (entry.level >= types_1.LogLevel.ERROR) {
            console.error(output);
        }
        else {
            console.log(output);
        }
    }
    formatForConsole(entry) {
        const ts = new Date(entry.timestamp).toLocaleTimeString();
        const levelName = types_1.LogLevel[entry.level];
        const service = entry.context.service || 'unknown';
        const env = entry.context.environment || process.env.NODE_ENV || 'development';
        const message = entry.message;
        const useColor = process.stdout.isTTY && process.env.NO_COLOR !== '1';
        const paint = (s, code) => useColor ? `\u001b[${code}m${s}\u001b[0m` : s;
        const dim = (s) => paint(s, 2);
        const bold = (s) => paint(s, 1);
        const fg = {
            gray: (s) => paint(s, 90),
            red: (s) => paint(s, 31),
            green: (s) => paint(s, 32),
            yellow: (s) => paint(s, 33),
            blue: (s) => paint(s, 34),
            magenta: (s) => paint(s, 35),
            cyan: (s) => paint(s, 36),
            white: (s) => paint(s, 37),
        };
        const levelColors = {
            TRACE: fg.gray,
            DEBUG: fg.blue,
            INFO: fg.green,
            WARN: fg.yellow,
            ERROR: fg.red,
            FATAL: fg.magenta,
        };
        const levelIcons = {
            TRACE: '…',
            DEBUG: '🔧',
            INFO: 'ℹ️',
            WARN: '⚠️',
            ERROR: '⛔',
            FATAL: '💥',
        };
        const levelColor = levelColors[levelName] ?? fg.white;
        const icon = levelIcons[levelName] ?? '•';
        const levelBadge = bold(levelColor(levelName.padEnd(5)));
        const timeBadge = dim(ts);
        const svc = fg.cyan(`${service}@${env}`);
        // Header line
        let out = `${timeBadge} ${levelColor(icon)} ${levelBadge} ${bold(message)} ${dim('[')}${svc}${dim(']')}`;
        // Context line (request/trace)
        const ctxParts = [];
        const ctx = entry.context || {};
        if (ctx.requestId)
            ctxParts.push(`${dim('req=')}${ctx.requestId}`);
        if (ctx.traceId)
            ctxParts.push(`${dim('trace=')}${ctx.traceId}`);
        if (ctx.spanId)
            ctxParts.push(`${dim('span=')}${ctx.spanId}`);
        if (ctx.userId)
            ctxParts.push(`${dim('user=')}${ctx.userId}`);
        if (ctx.ip)
            ctxParts.push(`${dim('ip=')}${ctx.ip}`);
        if (ctxParts.length) {
            out += `\n  ${fg.cyan(bold('Context:'))} ${ctxParts.join('  ')}`;
        }
        // Error details
        if (entry.error) {
            const err = entry.error;
            out += `\n  ${fg.red(bold('Error:'))} ${err.name}: ${err.message}`;
            if (err.stack)
                out += `\n${dim(err.stack)}`;
        }
        // HTTP details (if present in data)
        const data = { ...(entry.data || {}) };
        if (data.http) {
            const h = data.http;
            out += `\n  ${fg.yellow(bold('HTTP:'))} ${h.method || ''} ${h.url || ''}`;
            const httpMeta = [];
            if (h.statusCode !== undefined)
                httpMeta.push(`${dim('status=')}${h.statusCode}`);
            if (h.duration !== undefined)
                httpMeta.push(`${dim('duration=')}${h.duration}ms`);
            if (h.ip)
                httpMeta.push(`${dim('ip=')}${h.ip}`);
            if (h.userAgent)
                httpMeta.push(`${dim('ua=')}${h.userAgent}`);
            if (httpMeta.length)
                out += `\n    ${httpMeta.join('  ')}`;
            delete data.http;
        }
        // Timer/metrics hint
        if (data.timer || data.duration) {
            out += `\n  ${fg.magenta(bold('Metrics:'))} ${data.timer ? `${dim('timer=')}${data.timer}  ` : ''}${data.duration !== undefined ? `${dim('duration=')}${data.duration}ms` : ''}`;
            delete data.timer;
            delete data.duration;
        }
        // Remaining data payload pretty-print with light key coloring
        const keys = Object.keys(data || {});
        if (keys.length > 0) {
            const json = JSON.stringify(data, null, 2)
                .replace(/\"([^"]+)\":/g, (_m, k) => `${fg.blue(k)}:`)
                .replace(/:\s*(\d+)(\b)/g, (_m, n, b) => `: ${fg.yellow(n)}${b}`);
            const pretty = json
                .split('\n')
                .map(line => `  ${dim(line)}`)
                .join('\n');
            out += `\n  ${fg.white(bold('Data:'))}\n${pretty}`;
        }
        return out;
    }
    async flush() {
        // Console doesn't need flushing
    }
    async close() {
        // Console doesn't need closing
    }
}
class FileTransport extends LogTransport {
    async write(entry) {
        // Implementation would write to file with rotation
        const output = JSON.stringify(entry) + '\n';
        // this.writeStream.write(output);
    }
    async flush() {
        // Flush file stream
    }
    async close() {
        // Close file stream
    }
}
class HttpTransport extends LogTransport {
    async write(entry) {
        if (!this.config.http)
            return;
        try {
            // Would implement HTTP POST to log aggregation service
            const response = await fetch(this.config.http.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.config.http.headers,
                },
                body: JSON.stringify(entry),
            });
            if (!response.ok) {
                console.error('Failed to send log to HTTP endpoint:', response.statusText);
            }
        }
        catch (error) {
            console.error('Error sending log to HTTP endpoint:', error);
        }
    }
    async flush() {
        // HTTP doesn't need flushing
    }
    async close() {
        // HTTP doesn't need closing
    }
}
// Context utilities for Express/Fastify middleware
function createRequestContext(requestId) {
    return {
        requestId: requestId || (0, crypto_1.randomUUID)(),
        traceId: (0, crypto_1.randomUUID)(),
        service: 'unknown',
        environment: process.env.NODE_ENV || 'development',
    };
}
function runWithContext(context, fn) {
    return contextStorage.run(context, fn);
}
function getContext() {
    return contextStorage.getStore();
}
// Factory function for easy logger creation
function createLogger(config) {
    return new SuuupraLogger(config);
}
// Express middleware
function expressLoggingMiddleware(logger) {
    return (req, res, next) => {
        const requestId = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
        const context = createRequestContext(requestId);
        runWithContext(context, () => {
            const startTime = perf_hooks_1.performance.now();
            res.on('finish', () => {
                const duration = perf_hooks_1.performance.now() - startTime;
                logger.logRequest({
                    method: req.method,
                    url: req.url,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                }, {
                    statusCode: res.statusCode,
                    duration,
                });
            });
            next();
        });
    };
}
// Fastify plugin
function fastifyLoggingPlugin(fastify, options, done) {
    const logger = createLogger(options);
    fastify.addHook('onRequest', async (request, reply) => {
        const requestId = request.headers['x-request-id'] || (0, crypto_1.randomUUID)();
        const context = createRequestContext(requestId);
        request.logContext = context;
        request.logger = logger.withContext(context);
    });
    fastify.addHook('onResponse', async (request, reply) => {
        if (request.logger) {
            request.logger.logRequest({
                method: request.method,
                url: request.url,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
            }, {
                statusCode: reply.statusCode,
                duration: reply.elapsedTime ?? reply.getResponseTime?.(),
            });
        }
    });
    done();
}
var types_2 = require("../core/types");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return types_2.LogLevel; } });
