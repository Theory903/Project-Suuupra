import winston from 'winston';
import { config } from '@/config';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: config.service.serviceName,
      environment: config.service.environment,
      ...meta
    };
    
    return JSON.stringify(logEntry);
  })
);

// Create logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: config.observability.logLevel,
  format: logFormat,
  defaultMeta: {
    service: config.service.serviceName,
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.service.environment === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          )
        : logFormat
    })
  ],
  exitOnError: false
});

// Add file transport for production
if (config.service.environment === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    tailable: true
  }));
}

// Request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Log request
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    userId: req.user?.id,
    tenantId: req.user?.tenantId
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    });
    
    originalEnd.call(res, chunk, encoding);
  };
  
  next();
};

// Error logger
export const errorLogger = (error: Error, req: any, res: any, next: any) => {
  logger.error('Request error', {
    requestId: req.requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    method: req.method,
    url: req.url,
    userId: req.user?.id,
    tenantId: req.user?.tenantId
  });
  
  next(error);
};

// Utility functions
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Context logger for structured logging
export class ContextLogger {
  private context: Record<string, any>;
  
  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }
  
  addContext(key: string, value: any): ContextLogger {
    return new ContextLogger({ ...this.context, [key]: value });
  }
  
  info(message: string, meta?: Record<string, any>): void {
    logger.info(message, { ...this.context, ...meta });
  }
  
  warn(message: string, meta?: Record<string, any>): void {
    logger.warn(message, { ...this.context, ...meta });
  }
  
  error(message: string, error?: Error, meta?: Record<string, any>): void {
    logger.error(message, {
      ...this.context,
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
  
  debug(message: string, meta?: Record<string, any>): void {
    logger.debug(message, { ...this.context, ...meta });
  }
}

// Export default logger
export default logger;
