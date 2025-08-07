/**
 * What: Route matching utilities
 * Why: Separate concerns for testability and clarity
 * How: Provide a pure function to find a matching route for an incoming request
 */

import { FastifyRequest } from 'fastify';
import { RouteConfig } from '../types/gateway';

export function findMatchingRoute(req: FastifyRequest, routes: RouteConfig[]): RouteConfig | undefined {
  const url = req.raw.url || '/';
  const method = req.method?.toUpperCase();
  for (const route of routes) {
    const matcher = route.matcher;
    if (matcher.methods && method && !matcher.methods.includes(method)) continue;
    if (matcher.pathPrefix && !url.startsWith(matcher.pathPrefix)) continue;
    if (matcher.hostnames && req.headers.host && !matcher.hostnames.includes(req.headers.host)) continue;
    let headersOk = true;
    if (matcher.headerMatches) {
      for (const [key, expected] of Object.entries(matcher.headerMatches)) {
        const actual = req.headers[key.toLowerCase()];
        const actualVal = Array.isArray(actual) ? actual[0] : actual;
        if (typeof expected === 'string') {
          if (actualVal !== expected) { headersOk = false; break; }
        } else {
          if (!actualVal || !expected.test(actualVal)) { headersOk = false; break; }
        }
      }
    }
    if (!headersOk) continue;
    return route;
  }
  return undefined;
}


