// src/server.ts
import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyOAuth2 from "@fastify/oauth2";
import { serviceRegistry, circuitBreakers } from "./services";
import { PassThrough } from "stream";

const app = fastify({ logger: true });
const port = 8080;

// In a real application, this should be loaded from environment variables
const JWT_SECRET = "supersecretjwtkey";

app.register(fastifyJwt, {
  secret: JWT_SECRET,
});

// Placeholder for OAuth2 configuration. You'll need to replace these with your actual values.
// This example assumes a generic OAuth2 provider.
app.register(fastifyOAuth2, {
  name: "googleOAuth2",
  scope: ["profile", "email"],
  credentials: {
    client: {
      id: "YOUR_GOOGLE_CLIENT_ID",
      secret: "YOUR_GOOGLE_CLIENT_SECRET",
    },
    auth: fastifyOAuth2.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: "/login/google",
  callbackUri: "http://localhost:8080/login/google/callback",
});

app.get("/healthz", (req, reply) => {
  reply.send({ suxxess: true });
});

// Authentication pre-handler
app.decorate("authenticate", async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Generic proxy route
app.all("/:serviceName/*", async (req, reply) => {
  const { serviceName } = req.params as { serviceName: keyof typeof serviceRegistry };
  const serviceUrl = serviceRegistry[serviceName];

  if (!serviceUrl) {
    return reply.status(404).send({ error: "Service not found" });
  }

  const breaker = circuitBreakers[serviceName];

  try {
    const result = await breaker.fire(req, serviceUrl);

    if (result.statusCode && result.body) {
      // Fallback response
      reply.status(result.statusCode).send(result.body);
    } else {
      // Proxy the response
      reply.raw.writeHead(result.statusCode || 200, result.headers);
      const passThrough = new PassThrough();
      result.pipe(passThrough);
      reply.send(passThrough);
    }
  } catch (err: any) {
    if (err.code === "EOPENBREAKER") {
      reply.status(503).send({ error: `Service '${serviceName}' is unavailable.` });
    } else {
      app.log.error(err);
      reply.status(500).send({ error: "An unexpected error occurred." });
    }
  }
});

// Protected route
app.get(
  "/protected",
  { preHandler: [app.authenticate] },
  async (request, reply) => {
    reply.send({
      message: "Welcome to the protected route!",
      user: request.user,
    });
  },
);

const start = async () => {
  try {
    await app.listen({ port });
    app.log.info(`API Gateway listening on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();