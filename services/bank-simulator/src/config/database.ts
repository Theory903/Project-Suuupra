import { PrismaClient } from '@prisma/client';
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
    prisma.$on('query', (e) => {
      logger.debug('Database Query', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    });
  }

  // Log errors
  prisma.$on('error', (e) => {
    logger.error('Database Error', { error: e });
  });

  // Log warnings
  prisma.$on('warn', (e) => {
    logger.warn('Database Warning', { warning: e });
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
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
};

export { prisma };
export default createPrismaClient;
