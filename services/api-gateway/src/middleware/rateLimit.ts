/**
 * What: Redis-backed token bucket rate limiter
 * Why: Protect upstreams and ensure fair usage per IP/user/tenant/route
 * How: Decrement tokens in Redis per key each interval; allow burst via multiplier
 */

import { createClient, RedisClientType } from 'redis';
import { FastifyRequest } from 'fastify';
import { RoutePolicy } from '../types/gateway';

let redis: RedisClientType | null = null;
export async function getRedis(): Promise<RedisClientType> {
  if (redis) return redis;
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  redis = createClient({ url });
  await redis.connect();
  return redis;
}

function buildKey(req: FastifyRequest, policy: NonNullable<RoutePolicy['rateLimit']>, routeId: string): string {
  const parts: string[] = ['rl'];
  for (const k of policy.keys || ['ip']) {
    if (k === 'ip') parts.push(String(req.ip));
    if (k === 'user') parts.push(String((req as any).user?.id || 'anon'));
    if (k === 'tenant') parts.push(String((req.headers['x-tenant-id'] as string) || 'default'));
    if (k === 'route') parts.push(routeId);
  }
  return parts.join(':');
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetMs?: number;
  abuseDetected?: boolean;
  reason?: string;
}

/**
 * Enhanced abuse detection patterns
 */
async function detectAbuse(req: FastifyRequest, key: string): Promise<{ detected: boolean; reason?: string }> {
  const client = await getRedis();
  const abuseKey = `abuse:${key}`;
  const now = Date.now();
  const window = 5 * 60 * 1000; // 5 minute window
  
  // Check for rapid sequential requests (more than 100 requests in 1 minute)
  const rapidKey = `${abuseKey}:rapid`;
  const rapidCount = await client.incr(rapidKey);
  if (rapidCount === 1) {
    await client.pExpire(rapidKey, 60000); // 1 minute expiry
  }
  
  if (rapidCount > 100) {
    return { detected: true, reason: 'Rapid request pattern detected' };
  }
  
  // Check for suspicious patterns (same User-Agent with different IPs)
  const userAgent = req.headers['user-agent'];
  if (userAgent) {
    const uaKey = `abuse:ua:${Buffer.from(userAgent).toString('base64').slice(0, 20)}`;
    const ipSet = `${uaKey}:ips`;
    await client.sAdd(ipSet, req.ip);
    await client.pExpire(ipSet, window);
    
    const uniqueIps = await client.sCard(ipSet);
    if (uniqueIps > 10) {
      return { detected: true, reason: 'Suspicious User-Agent usage pattern' };
    }
  }
  
  // Check for distributed attack patterns (too many different IPs hitting same endpoint)
  const endpointKey = `abuse:endpoint:${req.url}:ips`;
  await client.sAdd(endpointKey, req.ip);
  await client.pExpire(endpointKey, window);
  
  const uniqueEndpointIps = await client.sCard(endpointKey);
  if (uniqueEndpointIps > 50) {
    return { detected: true, reason: 'Distributed attack pattern detected' };
  }
  
  return { detected: false };
}

export async function checkRateLimit(
  req: FastifyRequest,
  policy: NonNullable<RoutePolicy['rateLimit']>,
  routeId: string
): Promise<RateLimitResult> {
  if (!policy.enabled) return { allowed: true };
  
  const tokens = policy.tokensPerInterval ?? 60;
  const intervalMs = policy.intervalMs ?? 60_000;
  const burst = policy.burstMultiplier ?? 1;
  const maxTokens = tokens * burst;
  const key = buildKey(req, policy, routeId);
  const now = Date.now();
  const bucketKey = `${key}:bucket`;
  const refKey = `${key}:ts`;

  const client = await getRedis();
  
  // Enhanced abuse detection
  const abuseCheck = await detectAbuse(req, key);
  if (abuseCheck.detected) {
    // Log security event
    console.warn('Abuse detected:', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      url: req.url,
      reason: abuseCheck.reason,
      timestamp: new Date().toISOString(),
    });
    
    return {
      allowed: false,
      abuseDetected: true,
      reason: abuseCheck.reason,
      resetMs: intervalMs,
    };
  }
  
  const results = await client.mGet([refKey, bucketKey]);
  const lastTsRaw = results?.[0];
  const bucketRaw = results?.[1];
  const lastTs = lastTsRaw ? parseInt(lastTsRaw as string, 10) : now;
  const bucket = Math.min(maxTokens, (bucketRaw ? parseInt(bucketRaw as string, 10) : maxTokens) + Math.floor(((now - lastTs) / intervalMs) * tokens));

  const newBucket = bucket - 1;
  const allowed = newBucket >= 0;
  
  // Update counters only if request is allowed or if we need to track violations
  const multi = client.multi();
  multi.set(refKey, String(now));
  multi.set(bucketKey, String(allowed ? newBucket : bucket));
  multi.pExpire(refKey, intervalMs);
  multi.pExpire(bucketKey, intervalMs);
  
  // Track consecutive rate limit violations for progressive penalties
  if (!allowed) {
    const violationKey = `${key}:violations`;
    multi.incr(violationKey);
    multi.pExpire(violationKey, intervalMs * 2); // Track violations for double the rate limit window
  } else {
    // Reset violations on successful request
    multi.del(`${key}:violations`);
  }
  
  await multi.exec();

  return {
    allowed,
    remaining: Math.max(0, allowed ? newBucket : bucket),
    resetMs: intervalMs,
    abuseDetected: false,
  };
}


