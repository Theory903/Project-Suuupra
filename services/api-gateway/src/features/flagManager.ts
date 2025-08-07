/**
 * What: Feature flags integration with OpenFeature for routes and models
 * Why: Enable dynamic feature toggling and gradual rollouts without deployments
 * How: OpenFeature SDK integration, rule-based evaluation, context-aware flags
 */

export interface FeatureFlagContext {
  userId?: string;
  tenantId?: string;
  userAgent?: string;
  ipAddress?: string;
  region?: string;
  environment?: string;
  routeId?: string;
  serviceName?: string;
  metadata?: Record<string, any>;
}

export interface FeatureFlagRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: FeatureFlagCondition[];
  rolloutPercentage?: number; // 0-100
  variants?: FeatureFlagVariant[];
  defaultVariant?: string;
}

export interface FeatureFlagCondition {
  attribute: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  value: any;
}

export interface FeatureFlagVariant {
  name: string;
  weight: number; // 0-100
  configuration?: Record<string, any>;
}

export interface FeatureFlagEvaluation {
  flagKey: string;
  value: boolean | string | number | object;
  variant?: string;
  reason: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface FeatureFlagProvider {
  name: string;
  getBooleanFlag(flagKey: string, defaultValue: boolean, context: FeatureFlagContext): Promise<FeatureFlagEvaluation>;
  getStringFlag(flagKey: string, defaultValue: string, context: FeatureFlagContext): Promise<FeatureFlagEvaluation>;
  getNumberFlag(flagKey: string, defaultValue: number, context: FeatureFlagContext): Promise<FeatureFlagEvaluation>;
  getObjectFlag(flagKey: string, defaultValue: object, context: FeatureFlagContext): Promise<FeatureFlagEvaluation>;
}

export interface FeatureFlagManagerConfig {
  provider: 'local' | 'openfeature' | 'launchdarkly' | 'split' | 'flagsmith';
  cacheEnabled: boolean;
  cacheTtlMs: number;
  local?: {
    configPath?: string;
    flags: Record<string, FeatureFlagRule>;
  };
  openfeature?: {
    providerName: string;
    endpoint?: string;
  };
  launchdarkly?: {
    sdkKey: string;
    baseUri?: string;
  };
}

const DEFAULT_CONFIG: FeatureFlagManagerConfig = {
  provider: 'local',
  cacheEnabled: true,
  cacheTtlMs: 60000, // 1 minute
  local: {
    flags: {},
  },
};

export class FeatureFlagManager {
  private config: FeatureFlagManagerConfig;
  private provider: FeatureFlagProvider;
  private cache = new Map<string, { evaluation: FeatureFlagEvaluation; expiresAt: number }>();

  constructor(config: Partial<FeatureFlagManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.provider = this.createProvider();
  }

  async getBooleanFlag(
    flagKey: string,
    defaultValue: boolean,
    context: FeatureFlagContext = {}
  ): Promise<boolean> {
    const evaluation = await this.evaluateFlag('boolean', flagKey, defaultValue, context);
    return evaluation.value as boolean;
  }

  async getStringFlag(
    flagKey: string,
    defaultValue: string,
    context: FeatureFlagContext = {}
  ): Promise<string> {
    const evaluation = await this.evaluateFlag('string', flagKey, defaultValue, context);
    return evaluation.value as string;
  }

  async getNumberFlag(
    flagKey: string,
    defaultValue: number,
    context: FeatureFlagContext = {}
  ): Promise<number> {
    const evaluation = await this.evaluateFlag('number', flagKey, defaultValue, context);
    return evaluation.value as number;
  }

  async getObjectFlag(
    flagKey: string,
    defaultValue: object,
    context: FeatureFlagContext = {}
  ): Promise<object> {
    const evaluation = await this.evaluateFlag('object', flagKey, defaultValue, context);
    return evaluation.value as object;
  }

  private async evaluateFlag(
    type: 'boolean' | 'string' | 'number' | 'object',
    flagKey: string,
    defaultValue: any,
    context: FeatureFlagContext
  ): Promise<FeatureFlagEvaluation> {
    const cacheKey = this.createCacheKey(flagKey, context);
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.evaluation;
      }
    }

    // Evaluate flag
    let evaluation: FeatureFlagEvaluation;
    try {
      switch (type) {
        case 'boolean':
          evaluation = await this.provider.getBooleanFlag(flagKey, defaultValue, context);
          break;
        case 'string':
          evaluation = await this.provider.getStringFlag(flagKey, defaultValue, context);
          break;
        case 'number':
          evaluation = await this.provider.getNumberFlag(flagKey, defaultValue, context);
          break;
        case 'object':
          evaluation = await this.provider.getObjectFlag(flagKey, defaultValue, context);
          break;
        default:
          throw new Error(`Unsupported flag type: ${type}`);
      }
    } catch (error) {
      evaluation = {
        flagKey,
        value: defaultValue,
        reason: 'ERROR',
        errorMessage: (error as Error).message,
      };
    }

    // Cache result
    if (this.config.cacheEnabled) {
      this.cache.set(cacheKey, {
        evaluation,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    return evaluation;
  }

  private createProvider(): FeatureFlagProvider {
    switch (this.config.provider) {
      case 'local':
        return new LocalFeatureFlagProvider(this.config.local!);
      case 'openfeature':
        return new OpenFeatureProvider(this.config.openfeature!);
      case 'launchdarkly':
        return new LaunchDarklyProvider(this.config.launchdarkly!);
      default:
        throw new Error(`Unsupported feature flag provider: ${this.config.provider}`);
    }
  }

  private createCacheKey(flagKey: string, context: FeatureFlagContext): string {
    const contextString = JSON.stringify(context);
    return `${flagKey}:${contextString}`;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): {
    size: number;
    hitRate: number; // Would need to track hits/misses
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // Simplified for this implementation
    };
  }

  updateConfig(newConfig: Partial<FeatureFlagManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.provider = this.createProvider();
    this.clearCache();
  }
}

class LocalFeatureFlagProvider implements FeatureFlagProvider {
  name = 'local';
  private flags: Record<string, FeatureFlagRule>;

  constructor(config: { flags: Record<string, FeatureFlagRule> }) {
    this.flags = config.flags;
  }

  async getBooleanFlag(flagKey: string, defaultValue: boolean, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return this.evaluateFlag(flagKey, defaultValue, context);
  }

  async getStringFlag(flagKey: string, defaultValue: string, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return this.evaluateFlag(flagKey, defaultValue, context);
  }

  async getNumberFlag(flagKey: string, defaultValue: number, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return this.evaluateFlag(flagKey, defaultValue, context);
  }

  async getObjectFlag(flagKey: string, defaultValue: object, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return this.evaluateFlag(flagKey, defaultValue, context);
  }

  private async evaluateFlag(flagKey: string, defaultValue: any, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    const flag = this.flags[flagKey];
    
    if (!flag) {
      return {
        flagKey,
        value: defaultValue,
        reason: 'FLAG_NOT_FOUND',
      };
    }

    if (!flag.enabled) {
      return {
        flagKey,
        value: defaultValue,
        reason: 'DISABLED',
      };
    }

    // Evaluate conditions
    const conditionsMatch = this.evaluateConditions(flag.conditions, context);
    if (!conditionsMatch) {
      return {
        flagKey,
        value: defaultValue,
        reason: 'CONDITIONS_NOT_MET',
      };
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      const hash = this.hashContext(context, flagKey);
      const rolloutValue = hash % 100;
      if (rolloutValue >= flag.rolloutPercentage) {
        return {
          flagKey,
          value: defaultValue,
          reason: 'ROLLOUT_PERCENTAGE',
        };
      }
    }

    // Select variant
    if (flag.variants && flag.variants.length > 0) {
      const selectedVariant = this.selectVariant(flag.variants, context, flagKey);
      return {
        flagKey,
        value: selectedVariant.configuration || true,
        variant: selectedVariant.name,
        reason: 'VARIANT_SELECTED',
      };
    }

    // Default to enabled
    return {
      flagKey,
      value: true,
      reason: 'ENABLED',
    };
  }

  private evaluateConditions(conditions: FeatureFlagCondition[], context: FeatureFlagContext): boolean {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      const contextValue = this.getContextValue(context, condition.attribute);
      return this.evaluateCondition(contextValue, condition.operator, condition.value);
    });
  }

  private getContextValue(context: FeatureFlagContext, attribute: string): any {
    switch (attribute) {
      case 'userId':
        return context.userId;
      case 'tenantId':
        return context.tenantId;
      case 'userAgent':
        return context.userAgent;
      case 'ipAddress':
        return context.ipAddress;
      case 'region':
        return context.region;
      case 'environment':
        return context.environment;
      case 'routeId':
        return context.routeId;
      case 'serviceName':
        return context.serviceName;
      default:
        return context.metadata?.[attribute];
    }
  }

  private evaluateCondition(contextValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'eq':
        return contextValue === expectedValue;
      case 'ne':
        return contextValue !== expectedValue;
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(contextValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(contextValue);
      case 'contains':
        return String(contextValue).includes(String(expectedValue));
      case 'starts_with':
        return String(contextValue).startsWith(String(expectedValue));
      case 'ends_with':
        return String(contextValue).endsWith(String(expectedValue));
      case 'regex':
        return new RegExp(String(expectedValue)).test(String(contextValue));
      default:
        return false;
    }
  }

  private selectVariant(variants: FeatureFlagVariant[], context: FeatureFlagContext, flagKey: string): FeatureFlagVariant {
    const hash = this.hashContext(context, flagKey);
    const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
    const normalizedHash = hash % totalWeight;

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (normalizedHash < cumulativeWeight) {
        return variant;
      }
    }

    return variants[0]; // Fallback
  }

  private hashContext(context: FeatureFlagContext, flagKey: string): number {
    const key = context.userId || context.tenantId || context.ipAddress || 'anonymous';
    const input = `${flagKey}:${key}`;
    
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash);
  }
}

class OpenFeatureProvider implements FeatureFlagProvider {
  name = 'openfeature';
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async getBooleanFlag(flagKey: string, defaultValue: boolean, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    // In a real implementation, this would use the OpenFeature SDK
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }

  async getStringFlag(flagKey: string, defaultValue: string, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }

  async getNumberFlag(flagKey: string, defaultValue: number, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }

  async getObjectFlag(flagKey: string, defaultValue: object, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }
}

class LaunchDarklyProvider implements FeatureFlagProvider {
  name = 'launchdarkly';
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async getBooleanFlag(flagKey: string, defaultValue: boolean, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    // In a real implementation, this would use the LaunchDarkly SDK
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }

  async getStringFlag(flagKey: string, defaultValue: string, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }

  async getNumberFlag(flagKey: string, defaultValue: number, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }

  async getObjectFlag(flagKey: string, defaultValue: object, context: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    return {
      flagKey,
      value: defaultValue,
      reason: 'NOT_IMPLEMENTED',
    };
  }
}

// Global feature flag manager instance
let featureFlagManager: FeatureFlagManager;

export function initializeFeatureFlagManager(config: Partial<FeatureFlagManagerConfig>): FeatureFlagManager {
  featureFlagManager = new FeatureFlagManager(config);
  return featureFlagManager;
}

export function getFeatureFlagManager(): FeatureFlagManager {
  if (!featureFlagManager) {
    featureFlagManager = new FeatureFlagManager();
  }
  return featureFlagManager;
}

// Common feature flags for gateway
export const GATEWAY_FEATURE_FLAGS = {
  // Route-level flags
  ENABLE_ROUTE_CACHING: 'gateway.route.caching.enabled',
  ENABLE_ROUTE_COMPRESSION: 'gateway.route.compression.enabled',
  ENABLE_ROUTE_AUTH: 'gateway.route.auth.enabled',
  
  // Model routing flags
  ENABLE_MODEL_ROUTING: 'gateway.ai.model_routing.enabled',
  ENABLE_MODEL_FALLBACK: 'gateway.ai.model_fallback.enabled',
  MODEL_SELECTION_STRATEGY: 'gateway.ai.model_selection.strategy',
  
  // Feature rollouts
  ENABLE_NEW_AUTH_FLOW: 'gateway.auth.new_flow.enabled',
  ENABLE_ADVANCED_RATE_LIMITING: 'gateway.rate_limit.advanced.enabled',
  ENABLE_CIRCUIT_BREAKER_V2: 'gateway.circuit_breaker.v2.enabled',
  
  // Environment-specific
  ENABLE_DEBUG_LOGGING: 'gateway.debug.logging.enabled',
  ENABLE_METRICS_COLLECTION: 'gateway.metrics.collection.enabled',
  ENABLE_TRACING: 'gateway.tracing.enabled',
} as const;

// Example flag configurations
export const EXAMPLE_FLAGS: Record<string, FeatureFlagRule> = {
  [GATEWAY_FEATURE_FLAGS.ENABLE_MODEL_ROUTING]: {
    id: 'model-routing',
    name: 'AI Model Routing',
    description: 'Enable intelligent AI model routing',
    enabled: true,
    conditions: [
      {
        attribute: 'environment',
        operator: 'in',
        value: ['staging', 'production'],
      },
    ],
    rolloutPercentage: 50, // 50% rollout
    variants: [
      {
        name: 'weighted',
        weight: 70,
        configuration: { strategy: 'weighted' },
      },
      {
        name: 'sticky',
        weight: 30,
        configuration: { strategy: 'sticky' },
      },
    ],
  },
  [GATEWAY_FEATURE_FLAGS.ENABLE_NEW_AUTH_FLOW]: {
    id: 'new-auth-flow',
    name: 'New Authentication Flow',
    description: 'Enable the new JWT/OIDC authentication flow',
    enabled: true,
    conditions: [
      {
        attribute: 'tenantId',
        operator: 'in',
        value: ['tenant-beta-1', 'tenant-beta-2'],
      },
    ],
    rolloutPercentage: 25, // 25% rollout for beta tenants
  },
};
