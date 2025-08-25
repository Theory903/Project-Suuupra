/**
 * Stub implementation for gateway services
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

// Service registry - maps service names to their URLs (from docker-compose)
const services = {
  'identity': 'http://identity:8081',
  'content': 'http://content:8089',
  'commerce': 'http://commerce:8083',
  'payments': 'http://payments:8082',
  'ledger': 'http://ledger:8086',
  'live-classes': 'http://live-classes:8090',
  'vod': 'http://vod:8091',
  'mass-live': 'http://mass-live:8092',
  'creator-studio': 'http://creator-studio:8093',
  'recommendations': 'http://recommendations:8095',
  'search-crawler': 'http://search-crawler:8094',
  'llm-tutor': 'http://llm-tutor:8096',
  'analytics': 'http://analytics:8097',
  'counters': 'http://counters:8098',
  'live-tracking': 'http://live-tracking:8099',
  'notifications': 'http://notifications:8085',
  'admin': 'http://admin:8100',
  'upi-core': 'http://upi-core:8087',
  'bank-simulator': 'http://bank-simulator:8088',
  'content-delivery': 'http://content-delivery:8084'
};

export async function handleGatewayProxy(request: FastifyRequest, reply: FastifyReply) {
  const url = request.url;
  const method = request.method;
  
  console.log(`🔄 [Gateway] ${method} ${url}`);
  
  // Parse the path to determine service
  const pathParts = url.split('/').filter(part => part.length > 0);
  
  if (pathParts.length === 0) {
    return reply.code(404).send({ error: 'Route not found' });
  }
  
  const serviceName = pathParts[0];
  const serviceUrl = (services as any)[serviceName];
  
  if (!serviceUrl) {
    console.warn(`⚠️  [Gateway] Service not found: ${serviceName}`);
    return reply.code(404).send({ 
      error: 'Service not found',
      service: serviceName,
      availableServices: Object.keys(services)
    });
  }
  
  // Build target URL - remove service name from path
  const remainingPath = '/' + pathParts.slice(1).join('/');
  const targetUrl = serviceUrl + remainingPath + (url.includes('?') ? '?' + url.split('?')[1] : '');
  
  console.log(`➡️  [Gateway] Proxying to: ${targetUrl}`);
  
  try {
    // Use Fastify's http-proxy if available, otherwise use a simple implementation
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        ...request.headers,
        host: parsedUrl.hostname,
      },
      timeout: 10000,
    };
    
    const proxyReq = httpModule.request(options, (proxyRes: any) => {
      console.log(`✅ [Gateway] Response ${proxyRes.statusCode} from ${serviceName}`);
      
      // Set CORS headers
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Forward status and headers
      reply.code(proxyRes.statusCode);
      Object.keys(proxyRes.headers).forEach(key => {
        reply.header(key, proxyRes.headers[key]);
      });
      
      // Stream response
      proxyRes.pipe(reply.raw);
    });
    
    proxyReq.on('error', (error: Error) => {
      console.error(`❌ [Gateway] Proxy error for ${serviceName}:`, error.message);
      reply.code(502).send({
        error: 'Bad Gateway',
        message: `Service ${serviceName} unavailable: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    });
    
    proxyReq.on('timeout', () => {
      console.error(`⏰ [Gateway] Timeout for ${serviceName}`);
      proxyReq.destroy();
      reply.code(504).send({
        error: 'Gateway Timeout',
        message: `Service ${serviceName} timed out`,
        timestamp: new Date().toISOString()
      });
    });
    
    // Forward request body
    if (method !== 'GET' && method !== 'HEAD') {
      request.raw.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
    
  } catch (error: any) {
    console.error(`❌ [Gateway] Error proxying to ${serviceName}:`, error.message);
    reply.code(500).send({
      error: 'Internal Server Error',
      message: `Failed to proxy to ${serviceName}: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}
