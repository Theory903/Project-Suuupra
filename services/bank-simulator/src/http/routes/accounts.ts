import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const accountsRoutes: FastifyPluginAsync = async (fastify) => {
  // Placeholder for account routes
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.send({
      success: true,
      message: 'Accounts API - Coming Soon',
      data: [],
    });
  });
};

export = accountsRoutes;
