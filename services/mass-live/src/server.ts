// services/mass-live/src/server.ts
import fastify from 'fastify';

const app = fastify({ logger: true });
const serviceName = 'mass-live';
const port = 8088;

app.get('/*', async (request, reply) => {
  app.log.info(`${serviceName} service received request for ${request.url}`);
  reply.send(`Hello from the ${serviceName} service! You requested: ${request.url}`);
});

const start = async () => {
  try {
    await app.listen({ port });
    console.log(`${serviceName} service listening on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
