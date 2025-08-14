import 'dotenv/config';
import { startServer } from './server';
import { createPrismaClient, disconnectDatabase } from './config/database';
import logger from './utils/logger';
import { config } from './config';

// Global error handlers
process.on('uncaughtException', (error: Error) => {
  logger.fatal('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.fatal('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await shutdown();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await shutdown();
});

async function shutdown(): Promise<void> {
  try {
    // Disconnect from database
    await disconnectDatabase();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  try {
    logger.info('Starting Bank Simulator Service', {
      version: process.env['npm_package_version'] || '1.0.0',
      environment: config.env,
      nodeVersion: process.version,
    });

    // Initialize database connection
    const prisma = createPrismaClient();
    logger.info('Database connection established');

    // Test database connection
    try {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      logger.info('Database health check passed', { result });
    } catch (dbError) {
      logger.error('Database test query failed', { 
        error: dbError instanceof Error ? dbError.message : dbError,
        stack: dbError instanceof Error ? dbError.stack : undefined,
        databaseUrl: config.database.url
      });
      throw dbError;
    }

    // Start the server (HTTP + gRPC)
    await startServer();

    logger.info('Bank Simulator Service started successfully', {
      httpPort: config.port,
      grpcPort: config.grpc.port,
      metricsPort: config.observability.metricsPort,
    });

  } catch (error) {
    logger.fatal('Failed to start Bank Simulator Service', { error });
    process.exit(1);
  }
}

// Start the application
bootstrap().catch((error) => {
  logger.fatal('Bootstrap failed', { error });
  process.exit(1);
});
