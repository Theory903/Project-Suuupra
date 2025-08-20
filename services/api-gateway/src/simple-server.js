/**
 * API Gateway - Enhanced Proxy Server
 * Routes requests to appropriate microservices
 */

const http = require('http');
const url = require('url');

// Service registry - maps service names to their URLs (corrected ports from docker-compose)
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

// Proxy a request to the target service
function proxyRequest(req, res, targetUrl, remainingPath) {
  const parsedTarget = url.parse(targetUrl);
  
  // Build the target URL with remaining path and query string
  const targetPath = remainingPath + (req.url.includes('?') ? req.url.split('?')[1] : '');
  
  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port,
    path: targetPath.startsWith('?') ? `/${targetPath}` : targetPath,
    method: req.method,
    headers: { ...req.headers }
  };
  
  // Remove host header to avoid conflicts
  delete options.headers.host;
  
  console.log(`🔄 Proxying ${req.method} ${req.url} → ${targetUrl}${targetPath}`);
  
  const proxyReq = http.request(options, (proxyRes) => {
    // Copy status code and headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe the response
    proxyRes.pipe(res, { end: true });
  });
  
  proxyReq.on('error', (err) => {
    console.error(`❌ Proxy error for ${req.url}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Bad Gateway',
      message: `Service unavailable: ${err.message}`,
      service: 'api-gateway',
      timestamp: new Date().toISOString()
    }));
  });
  
  // Pipe request body to target service
  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const startTime = Date.now();
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check
  if (req.url === '/health') {
    const response = {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime() * 1000
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // Ready check
  if (req.url === '/ready') {
    const response = {
      status: 'ready',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime() * 1000
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // Metrics
  if (req.url === '/metrics') {
    const metrics = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total 1
`;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }
  
  // Route requests to services
  const urlPath = req.url.split('?')[0]; // Remove query string for routing
  const pathParts = urlPath.split('/').filter(part => part.length > 0);
  
  if (pathParts.length > 0) {
    const serviceName = pathParts[0];
    const serviceUrl = services[serviceName];
    
    if (serviceUrl) {
      // Extract the remaining path after service name
      const remainingPath = '/' + pathParts.slice(1).join('/');
      proxyRequest(req, res, serviceUrl, remainingPath);
      return;
    }
  }
  
  // Default response for unmatched routes
  const response = {
    message: 'API Gateway - Route not found',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
    availableServices: Object.keys(services),
    version: '1.0.0'
  };
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
});

const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
  console.log(`api-gateway running on http://${host}:${port}`);
  console.log(`Health: http://${host}:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
