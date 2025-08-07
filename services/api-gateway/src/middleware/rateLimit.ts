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
  const results = await client.mGet([refKey, bucketKey]);
  const lastTsRaw = results?.[0];
  const bucketRaw = results?.[1];
  const lastTs = lastTsRaw ? parseInt(lastTsRaw as string, 10) : now;
  const bucket = Math.min(maxTokens, (bucketRaw ? parseInt(bucketRaw as string, 10) : maxTokens) + Math.floor(((now - lastTs) / intervalMs) * tokens));

  const newBucket = bucket - 1;
  const allowed = newBucket >= 0;
  const multi = client.multi();
  multi.set(refKey, String(now));
  multi.set(bucketKey, String(allowed ? newBucket : bucket));
  multi.pExpire(refKey, intervalMs);
  multi.pExpire(bucketKey, intervalMs);
  await multi.exec();

  return {
    allowed,
    remaining: Math.max(0, allowed ? newBucket : bucket),
    resetMs: intervalMs,
  };
}


