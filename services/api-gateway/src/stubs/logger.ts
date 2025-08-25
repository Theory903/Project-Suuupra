/**
 * Stub implementation for shared logging library
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  withRequestId(id: string): Logger;
  withContext(context: any): Logger;
}

class SimpleLogger implements Logger {
  private requestId?: string;
  private context?: any;

  constructor(private config: any = {}) {}

  info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${this.formatMessage(message)}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${this.formatMessage(message)}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${this.formatMessage(message)}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${this.formatMessage(message)}`, ...args);
  }

  withRequestId(id: string): Logger {
    const logger = new SimpleLogger(this.config);
    logger.requestId = id;
    logger.context = this.context;
    return logger;
  }

  withContext(context: any): Logger {
    const logger = new SimpleLogger(this.config);
    logger.requestId = this.requestId;
    logger.context = { ...this.context, ...context };
    return logger;
  }

  private formatMessage(message: string): string {
    const parts = [];
    if (this.requestId) parts.push(`[${this.requestId}]`);
    if (this.context?.traceId) parts.push(`[trace:${this.context.traceId}]`);
    return `${parts.join('')} ${message}`;
  }
}

export function createLogger(config: any): Logger {
  return new SimpleLogger(config);
}
