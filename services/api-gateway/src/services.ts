
import Opossum from 'opossum';
import http from 'http';
import { FastifyRequest } from 'fastify';

export const serviceRegistry: Record<string, string> = {
  identity: 'http://localhost:3001',
  content: 'http://localhost:3002',
  commerce: 'http://localhost:3003',
  payments: 'http://localhost:3004',
  ledger: 'http://localhost:3005',
  'live-classes': 'http://localhost:3006',
  vod: 'http://localhost:3007',
  'mass-live': 'http://localhost:3008',
  'creator-studio': 'http://localhost:3009',
  recommendations: 'http://localhost:3010',
  'search-crawler': 'http://localhost:3011',
  'llm-tutor': 'http://localhost:3012',
  analytics: 'http://localhost:3013',
  counters: 'http://localhost:3014',
  'live-tracking': 'http://localhost:3015',
  notifications: 'http://localhost:3016',
  admin: 'http://localhost:3017',
};

async function proxyAction(req: FastifyRequest, serviceUrl: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const url = new URL(serviceUrl);
    const path = (req.params as any)['*'];
    const fullPath = `/${path}${req.raw.search || ''}`;

    const headers = { ...req.headers };
    delete headers.host; // Use the host of the upstream service

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: fullPath,
      method: req.method,
      headers: headers,
    };

    const proxyReq = http.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 500) {
        // For server-side errors, we reject the promise to trip the circuit
        reject(new Error(`Service returned status ${res.statusCode}`));
      } else {
        // For client-side errors and success, we resolve and let the client handle it
        resolve(res);
      }
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });

    // Pipe the request body to the upstream service
    req.raw.pipe(proxyReq);
  });
}

const circuitOptions: Opossum.Options = {
  timeout: 5000, // If the action takes longer than 5 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
  resetTimeout: 30000, // After 30 seconds, half-open the circuit and try again
};

type ServiceName = keyof typeof serviceRegistry;

export const circuitBreakers = Object.keys(serviceRegistry).reduce((breakers, serviceName) => {
  const breaker = new Opossum(proxyAction, circuitOptions);

  // Define a fallback for when the circuit is open
  breaker.fallback(() => ({
    statusCode: 503,
    body: { error: `Service '${serviceName}' is unavailable at the moment.` },
  }));

  breakers[serviceName as ServiceName] = breaker;
  return breakers;
}, {} as Record<ServiceName, Opossum>);
