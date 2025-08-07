import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import * as http from 'http';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { createServer } from '../helpers/testServer';
import { createMockUpstream } from '../helpers/mockUpstream';
import { GatewayConfig } from '../../src/types/gateway';

// Test configuration
const TEST_CONFIG: GatewayConfig = {
  version: '2.0.0',
  server: {
    port: 0, // Let system assign port
    cors: {
      enabled: true,
      origins: ['*']
    }
  },
  routes: [
    {
      id: 'auth-required-route',
      matcher: {
        pathPrefix: '/api/secure',
        methods: ['GET', 'POST']
      },
      target: {
        serviceName: 'secure-service',
        discovery: {
          type: 'static',
          endpoints: ['http://localhost:8081']
        }
      },
      policy: {
        auth: {
          enabled: true,
          jwt: {
            enabled: true,
            issuer: 'test-issuer',
            audience: 'test-audience',
            jwksUri: 'http://localhost:8082/.well-known/jwks.json'
          }
        },
        rateLimit: {
          enabled: true,
          requests: 10,
          window: 60,
          keys: ['ip']
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          timeoutMs: 1000,
          resetTimeoutMs: 5000
        }
      }
    },
    {
      id: 'public-route',
      matcher: {
        pathPrefix: '/api/public',
        methods: ['GET']
      },
      target: {
        serviceName: 'public-service',
        discovery: {
          type: 'static',
          endpoints: ['http://localhost:8083']
        }
      },
      policy: {
        auth: {
          enabled: false
        },
        rateLimit: {
          enabled: true,
          requests: 100,
          window: 60,
          keys: ['ip']
        }
      }
    },
    {
      id: 'streaming-route',
      matcher: {
        pathPrefix: '/api/stream',
        methods: ['GET']
      },
      target: {
        serviceName: 'streaming-service',
        discovery: {
          type: 'static',
          endpoints: ['http://localhost:8084']
        }
      },
      policy: {
        auth: {
          enabled: false
        }
      }
    },
    {
      id: 'websocket-route',
      matcher: {
        pathPrefix: '/ws',
        methods: ['GET']
      },
      target: {
        serviceName: 'websocket-service',
        discovery: {
          type: 'static',
          endpoints: ['http://localhost:8085']
        }
      },
      policy: {
        auth: {
          enabled: true,
          jwt: {
            enabled: true,
            issuer: 'test-issuer',
            audience: 'test-audience'
          }
        }
      }
    }
  ],
  services: [
    {
      name: 'secure-service',
      discovery: {
        type: 'static',
        endpoints: ['http://localhost:8081']
      }
    },
    {
      name: 'public-service',
      discovery: {
        type: 'static',
        endpoints: ['http://localhost:8083']
      }
    },
    {
      name: 'streaming-service',
      discovery: {
        type: 'static',
        endpoints: ['http://localhost:8084']
      }
    },
    {
      name: 'websocket-service',
      discovery: {
        type: 'static',
        endpoints: ['http://localhost:8085']
      }
    }
  ],
  features: {
    prometheusMetrics: true,
    rateLimiting: true,
    circuitBreakers: true,
    streaming: true,
    websockets: true,
    aiFeatures: false
  },
  admin: {
    apiEnabled: true,
    hotReloadEnabled: true,
    secretsManagementEnabled: false
  }
};

describe('API Gateway E2E Tests', () => {
  let gateway: FastifyInstance;
  let gatewayPort: number;
  let gatewayUrl: string;
  
  // Mock upstream servers
  let secureService: http.Server;
  let publicService: http.Server;
  let streamingService: http.Server;
  let websocketService: http.Server;
  let authService: http.Server;

  // Test JWT
  const jwtSecret = 'test-secret-key';
  const validToken = jwt.sign(
    {
      sub: 'test-user',
      aud: 'test-audience',
      iss: 'test-issuer',
      exp: Math.floor(Date.now() / 1000) + 3600,
      scope: 'read write'
    },
    jwtSecret
  );

  beforeAll(async () => {
    // Start mock upstream services
    secureService = createMockUpstream(8081, {
      '/': { statusCode: 200, body: { message: 'Secure service response' } }
    });

    publicService = createMockUpstream(8083, {
      '/': { statusCode: 200, body: { message: 'Public service response' } }
    });

    streamingService = createMockUpstream(8084, {
      '/': {
        statusCode: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"message": "streaming data"}\n\n'
      }
    });

    websocketService = createMockUpstream(8085, {
      '/': { statusCode: 200, body: { message: 'WebSocket service' } }
    });

    // Mock JWKS endpoint
    authService = createMockUpstream(8082, {
      '/.well-known/jwks.json': {
        statusCode: 200,
        body: {
          keys: [
            {
              kty: 'oct',
              kid: 'test-key',
              use: 'sig',
              alg: 'HS256',
              k: Buffer.from(jwtSecret).toString('base64url')
            }
          ]
        }
      }
    });

    // Start gateway
    gateway = await createServer(TEST_CONFIG);
    await gateway.listen({ port: 0, host: '127.0.0.1' });
    
    const address = gateway.server.address();
    gatewayPort = typeof address === 'string' ? 0 : address?.port || 0;
    gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await gateway?.close();
    secureService?.close();
    publicService?.close();
    streamingService?.close();
    websocketService?.close();
    authService?.close();
  });

  describe('Authentication Flow', () => {
    it('should allow access to public routes without authentication', async () => {
      const response = await fetch(`${gatewayUrl}/api/public/test`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.message).toBe('Public service response');
    });

    it('should reject access to secure routes without token', async () => {
      const response = await fetch(`${gatewayUrl}/api/secure/test`);
      expect(response.status).toBe(401);
    });

    it('should reject access with invalid token', async () => {
      const response = await fetch(`${gatewayUrl}/api/secure/test`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      expect(response.status).toBe(401);
    });

    it('should allow access with valid JWT token', async () => {
      const response = await fetch(`${gatewayUrl}/api/secure/test`, {
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.message).toBe('Secure service response');
    });

    it('should reject expired JWT token', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'test-user',
          aud: 'test-audience',
          iss: 'test-issuer',
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        },
        jwtSecret
      );

      const response = await fetch(`${gatewayUrl}/api/secure/test`, {
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });
      expect(response.status).toBe(401);
    });

    it('should reject token with wrong audience', async () => {
      const wrongAudienceToken = jwt.sign(
        {
          sub: 'test-user',
          aud: 'wrong-audience',
          iss: 'test-issuer',
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        jwtSecret
      );

      const response = await fetch(`${gatewayUrl}/api/secure/test`, {
        headers: {
          'Authorization': `Bearer ${wrongAudienceToken}`
        }
      });
      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      // Clear rate limiting state before each test
      await fetch(`${gatewayUrl}/admin/api/v1/rate-limits/clear`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 5 requests (well within the 10 req/min limit)
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${gatewayUrl}/api/public/test`);
        expect(response.status).toBe(200);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make requests to exceed the 10 req/min limit
      const responses = [];
      for (let i = 0; i < 15; i++) {
        const response = await fetch(`${gatewayUrl}/api/public/test`);
        responses.push(response.status);
      }

      // Some requests should be rate limited (429)
      const rateLimitedCount = responses.filter(status => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should include rate limiting headers', async () => {
      const response = await fetch(`${gatewayUrl}/api/public/test`);
      
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('should respect different rate limits per route', async () => {
      // Public route has 100 req/min, secure route has 10 req/min
      // Test that they have independent counters
      
      // Use up secure route limit
      for (let i = 0; i < 12; i++) {
        await fetch(`${gatewayUrl}/api/secure/test`, {
          headers: { 'Authorization': `Bearer ${validToken}` }
        });
      }

      // Public route should still work
      const publicResponse = await fetch(`${gatewayUrl}/api/public/test`);
      expect(publicResponse.status).toBe(200);
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(async () => {
      // Reset circuit breaker state
      await fetch(`${gatewayUrl}/admin/api/v1/circuit-breakers/reset`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      });
    });

    it('should open circuit breaker after failure threshold', async () => {
      // Configure mock to return errors
      secureService.close();
      
      // Make requests to trigger circuit breaker (3 failures)
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${gatewayUrl}/api/secure/test`, {
          headers: { 'Authorization': `Bearer ${validToken}` }
        });
        responses.push(response.status);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should have some 503 responses (circuit breaker open)
      const circuitBreakerResponses = responses.filter(status => status === 503);
      expect(circuitBreakerResponses.length).toBeGreaterThan(0);

      // Restart mock service for cleanup
      secureService = createMockUpstream(8081, {
        '/': { statusCode: 200, body: { message: 'Secure service response' } }
      });
    });

    it('should include circuit breaker headers when open', async () => {
      // Trigger circuit breaker
      secureService.close();
      
      for (let i = 0; i < 4; i++) {
        await fetch(`${gatewayUrl}/api/secure/test`, {
          headers: { 'Authorization': `Bearer ${validToken}` }
        });
      }

      const response = await fetch(`${gatewayUrl}/api/secure/test`, {
        headers: { 'Authorization': `Bearer ${validToken}` }
      });

      if (response.status === 503) {
        expect(response.headers.get('X-Circuit-Breaker')).toBe('open');
        expect(response.headers.get('Retry-After')).toBeTruthy();
      }

      // Restart mock service
      secureService = createMockUpstream(8081, {
        '/': { statusCode: 200, body: { message: 'Secure service response' } }
      });
    });
  });

  describe('Streaming Support', () => {
    it('should proxy server-sent events', async () => {
      const response = await fetch(`${gatewayUrl}/api/stream/events`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      
      const text = await response.text();
      expect(text).toContain('data: {"message": "streaming data"}');
    });

    it('should handle streaming with proper headers', async () => {
      const response = await fetch(`${gatewayUrl}/api/stream/events`, {
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
    });
  });

  describe('WebSocket Support', () => {
    it('should proxy WebSocket connections with authentication', (done) => {
      const wsUrl = `ws://127.0.0.1:${gatewayPort}/ws`;
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({ message: 'test' }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message).toBeDefined();
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should reject WebSocket connections without authentication', (done) => {
      const wsUrl = `ws://127.0.0.1:${gatewayPort}/ws`;
      
      const ws = new WebSocket(wsUrl);

      ws.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      ws.on('open', () => {
        done(new Error('WebSocket should not connect without auth'));
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      // Configure mock to fail first request, succeed on retry
      let requestCount = 0;
      secureService.close();
      
      secureService = http.createServer((req, res) => {
        requestCount++;
        if (requestCount === 1) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        } else {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Success on retry' }));
        }
      }).listen(8081);

      const response = await fetch(`${gatewayUrl}/api/secure/test`, {
        headers: { 'Authorization': `Bearer ${validToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Success on retry');
      expect(requestCount).toBeGreaterThan(1);
    });
  });

  describe('Admin API Integration', () => {
    it('should provide health check endpoint', async () => {
      const response = await fetch(`${gatewayUrl}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
    });

    it('should provide metrics endpoint', async () => {
      const response = await fetch(`${gatewayUrl}/metrics`);
      expect(response.status).toBe(200);
      
      const metrics = await response.text();
      expect(metrics).toContain('gateway_requests_total');
      expect(metrics).toContain('gateway_request_duration_seconds');
    });

    it('should allow configuration updates via admin API', async () => {
      // Add a new route via admin API
      const newRoute = {
        id: 'dynamic-route',
        matcher: {
          pathPrefix: '/api/dynamic',
          methods: ['GET']
        },
        target: {
          serviceName: 'public-service',
          discovery: {
            type: 'static',
            endpoints: ['http://localhost:8083']
          }
        },
        policy: {
          auth: { enabled: false }
        }
      };

      const addResponse = await fetch(`${gatewayUrl}/admin/api/v1/routes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify(newRoute)
      });

      expect(addResponse.status).toBe(201);

      // Test the new route
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for config reload
      
      const testResponse = await fetch(`${gatewayUrl}/api/dynamic/test`);
      expect(testResponse.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle upstream service unavailable', async () => {
      // Stop the service
      publicService.close();

      const response = await fetch(`${gatewayUrl}/api/public/test`);
      expect([502, 503, 504]).toContain(response.status);

      // Restart service
      publicService = createMockUpstream(8083, {
        '/': { statusCode: 200, body: { message: 'Public service response' } }
      });
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await fetch(`${gatewayUrl}/api/public/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid-json'
      });

      // Should not crash the gateway
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle very large requests', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await fetch(`${gatewayUrl}/api/public/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: largePayload
      });

      // Should handle gracefully (either accept or reject with appropriate status)
      expect([200, 413, 414]).toContain(response.status);
    });
  });

  describe('Security Features', () => {
    it('should include security headers', async () => {
      const response = await fetch(`${gatewayUrl}/api/public/test`);
      
      // Check for common security headers
      expect(response.headers.get('X-Frame-Options')).toBeTruthy();
      expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
    });

    it('should handle CORS preflight requests', async () => {
      const response = await fetch(`${gatewayUrl}/api/public/test`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        fetch(`${gatewayUrl}/api/public/test`)
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;
      
      // Most requests should succeed (allowing for some rate limiting)
      expect(successCount).toBeGreaterThan(concurrentRequests * 0.8);
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const requests = Array(20).fill(null).map(() =>
        fetch(`${gatewayUrl}/api/public/test`)
      );

      await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 20 requests in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });
});
