/**
 * What: Minimal HTTP proxy action used by circuit breaker
 * Why: Keep proxy logic cohesive and swappable (e.g., for streaming/AI endpoints)
 * How: Takes FastifyRequest and upstream URL, returns the upstream IncomingMessage
 */

import * as http from 'http';
import { FastifyRequest } from 'fastify';

export async function proxyAction(req: FastifyRequest, serviceUrl: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const url = new URL(serviceUrl);
    const path = (req.params as any)['*'];
    const originalUrl = req.raw.url || '/';
    const originalSearch = originalUrl.includes('?')
      ? originalUrl.substring(originalUrl.indexOf('?'))
      : '';
    const fullPath = `/${path}${originalSearch}`;

    const headers = { ...req.headers } as Record<string, string | string[] | undefined>;
    delete (headers as any).host;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: fullPath,
      method: req.method,
      headers,
    };

    const upstreamReq = http.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 500) {
        reject(new Error(`Service returned status ${res.statusCode}`));
      } else {
        resolve(res);
      }
    });

    upstreamReq.on('error', (err) => reject(err));
    req.raw.pipe(upstreamReq);
  });
}


