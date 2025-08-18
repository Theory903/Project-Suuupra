import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { DatabaseManager } from './core/database.js';
import { RedisManager } from './core/redis.js';
import { MediaSoupManager } from './core/mediasoup.js';

// Import routes
import { roomRoutes } from './routes/rooms.js';
import { authRoutes } from './routes/auth.js';
import { recordingRoutes } from './routes/recording.js';
import { analyticsRoutes } from './routes/analytics.js';
import { adminRoutes } from './routes/admin.js';

// Import WebSocket handlers
import { setupWebSocketHandlers } from './websocket/handlers.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';
import { metricsMiddleware } from './middleware/metrics.js';

export interface AppDependencies {
  database: DatabaseManager;
  redis: RedisManager;
  mediaSoup: MediaSoupManager;
}

export async function createApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => require('uuid').v4()
  });

  // Register plugins
  await app.register(cors, {
    origin: config.security.corsOrigin,
    credentials: true
  });

  if (config.security.helmetEnabled) {
    await app.register(helmet, {
      contentSecurityPolicy: false
    });
  }

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
    redis: deps.redis.redis
  });

  await app.register(websocket);

  // Swagger documentation
  await app.register(swagger, {
    swagger: {
      info: {
        title: 'Live Classes API',
        description: 'Production-ready live classes service with WebRTC and recording',
        version: '1.0.0'
      },
      host: `${config.server.host}:${config.server.port}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'rooms', description: 'Room management endpoints' },
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'recording', description: 'Recording management endpoints' },
        { name: 'analytics', description: 'Analytics endpoints' },
        { name: 'admin', description: 'Admin endpoints' }
      ]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });

  // Add dependencies to app context
  app.decorate('db', deps.database);
  app.decorate('redis', deps.redis);
  app.decorate('mediaSoup', deps.mediaSoup);

  // Register middleware
  await app.register(metricsMiddleware);
  await app.register(authMiddleware);

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    const dbHealth = await deps.database.healthCheck();
    const redisHealth = await deps.redis.healthCheck();
    
    const health = {
      status: dbHealth && redisHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: config.server.name,
      version: '1.0.0',
      checks: {
        database: dbHealth ? 'up' : 'down',
        redis: redisHealth ? 'up' : 'down',
        mediasoup: deps.mediaSoup ? 'up' : 'down'
      }
    };

    return reply.code(health.status === 'healthy' ? 200 : 503).send(health);
  });

  // Metrics endpoint
  app.get('/metrics', async (request, reply) => {
    const workerStats = await deps.mediaSoup.getWorkerStats();
    const metrics = {
      timestamp: new Date().toISOString(),
      workers: workerStats,
      redis: {
        connected: deps.redis.redis.status === 'ready'
      }
    };
    
    return reply.send(metrics);
  });

  // Register API routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(roomRoutes, { prefix: '/api/v1/rooms' });
  await app.register(recordingRoutes, { prefix: '/api/v1/recording' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  // Setup WebSocket handlers
  await setupWebSocketHandlers(app, deps);

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    logger.error('Unhandled error:', error);
    
    const statusCode = error.statusCode || 500;
    const response = {
      error: true,
      message: statusCode === 500 ? 'Internal Server Error' : error.message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId: request.id
    };

    return reply.code(statusCode).send(response);
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    logger.info('Shutting down Live Classes Service...');
    
    try {
      await deps.mediaSoup.shutdown();
      await deps.redis.disconnect();
      await deps.database.disconnect();
      await app.close();
      logger.info('✅ Graceful shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return app;
}
