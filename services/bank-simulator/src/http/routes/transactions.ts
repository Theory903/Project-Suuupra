import { FastifyPluginAsync } from 'fastify';

const transactionsRoutes: FastifyPluginAsync = async (fastify) => {
  // Placeholder for transaction routes
  fastify.get('/', async (request, reply) => {
    await reply.send({
      success: true,
      message: 'Transactions API - Coming Soon',
      data: [],
    });
  });
};

export = transactionsRoutes;
