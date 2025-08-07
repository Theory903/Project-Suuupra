/**
 * What: API Key management and validation with Redis-backed store
 * Why: Secure API key authentication with hashing, scopes, and rotation support
 * How: Hash keys at rest, validate against store, track usage, support scopes
 */

import * as crypto from 'crypto';
import { getRedis } from './rateLimit';

export interface ApiKeyRecord {
  id: string;
  hashedKey: string;
  name: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  keyRecord?: ApiKeyRecord;
  error?: string;
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): string {
  return `ak_${crypto.randomBytes(32).toString('hex')}`;
}

export async function createApiKey(
  name: string,
  scopes: string[] = [],
  expiresAt?: number,
  metadata?: Record<string, any>
): Promise<{ key: string; record: ApiKeyRecord }> {
  const key = generateApiKey();
  const hashedKey = hashApiKey(key);
  const id = crypto.randomUUID();
  const now = Date.now();
  
  const record: ApiKeyRecord = {
    id,
    hashedKey,
    name,
    scopes,
    createdAt: now,
    expiresAt,
    isActive: true,
    metadata,
  };

  const redis = await getRedis();
  await redis.hSet(`apikey:${id}`, record as any);
  await redis.set(`apikey:hash:${hashedKey}`, id);
  
  return { key, record };
}

export async function validateApiKey(key: string): Promise<ApiKeyValidationResult> {
  if (!key || !key.startsWith('ak_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const hashedKey = hashApiKey(key);
  const redis = await getRedis();
  
  const keyId = await redis.get(`apikey:hash:${hashedKey}`);
  if (!keyId) {
    return { valid: false, error: 'API key not found' };
  }

  const record = await redis.hGetAll(`apikey:${keyId}`) as any;
  if (!record || !record.id) {
    return { valid: false, error: 'API key record not found' };
  }

  const keyRecord: ApiKeyRecord = {
    ...record,
    scopes: record.scopes ? JSON.parse(record.scopes) : [],
    createdAt: parseInt(record.createdAt, 10),
    lastUsedAt: record.lastUsedAt ? parseInt(record.lastUsedAt, 10) : undefined,
    expiresAt: record.expiresAt ? parseInt(record.expiresAt, 10) : undefined,
    isActive: record.isActive === 'true',
    metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
  };

  if (!keyRecord.isActive) {
    return { valid: false, error: 'API key is disabled' };
  }

  if (keyRecord.expiresAt && Date.now() > keyRecord.expiresAt) {
    return { valid: false, error: 'API key has expired' };
  }

  // Update last used timestamp
  await redis.hSet(`apikey:${keyId}`, 'lastUsedAt', String(Date.now()));

  return { valid: true, keyRecord };
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const redis = await getRedis();
  const record = await redis.hGetAll(`apikey:${keyId}`) as any;
  
  if (!record || !record.id) {
    return false;
  }

  await redis.hSet(`apikey:${keyId}`, 'isActive', 'false');
  await redis.del(`apikey:hash:${record.hashedKey}`);
  
  return true;
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const redis = await getRedis();
  const keys = await redis.keys('apikey:*');
  const records: ApiKeyRecord[] = [];
  
  for (const key of keys) {
    if (key.startsWith('apikey:hash:')) continue;
    
    const record = await redis.hGetAll(key) as any;
    if (record && record.id) {
      records.push({
        ...record,
        scopes: record.scopes ? JSON.parse(record.scopes) : [],
        createdAt: parseInt(record.createdAt, 10),
        lastUsedAt: record.lastUsedAt ? parseInt(record.lastUsedAt, 10) : undefined,
        expiresAt: record.expiresAt ? parseInt(record.expiresAt, 10) : undefined,
        isActive: record.isActive === 'true',
        metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
      });
    }
  }
  
  return records;
}
