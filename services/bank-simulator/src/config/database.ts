import { PrismaClient } from '@prisma/client';
// TODO: Properly type QueryEvent and LogEvent from Prisma client
// import { QueryEvent, LogEvent } from '@prisma/client/runtime/library'; // Import specific event types

interface QueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
}

interface LogEvent {
  timestamp: Date;
  message: string;
  target: string;
  level: string;
}

import { config } from './index';
import logger from '../utils/logger';

// Prisma Client singleton
let prisma: PrismaClient;

export const createPrismaClient = (): PrismaClient => {
  if (prisma) {
    return prisma;
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.database.url,
      },
    },
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });

  // Log queries in development
  if (config.env === 'development') {
    (prisma as any).$on('query', (e: QueryEvent) => {
      logger.debug('Database Query', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    });
  }

  // Log errors
  (prisma as any).$on('error', (e: LogEvent) => {
    logger.error('Database Error', { error: e.message });
  });

  // Log warnings
  (prisma as any).$on('warn', (e: LogEvent) => {
    logger.warn('Database Warning', { warning: e.message });
  });

  return prisma;
};

export const disconnectDatabase = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
};

// Health check for database
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    logger.debug('Database health check passed', { result });
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error instanceof Error ? error.message : error });
    return false;
  }
};

export { prisma };
export default createPrismaClient;
