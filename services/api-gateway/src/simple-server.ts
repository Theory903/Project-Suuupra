/**
 * Simple API Gateway Server - Working Version
 * Minimal implementation to get the service running
 */

import fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';

// Simple types
interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
}

// Create the server
const server = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV === 'development'
  }
});

// Register plugins
server.register(cors, {
  origin: true,
  credentials: true
});

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'suuupra-gateway-secret-key'
});

// Health check endpoint
server.get<{ Reply: HealthResponse }>('/health', async (request, reply) => {
  const startTime = process.hrtime.bigint();
  const uptime = Number(startTime) / 1000000; // Convert to milliseconds
  
  return {
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: uptime
  };
});

// Ready check endpoint
server.get<{ Reply: HealthResponse }>('/ready', async (request, reply) => {
  const startTime = process.hrtime.bigint();
  const uptime = Number(startTime) / 1000000;
  
  return {
    status: 'ready',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: uptime
  };
});

// Metrics endpoint (basic)
server.get('/metrics', async (request, reply) => {
  const metrics = `
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total 1

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 1
http_request_duration_seconds_bucket{le="+Inf"} 1
http_request_duration_seconds_sum 0.001
http_request_duration_seconds_count 1
  `.trim();
  
  reply.type('text/plain').send(metrics);
});

// Basic proxy endpoint (placeholder)
server.all('/api/*', async (request, reply) => {
  const requestId = request.headers['x-request-id'] || randomUUID();
  
  server.log.info({
    requestId,
    method: request.method,
    url: request.url,
    headers: request.headers
  }, 'Proxying request');
  
  // For now, just return a simple response
  return {
    message: 'API Gateway is running',
    requestId,
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method
  };
});

// Start the server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    server.log.info(`API Gateway running on http://${host}:${port}`);
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      server.log.info('Received SIGTERM, shutting down gracefully');
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      server.log.info('Received SIGINT, shutting down gracefully');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();