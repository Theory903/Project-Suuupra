/**
 * What: Security middleware (IP allow/deny, signed URL validation)
 * Why: Enforce edge security controls before proxying
 * How: Check client IP against allow/deny lists; verify signed URLs for protected routes
 */

import * as crypto from 'crypto';
import { FastifyRequest } from 'fastify';
import { SecurityPolicy } from '../types/gateway';

export function checkIpAccess(clientIp: string, policy: SecurityPolicy): { ok: boolean; statusCode?: number; message?: string } {
  const allow = policy.ipAllowList;
  const deny = policy.ipDenyList;
  if (deny && deny.includes(clientIp)) return { ok: false, statusCode: 403, message: 'IP denied' };
  if (allow && allow.length > 0 && !allow.includes(clientIp)) return { ok: false, statusCode: 403, message: 'IP not allowed' };
  return { ok: true };
}

export function validateSignedUrl(req: FastifyRequest, policy: SecurityPolicy): { ok: boolean; statusCode?: number; message?: string } {
  if (!policy.signedUrlProxyEnabled) return { ok: true };
  const url = req.raw.url || '';
  const parsed = new URL(`http://localhost${url}`);
  const sig = parsed.searchParams.get('sig');
  const exp = parsed.searchParams.get('exp');
  if (!sig || !exp) return { ok: false, statusCode: 401, message: 'Missing signature' };
  if (Date.now() / 1000 > Number(exp)) return { ok: false, statusCode: 401, message: 'URL expired' };
  const secret = policy.signedUrlSecret || process.env.SIGNED_URL_SECRET || '';
  if (!secret) return { ok: false, statusCode: 500, message: 'Signature secret not configured' };
  parsed.searchParams.delete('sig');
  const base = parsed.pathname + '?' + parsed.searchParams.toString();
  const expected = crypto.createHmac('sha256', secret).update(base).digest('hex');
  if (expected !== sig) return { ok: false, statusCode: 401, message: 'Invalid signature' };
  return { ok: true };
}


