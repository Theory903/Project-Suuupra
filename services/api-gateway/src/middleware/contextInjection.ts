/**
 * What: Context injection middleware for mapping JWT claims to headers safely
 * Why: Pass user context to downstream services without exposing sensitive data
 * How: Configurable claim-to-header mapping with transformation and validation
 */

import { FastifyRequest } from 'fastify';
import { ContextMappingRule } from '../types/gateway';

export interface ContextInjectionResult {
  ok: boolean;
  error?: string;
  headers?: Record<string, string>;
}

function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function transformValue(value: any, transform?: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (transform) {
    case 'json':
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    case 'csv':
      if (Array.isArray(value)) {
        return value.join(',');
      }
      return String(value);
    case 'string':
    default:
      return String(value);
  }
}

export function injectContext(
  req: FastifyRequest,
  mappingRules: ContextMappingRule[]
): ContextInjectionResult {
  const user = (req as any).user;
  const apiKey = (req as any).apiKey;
  const headers: Record<string, string> = {};

  if (!mappingRules || mappingRules.length === 0) {
    return { ok: true, headers };
  }

  // Combine user claims and API key info for context
  const context = {
    ...user,
    apiKey: apiKey ? {
      id: apiKey.id,
      name: apiKey.name,
      scopes: apiKey.scopes,
    } : undefined,
  };

  for (const rule of mappingRules) {
    try {
      const value = getNestedProperty(context, rule.claimPath);
      
      if (value === undefined || value === null) {
        if (rule.required) {
          return {
            ok: false,
            error: `Required claim '${rule.claimPath}' not found`,
          };
        }
        continue; // Skip optional missing claims
      }

      const transformedValue = transformValue(value, rule.transform);
      headers[rule.headerName] = transformedValue;
    } catch (error) {
      if (rule.required) {
        return {
          ok: false,
          error: `Failed to process required claim '${rule.claimPath}': ${error}`,
        };
      }
      // Skip optional claims that fail processing
      continue;
    }
  }

  return { ok: true, headers };
}

// Common context mapping presets
export const COMMON_MAPPINGS = {
  USER_IDENTITY: [
    { claimPath: 'sub', headerName: 'x-user-id', required: true },
    { claimPath: 'email', headerName: 'x-user-email' },
    { claimPath: 'name', headerName: 'x-user-name' },
  ] as ContextMappingRule[],

  USER_ROLES: [
    { claimPath: 'roles', headerName: 'x-user-roles', transform: 'csv' },
    { claimPath: 'permissions', headerName: 'x-user-permissions', transform: 'csv' },
  ] as ContextMappingRule[],

  TENANT_INFO: [
    { claimPath: 'tenant_id', headerName: 'x-tenant-id', required: true },
    { claimPath: 'tenant_name', headerName: 'x-tenant-name' },
    { claimPath: 'organization', headerName: 'x-organization' },
  ] as ContextMappingRule[],

  API_KEY_INFO: [
    { claimPath: 'apiKey.id', headerName: 'x-api-key-id' },
    { claimPath: 'apiKey.name', headerName: 'x-api-key-name' },
    { claimPath: 'apiKey.scopes', headerName: 'x-api-key-scopes', transform: 'csv' },
  ] as ContextMappingRule[],

  OAUTH_SCOPES: [
    { claimPath: 'scope', headerName: 'x-oauth-scopes' },
    { claimPath: 'aud', headerName: 'x-oauth-audience', transform: 'csv' },
    { claimPath: 'iss', headerName: 'x-oauth-issuer' },
  ] as ContextMappingRule[],
};

// Utility to merge multiple preset mappings
export function createMappingRules(...presets: ContextMappingRule[][]): ContextMappingRule[] {
  return presets.flat();
}

// Security validation for mapping rules
export function validateMappingRules(rules: ContextMappingRule[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const headerNames = new Set<string>();

  for (const rule of rules) {
    // Check for duplicate header names
    if (headerNames.has(rule.headerName)) {
      errors.push(`Duplicate header name: ${rule.headerName}`);
    }
    headerNames.add(rule.headerName);

    // Validate header name format (should start with x- for custom headers)
    if (!rule.headerName.match(/^[a-z0-9-]+$/)) {
      errors.push(`Invalid header name format: ${rule.headerName}`);
    }

    // Validate claim path format
    if (!rule.claimPath || rule.claimPath.includes('..') || rule.claimPath.startsWith('.')) {
      errors.push(`Invalid claim path: ${rule.claimPath}`);
    }

    // Validate transform type
    if (rule.transform && !['string', 'json', 'csv'].includes(rule.transform)) {
      errors.push(`Invalid transform type: ${rule.transform}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
