import { config } from './config/index.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { DatabaseManager } from './core/database.js';
import { RedisManager } from './core/redis.js';
import { MediaSoupManager } from './core/mediasoup.js';

async function bootstrap() {
  try {
    // Initialize core services
    logger.info('🚀 Starting Live Classes Service...');
    
    // Initialize database
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    logger.info('✅ Database connected');

    // Initialize Redis
    const redisManager = new RedisManager();
    await redisManager.initialize();
    logger.info('✅ Redis connected');

    // Initialize MediaSoup
    const mediaSoupManager = new MediaSoupManager();
    await mediaSoupManager.initialize();
    logger.info('✅ MediaSoup workers initialized');

    // Create and start Fastify app
    const app = await createApp({
      database: dbManager,
      redis: redisManager,
      mediaSoup: mediaSoupManager
    });

    // Start server
    const port = config.server.port;
    const host = config.server.host;
    
    await app.listen({ port, host });
    logger.info(`🎬 Live Classes Service running on ${host}:${port}`);
    logger.info(`📖 API Documentation: http://${host}:${port}/docs`);
    logger.info(`📊 Metrics: http://${host}:${port}/metrics`);

  } catch (error) {
    logger.error('❌ Failed to start Live Classes Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

bootstrap();
