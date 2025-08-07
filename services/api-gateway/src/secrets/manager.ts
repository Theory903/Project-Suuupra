/**
 * What: Secrets management integration with Vault and AWS Secrets Manager
 * Why: Secure storage and retrieval of sensitive configuration data
 * How: Abstract interface with multiple backend providers and caching
 */

export interface SecretValue {
  value: string;
  version?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface SecretsProvider {
  name: string;
  getSecret(path: string): Promise<SecretValue>;
  setSecret(path: string, value: string, metadata?: Record<string, any>): Promise<void>;
  deleteSecret(path: string): Promise<void>;
  listSecrets(prefix?: string): Promise<string[]>;
}

export interface SecretsManagerConfig {
  provider: 'vault' | 'aws' | 'gcp' | 'env';
  cacheEnabled: boolean;
  cacheTtlMs: number;
  vault?: VaultConfig;
  aws?: AWSSecretsConfig;
  gcp?: GCPSecretsConfig;
}

export interface VaultConfig {
  url: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  mountPath?: string;
}

export interface AWSSecretsConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface GCPSecretsConfig {
  projectId: string;
  keyFilename?: string;
  credentials?: any;
}

interface CachedSecret {
  value: SecretValue;
  cachedAt: number;
  expiresAt: number;
}

const DEFAULT_CONFIG: SecretsManagerConfig = {
  provider: 'env',
  cacheEnabled: true,
  cacheTtlMs: 300000, // 5 minutes
};

export class SecretsManager {
  private config: SecretsManagerConfig;
  private provider: SecretsProvider;
  private cache = new Map<string, CachedSecret>();

  constructor(config: Partial<SecretsManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.provider = this.createProvider();
  }

  async getSecret(path: string, useCache = true): Promise<SecretValue> {
    if (useCache && this.config.cacheEnabled) {
      const cached = this.cache.get(path);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
      }
    }

    const secret = await this.provider.getSecret(path);
    
    if (this.config.cacheEnabled) {
      this.cache.set(path, {
        value: secret,
        cachedAt: Date.now(),
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    return secret;
  }

  async setSecret(path: string, value: string, metadata?: Record<string, any>): Promise<void> {
    await this.provider.setSecret(path, value, metadata);
    
    // Invalidate cache
    this.cache.delete(path);
  }

  async deleteSecret(path: string): Promise<void> {
    await this.provider.deleteSecret(path);
    
    // Invalidate cache
    this.cache.delete(path);
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    return await this.provider.listSecrets(prefix);
  }

  private createProvider(): SecretsProvider {
    switch (this.config.provider) {
      case 'vault':
        return new VaultProvider(this.config.vault!);
      case 'aws':
        return new AWSSecretsProvider(this.config.aws!);
      case 'gcp':
        return new GCPSecretsProvider(this.config.gcp!);
      case 'env':
        return new EnvProvider();
      default:
        throw new Error(`Unsupported secrets provider: ${this.config.provider}`);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): {
    size: number;
    hitRate: number;
  } {
    // Simple cache stats (in production, track hits/misses)
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  updateConfig(newConfig: Partial<SecretsManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.provider = this.createProvider();
    this.clearCache();
  }
}

class VaultProvider implements SecretsProvider {
  name = 'vault';
  private config: VaultConfig;
  private token?: string;

  constructor(config: VaultConfig) {
    this.config = config;
    this.token = config.token;
  }

  async getSecret(path: string): Promise<SecretValue> {
    await this.ensureAuthenticated();
    
    const url = `${this.config.url}/v1/${this.config.mountPath || 'secret'}/data/${path}`;
    const response = await fetch(url, {
      headers: {
        'X-Vault-Token': this.token!,
        'X-Vault-Namespace': this.config.namespace || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Vault error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      value: JSON.stringify(data.data.data),
      version: data.data.metadata?.version?.toString(),
      metadata: data.data.metadata,
    };
  }

  async setSecret(path: string, value: string, metadata?: Record<string, any>): Promise<void> {
    await this.ensureAuthenticated();
    
    const url = `${this.config.url}/v1/${this.config.mountPath || 'secret'}/data/${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Vault-Token': this.token!,
        'X-Vault-Namespace': this.config.namespace || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: JSON.parse(value),
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vault error: ${response.statusText}`);
    }
  }

  async deleteSecret(path: string): Promise<void> {
    await this.ensureAuthenticated();
    
    const url = `${this.config.url}/v1/${this.config.mountPath || 'secret'}/metadata/${path}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Vault-Token': this.token!,
        'X-Vault-Namespace': this.config.namespace || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Vault error: ${response.statusText}`);
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    await this.ensureAuthenticated();
    
    const url = `${this.config.url}/v1/${this.config.mountPath || 'secret'}/metadata/${prefix || ''}?list=true`;
    const response = await fetch(url, {
      headers: {
        'X-Vault-Token': this.token!,
        'X-Vault-Namespace': this.config.namespace || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Vault error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.keys || [];
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.token) return;

    if (this.config.roleId && this.config.secretId) {
      await this.authenticateWithAppRole();
    } else {
      throw new Error('No Vault authentication method configured');
    }
  }

  private async authenticateWithAppRole(): Promise<void> {
    const url = `${this.config.url}/v1/auth/approle/login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Namespace': this.config.namespace || '',
      },
      body: JSON.stringify({
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vault authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.token = data.auth.client_token;
  }
}

class AWSSecretsProvider implements SecretsProvider {
  name = 'aws';
  private config: AWSSecretsConfig;

  constructor(config: AWSSecretsConfig) {
    this.config = config;
  }

  async getSecret(path: string): Promise<SecretValue> {
    // In a real implementation, use AWS SDK
    // For now, simulate the call
    throw new Error('AWS Secrets Manager not implemented - use AWS SDK');
  }

  async setSecret(path: string, value: string, metadata?: Record<string, any>): Promise<void> {
    throw new Error('AWS Secrets Manager not implemented - use AWS SDK');
  }

  async deleteSecret(path: string): Promise<void> {
    throw new Error('AWS Secrets Manager not implemented - use AWS SDK');
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    throw new Error('AWS Secrets Manager not implemented - use AWS SDK');
  }
}

class GCPSecretsProvider implements SecretsProvider {
  name = 'gcp';
  private config: GCPSecretsConfig;

  constructor(config: GCPSecretsConfig) {
    this.config = config;
  }

  async getSecret(path: string): Promise<SecretValue> {
    // In a real implementation, use GCP Secret Manager client
    throw new Error('GCP Secret Manager not implemented - use GCP SDK');
  }

  async setSecret(path: string, value: string, metadata?: Record<string, any>): Promise<void> {
    throw new Error('GCP Secret Manager not implemented - use GCP SDK');
  }

  async deleteSecret(path: string): Promise<void> {
    throw new Error('GCP Secret Manager not implemented - use GCP SDK');
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    throw new Error('GCP Secret Manager not implemented - use GCP SDK');
  }
}

class EnvProvider implements SecretsProvider {
  name = 'env';

  async getSecret(path: string): Promise<SecretValue> {
    const envKey = path.toUpperCase().replace(/[\/\-]/g, '_');
    const value = process.env[envKey];
    
    if (value === undefined) {
      throw new Error(`Environment variable ${envKey} not found`);
    }

    return { value };
  }

  async setSecret(path: string, value: string, metadata?: Record<string, any>): Promise<void> {
    const envKey = path.toUpperCase().replace(/[\/\-]/g, '_');
    process.env[envKey] = value;
  }

  async deleteSecret(path: string): Promise<void> {
    const envKey = path.toUpperCase().replace(/[\/\-]/g, '_');
    delete process.env[envKey];
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    const prefixUpper = prefix?.toUpperCase().replace(/[\/\-]/g, '_') || '';
    return Object.keys(process.env).filter(key => key.startsWith(prefixUpper));
  }
}

// Global secrets manager instance
let secretsManager: SecretsManager;

export function initializeSecretsManager(config: Partial<SecretsManagerConfig>): SecretsManager {
  secretsManager = new SecretsManager(config);
  return secretsManager;
}

export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    // Initialize with default env provider if not configured
    secretsManager = new SecretsManager({ provider: 'env' });
  }
  return secretsManager;
}

// Helper functions for common secret patterns
export async function getJWTSecret(issuer: string): Promise<string> {
  const manager = getSecretsManager();
  const secret = await manager.getSecret(`jwt/${issuer}/secret`);
  return secret.value;
}

export async function getAPISecret(serviceName: string): Promise<string> {
  const manager = getSecretsManager();
  const secret = await manager.getSecret(`api/${serviceName}/secret`);
  return secret.value;
}

export async function getDatabaseCredentials(dbName: string): Promise<{ username: string; password: string }> {
  const manager = getSecretsManager();
  const secret = await manager.getSecret(`database/${dbName}/credentials`);
  const credentials = JSON.parse(secret.value);
  return credentials;
}
