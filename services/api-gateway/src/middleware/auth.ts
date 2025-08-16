/**
 * What: Authentication and RBAC checks (JWT + API Key) with Identity Service integration
 * Why: Enforce access control at the edge per route policy with centralized identity management
 * How: Verify JWT via JWKS, validate with Identity service, check API key store, validate roles
 */

import { FastifyRequest } from 'fastify';
import { RoutePolicy } from '../types/gateway';

// Dynamic import for 'jose' to avoid type resolution issues before deps are installed
declare const require: any;
let jose: any = null;
jose = require('jose');

// Enhanced caching for JWKS and identity service responses
const jwksCache: Record<string, any> = {};
const identityServiceCache: Record<string, { data: any; expires: number }> = {};
const IDENTITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function verifyJwtWithJose(
  token: string,
  options: NonNullable<RoutePolicy['auth']>
): Promise<any> {
  const discoveryUrl = options.oidcDiscoveryUrl;
  let jwksUrl = options.jwksUri;
  if (!jwksUrl && discoveryUrl) {
    const res = await fetch(discoveryUrl);
    if (!res.ok) throw new Error('OIDC discovery failed');
    const json = (await res.json()) as { jwks_uri?: string };
    jwksUrl = json.jwks_uri;
  }
  if (!jwksUrl) throw new Error('No JWKS URI configured');
  const cacheKey = `${options.issuer || ''}|${jwksUrl}`;
  const jwks = jwksCache[cacheKey] || jose?.createRemoteJWKSet?.(new URL(jwksUrl), {
    cacheMaxAge: options.jwksCacheMaxAgeMs ?? 10 * 60 * 1000,
  } as any);
  jwksCache[cacheKey] = jwks;
  const audience = options.audience;
  const issuer = options.issuer;
  const { payload } = await jose.jwtVerify(token, jwks as any, {
    issuer,
    audience,
  });
  return payload;
}

export interface AuthResult {
  ok: boolean;
  statusCode?: number;
  message?: string;
}

/**
 * Validate user with Identity Service
 */
async function validateWithIdentityService(userId: string, token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
  const cacheKey = `identity:${userId}`;
  const cached = identityServiceCache[cacheKey];
  
  if (cached && Date.now() < cached.expires) {
    return { valid: true, user: cached.data };
  }

  try {
    const identityServiceUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:8081';
    const response = await fetch(`${identityServiceUrl}/api/v1/users/${userId}/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { valid: false, error: `Identity service validation failed: ${response.status}` };
    }

    const userData = await response.json();
    
    // Cache the result
    identityServiceCache[cacheKey] = {
      data: userData,
      expires: Date.now() + IDENTITY_CACHE_TTL,
    };

    return { valid: true, user: userData };
  } catch (error) {
    console.error('Identity service validation error:', error);
    return { valid: false, error: 'Identity service unavailable' };
  }
}

export async function enforceAuth(req: FastifyRequest, policy: NonNullable<RoutePolicy['auth']>): Promise<AuthResult> {
  if (!policy.requireJwt && !policy.requireApiKey && !policy.requiredRoles?.length) {
    return { ok: true };
  }
  
  let jwtPayload: any = null;
  
  if (policy.requireJwt) {
    try {
      const authz = (req.headers['authorization'] as string | undefined) || '';
      const bearer = authz.startsWith('Bearer ') ? authz.substring(7) : undefined;
      const token = bearer || (req.headers['x-id-token'] as string | undefined);
      if (!token) throw new Error('Missing token');

      if (policy.jwksUri || policy.oidcDiscoveryUrl) {
        jwtPayload = await verifyJwtWithJose(token, policy);
        (req as any).user = jwtPayload;
        
        // Additional validation with Identity Service for critical operations
        if (jwtPayload.sub) {
          const identityValidation = await validateWithIdentityService(jwtPayload.sub, token);
          if (!identityValidation.valid) {
            return { ok: false, statusCode: 401, message: identityValidation.error || 'Identity validation failed' };
          }
          
          // Merge identity service data with JWT payload
          (req as any).user = { ...jwtPayload, ...identityValidation.user };
        }
      } else if (typeof (req as any).jwtVerify === 'function') {
        await (req as any).jwtVerify();
        jwtPayload = (req as any).user;
      } else {
        return { ok: false, statusCode: 401, message: 'JWT verification unavailable' };
      }
    } catch (e: any) {
      return { ok: false, statusCode: 401, message: 'Invalid or missing JWT' };
    }
  }
  
  if (policy.requireApiKey) {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) return { ok: false, statusCode: 401, message: 'Missing API key' };
    
    const { validateApiKey } = await import('./apiKeys');
    const validation = await validateApiKey(apiKey);
    if (!validation.valid) {
      return { ok: false, statusCode: 401, message: validation.error || 'Invalid API key' };
    }
    
    // Store API key info for later use
    (req as any).apiKey = validation.keyRecord;
  }
  
  if (policy.requiredRoles?.length) {
    const roles = ((req as any).user?.roles as string[] | undefined) || [];
    const hasRole = policy.requiredRoles.some((r) => roles.includes(r));
    if (!hasRole) return { ok: false, statusCode: 403, message: 'Forbidden: insufficient role' };
  }
  
  if (policy.requiredScopes?.length) {
    const scopesStr = ((req as any).user?.scope as string | undefined) || '';
    const scopes = new Set(scopesStr.split(' ').filter(Boolean));
    const ok = policy.requiredScopes.every((s) => scopes.has(s));
    if (!ok) return { ok: false, statusCode: 403, message: 'Forbidden: missing scope' };
  }
  
  return { ok: true };
}


