/**
 * What: Environment-scoped configuration isolation for multi-tenant deployments
 * Why: Separate configurations per environment while sharing infrastructure
 * How: Environment-aware config loading, tenant isolation, namespace management
 */

import { GatewayConfig, RouteConfig } from '../types/gateway';

export interface Environment {
  name: string;
  displayName: string;
  namespace: string;
  domain: string;
  config: EnvironmentConfig;
  tenants: string[];
  metadata: Record<string, any>;
}

export interface EnvironmentConfig {
  features: {
    rateLimitingEnabled: boolean;
    authRequired: boolean;
    tracingEnabled: boolean;
    metricsEnabled: boolean;
    debugMode: boolean;
  };
  limits: {
    maxRequestsPerSecond: number;
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
  };
  security: {
    allowedOrigins: string[];
    ipWhitelist?: string[];
    ipBlacklist?: string[];
    requireHttps: boolean;
  };
  integrations: {
    enabledProviders: string[];
    secretsBackend: string;
    metricsBackend: string;
    tracingBackend: string;
  };
}

export interface TenantConfig {
  id: string;
  name: string;
  environment: string;
  namespace: string;
  routes: RouteConfig[];
  limits: {
    maxRoutes: number;
    maxRequestsPerSecond: number;
    maxStorageMB: number;
  };
  features: string[];
  metadata: Record<string, any>;
}

export interface EnvironmentIsolationConfig {
  enabled: boolean;
  defaultEnvironment: string;
  environmentDetection: 'header' | 'subdomain' | 'path' | 'manual';
  tenantDetection: 'header' | 'subdomain' | 'jwt-claim' | 'api-key';
  configSources: {
    environments: 'file' | 'database' | 'api';
    tenants: 'file' | 'database' | 'api';
  };
  cacheEnabled: boolean;
  cacheTtlMs: number;
}

const DEFAULT_CONFIG: EnvironmentIsolationConfig = {
  enabled: false,
  defaultEnvironment: 'production',
  environmentDetection: 'header',
  tenantDetection: 'header',
  configSources: {
    environments: 'file',
    tenants: 'file',
  },
  cacheEnabled: true,
  cacheTtlMs: 300000, // 5 minutes
};

export class EnvironmentIsolationManager {
  private config: EnvironmentIsolationConfig;
  private environments = new Map<string, Environment>();
  private tenants = new Map<string, TenantConfig>();
  private configCache = new Map<string, { config: GatewayConfig; expiresAt: number }>();

  constructor(config: Partial<EnvironmentIsolationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadEnvironments();
    this.loadTenants();
  }

  async getGatewayConfig(context: {
    environment?: string;
    tenant?: string;
    request?: any;
  }): Promise<GatewayConfig> {
    if (!this.config.enabled) {
      // Return default config if isolation is disabled
      return this.getDefaultConfig();
    }

    const environment = context.environment || this.detectEnvironment(context.request);
    const tenant = context.tenant || this.detectTenant(context.request);
    
    const cacheKey = `${environment}:${tenant || 'default'}`;
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.configCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.config;
      }
    }

    // Build environment-specific configuration
    const config = await this.buildGatewayConfig(environment, tenant);
    
    // Cache result
    if (this.config.cacheEnabled) {
      this.configCache.set(cacheKey, {
        config,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    return config;
  }

  private detectEnvironment(request?: any): string {
    if (!request) return this.config.defaultEnvironment;

    switch (this.config.environmentDetection) {
      case 'header':
        return request.headers?.['x-environment'] || this.config.defaultEnvironment;
      
      case 'subdomain':
        const host = request.headers?.host || '';
        const subdomain = host.split('.')[0];
        return this.environments.has(subdomain) ? subdomain : this.config.defaultEnvironment;
      
      case 'path':
        const path = request.url || '';
        const pathSegments = path.split('/').filter(Boolean);
        const envFromPath = pathSegments[0];
        return this.environments.has(envFromPath) ? envFromPath : this.config.defaultEnvironment;
      
      case 'manual':
      default:
        return this.config.defaultEnvironment;
    }
  }

  private detectTenant(request?: any): string | undefined {
    if (!request) return undefined;

    switch (this.config.tenantDetection) {
      case 'header':
        return request.headers?.['x-tenant-id'];
      
      case 'subdomain':
        const host = request.headers?.host || '';
        const parts = host.split('.');
        if (parts.length >= 3) {
          // Assume format: tenant.env.domain.com
          return parts[0];
        }
        return undefined;
      
      case 'jwt-claim':
        const user = (request as any).user;
        return user?.tenant_id || user?.tenantId;
      
      case 'api-key':
        const apiKey = (request as any).apiKey;
        return apiKey?.metadata?.tenantId;
      
      default:
        return undefined;
    }
  }

  private async buildGatewayConfig(environment: string, tenant?: string): Promise<GatewayConfig> {
    const env = this.environments.get(environment);
    if (!env) {
      throw new Error(`Environment ${environment} not found`);
    }

    const tenantConfig = tenant ? this.tenants.get(tenant) : undefined;
    if (tenant && !tenantConfig) {
      throw new Error(`Tenant ${tenant} not found`);
    }

    // Start with base environment configuration
    const config: GatewayConfig = {
      routes: [],
      admin: {
        apiEnabled: env.config.features.debugMode,
        hotReloadEnabled: true,
        secretsManagementEnabled: true,
      },
      features: {
        rateLimiting: env.config.features.rateLimitingEnabled,
        circuitBreakers: true,
        retries: true,
        cors: true,
        ipAllowDeny: env.config.security.ipWhitelist !== undefined,
        signedUrlProxy: false,
        aiStreamingProxy: true,
        websocketSessionMgr: false,
        prometheusMetrics: env.config.features.metricsEnabled,
        openTelemetry: env.config.features.tracingEnabled,
      },
    };

    // Add tenant-specific routes if tenant is specified
    if (tenantConfig) {
      // Filter and namespace routes for the tenant
      config.routes = tenantConfig.routes.map(route => ({
        ...route,
        id: `${tenant}-${route.id}`,
        matcher: {
          ...route.matcher,
          // Add tenant-specific path prefix if needed
          pathPrefix: this.addTenantPrefix(route.matcher.pathPrefix || '/', tenant!),
        },
        target: {
          ...route.target,
          // Add tenant namespace to service discovery
          discovery: {
            ...route.target.discovery,
            namespace: tenantConfig.namespace,
          },
        },
      }));

      // Apply tenant-specific rate limits
      config.routes.forEach(route => {
        if (route.policy?.rateLimit) {
          route.policy.rateLimit.tokensPerInterval = Math.min(
            route.policy.rateLimit.tokensPerInterval || Infinity,
            tenantConfig.limits.maxRequestsPerSecond
          );
        }
      });
    } else {
      // Load environment-wide routes
      config.routes = await this.loadEnvironmentRoutes(environment);
    }

    return config;
  }

  private addTenantPrefix(pathPrefix: string, tenant: string): string {
    // Add tenant prefix to path if not already present
    if (pathPrefix.startsWith(`/${tenant}/`)) {
      return pathPrefix;
    }
    
    if (pathPrefix === '/') {
      return `/${tenant}/`;
    }
    
    return `/${tenant}${pathPrefix}`;
  }

  private async loadEnvironmentRoutes(environment: string): Promise<RouteConfig[]> {
    // In a real implementation, this would load from database or API
    // For now, return some default routes based on environment
    const baseRoutes: RouteConfig[] = [
      {
        id: `${environment}-health`,
        matcher: {
          pathPrefix: '/health',
          methods: ['GET'],
        },
        target: {
          serviceName: 'health-service',
          discovery: {
            type: 'k8s',
            namespace: environment,
          },
        },
        policy: {},
      },
    ];

    // Add environment-specific routes
    if (environment === 'development') {
      baseRoutes.push({
        id: `${environment}-debug`,
        matcher: {
          pathPrefix: '/debug',
          methods: ['GET'],
        },
        target: {
          serviceName: 'debug-service',
          discovery: {
            type: 'k8s',
            namespace: environment,
          },
        },
        policy: {},
      });
    }

    return baseRoutes;
  }

  private loadEnvironments(): void {
    // Load from environment variable or file
    const environmentsConfig = process.env.ENVIRONMENTS_CONFIG;
    
    if (environmentsConfig) {
      try {
        const environments = JSON.parse(environmentsConfig);
        for (const env of environments) {
          this.environments.set(env.name, env);
        }
        return;
      } catch (error) {
        console.error('Failed to parse environments config:', error);
      }
    }

    // Default environments
    this.loadDefaultEnvironments();
  }

  private loadTenants(): void {
    // Load from environment variable or file
    const tenantsConfig = process.env.TENANTS_CONFIG;
    
    if (tenantsConfig) {
      try {
        const tenants = JSON.parse(tenantsConfig);
        for (const tenant of tenants) {
          this.tenants.set(tenant.id, tenant);
        }
        return;
      } catch (error) {
        console.error('Failed to parse tenants config:', error);
      }
    }

    // Default tenants
    this.loadDefaultTenants();
  }

  private loadDefaultEnvironments(): void {
    const defaultEnvironments: Environment[] = [
      {
        name: 'development',
        displayName: 'Development',
        namespace: 'dev',
        domain: 'dev.suuupra.io',
        tenants: ['tenant-dev'],
        config: {
          features: {
            rateLimitingEnabled: false,
            authRequired: false,
            tracingEnabled: true,
            metricsEnabled: true,
            debugMode: true,
          },
          limits: {
            maxRequestsPerSecond: 1000,
            maxConcurrentRequests: 100,
            requestTimeoutMs: 30000,
          },
          security: {
            allowedOrigins: ['*'],
            requireHttps: false,
          },
          integrations: {
            enabledProviders: ['local'],
            secretsBackend: 'env',
            metricsBackend: 'prometheus',
            tracingBackend: 'jaeger',
          },
        },
        metadata: {},
      },
      {
        name: 'staging',
        displayName: 'Staging',
        namespace: 'staging',
        domain: 'staging.suuupra.io',
        tenants: ['tenant-staging'],
        config: {
          features: {
            rateLimitingEnabled: true,
            authRequired: true,
            tracingEnabled: true,
            metricsEnabled: true,
            debugMode: false,
          },
          limits: {
            maxRequestsPerSecond: 5000,
            maxConcurrentRequests: 500,
            requestTimeoutMs: 15000,
          },
          security: {
            allowedOrigins: ['https://staging.suuupra.io'],
            requireHttps: true,
          },
          integrations: {
            enabledProviders: ['aws', 'gcp'],
            secretsBackend: 'vault',
            metricsBackend: 'prometheus',
            tracingBackend: 'jaeger',
          },
        },
        metadata: {},
      },
      {
        name: 'production',
        displayName: 'Production',
        namespace: 'prod',
        domain: 'suuupra.io',
        tenants: ['tenant-prod-1', 'tenant-prod-2'],
        config: {
          features: {
            rateLimitingEnabled: true,
            authRequired: true,
            tracingEnabled: true,
            metricsEnabled: true,
            debugMode: false,
          },
          limits: {
            maxRequestsPerSecond: 10000,
            maxConcurrentRequests: 1000,
            requestTimeoutMs: 10000,
          },
          security: {
            allowedOrigins: ['https://suuupra.io', 'https://app.suuupra.io'],
            requireHttps: true,
          },
          integrations: {
            enabledProviders: ['aws', 'gcp', 'azure'],
            secretsBackend: 'vault',
            metricsBackend: 'prometheus',
            tracingBackend: 'jaeger',
          },
        },
        metadata: {},
      },
    ];

    for (const env of defaultEnvironments) {
      this.environments.set(env.name, env);
    }
  }

  private loadDefaultTenants(): void {
    const defaultTenants: TenantConfig[] = [
      {
        id: 'tenant-dev',
        name: 'Development Tenant',
        environment: 'development',
        namespace: 'tenant-dev',
        routes: [
          {
            id: 'api',
            matcher: {
              pathPrefix: '/api/',
              methods: ['GET', 'POST', 'PUT', 'DELETE'],
            },
            target: {
              serviceName: 'api-service',
              discovery: {
                type: 'k8s',
                namespace: 'tenant-dev',
              },
            },
            policy: {},
          },
        ],
        limits: {
          maxRoutes: 100,
          maxRequestsPerSecond: 1000,
          maxStorageMB: 1000,
        },
        features: ['basic-auth', 'rate-limiting'],
        metadata: {},
      },
    ];

    for (const tenant of defaultTenants) {
      this.tenants.set(tenant.id, tenant);
    }
  }

  private getDefaultConfig(): GatewayConfig {
    return {
      routes: [],
      admin: {
        apiEnabled: false,
        hotReloadEnabled: false,
        secretsManagementEnabled: false,
      },
      features: {
        rateLimiting: true,
        circuitBreakers: true,
        retries: true,
        cors: true,
        ipAllowDeny: false,
        signedUrlProxy: false,
        aiStreamingProxy: true,
        websocketSessionMgr: false,
        prometheusMetrics: true,
        openTelemetry: true,
      },
    };
  }

  getEnvironments(): Environment[] {
    return Array.from(this.environments.values());
  }

  getTenants(environment?: string): TenantConfig[] {
    const tenants = Array.from(this.tenants.values());
    
    if (environment) {
      return tenants.filter(tenant => tenant.environment === environment);
    }
    
    return tenants;
  }

  addEnvironment(environment: Environment): void {
    this.environments.set(environment.name, environment);
    this.clearCache();
  }

  addTenant(tenant: TenantConfig): void {
    this.tenants.set(tenant.id, tenant);
    this.clearCache();
  }

  removeEnvironment(environmentName: string): void {
    this.environments.delete(environmentName);
    this.clearCache();
  }

  removeTenant(tenantId: string): void {
    this.tenants.delete(tenantId);
    this.clearCache();
  }

  clearCache(): void {
    this.configCache.clear();
  }

  getStats(): {
    environments: number;
    tenants: number;
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      environments: this.environments.size,
      tenants: this.tenants.size,
      cacheSize: this.configCache.size,
      cacheHitRate: 0, // Would need to track hits/misses
    };
  }

  updateConfig(newConfig: Partial<EnvironmentIsolationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache();
  }
}

// Global environment isolation manager instance
let environmentIsolationManager: EnvironmentIsolationManager;

export function initializeEnvironmentIsolation(config: Partial<EnvironmentIsolationConfig>): EnvironmentIsolationManager {
  environmentIsolationManager = new EnvironmentIsolationManager(config);
  return environmentIsolationManager;
}

export function getEnvironmentIsolationManager(): EnvironmentIsolationManager {
  if (!environmentIsolationManager) {
    environmentIsolationManager = new EnvironmentIsolationManager();
  }
  return environmentIsolationManager;
}
