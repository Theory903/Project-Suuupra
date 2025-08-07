/**
 * What: Per-request orchestration to apply routing, retry, and circuit breaking
 * Why: Keep the main server lean and treat this as a reusable pipeline primitive
 * How: Combine route match + breaker factory + proxy action; return upstream response
 */

import * as http from 'http';
import { FastifyRequest } from 'fastify';
import { getBreaker } from '../proxy/circuit';
import { proxyAction } from '../proxy/httpProxy';
import { findMatchingRoute } from '../routing/match';
import { gatewayConfig, serviceRegistry } from '../config/gatewayConfig';
import { enforceAuth } from '../middleware/auth';
import { checkRateLimit } from '../middleware/rateLimit';
import { checkIpAccess, validateSignedUrl } from '../middleware/security';
import { applyRequestTransforms } from '../middleware/transforms';
import { RouteConfig } from '../types/gateway';
import { isStreamingRequest, streamingProxyAction } from '../proxy/streamingProxy';
import { injectContext } from '../middleware/contextInjection';
import { updateQueueDepth, updateConcurrentRequests } from '../observability/metrics';

// naive in-memory in-flight counters keyed by route id
const inflightByRoute: Record<string, number> = {};
function incInflight(route?: RouteConfig) {
  if (!route) return;
  const id = route.id;
  inflightByRoute[id] = (inflightByRoute[id] || 0) + 1;
  updateConcurrentRequests(id, inflightByRoute[id]);
}
function decInflight(route?: RouteConfig) {
  if (!route) return;
  const id = route.id;
  inflightByRoute[id] = Math.max(0, (inflightByRoute[id] || 0) - 1);
  updateConcurrentRequests(id, inflightByRoute[id]);
}

export interface ProxyOutcome {
  response: http.IncomingMessage;
  correlationId: string;
  isStreaming?: boolean;
}

function generateCorrelationId(): string {
  const random = Math.random().toString(16).slice(2);
  return `corr_${Date.now().toString(16)}_${random}`;
}

export async function handleGatewayProxy(req: FastifyRequest): Promise<ProxyOutcome> {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  (req.headers as Record<string, string>)['x-correlation-id'] = correlationId;

  const route = findMatchingRoute(req, gatewayConfig.routes);
  const targetServiceName = route?.target.serviceName || (req.params as any)['service'] || '';
  const serviceUrl = serviceRegistry[targetServiceName];
  if (!serviceUrl) {
    const err = new Error(`Unknown service '${targetServiceName}'`);
    (err as any).statusCode = 502;
    throw err;
  }

  const breaker = getBreaker(targetServiceName, proxyAction, {
    timeout: route?.policy.breaker?.timeoutMs ?? 5000,
    errorThresholdPercentage: route?.policy.breaker?.errorThresholdPercentage ?? 50,
    resetTimeout: route?.policy.breaker?.resetTimeoutMs ?? 30000,
  });

  // Security: IP and Signed URL checks
  if (route?.policy.security) {
    const ipCheck = checkIpAccess(String(req.ip), route.policy.security);
    if (!ipCheck.ok) throw Object.assign(new Error(ipCheck.message || 'Forbidden'), { statusCode: ipCheck.statusCode || 403 });
    const sigCheck = validateSignedUrl(req, route.policy.security);
    if (!sigCheck.ok) throw Object.assign(new Error(sigCheck.message || 'Unauthorized'), { statusCode: sigCheck.statusCode || 401 });
  }

  // Auth
  if (route?.policy.auth) {
    const auth = await enforceAuth(req, route.policy.auth);
    if (!auth.ok) throw Object.assign(new Error(auth.message || 'Unauthorized'), { statusCode: auth.statusCode || 401 });
  }

  // Rate limiting
  if (route?.policy.rateLimit?.enabled) {
    const rl = await checkRateLimit(req, route.policy.rateLimit, route.id);
    if (!rl.allowed) {
      const err = new Error('Too Many Requests');
      (err as any).statusCode = 429;
      if (rl.resetMs !== undefined) {
        (req.headers as any)['retry-after'] = String(Math.ceil((rl.resetMs || 0) / 1000));
      }
      throw err;
    }
    if (rl.remaining !== undefined) (req.headers as any)['x-rate-limit-remaining'] = String(rl.remaining);
  }

  const retriesEnabled = route?.policy.retry?.enabled;
  const maxAttempts = Math.max(1, route?.policy.retry?.maxAttempts ?? 1);
  const backoffInitial = route?.policy.retry?.backoffInitialMs ?? 0;
  const backoffJitter = route?.policy.retry?.backoffJitterMs ?? 0;

  // AI concurrency caps
  const concurrencyLimit = route?.policy.ai?.concurrencyLimit ?? 0;
  if (concurrencyLimit > 0) {
    const current = inflightByRoute[route!.id] || 0;
    if (current >= concurrencyLimit && !route?.policy.ai?.queueingEnabled) {
      const err = new Error('Too Many Requests');
      (err as any).statusCode = 429;
      (req.headers as any)['retry-after'] = '1';
      throw err;
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= (retriesEnabled ? maxAttempts : 1); attempt++) {
    try {
      // Apply request transforms just-in-time
      if (route?.policy.transforms) {
        (req.headers as any) = applyRequestTransforms(req.headers as any, route.policy.transforms);
      }

      // Context injection for AI/downstream services
      if (route?.policy.ai?.contextInjectionEnabled && route.policy.ai.contextMapping) {
        const contextResult = injectContext(req, route.policy.ai.contextMapping);
        if (!contextResult.ok) {
          throw Object.assign(new Error(contextResult.error || 'Context injection failed'), { statusCode: 400 });
        }
        // Merge context headers
        Object.assign(req.headers as any, contextResult.headers);
      }
      incInflight(route);
      const response = (await breaker.fire(req as any, serviceUrl)) as http.IncomingMessage;
      // Add per-route metrics label via header for server.ts metrics
      (response.headers as any) = (response.headers || {});
      (response.headers as any)['x-gateway-route-id'] = route?.id || 'unknown';
      return { response, correlationId };
    } catch (err) {
      lastError = err;
      if (attempt >= (retriesEnabled ? maxAttempts : 1)) break;
      const wait = backoffInitial + Math.floor(Math.random() * backoffJitter);
      await new Promise((r) => setTimeout(r, wait));
    } finally {
      decInflight(route);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}


