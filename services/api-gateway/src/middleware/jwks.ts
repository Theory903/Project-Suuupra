/**
 * What: JWKS-based JWT verification
 * Why: Secure token validation with key rotation support
 * How: Fetch and cache JWKS, verify JWTs using jose
 */

import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

export interface JwksConfig {
  jwksUri: string;
  issuer?: string;
  audience?: string;
}

export async function verifyJwtWithJwks(token: string, config: JwksConfig): Promise<JWTPayload> {
  if (!jwksCache) {
    const url = new URL(config.jwksUri);
    jwksCache = createRemoteJWKSet(url);
  }
  const { payload } = await jwtVerify(token, jwksCache, {
    issuer: config.issuer,
    audience: config.audience,
  });
  return payload;
}



