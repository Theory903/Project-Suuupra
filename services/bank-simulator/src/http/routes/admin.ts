import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // System status endpoint
  fastify.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { checkDatabaseHealth } = await import('../../config/database');
    
    const status = {
      service: 'bank-simulator',
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      health: {
        database: await checkDatabaseHealth(),
      },
    };

    await reply.send({
      success: true,
      data: status,
    });
  });

  // Service metrics endpoint
  fastify.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Placeholder for custom metrics
    await reply.send({
      success: true,
      message: 'Metrics endpoint - Coming Soon',
      data: {
        totalRequests: 0,
        totalTransactions: 0,
        successRate: 100,
      },
    });
  });
};

export = adminRoutes;
