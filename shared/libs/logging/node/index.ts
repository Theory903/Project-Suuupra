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

import { AsyncLocalStorage } from 'async_hooks';
import { createHash, randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
// Optional OpenTelemetry integration
declare const require: any;
let trace: any = { getActiveSpan: () => null };
let otelContext: any = { active: () => ({}) };
let SpanStatusCode: any = { OK: 1, ERROR: 2 };

try {
  const otelApi = require('@opentelemetry/api');
  trace = otelApi.trace;
  otelContext = otelApi.context;
  SpanStatusCode = otelApi.SpanStatusCode;
} catch (e) {
  // OpenTelemetry not available - use no-op implementations
}
import {
  Logger,
  LoggerConfig,
  LogContext,
  LogEntry,
  LogLevel,
  Timer,
  HttpRequest,
  HttpResponse,
  DatabaseQuery,
  SecurityEvent,
  WideEvent,
  TransportConfig
} from '../core/types';

// Context storage for request correlation
const contextStorage = new AsyncLocalStorage<LogContext>();

export class SuuupraLogger implements Logger {
  private config: LoggerConfig;
  private context: LogContext;
  private transports: LogTransport[] = [];
  private tracer = trace.getTracer('suuupra-logger');

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      service: 'unknown-service',
      environment: process.env.NODE_ENV || 'development',
      level: LogLevel.INFO,
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
      instanceId: process.env.INSTANCE_ID || randomUUID(),
      region: process.env.AWS_REGION || process.env.REGION,
    };

    this.initializeTransports();
  }

  private initializeTransports(): void {
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

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, any>,
    error?: Error,
    additionalContext?: Partial<LogContext>
  ): LogEntry {
    const timestamp = new Date().toISOString();
    const currentContext = contextStorage.getStore() || {};
    
    const entry: LogEntry = {
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
        code: (error as any).code,
      };
    }

    return entry;
  }

  private createWideEvent(
    eventType: string,
    data: Record<string, any> = {}
  ): WideEvent {
    const currentContext = contextStorage.getStore() || {};
    const timestamp = new Date().toISOString();

    return {
      eventId: randomUUID(),
      eventType,
      timestamp,
      requestId: (currentContext as any).requestId || randomUUID(),
      traceId: (currentContext as any).traceId || randomUUID(),
      spanId: (currentContext as any).spanId,
      service: this.context.service,
      version: this.context.version,
      environment: this.context.environment,
      instanceId: this.context.instanceId,
      region: this.context.region,
      dimensions: data,
    };
  }

  private maskPII(text: string): string {
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

  private maskDataPII(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) return data;

    const masked = { ...data };
    const piiFields = ['password', 'token', 'secret', 'key', 'ssn', 'creditCard'];
    
    for (const field of piiFields) {
      if (masked[field]) {
        masked[field] = '[REDACTED]';
      }
    }

    return masked;
  }

  private async writeToTransports(entry: LogEntry): Promise<void> {
    const promises = this.transports
      .filter(transport => transport.shouldLog(entry.level))
      .map(transport => transport.write(entry));

    if (this.config.performance?.async) {
      // Fire and forget for performance
      Promise.all(promises).catch(console.error);
    } else {
      await Promise.all(promises);
    }
  }

  // Core logging methods
  trace(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      const entry = this.createLogEntry(LogLevel.TRACE, message, data, undefined, context);
      this.writeToTransports(entry);
    }
  }

  debug(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, data, undefined, context);
      this.writeToTransports(entry);
    }
  }

  info(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, message, data, undefined, context);
      this.writeToTransports(entry);
    }
  }

  warn(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, message, data, undefined, context);
      this.writeToTransports(entry);
    }
  }

  error(message: string, error?: Error, data?: Record<string, any>, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, message, data, error, context);
      this.writeToTransports(entry);
    }
  }

  fatal(message: string, error?: Error, data?: Record<string, any>, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      const entry = this.createLogEntry(LogLevel.FATAL, message, data, error, context);
      this.writeToTransports(entry);
    }
  }

  // Context management
  withContext(context: Partial<LogContext>): Logger {
    const newLogger = new SuuupraLogger(this.config);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  withRequestId(requestId: string): Logger {
    return this.withContext({ requestId });
  }

  withUserId(userId: string): Logger {
    return this.withContext({ userId });
  }

  withTraceId(traceId: string): Logger {
    return this.withContext({ traceId });
  }

  // Performance logging
  startTimer(name: string): Timer {
    const startTime = performance.now();
    
    return {
      end: (data?: Record<string, any>) => {
        const duration = performance.now() - startTime;
        this.logDuration(name, duration, data);
      },
      getDuration: () => performance.now() - startTime,
    };
  }

  logDuration(name: string, duration: number, data?: Record<string, any>): void {
    this.info(`Timer: ${name}`, {
      timer: name,
      duration,
      ...data,
    });
  }

  // Structured logging helpers
  logRequest(request: HttpRequest, response?: HttpResponse): void {
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

  logDatabaseQuery(query: DatabaseQuery): void {
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

  logSecurityEvent(event: SecurityEvent): void {
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
  async flush(): Promise<void> {
    const promises = this.transports.map(transport => transport.flush());
    await Promise.all(promises);
  }

  async close(): Promise<void> {
    await this.flush();
    const promises = this.transports.map(transport => transport.close());
    await Promise.all(promises);
  }
}

// Transport implementations
abstract class LogTransport {
  protected config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  abstract write(entry: LogEntry): Promise<void>;
  abstract flush(): Promise<void>;
  abstract close(): Promise<void>;

  shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }
}

class ConsoleTransport extends LogTransport {
  async write(entry: LogEntry): Promise<void> {
    const output = this.config.format === 'json' 
      ? JSON.stringify(entry)
      : this.formatForConsole(entry);

    if (entry.level >= LogLevel.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  private formatForConsole(entry: LogEntry): string {
    const ts = new Date(entry.timestamp).toLocaleTimeString();
    const levelName = LogLevel[entry.level];
    const service = entry.context.service || 'unknown';
    const env = (entry.context as any).environment || process.env.NODE_ENV || 'development';
    const message = entry.message;

    const useColor = process.stdout.isTTY && process.env.NO_COLOR !== '1';
    const paint = (s: string, code: number) => useColor ? `\u001b[${code}m${s}\u001b[0m` : s;
    const dim = (s: string) => paint(s, 2);
    const bold = (s: string) => paint(s, 1);
    const fg = {
      gray: (s: string) => paint(s, 90),
      red: (s: string) => paint(s, 31),
      green: (s: string) => paint(s, 32),
      yellow: (s: string) => paint(s, 33),
      blue: (s: string) => paint(s, 34),
      magenta: (s: string) => paint(s, 35),
      cyan: (s: string) => paint(s, 36),
      white: (s: string) => paint(s, 37),
    };

    const levelColors: Record<string, (s: string) => string> = {
      TRACE: fg.gray,
      DEBUG: fg.blue,
      INFO: fg.green,
      WARN: fg.yellow,
      ERROR: fg.red,
      FATAL: fg.magenta,
    };

    const levelIcons: Record<string, string> = {
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
    const ctxParts: string[] = [];
    const ctx = entry.context || ({} as any);
    if (ctx.requestId) ctxParts.push(`${dim('req=')}${ctx.requestId}`);
    if (ctx.traceId) ctxParts.push(`${dim('trace=')}${ctx.traceId}`);
    if (ctx.spanId) ctxParts.push(`${dim('span=')}${ctx.spanId}`);
    if (ctx.userId) ctxParts.push(`${dim('user=')}${ctx.userId}`);
    if (ctx.ip) ctxParts.push(`${dim('ip=')}${ctx.ip}`);
    if (ctxParts.length) {
      out += `\n  ${fg.cyan(bold('Context:'))} ${ctxParts.join('  ')}`;
    }

    // Error details
    if (entry.error) {
      const err = entry.error;
      out += `\n  ${fg.red(bold('Error:'))} ${err.name}: ${err.message}`;
      if (err.stack) out += `\n${dim(err.stack)}`;
    }

    // HTTP details (if present in data)
    const data = { ...(entry.data || {}) } as any;
    if (data.http) {
      const h = data.http;
      out += `\n  ${fg.yellow(bold('HTTP:'))} ${h.method || ''} ${h.url || ''}`;
      const httpMeta: string[] = [];
      if (h.statusCode !== undefined) httpMeta.push(`${dim('status=')}${h.statusCode}`);
      if (h.duration !== undefined) httpMeta.push(`${dim('duration=')}${h.duration}ms`);
      if (h.ip) httpMeta.push(`${dim('ip=')}${h.ip}`);
      if (h.userAgent) httpMeta.push(`${dim('ua=')}${h.userAgent}`);
      if (httpMeta.length) out += `\n    ${httpMeta.join('  ')}`;
      delete data.http;
    }

    // Timer/metrics hint
    if (data.timer || data.duration) {
      out += `\n  ${fg.magenta(bold('Metrics:'))} ${data.timer ? `${dim('timer=')}${data.timer}  ` : ''}${data.duration !== undefined ? `${dim('duration=')}${data.duration}ms` : ''}`;
      delete data.timer; delete data.duration;
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

  async flush(): Promise<void> {
    // Console doesn't need flushing
  }

  async close(): Promise<void> {
    // Console doesn't need closing
  }
}

class FileTransport extends LogTransport {
  private writeStream?: any; // Would implement with fs.createWriteStream

  async write(entry: LogEntry): Promise<void> {
    // Implementation would write to file with rotation
    const output = JSON.stringify(entry) + '\n';
    // this.writeStream.write(output);
  }

  async flush(): Promise<void> {
    // Flush file stream
  }

  async close(): Promise<void> {
    // Close file stream
  }
}

class HttpTransport extends LogTransport {
  async write(entry: LogEntry): Promise<void> {
    if (!this.config.http) return;

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
    } catch (error) {
      console.error('Error sending log to HTTP endpoint:', error);
    }
  }

  async flush(): Promise<void> {
    // HTTP doesn't need flushing
  }

  async close(): Promise<void> {
    // HTTP doesn't need closing
  }
}

// Context utilities for Express/Fastify middleware
export function createRequestContext(requestId?: string): LogContext {
  return {
    requestId: requestId || randomUUID(),
    traceId: randomUUID(),
    service: 'unknown',
    environment: process.env.NODE_ENV || 'development',
  };
}

export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return contextStorage.run(context, fn);
}

export function getContext(): LogContext | undefined {
  return contextStorage.getStore();
}

// Factory function for easy logger creation
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new SuuupraLogger(config);
}

// Express middleware
export function expressLoggingMiddleware(logger: Logger) {
  return (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    const context = createRequestContext(requestId);
    
    runWithContext(context, () => {
      const startTime = performance.now();
      
      res.on('finish', () => {
        const duration = performance.now() - startTime;
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
export function fastifyLoggingPlugin(fastify: any, options: any, done: any) {
  const logger = createLogger(options);
  
  fastify.addHook('onRequest', async (request: any, reply: any) => {
    const requestId = request.headers['x-request-id'] || randomUUID();
    const context = createRequestContext(requestId);
    
    request.logContext = context;
    request.logger = logger.withContext(context);
  });
  
  fastify.addHook('onResponse', async (request: any, reply: any) => {
    if (request.logger) {
      request.logger.logRequest({
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      }, {
        statusCode: reply.statusCode,
        duration: (reply as any).elapsedTime ?? reply.getResponseTime?.(),
      });
    }
  });
  
  done();
}

export { LogLevel } from '../core/types';
export type { Logger, LoggerConfig, LogContext } from '../core/types';
