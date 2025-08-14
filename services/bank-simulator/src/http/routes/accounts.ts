import { FastifyPluginAsync } from 'fastify';

const accountsRoutes: FastifyPluginAsync = async (fastify) => {
  // Placeholder for account routes
  fastify.get('/', async (request, reply) => {
    await reply.send({
      success: true,
      message: 'Accounts API - Coming Soon',
      data: [],
    });
  });
};

export = accountsRoutes;
