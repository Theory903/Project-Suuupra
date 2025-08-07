import * as http from 'http';
import * as url from 'url';

export interface MockResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
  delay?: number;
}

export interface MockEndpoints {
  [path: string]: MockResponse;
}

export function createMockUpstream(port: number, endpoints: MockEndpoints): http.Server {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';
    
    // Find matching endpoint
    let mockResponse: MockResponse | undefined;
    
    // Try exact match first
    if (endpoints[pathname]) {
      mockResponse = endpoints[pathname];
    } else {
      // Try pattern matching
      for (const [pattern, response] of Object.entries(endpoints)) {
        if (pattern === '/' && pathname !== '/') {
          // Root handler as fallback
          mockResponse = response;
          break;
        }
        
        // Simple prefix matching
        if (pathname.startsWith(pattern.replace('*', ''))) {
          mockResponse = response;
          break;
        }
      }
    }

    // Default response if no match
    if (!mockResponse) {
      mockResponse = {
        statusCode: 404,
        body: { error: 'Not Found' }
      };
    }

    // Apply delay if specified
    const sendResponse = () => {
      res.statusCode = mockResponse!.statusCode;
      
      // Set default headers
      res.setHeader('Content-Type', 'application/json');
      
      // Apply custom headers
      if (mockResponse!.headers) {
        for (const [key, value] of Object.entries(mockResponse!.headers)) {
          res.setHeader(key, value);
        }
      }
      
      // Send response body
      if (typeof mockResponse!.body === 'string') {
        res.end(mockResponse!.body);
      } else {
        res.end(JSON.stringify(mockResponse!.body));
      }
    };

    if (mockResponse.delay) {
      setTimeout(sendResponse, mockResponse.delay);
    } else {
      sendResponse();
    }
  });

  server.listen(port, '127.0.0.1');
  
  // Handle server errors
  server.on('error', (err) => {
    if ((err as any).code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use, trying to reuse existing server`);
    } else {
      console.error(`Mock upstream server error on port ${port}:`, err);
    }
  });

  return server;
}

export function createStreamingMockUpstream(port: number): http.Server {
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial event
    res.write('data: {"message": "connected", "timestamp": "' + new Date().toISOString() + '"}\n\n');

    // Send periodic events
    const interval = setInterval(() => {
      res.write('data: {"message": "streaming data", "timestamp": "' + new Date().toISOString() + '"}\n\n');
    }, 1000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
    });

    req.on('aborted', () => {
      clearInterval(interval);
    });
  });

  server.listen(port, '127.0.0.1');
  return server;
}

export function createWebSocketMockUpstream(port: number): http.Server {
  const WebSocket = require('ws');
  
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws: any, req: http.IncomingMessage) => {
    console.log('WebSocket connection established');

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Echo the message back with timestamp
        ws.send(JSON.stringify({
          echo: data,
          timestamp: new Date().toISOString(),
          server: 'mock-upstream'
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          error: 'Invalid JSON',
          timestamp: new Date().toISOString()
        }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    }));
  });

  server.listen(port, '127.0.0.1');
  return server;
}

export function createFailingMockUpstream(port: number, failureRate: number = 0.5): http.Server {
  const server = http.createServer((req, res) => {
    // Randomly fail based on failure rate
    if (Math.random() < failureRate) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: 'Success',
        timestamp: new Date().toISOString(),
        url: req.url
      }));
    }
  });

  server.listen(port, '127.0.0.1');
  return server;
}

export function createSlowMockUpstream(port: number, delayMs: number = 1000): http.Server {
  const server = http.createServer((req, res) => {
    setTimeout(() => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: 'Slow response',
        delay: delayMs,
        timestamp: new Date().toISOString()
      }));
    }, delayMs);
  });

  server.listen(port, '127.0.0.1');
  return server;
}

export function createAuthMockUpstream(port: number, validTokens: string[] = ['valid-token']): http.Server {
  const server = http.createServer((req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!validTokens.includes(token)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid token' }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      message: 'Authenticated successfully',
      token: token,
      timestamp: new Date().toISOString()
    }));
  });

  server.listen(port, '127.0.0.1');
  return server;
}

export function createJWKSMockUpstream(port: number, secret: string = 'test-secret'): http.Server {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    
    if (parsedUrl.pathname === '/.well-known/jwks.json') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        keys: [
          {
            kty: 'oct',
            kid: 'test-key-1',
            use: 'sig',
            alg: 'HS256',
            k: Buffer.from(secret).toString('base64url')
          }
        ]
      }));
    } else if (parsedUrl.pathname === '/.well-known/openid-configuration') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        issuer: 'http://localhost:' + port,
        jwks_uri: 'http://localhost:' + port + '/.well-known/jwks.json',
        authorization_endpoint: 'http://localhost:' + port + '/auth',
        token_endpoint: 'http://localhost:' + port + '/token',
        supported_response_types: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['HS256']
      }));
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, '127.0.0.1');
  return server;
}

export function createHealthCheckMockUpstream(port: number, healthy: boolean = true): http.Server {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    
    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/healthz') {
      if (healthy) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }));
      } else {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Service unavailable'
        }));
      }
    } else {
      // Regular endpoint
      res.statusCode = healthy ? 200 : 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: healthy ? 'Service is running' : 'Service is down',
        timestamp: new Date().toISOString()
      }));
    }
  });

  server.listen(port, '127.0.0.1');
  return server;
}
