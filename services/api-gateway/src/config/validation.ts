import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { GatewayConfig, RouteConfig, RateLimitPolicy, CircuitBreakerPolicy, AuthPolicy } from '../types/gateway';

// Schema validation setup
const ajv = new Ajv({ 
  allErrors: true, 
  verbose: true,
  strict: false,
  removeAdditional: true
});
addFormats(ajv);

// Version compatibility matrix
export interface ConfigVersion {
  version: string;
  compatibleWith: string[];
  deprecated?: boolean;
  migrationRequired?: boolean;
}

export const SUPPORTED_VERSIONS: ConfigVersion[] = [
  {
    version: '1.0.0',
    compatibleWith: ['1.0.0'],
    deprecated: true,
    migrationRequired: true
  },
  {
    version: '1.1.0',
    compatibleWith: ['1.0.0', '1.1.0'],
    migrationRequired: false
  },
  {
    version: '2.0.0',
    compatibleWith: ['1.1.0', '2.0.0'],
    migrationRequired: false
  }
];

// JSON Schemas
const rateLimitPolicySchema: JSONSchemaType<RateLimitPolicy> = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean', nullable: true },
    tokensPerInterval: { type: 'number', minimum: 1, maximum: 1000000, nullable: true },
    intervalMs: { type: 'number', minimum: 1, maximum: 86400000, nullable: true },
    burstMultiplier: { type: 'number', minimum: 1, maximum: 10000, nullable: true },
    keys: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['ip', 'user', 'tenant', 'route']
      },
      minItems: 1,
      maxItems: 4,
      nullable: true
    }
  },
  required: [],
  additionalProperties: false
};

const circuitBreakerPolicySchema: JSONSchemaType<CircuitBreakerPolicy> = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean', nullable: true },
    timeoutMs: { type: 'number', minimum: 100, maximum: 60000, nullable: true },
    errorThresholdPercentage: { type: 'number', minimum: 1, maximum: 100, nullable: true },
    resetTimeoutMs: { type: 'number', minimum: 1000, maximum: 300000, nullable: true }
  },
  required: [],
  additionalProperties: false
};

const authPolicySchema: JSONSchemaType<AuthPolicy> = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean' },
    required: { type: 'boolean', nullable: true },
    jwt: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        issuer: { type: 'string', format: 'uri', nullable: true },
        audience: { type: 'string', nullable: true },
        jwksUri: { type: 'string', format: 'uri', nullable: true },
        algorithms: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        },
        cacheTtl: { type: 'number', minimum: 60, maximum: 86400, nullable: true },
        clockTolerance: { type: 'number', minimum: 0, maximum: 300, nullable: true }
      },
      required: ['enabled'],
      additionalProperties: false,
      nullable: true
    },
    apiKey: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        header: { type: 'string', nullable: true },
        query: { type: 'string', nullable: true },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        }
      },
      required: ['enabled'],
      additionalProperties: false,
      nullable: true
    },
    oauth2: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        introspectionUrl: { type: 'string', format: 'uri', nullable: true },
        clientId: { type: 'string', nullable: true },
        clientSecret: { type: 'string', nullable: true },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        }
      },
      required: ['enabled'],
      additionalProperties: false,
      nullable: true
    }
  },
  required: ['enabled'],
  additionalProperties: false
};

const routeConfigSchema: JSONSchemaType<RouteConfig> = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      pattern: '^[a-zA-Z0-9-_]+$',
      minLength: 1,
      maxLength: 100
    },
    matcher: {
      type: 'object',
      properties: {
        pathPrefix: { type: 'string', pattern: '^/.*', nullable: true },
        pathRegex: { type: 'string', nullable: true },
        methods: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
          },
          minItems: 1,
          maxItems: 7
        },
        headers: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z0-9-_]+$': { type: 'string' }
          },
          additionalProperties: false,
          nullable: true
        },
        query: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z0-9-_]+$': { type: 'string' }
          },
          additionalProperties: false,
          nullable: true
        }
      },
      required: ['methods'],
      additionalProperties: false
    },
    target: {
      type: 'object',
      properties: {
        serviceName: { 
          type: 'string',
          pattern: '^[a-zA-Z0-9-_]+$',
          minLength: 1,
          maxLength: 100
        },
        pathRewrite: { type: 'string', nullable: true },
        discovery: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['static', 'dns', 'k8s', 'consul']
            },
            endpoints: {
              type: 'array',
              items: { type: 'string', format: 'uri' },
              nullable: true
            },
            namespace: { type: 'string', nullable: true },
            service: { type: 'string', nullable: true },
            port: { type: 'number', minimum: 1, maximum: 65535, nullable: true }
          },
          required: ['type'],
          additionalProperties: false
        }
      },
      required: ['serviceName', 'discovery'],
      additionalProperties: false
    },
    policy: {
      type: 'object',
      properties: {
        auth: { ...authPolicySchema, nullable: true },
        rateLimit: { ...rateLimitPolicySchema, nullable: true },
        circuitBreaker: { ...circuitBreakerPolicySchema, nullable: true },
        timeout: { type: 'number', minimum: 100, maximum: 300000, nullable: true },
        retries: { type: 'number', minimum: 0, maximum: 10, nullable: true },
        cors: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            origins: {
              type: 'array',
              items: { type: 'string' },
              nullable: true
            },
            methods: {
              type: 'array',
              items: { type: 'string' },
              nullable: true
            },
            headers: {
              type: 'array',
              items: { type: 'string' },
              nullable: true
            },
            credentials: { type: 'boolean', nullable: true },
            maxAge: { type: 'number', minimum: 0, maximum: 86400, nullable: true }
          },
          required: ['enabled'],
          additionalProperties: false,
          nullable: true
        }
      },
      required: [],
      additionalProperties: false
    },
    metadata: {
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        tags: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        },
        owner: { type: 'string', nullable: true },
        version: { type: 'string', nullable: true }
      },
      additionalProperties: false,
      nullable: true
    }
  },
  required: ['id', 'matcher', 'target', 'policy'],
  additionalProperties: false
};

const serviceConfigSchema: JSONSchemaType<ServiceConfig> = {
  type: 'object',
  properties: {
    name: { 
      type: 'string',
      pattern: '^[a-zA-Z0-9-_]+$',
      minLength: 1,
      maxLength: 100
    },
    discovery: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['static', 'dns', 'k8s', 'consul']
        },
        endpoints: {
          type: 'array',
          items: { type: 'string', format: 'uri' },
          nullable: true
        },
        healthCheck: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            path: { type: 'string', nullable: true },
            interval: { type: 'number', minimum: 1000, maximum: 300000, nullable: true },
            timeout: { type: 'number', minimum: 100, maximum: 60000, nullable: true },
            unhealthyThreshold: { type: 'number', minimum: 1, maximum: 10, nullable: true },
            healthyThreshold: { type: 'number', minimum: 1, maximum: 10, nullable: true }
          },
          required: ['enabled'],
          additionalProperties: false,
          nullable: true
        }
      },
      required: ['type'],
      additionalProperties: false
    },
    loadBalancing: {
      type: 'object',
      properties: {
        algorithm: {
          type: 'string',
          enum: ['round-robin', 'weighted', 'least-connections', 'least-response-time', 'ip-hash']
        },
        weights: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z0-9-_.]+$': { type: 'number', minimum: 0, maximum: 100 }
          },
          additionalProperties: false,
          nullable: true
        }
      },
      required: ['algorithm'],
      additionalProperties: false,
      nullable: true
    }
  },
  required: ['name', 'discovery'],
  additionalProperties: false
};

const gatewayConfigSchema: JSONSchemaType<GatewayConfig> = {
  type: 'object',
  properties: {
    version: { 
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$'
    },
    server: {
      type: 'object',
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 },
        host: { type: 'string', nullable: true },
        cors: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            origins: {
              type: 'array',
              items: { type: 'string' },
              nullable: true
            }
          },
          required: ['enabled'],
          additionalProperties: false,
          nullable: true
        }
      },
      required: ['port'],
      additionalProperties: false
    },
    routes: {
      type: 'array',
      items: routeConfigSchema,
      minItems: 1
    },
    services: {
      type: 'array',
      items: serviceConfigSchema
    },
    features: {
      type: 'object',
      properties: {
        prometheusMetrics: { type: 'boolean' },
        openTelemetry: { type: 'boolean' },
        rateLimiting: { type: 'boolean' },
        circuitBreakers: { type: 'boolean' },
        ipAllowDeny: { type: 'boolean' },
        waf: { type: 'boolean' },
        streaming: { type: 'boolean' },
        websockets: { type: 'boolean' },
        aiFeatures: { type: 'boolean' },
        contextInjection: { type: 'boolean' },
        credentialProxy: { type: 'boolean' },
        secretsManagement: { type: 'boolean' },
        adminApi: { type: 'boolean' }
      },
      required: [],
      additionalProperties: false,
      nullable: true
    },
    admin: {
      type: 'object',
      properties: {
        apiEnabled: { type: 'boolean' },
        hotReloadEnabled: { type: 'boolean' },
        secretsManagementEnabled: { type: 'boolean' }
      },
      required: ['apiEnabled'],
      additionalProperties: false,
      nullable: true
    }
  },
  required: ['version', 'server', 'routes', 'services'],
  additionalProperties: false
};

// Compiled validators
export class ConfigValidator {
  private validators: Map<string, ValidateFunction> = new Map();
  
  constructor() {
    this.validators.set('gateway', ajv.compile(gatewayConfigSchema));
    this.validators.set('route', ajv.compile(routeConfigSchema));
    this.validators.set('service', ajv.compile(serviceConfigSchema));
    this.validators.set('rateLimit', ajv.compile(rateLimitPolicySchema));
    this.validators.set('circuitBreaker', ajv.compile(circuitBreakerPolicySchema));
    this.validators.set('auth', ajv.compile(authPolicySchema));
  }

  validate(type: string, config: any): ValidationResult {
    const validator = this.validators.get(type);
    if (!validator) {
      return {
        valid: false,
        errors: [`Unknown configuration type: ${type}`]
      };
    }

    const valid = validator(config);
    
    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = validator.errors?.map(error => {
      const path = error.instancePath || error.schemaPath;
      return `${path}: ${error.message}`;
    }) || [];

    return { valid: false, errors };
  }

  validateGatewayConfig(config: any): ValidationResult {
    // First validate the structure
    const structuralResult = this.validate('gateway', config);
    if (!structuralResult.valid) {
      return structuralResult;
    }

    // Then perform semantic validation
    return this.validateSemantics(config as GatewayConfig);
  }

  private validateSemantics(config: GatewayConfig): ValidationResult {
    const errors: string[] = [];

    // Check version compatibility
    const versionCheck = this.validateVersion(config.version);
    if (!versionCheck.valid) {
      errors.push(...versionCheck.errors);
    }

    // Check route ID uniqueness
    const routeIds = new Set<string>();
    for (const route of config.routes) {
      if (routeIds.has(route.id)) {
        errors.push(`Duplicate route ID: ${route.id}`);
      }
      routeIds.add(route.id);
    }

    // Check service name uniqueness
    const serviceNames = new Set<string>();
    for (const service of config.services) {
      if (serviceNames.has(service.name)) {
        errors.push(`Duplicate service name: ${service.name}`);
      }
      serviceNames.add(service.name);
    }

    // Check route-service references
    for (const route of config.routes) {
      const serviceName = route.target.serviceName;
      if (!serviceNames.has(serviceName)) {
        errors.push(`Route ${route.id} references unknown service: ${serviceName}`);
      }
    }

    // Check path conflicts
    const pathConflicts = this.checkPathConflicts(config.routes);
    errors.push(...pathConflicts);

    // Check policy consistency
    const policyErrors = this.validatePolicyConsistency(config);
    errors.push(...policyErrors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateVersion(version: string): ValidationResult {
    const supportedVersion = SUPPORTED_VERSIONS.find(v => v.version === version);
    
    if (!supportedVersion) {
      return {
        valid: false,
        errors: [`Unsupported configuration version: ${version}. Supported versions: ${SUPPORTED_VERSIONS.map(v => v.version).join(', ')}`]
      };
    }

    if (supportedVersion.deprecated) {
      return {
        valid: true,
        errors: [],
        warnings: [`Configuration version ${version} is deprecated. Consider upgrading.`]
      };
    }

    return { valid: true, errors: [] };
  }

  private checkPathConflicts(routes: RouteConfig[]): string[] {
    const errors: string[] = [];
    const pathGroups: Map<string, RouteConfig[]> = new Map();

    // Group routes by method
    for (const route of routes) {
      for (const method of route.matcher.methods) {
        const key = method;
        if (!pathGroups.has(key)) {
          pathGroups.set(key, []);
        }
        pathGroups.get(key)!.push(route);
      }
    }

    // Check for conflicts within each method group
    for (const [method, methodRoutes] of pathGroups) {
      for (let i = 0; i < methodRoutes.length; i++) {
        for (let j = i + 1; j < methodRoutes.length; j++) {
          const route1 = methodRoutes[i];
          const route2 = methodRoutes[j];
          
          if (this.pathsConflict(route1, route2)) {
            errors.push(`Path conflict between routes ${route1.id} and ${route2.id} for method ${method}`);
          }
        }
      }
    }

    return errors;
  }

  private pathsConflict(route1: RouteConfig, route2: RouteConfig): boolean {
    const path1 = route1.matcher.pathPrefix || route1.matcher.pathRegex;
    const path2 = route2.matcher.pathPrefix || route2.matcher.pathRegex;

    if (!path1 || !path2) return false;

    // Simple prefix conflict check
    if (route1.matcher.pathPrefix && route2.matcher.pathPrefix) {
      return route1.matcher.pathPrefix.startsWith(route2.matcher.pathPrefix) ||
             route2.matcher.pathPrefix.startsWith(route1.matcher.pathPrefix);
    }

    // For regex patterns, we'd need more sophisticated conflict detection
    // For now, assume regex patterns don't conflict with each other
    return false;
  }

  private validatePolicyConsistency(config: GatewayConfig): string[] {
    const errors: string[] = [];

    for (const route of config.routes) {
      const policy = route.policy;

      // Check auth policy consistency
      if (policy.auth?.enabled) {
        if (!policy.auth.jwt?.enabled && !policy.auth.apiKey?.enabled && !policy.auth.oauth2?.enabled) {
          errors.push(`Route ${route.id} has auth enabled but no auth methods configured`);
        }
      }

      // Check rate limiting policy
      if (policy.rateLimit?.enabled) {
        if (policy.rateLimit.burst && policy.rateLimit.burst > policy.rateLimit.requests) {
          errors.push(`Route ${route.id} has burst limit greater than request limit`);
        }
      }

      // Check circuit breaker policy
      if (policy.circuitBreaker?.enabled) {
        if (policy.circuitBreaker.resetTimeoutMs < policy.circuitBreaker.timeoutMs) {
          errors.push(`Route ${route.id} has reset timeout less than request timeout`);
        }
      }

      // Check timeout consistency
      if (policy.timeout && policy.circuitBreaker?.enabled) {
        if (policy.timeout > policy.circuitBreaker.timeoutMs) {
          errors.push(`Route ${route.id} has route timeout greater than circuit breaker timeout`);
        }
      }
    }

    return errors;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Migration utilities
export class ConfigMigrator {
  migrate(config: any, fromVersion: string, toVersion: string): MigrationResult {
    const migrationPath = this.findMigrationPath(fromVersion, toVersion);
    if (!migrationPath.valid) {
      return migrationPath;
    }

    let migratedConfig = { ...config };
    const appliedMigrations: string[] = [];

    try {
      for (const migration of migrationPath.migrations!) {
        migratedConfig = this.applyMigration(migratedConfig, migration);
        appliedMigrations.push(migration);
      }

      return {
        valid: true,
        migratedConfig,
        appliedMigrations
      };
    } catch (error) {
      return {
        valid: false,
        error: `Migration failed at step ${appliedMigrations.length}: ${error}`
      };
    }
  }

  private findMigrationPath(fromVersion: string, toVersion: string): MigrationPathResult {
    const from = SUPPORTED_VERSIONS.find(v => v.version === fromVersion);
    const to = SUPPORTED_VERSIONS.find(v => v.version === toVersion);

    if (!from || !to) {
      return {
        valid: false,
        error: 'Invalid version specified'
      };
    }

    // Simple migration path - direct compatibility check
    if (to.compatibleWith.includes(fromVersion)) {
      return {
        valid: true,
        migrations: [`${fromVersion}-to-${toVersion}`]
      };
    }

    return {
      valid: false,
      error: `No migration path available from ${fromVersion} to ${toVersion}`
    };
  }

  private applyMigration(config: any, migration: string): any {
    switch (migration) {
      case '1.0.0-to-1.1.0':
        return this.migrate_1_0_0_to_1_1_0(config);
      case '1.1.0-to-2.0.0':
        return this.migrate_1_1_0_to_2_0_0(config);
      default:
        throw new Error(`Unknown migration: ${migration}`);
    }
  }

  private migrate_1_0_0_to_1_1_0(config: any): any {
    const migrated = { ...config };
    
    // Update version
    migrated.version = '1.1.0';
    
    // Add new features section if missing
    if (!migrated.features) {
      migrated.features = {
        prometheusMetrics: true,
        openTelemetry: false,
        rateLimiting: true,
        circuitBreakers: true
      };
    }

    // Migrate old auth format to new format
    if (migrated.routes) {
      for (const route of migrated.routes) {
        if (route.policy?.authentication) {
          route.policy.auth = {
            enabled: route.policy.authentication.enabled,
            jwt: route.policy.authentication.jwt
          };
          delete route.policy.authentication;
        }
      }
    }

    return migrated;
  }

  private migrate_1_1_0_to_2_0_0(config: any): any {
    const migrated = { ...config };
    
    // Update version
    migrated.version = '2.0.0';
    
    // Add admin section
    if (!migrated.admin) {
      migrated.admin = {
        apiEnabled: false,
        hotReloadEnabled: false,
        secretsManagementEnabled: false
      };
    }

    // Add new feature flags
    if (migrated.features) {
      migrated.features.waf = false;
      migrated.features.streaming = false;
      migrated.features.websockets = false;
      migrated.features.aiFeatures = false;
    }

    return migrated;
  }
}

export interface MigrationResult {
  valid: boolean;
  migratedConfig?: any;
  appliedMigrations?: string[];
  error?: string;
}

export interface MigrationPathResult {
  valid: boolean;
  migrations?: string[];
  error?: string;
}

// Compatibility testing
export class CompatibilityTester {
  testBackwardCompatibility(oldConfig: any, newConfig: any): CompatibilityResult {
    const issues: CompatibilityIssue[] = [];
    
    // Check for removed routes
    const oldRouteIds = new Set(oldConfig.routes?.map((r: any) => r.id) || []);
    const newRouteIds = new Set(newConfig.routes?.map((r: any) => r.id) || []);
    
    for (const routeId of oldRouteIds) {
      if (!newRouteIds.has(routeId)) {
        issues.push({
          type: 'breaking',
          category: 'route',
          message: `Route ${routeId} was removed`,
          impact: 'high'
        });
      }
    }

    // Check for service changes
    const oldServiceNames = new Set(oldConfig.services?.map((s: any) => s.name) || []);
    const newServiceNames = new Set(newConfig.services?.map((s: any) => s.name) || []);
    
    for (const serviceName of oldServiceNames) {
      if (!newServiceNames.has(serviceName)) {
        issues.push({
          type: 'breaking',
          category: 'service',
          message: `Service ${serviceName} was removed`,
          impact: 'high'
        });
      }
    }

    // Check for policy changes
    this.checkPolicyCompatibility(oldConfig, newConfig, issues);

    return {
      compatible: issues.filter(i => i.type === 'breaking').length === 0,
      issues
    };
  }

  private checkPolicyCompatibility(oldConfig: any, newConfig: any, issues: CompatibilityIssue[]): void {
    const oldRoutes = new Map(oldConfig.routes?.map((r: any) => [r.id, r]) || []);
    const newRoutes = new Map(newConfig.routes?.map((r: any) => [r.id, r]) || []);

    for (const [routeId, oldRoute] of oldRoutes) {
      const newRoute = newRoutes.get(routeId);
      if (!newRoute) continue;

      // Check auth policy changes
      if (oldRoute.policy?.auth?.enabled && !newRoute.policy?.auth?.enabled) {
        issues.push({
          type: 'breaking',
          category: 'auth',
          message: `Authentication disabled for route ${routeId}`,
          impact: 'medium'
        });
      }

      // Check rate limiting changes
      if (oldRoute.policy?.rateLimit?.enabled && !newRoute.policy?.rateLimit?.enabled) {
        issues.push({
          type: 'warning',
          category: 'rateLimit',
          message: `Rate limiting disabled for route ${routeId}`,
          impact: 'low'
        });
      }

      // Check for stricter rate limits
      if (oldRoute.policy?.rateLimit?.requests && newRoute.policy?.rateLimit?.requests) {
        if (newRoute.policy.rateLimit.requests < oldRoute.policy.rateLimit.requests) {
          issues.push({
            type: 'warning',
            category: 'rateLimit',
            message: `Rate limit decreased for route ${routeId}: ${oldRoute.policy.rateLimit.requests} -> ${newRoute.policy.rateLimit.requests}`,
            impact: 'medium'
          });
        }
      }
    }
  }
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
}

export interface CompatibilityIssue {
  type: 'breaking' | 'warning' | 'info';
  category: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
}

// Export singleton instances
export const configValidator = new ConfigValidator();
export const configMigrator = new ConfigMigrator();
export const compatibilityTester = new CompatibilityTester();
