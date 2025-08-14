import pino from 'pino';
import { config } from '../config';

// Create logger instance
const logger = pino({
  level: config.observability.logLevel,
  transport: config.env === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: config.observability.serviceName,
    version: process.env.npm_package_version || '1.0.0',
  },
});

// Add request ID to logger context
export const createRequestLogger = (requestId: string) => {
  return logger.child({ requestId });
};

// Add transaction context to logger
export const createTransactionLogger = (transactionId: string, bankCode?: string) => {
  return logger.child({ 
    transactionId,
    bankCode,
    context: 'transaction'
  });
};

// Add account context to logger
export const createAccountLogger = (accountNumber: string, bankCode?: string) => {
  return logger.child({ 
    accountNumber,
    bankCode,
    context: 'account'
  });
};

export default logger;
