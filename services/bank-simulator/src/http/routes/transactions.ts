import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const transactionsRoutes: FastifyPluginAsync = async (fastify) => {
  // Placeholder for transaction routes
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.send({
      success: true,
      message: 'Transactions API - Coming Soon',
      data: [],
    });
  });
};

export = transactionsRoutes;
