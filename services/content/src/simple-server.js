/**
 * Simple content Server - Working Version
 */

const http = require('http');

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
      service: 'content',
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
      service: 'content',
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
  
  // Default API response
  const response = {
    message: 'content is running',
    service: 'content',
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
    version: '1.0.0'
  };
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
});

const port = process.env.PORT || 8089;
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
  console.log(`content running on http://${host}:${port}`);
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
