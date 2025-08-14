import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import logger from '../utils/logger';

export async function setupHttpServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false, // We use our custom logger
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Register plugins
  await server.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });

  await server.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
  });

  await server.register(require('@fastify/rate-limit'), {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  // Request logging middleware
  server.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any).log = logger.child({ 
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
    (request as any).log.info('Incoming request');
  });

  // Response logging middleware
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    (request as any).log.info({ 
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });

  // Error handler
  server.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    (request as any).log.error({ error: error.message, stack: error.stack }, 'Request error');
    
    if ((error as any).statusCode && (error as any).statusCode < 500) {
      await reply.status((error as any).statusCode).send({
        error: error.message,
        statusCode: (error as any).statusCode,
      });
    } else {
      await reply.status(500).send({
        error: 'Internal Server Error',
        statusCode: 500,
      });
    }
  });

  // Health check endpoint
  server.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { checkDatabaseHealth } = await import('../config/database');
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] || '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: await checkDatabaseHealth(),
      },
    };

    const isHealthy = Object.values(health.checks).every(Boolean);
    
    if (!isHealthy) {
      health.status = 'unhealthy';
      await reply.status(503).send(health);
    } else {
      await reply.send(health);
    }
  });

  // Readiness check endpoint
  server.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.send({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });

  // Liveness check endpoint
  server.get('/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  await server.register(require('./routes/admin'), { prefix: '/api/admin' });
  await server.register(require('./routes/banks'), { prefix: '/api/banks' });
  await server.register(require('./routes/accounts'), { prefix: '/api/accounts' });
  await server.register(require('./routes/transactions'), { prefix: '/api/transactions' });

  // Real transaction routes for integration testing
  const { registerRealTransactionRoutes } = await import('./routes/real-transactions');
  const { createPrismaClient } = await import('../config/database');
  const prisma = createPrismaClient();
  await registerRealTransactionRoutes(server, prisma);

  // Swagger documentation
  if (config.env === 'development') {
    await server.register(require('@fastify/swagger'), {
      openapi: {
        info: {
          title: 'Bank Simulator API',
          description: 'Mock banking backend for UPI ecosystem simulation',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${config.port}`,
            description: 'Development server',
          },
        ],
      },
    });

    await server.register(require('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });
  }

  return server;
}
