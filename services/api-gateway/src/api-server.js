/**
 * API Gateway - Full-Featured Proxy Server
 * A robust, production-ready API gateway with proper routing, health checks, and monitoring
 */

const http = require('http');
const url = require('url');

// Service registry - maps service names to their internal Docker URLs
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

// Request statistics for monitoring
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  startTime: Date.now(),
  requestsByService: {},
  responseTimeSum: 0,
  requestsPerMinute: []
};

// Track requests per minute for rate monitoring
setInterval(() => {
  stats.requestsPerMinute.push({
    timestamp: new Date().toISOString(),
    count: stats.totalRequests
  });
  // Keep only last 60 minutes
  if (stats.requestsPerMinute.length > 60) {
    stats.requestsPerMinute.shift();
  }
}, 60000);

// Enhanced logging function
function log(level, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    service: 'api-gateway',
    ...metadata
  };
  console.log(JSON.stringify(logEntry));
}

// Proxy a request to the target service with enhanced error handling
function proxyRequest(req, res, targetUrl, remainingPath) {
  const requestStartTime = Date.now();
  const parsedTarget = url.parse(targetUrl);
  
  // Build the target URL with remaining path and query string (FIXED: added ? separator)
  let targetPath = remainingPath;
  if (req.url.includes('?')) {
    targetPath += '?' + req.url.split('?')[1];
  }
  
  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port,
    path: targetPath,
    method: req.method,
    headers: { 
      ...req.headers,
      'X-Forwarded-For': req.connection.remoteAddress,
      'X-Forwarded-Proto': req.headers['x-forwarded-proto'] || 'http',
      'X-Gateway-Request-ID': `gateway-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  };
  
  // Remove host header to avoid conflicts
  delete options.headers.host;
  
  log('info', 'Proxying request', {
    method: req.method,
    originalUrl: req.url,
    targetUrl: `${targetUrl}${targetPath}`,
    requestId: options.headers['X-Gateway-Request-ID']
  });
  
  const proxyReq = http.request(options, (proxyRes) => {
    const responseTime = Date.now() - requestStartTime;
    stats.responseTimeSum += responseTime;
    
    // Log response details
    log('info', 'Received response from service', {
      statusCode: proxyRes.statusCode,
      responseTime: `${responseTime}ms`,
      requestId: options.headers['X-Gateway-Request-ID']
    });
    
    // Add gateway headers
    proxyRes.headers['X-Gateway'] = 'Suuupra-API-Gateway';
    proxyRes.headers['X-Response-Time'] = `${responseTime}ms`;
    
    // Copy status code and headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe the response
    proxyRes.pipe(res, { end: true });
    
    stats.successfulRequests++;
  });
  
  proxyReq.on('error', (err) => {
    const responseTime = Date.now() - requestStartTime;
    stats.failedRequests++;
    
    log('error', 'Proxy request failed', {
      error: err.message,
      targetUrl: `${targetUrl}${targetPath}`,
      responseTime: `${responseTime}ms`,
      requestId: options.headers['X-Gateway-Request-ID']
    });
    
    res.writeHead(502, { 
      'Content-Type': 'application/json',
      'X-Gateway': 'Suuupra-API-Gateway',
      'X-Error': 'Service Unavailable'
    });
    res.end(JSON.stringify({
      error: 'Bad Gateway',
      message: `Service unavailable: ${err.message}`,
      service: 'api-gateway',
      requestId: options.headers['X-Gateway-Request-ID'],
      timestamp: new Date().toISOString(),
      statusCode: 502
    }));
  });
  
  // Handle client connection errors
  req.on('error', (err) => {
    log('error', 'Client request error', {
      error: err.message,
      requestId: options.headers['X-Gateway-Request-ID']
    });
    proxyReq.destroy();
  });
  
  // Pipe request body to target service
  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const startTime = Date.now();
  stats.totalRequests++;
  
  // Enhanced CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Enhanced health check
  if (req.url === '/health') {
    const uptime = Date.now() - stats.startTime;
    const avgResponseTime = stats.successfulRequests > 0 ? 
      Math.round(stats.responseTimeSum / stats.successfulRequests) : 0;
    
    const response = {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 1000)}s`,
      version: '2.0.0',
      statistics: {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        successRate: stats.totalRequests > 0 ? 
          ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%' : '100%',
        averageResponseTime: `${avgResponseTime}ms`
      },
      services: {
        registered: Object.keys(services).length,
        available: Object.keys(services)
      }
    };
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'X-Gateway': 'Suuupra-API-Gateway'
    });
    res.end(JSON.stringify(response, null, 2));
    return;
  }
  
  // Ready check for Kubernetes/Docker health
  if (req.url === '/ready') {
    const response = {
      status: 'ready',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      checks: {
        serviceRegistry: Object.keys(services).length > 0,
        memoryUsage: process.memoryUsage()
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // Enhanced metrics endpoint
  if (req.url === '/metrics') {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const avgResponseTime = stats.successfulRequests > 0 ? 
      (stats.responseTimeSum / stats.successfulRequests).toFixed(2) : 0;
    
    const metrics = `# HELP api_gateway_requests_total Total number of HTTP requests
# TYPE api_gateway_requests_total counter
api_gateway_requests_total ${stats.totalRequests}

# HELP api_gateway_requests_successful_total Total number of successful HTTP requests
# TYPE api_gateway_requests_successful_total counter
api_gateway_requests_successful_total ${stats.successfulRequests}

# HELP api_gateway_requests_failed_total Total number of failed HTTP requests
# TYPE api_gateway_requests_failed_total counter
api_gateway_requests_failed_total ${stats.failedRequests}

# HELP api_gateway_response_time_avg Average response time in milliseconds
# TYPE api_gateway_response_time_avg gauge
api_gateway_response_time_avg ${avgResponseTime}

# HELP api_gateway_uptime_seconds Gateway uptime in seconds
# TYPE api_gateway_uptime_seconds counter
api_gateway_uptime_seconds ${uptime}

# HELP api_gateway_services_registered Number of registered services
# TYPE api_gateway_services_registered gauge
api_gateway_services_registered ${Object.keys(services).length}
`;
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }
  
  // Service status endpoint
  if (req.url === '/services') {
    const response = {
      services: Object.keys(services).map(name => ({
        name,
        url: services[name],
        requests: stats.requestsByService[name] || 0
      })),
      total: Object.keys(services).length,
      timestamp: new Date().toISOString()
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
    return;
  }
  
  // Route requests to services
  const urlPath = req.url.split('?')[0]; // Remove query string for routing
  const pathParts = urlPath.split('/').filter(part => part.length > 0);
  
  if (pathParts.length > 0) {
    const serviceName = pathParts[0];
    const serviceUrl = services[serviceName];
    
    if (serviceUrl) {
      // Track requests per service
      stats.requestsByService[serviceName] = (stats.requestsByService[serviceName] || 0) + 1;
      
      // Extract the remaining path after service name
      const remainingPath = '/' + pathParts.slice(1).join('/');
      proxyRequest(req, res, serviceUrl, remainingPath);
      return;
    }
  }
  
  // Default response for unmatched routes
  log('warn', 'Route not found', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent']
  });
  
  const response = {
    error: 'Route Not Found',
    message: 'The requested endpoint was not found',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
    availableServices: Object.keys(services),
    documentation: {
      health: '/health',
      metrics: '/metrics',
      services: '/services',
      ready: '/ready'
    },
    version: '2.0.0'
  };
  
  res.writeHead(404, { 
    'Content-Type': 'application/json',
    'X-Gateway': 'Suuupra-API-Gateway'
  });
  res.end(JSON.stringify(response, null, 2));
});

const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
  log('info', 'API Gateway started successfully', {
    port,
    host,
    version: '2.0.0',
    services: Object.keys(services).length,
    features: [
      'Enhanced Routing',
      'Request Monitoring', 
      'Health Checks',
      'Metrics Collection',
      'Error Handling',
      'CORS Support'
    ]
  });
});

// Graceful shutdown
function gracefulShutdown(signal) {
  log('info', 'Received shutdown signal', { signal });
  
  server.close(() => {
    log('info', 'API Gateway shutdown completed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    log('error', 'Force shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log('fatal', 'Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled promise rejection', { 
    reason: reason.toString(),
    promise: promise.toString()
  });
});
