/**
 * Production API Gateway - Robust JavaScript Implementation
 * Combines simplicity with production-ready features
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Service registry from docker-compose configuration
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

// Request statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  startTime: Date.now(),
  requestsByService: {}
};

// Enhanced logging
function log(level, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'api-gateway',
    ...metadata
  };
  console.log(`[${level}] ${message}`, metadata);
}

// Generate request ID
function generateRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced proxy function with timeout and error handling
function proxyRequest(req, res, targetUrl, remainingPath) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Build complete target URL
  const targetPath = remainingPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
  const fullTargetUrl = targetUrl + targetPath;
  
  log('INFO', `Proxying request`, {
    requestId,
    method: req.method,
    originalUrl: req.url,
    targetUrl: fullTargetUrl,
    userAgent: req.headers['user-agent'],
    ip: req.connection.remoteAddress
  });
  
  const parsedUrl = new URL(fullTargetUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  const httpModule = isHttps ? https : http;
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      'x-request-id': requestId,
      'x-forwarded-for': req.connection.remoteAddress,
      'x-forwarded-proto': req.connection.encrypted ? 'https' : 'http'
    },
    timeout: 30000 // 30 second timeout
  };
  
  // Remove host header to avoid conflicts
  delete options.headers.host;
  
  const proxyReq = httpModule.request(options, (proxyRes) => {
    const statusCode = proxyRes.statusCode;
    const duration = Date.now() - startTime;
    
    log('INFO', `Received response`, {
      requestId,
      statusCode,
      duration: `${duration}ms`,
      contentType: proxyRes.headers['content-type']
    });
    
    // Set CORS and security headers
    const responseHeaders = {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'X-Request-ID': requestId,
      'X-Response-Time': `${duration}ms`,
      'X-Gateway-Version': '1.0.0'
    };
    
    // Write response headers
    res.writeHead(statusCode, responseHeaders);
    
    // Stream response body
    let responseData = '';
    let responseEnded = false;
    
    proxyRes.on('data', (chunk) => {
      if (!responseEnded) {
        responseData += chunk;
        res.write(chunk);
      }
    });
    
    proxyRes.on('end', () => {
      if (!responseEnded) {
        responseEnded = true;
        res.end();
        
        // Update statistics
        stats.totalRequests++;
        if (statusCode >= 200 && statusCode < 400) {
          stats.successfulRequests++;
        } else {
          stats.failedRequests++;
        }
        
        log('INFO', `Request completed`, {
          requestId,
          statusCode,
          duration: `${Date.now() - startTime}ms`,
          responseSize: responseData.length
        });
      }
    });
    
    proxyRes.on('error', (error) => {
      log('ERROR', `Response stream error`, {
        requestId,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      });
      
      if (!responseEnded && !res.headersSent) {
        responseEnded = true;
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        });
        res.end(JSON.stringify({
          error: 'Response Error',
          message: 'Error reading response from service',
          requestId,
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    // Handle client disconnection
    res.on('close', () => {
      if (!responseEnded) {
        responseEnded = true;
        log('WARN', `Client disconnected`, {
          requestId,
          duration: `${Date.now() - startTime}ms`
        });
      }
    });
  });
  
  // Handle request timeout
  proxyReq.on('timeout', () => {
    log('ERROR', `Request timeout`, {
      requestId,
      targetUrl: fullTargetUrl,
      duration: '30000ms+'
    });
    
    proxyReq.destroy();
    stats.failedRequests++;
    
    if (!res.headersSent) {
      res.writeHead(504, {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      });
      res.end(JSON.stringify({
        error: 'Gateway Timeout',
        message: 'Request timed out after 30 seconds',
        requestId,
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  // Handle connection errors
  proxyReq.on('error', (error) => {
    log('ERROR', `Proxy request error`, {
      requestId,
      error: error.message,
      code: error.code,
      targetUrl: fullTargetUrl
    });
    
    stats.failedRequests++;
    
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      });
      res.end(JSON.stringify({
        error: 'Bad Gateway',
        message: `Service unavailable: ${error.message}`,
        requestId,
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  // Handle request body for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    let requestBody = '';
    req.on('data', (chunk) => {
      requestBody += chunk;
      proxyReq.write(chunk);
    });
    
    req.on('end', () => {
      log('DEBUG', `Request body processed`, {
        requestId,
        bodySize: requestBody.length
      });
      proxyReq.end();
    });
    
    req.on('error', (error) => {
      log('ERROR', `Request stream error`, {
        requestId,
        error: error.message
      });
      proxyReq.destroy();
    });
  } else {
    proxyReq.end();
  }
}

// Main server
const server = http.createServer((req, res) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Add request ID to headers
  res.setHeader('X-Request-ID', requestId);
  
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/health') {
    const uptime = Date.now() - stats.startTime;
    const response = {
      status: 'healthy',
      service: 'api-gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 1000)}s`,
      stats: {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        successRate: stats.totalRequests > 0 ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%' : '0%'
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
    return;
  }
  
  // Metrics endpoint (Prometheus format)
  if (req.url === '/metrics') {
    const uptime = (Date.now() - stats.startTime) / 1000;
    const metrics = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{status="success"} ${stats.successfulRequests}
http_requests_total{status="error"} ${stats.failedRequests}

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="+Inf"} ${stats.totalRequests}

# HELP gateway_uptime_seconds Gateway uptime in seconds
# TYPE gateway_uptime_seconds gauge
gateway_uptime_seconds ${uptime}
`;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }
  
  // Route requests to services
  const urlPath = req.url.split('?')[0];
  const pathParts = urlPath.split('/').filter(part => part.length > 0);
  
  if (pathParts.length === 0) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: 'Please specify a service name in the URL path',
      availableServices: Object.keys(services),
      example: '/identity/api/v1/auth/login',
      requestId,
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }
  
  const serviceName = pathParts[0];
  const serviceUrl = services[serviceName];
  
  if (!serviceUrl) {
    log('WARN', `Service not found`, {
      requestId,
      serviceName,
      availableServices: Object.keys(services)
    });
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Service Not Found',
      message: `Service '${serviceName}' is not available`,
      availableServices: Object.keys(services),
      requestId,
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }
  
  // Update service statistics
  if (!stats.requestsByService[serviceName]) {
    stats.requestsByService[serviceName] = 0;
  }
  stats.requestsByService[serviceName]++;
  
  // Extract remaining path after service name
  const remainingPath = '/' + pathParts.slice(1).join('/');
  
  // Proxy the request
  proxyRequest(req, res, serviceUrl, remainingPath);
});

const port = parseInt(process.env.PORT || '8080');
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
  log('INFO', 'API Gateway started', {
    host,
    port,
    pid: process.pid,
    nodeVersion: process.version,
    availableServices: Object.keys(services).length,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  log('INFO', `Received ${signal}, shutting down gracefully`, {
    uptime: `${Math.floor((Date.now() - stats.startTime) / 1000)}s`,
    totalRequests: stats.totalRequests
  });
  
  server.close(() => {
    log('INFO', 'Server closed successfully');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    log('ERROR', 'Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled promise rejection', {
    reason: reason?.message || reason,
    promise: promise.toString()
  });
});
