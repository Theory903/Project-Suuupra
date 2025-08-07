import Fastify, { FastifyInstance } from 'fastify';
import { GatewayConfig } from '../../src/types/gateway';

export async function createServer(config: GatewayConfig): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false, // Disable logging during tests
    disableRequestLogging: true
  });

  // Register basic plugins for testing
  await server.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
  });

  // Mock gateway functionality for testing
  // In a real implementation, this would load the full gateway
  
  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Metrics endpoint
  server.get('/metrics', async () => {
    return `# HELP gateway_requests_total Total requests
# TYPE gateway_requests_total counter
gateway_requests_total{route="test"} 1

# HELP gateway_request_duration_seconds Request duration
# TYPE gateway_request_duration_seconds histogram
gateway_request_duration_seconds_bucket{le="0.1"} 1
gateway_request_duration_seconds_bucket{le="+Inf"} 1
gateway_request_duration_seconds_sum 0.05
gateway_request_duration_seconds_count 1
`;
  });

  // Mock route handlers based on config
  for (const route of config.routes) {
    const path = route.matcher.pathPrefix || '/';
    const methods = route.matcher.methods;

    for (const method of methods) {
      const handler = async (request: any, reply: any) => {
        // Mock authentication check
        if (route.policy.auth?.enabled) {
          const authHeader = request.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Authentication required' });
          }

          const token = authHeader.split(' ')[1];
          if (token === 'invalid-token') {
            return reply.code(401).send({ error: 'Invalid token' });
          }

          // Mock JWT validation (simplified)
          try {
            const jwt = require('jsonwebtoken');
            jwt.verify(token, 'test-secret-key');
          } catch (error) {
            return reply.code(401).send({ error: 'Invalid token' });
          }
        }

        // Mock rate limiting check
        if (route.policy.rateLimit?.enabled) {
          const rateLimitKey = `${request.ip}:${route.id}`;
          const requestCount = mockRateLimitStore.get(rateLimitKey) || 0;
          
          if (requestCount >= route.policy.rateLimit.requests) {
            return reply
              .code(429)
              .header('X-RateLimit-Limit', route.policy.rateLimit.requests.toString())
              .header('X-RateLimit-Remaining', '0')
              .header('X-RateLimit-Reset', (Date.now() + 60000).toString())
              .header('Retry-After', '60')
              .send({ error: 'Rate limit exceeded' });
          }

          mockRateLimitStore.set(rateLimitKey, requestCount + 1);
          
          // Set rate limit headers
          reply.header('X-RateLimit-Limit', route.policy.rateLimit.requests.toString());
          reply.header('X-RateLimit-Remaining', (route.policy.rateLimit.requests - requestCount - 1).toString());
          reply.header('X-RateLimit-Reset', (Date.now() + 60000).toString());
        }

        // Mock circuit breaker check
        if (route.policy.circuitBreaker?.enabled) {
          const circuitBreakerKey = route.target.serviceName;
          const failures = mockCircuitBreakerStore.get(circuitBreakerKey) || 0;
          
          if (failures >= route.policy.circuitBreaker.failureThreshold) {
            return reply
              .code(503)
              .header('X-Circuit-Breaker', 'open')
              .header('Retry-After', '5')
              .send({ error: 'Circuit breaker open' });
          }
        }

        // Mock upstream call
        try {
          const upstreamUrl = route.target.discovery.endpoints?.[0];
          if (!upstreamUrl) {
            throw new Error('No upstream endpoint');
          }

          const upstreamResponse = await fetch(`${upstreamUrl}${request.url.replace(path, '')}`);
          
          if (!upstreamResponse.ok) {
            // Record failure for circuit breaker
            if (route.policy.circuitBreaker?.enabled) {
              const circuitBreakerKey = route.target.serviceName;
              const failures = mockCircuitBreakerStore.get(circuitBreakerKey) || 0;
              mockCircuitBreakerStore.set(circuitBreakerKey, failures + 1);
            }
            throw new Error(`Upstream error: ${upstreamResponse.status}`);
          }

          // Reset circuit breaker failures on success
          if (route.policy.circuitBreaker?.enabled) {
            mockCircuitBreakerStore.delete(route.target.serviceName);
          }

          const contentType = upstreamResponse.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const data = await upstreamResponse.json();
            return reply.send(data);
          } else if (contentType?.includes('text/event-stream')) {
            const data = await upstreamResponse.text();
            return reply
              .header('Content-Type', 'text/event-stream')
              .header('Cache-Control', 'no-cache')
              .send(data);
          } else {
            const data = await upstreamResponse.text();
            return reply.send(data);
          }
        } catch (error) {
          // Record failure for circuit breaker
          if (route.policy.circuitBreaker?.enabled) {
            const circuitBreakerKey = route.target.serviceName;
            const failures = mockCircuitBreakerStore.get(circuitBreakerKey) || 0;
            mockCircuitBreakerStore.set(circuitBreakerKey, failures + 1);
          }

          return reply.code(502).send({ error: 'Bad Gateway' });
        }
      };

      // Register route handler
      const routePath = `${path}/*`;
      switch (method.toLowerCase()) {
        case 'get':
          server.get(routePath, handler);
          break;
        case 'post':
          server.post(routePath, handler);
          break;
        case 'put':
          server.put(routePath, handler);
          break;
        case 'delete':
          server.delete(routePath, handler);
          break;
        case 'patch':
          server.patch(routePath, handler);
          break;
        case 'head':
          server.head(routePath, handler);
          break;
        case 'options':
          server.options(routePath, handler);
          break;
      }
    }
  }

  // Admin API endpoints
  if (config.admin?.apiEnabled) {
    server.register(async function adminRoutes(fastify) {
      fastify.addHook('preHandler', async (request, reply) => {
        // Mock admin authentication
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.includes('admin-token')) {
          return reply.code(401).send({ error: 'Admin authentication required' });
        }
      });

      // Route management
      fastify.post('/admin/api/v1/routes', async (request, reply) => {
        return reply.code(201).send({ message: 'Route created' });
      });

      fastify.get('/admin/api/v1/routes/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const route = config.routes.find(r => r.id === id);
        if (!route) {
          return reply.code(404).send({ error: 'Route not found' });
        }
        return route;
      });

      // Rate limit management
      fastify.post('/admin/api/v1/rate-limits/clear', async (request, reply) => {
        mockRateLimitStore.clear();
        return { message: 'Rate limits cleared' };
      });

      // Circuit breaker management
      fastify.post('/admin/api/v1/circuit-breakers/reset', async (request, reply) => {
        mockCircuitBreakerStore.clear();
        return { message: 'Circuit breakers reset' };
      });

      fastify.post('/admin/api/v1/circuit-breakers/:service/reset', async (request, reply) => {
        const { service } = request.params as { service: string };
        mockCircuitBreakerStore.delete(service);
        return { message: `Circuit breaker reset for ${service}` };
      });
    });
  }

  // WebSocket support
  if (config.features?.websockets) {
    await server.register(require('@fastify/websocket'));

    server.register(async function websocketRoutes(fastify) {
      fastify.get('/ws', { websocket: true }, (connection, request) => {
        // Mock WebSocket authentication
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          connection.socket.close(1008, 'Authentication required');
          return;
        }

        const token = authHeader.split(' ')[1];
        try {
          const jwt = require('jsonwebtoken');
          jwt.verify(token, 'test-secret-key');
        } catch (error) {
          connection.socket.close(1008, 'Invalid token');
          return;
        }

        connection.socket.on('message', (message) => {
          // Echo the message back
          connection.socket.send(JSON.stringify({
            echo: JSON.parse(message.toString()),
            timestamp: new Date().toISOString()
          }));
        });
      });
    });
  }

  return server;
}

// Mock stores for testing
const mockRateLimitStore = new Map<string, number>();
const mockCircuitBreakerStore = new Map<string, number>();

// Clear stores periodically
setInterval(() => {
  mockRateLimitStore.clear();
}, 60000); // Clear every minute for rate limiting

setInterval(() => {
  // Decay circuit breaker failures
  for (const [key, failures] of mockCircuitBreakerStore.entries()) {
    if (failures > 0) {
      mockCircuitBreakerStore.set(key, Math.max(0, failures - 1));
    }
  }
}, 5000); // Decay every 5 seconds
