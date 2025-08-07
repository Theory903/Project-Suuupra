/**
 * What: Model router with weighted selection and sticky sessions for AI endpoints
 * Why: Load balance across multiple AI models with intelligent routing strategies
 * How: Weighted round-robin, sticky sessions, feature flag integration, health tracking
 */

import { FastifyRequest } from 'fastify';
import crypto from 'crypto';

export interface ModelEndpoint {
  id: string;
  name: string;
  url: string;
  weight: number;
  capabilities: string[]; // e.g., ['text-generation', 'embeddings']
  maxConcurrency?: number;
  currentLoad?: number;
  healthy: boolean;
  metadata: Record<string, any>;
}

export interface ModelRoutingConfig {
  strategy: 'round-robin' | 'weighted' | 'least-connections' | 'sticky';
  stickySessionKey?: string; // header/claim to use for sticky sessions
  healthCheckEnabled: boolean;
  fallbackModel?: string;
  featureFlags?: Record<string, boolean>;
}

export interface RoutingContext {
  request: FastifyRequest;
  capability: string;
  sessionKey?: string;
  metadata?: Record<string, any>;
}

export interface RoutingResult {
  endpoint: ModelEndpoint;
  reason: string;
  isSticky: boolean;
  isFallback: boolean;
}

const DEFAULT_CONFIG: ModelRoutingConfig = {
  strategy: 'weighted',
  healthCheckEnabled: true,
  featureFlags: {},
};

export class ModelRouter {
  private config: ModelRoutingConfig;
  private endpoints = new Map<string, ModelEndpoint>();
  private roundRobinCounters = new Map<string, number>();
  private stickySessionMap = new Map<string, string>(); // sessionKey -> endpointId
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 seconds

  constructor(config: Partial<ModelRoutingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  addEndpoint(endpoint: ModelEndpoint): void {
    this.endpoints.set(endpoint.id, {
      ...endpoint,
      currentLoad: endpoint.currentLoad || 0,
      healthy: endpoint.healthy !== false,
    });
  }

  removeEndpoint(endpointId: string): void {
    this.endpoints.delete(endpointId);
    this.roundRobinCounters.delete(endpointId);
    
    // Remove sticky sessions pointing to this endpoint
    for (const [sessionKey, mappedEndpointId] of this.stickySessionMap.entries()) {
      if (mappedEndpointId === endpointId) {
        this.stickySessionMap.delete(sessionKey);
      }
    }
  }

  updateEndpointHealth(endpointId: string, healthy: boolean): void {
    const endpoint = this.endpoints.get(endpointId);
    if (endpoint) {
      endpoint.healthy = healthy;
    }
  }

  updateEndpointLoad(endpointId: string, currentLoad: number): void {
    const endpoint = this.endpoints.get(endpointId);
    if (endpoint) {
      endpoint.currentLoad = currentLoad;
    }
  }

  async route(context: RoutingContext): Promise<RoutingResult> {
    const { capability, sessionKey } = context;
    
    // Get eligible endpoints
    const eligibleEndpoints = this.getEligibleEndpoints(capability);
    
    if (eligibleEndpoints.length === 0) {
      throw new Error(`No healthy endpoints available for capability: ${capability}`);
    }

    // Check for sticky session first
    if (sessionKey && this.config.strategy === 'sticky') {
      const stickyEndpoint = this.getStickyEndpoint(sessionKey, eligibleEndpoints);
      if (stickyEndpoint) {
        return {
          endpoint: stickyEndpoint,
          reason: 'sticky_session',
          isSticky: true,
          isFallback: false,
        };
      }
    }

    // Apply routing strategy
    const selectedEndpoint = await this.applyRoutingStrategy(eligibleEndpoints, context);
    
    // Create sticky session if needed
    if (sessionKey && this.config.strategy === 'sticky') {
      this.stickySessionMap.set(sessionKey, selectedEndpoint.id);
    }

    return {
      endpoint: selectedEndpoint,
      reason: this.config.strategy,
      isSticky: false,
      isFallback: false,
    };
  }

  private getEligibleEndpoints(capability: string): ModelEndpoint[] {
    const eligible: ModelEndpoint[] = [];
    
    for (const endpoint of this.endpoints.values()) {
      // Check health
      if (this.config.healthCheckEnabled && !endpoint.healthy) {
        continue;
      }

      // Check capability
      if (!endpoint.capabilities.includes(capability)) {
        continue;
      }

      // Check concurrency limits
      if (endpoint.maxConcurrency && endpoint.currentLoad && endpoint.currentLoad >= endpoint.maxConcurrency) {
        continue;
      }

      // Check feature flags
      if (this.config.featureFlags) {
        const flagKey = `model_${endpoint.id}_enabled`;
        if (this.config.featureFlags[flagKey] === false) {
          continue;
        }
      }

      eligible.push(endpoint);
    }

    return eligible;
  }

  private getStickyEndpoint(sessionKey: string, eligibleEndpoints: ModelEndpoint[]): ModelEndpoint | null {
    const endpointId = this.stickySessionMap.get(sessionKey);
    if (!endpointId) return null;

    return eligibleEndpoints.find(e => e.id === endpointId) || null;
  }

  private async applyRoutingStrategy(
    endpoints: ModelEndpoint[],
    context: RoutingContext
  ): Promise<ModelEndpoint> {
    switch (this.config.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(endpoints, context.capability);
      
      case 'weighted':
        return this.weightedSelection(endpoints);
      
      case 'least-connections':
        return this.leastConnectionsSelection(endpoints);
      
      case 'sticky':
        // For sticky without existing session, fall back to weighted
        return this.weightedSelection(endpoints);
      
      default:
        return this.weightedSelection(endpoints);
    }
  }

  private roundRobinSelection(endpoints: ModelEndpoint[], capability: string): ModelEndpoint {
    const counterKey = `${capability}_rr`;
    const counter = this.roundRobinCounters.get(counterKey) || 0;
    const selectedIndex = counter % endpoints.length;
    
    this.roundRobinCounters.set(counterKey, counter + 1);
    return endpoints[selectedIndex];
  }

  private weightedSelection(endpoints: ModelEndpoint[]): ModelEndpoint {
    const totalWeight = endpoints.reduce((sum, endpoint) => sum + endpoint.weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (const endpoint of endpoints) {
      cumulativeWeight += endpoint.weight;
      if (random <= cumulativeWeight) {
        return endpoint;
      }
    }
    
    // Fallback to first endpoint
    return endpoints[0];
  }

  private leastConnectionsSelection(endpoints: ModelEndpoint[]): ModelEndpoint {
    return endpoints.reduce((least, current) => {
      const leastLoad = least.currentLoad || 0;
      const currentLoad = current.currentLoad || 0;
      return currentLoad < leastLoad ? current : least;
    });
  }

  getEndpointStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [id, endpoint] of this.endpoints.entries()) {
      stats[id] = {
        name: endpoint.name,
        healthy: endpoint.healthy,
        currentLoad: endpoint.currentLoad || 0,
        maxConcurrency: endpoint.maxConcurrency,
        weight: endpoint.weight,
        capabilities: endpoint.capabilities,
      };
    }
    
    return stats;
  }

  getStickySessionStats(): {
    totalSessions: number;
    sessionsByEndpoint: Record<string, number>;
  } {
    const sessionsByEndpoint: Record<string, number> = {};
    
    for (const endpointId of this.stickySessionMap.values()) {
      sessionsByEndpoint[endpointId] = (sessionsByEndpoint[endpointId] || 0) + 1;
    }
    
    return {
      totalSessions: this.stickySessionMap.size,
      sessionsByEndpoint,
    };
  }

  updateConfig(newConfig: Partial<ModelRoutingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // If strategy changed from sticky, clear sticky sessions
    if (this.config.strategy !== 'sticky') {
      this.stickySessionMap.clear();
    }
  }

  clearStickySession(sessionKey: string): boolean {
    return this.stickySessionMap.delete(sessionKey);
  }

  clearAllStickySessions(): void {
    this.stickySessionMap.clear();
  }
}

// Global model routers per route
const modelRouters = new Map<string, ModelRouter>();

export function getModelRouter(routeId: string, config?: Partial<ModelRoutingConfig>): ModelRouter {
  let router = modelRouters.get(routeId);
  
  if (!router) {
    router = new ModelRouter(config);
    modelRouters.set(routeId, router);
  } else if (config) {
    router.updateConfig(config);
  }
  
  return router;
}

export function removeModelRouter(routeId: string): void {
  modelRouters.delete(routeId);
}

// Helper functions for extracting routing context
export function extractRoutingContext(request: FastifyRequest, capability: string): RoutingContext {
  // Extract session key from various sources
  let sessionKey: string | undefined;
  
  // Try JWT user ID
  const user = (request as any).user;
  if (user?.sub) {
    sessionKey = user.sub;
  }
  
  // Try custom header
  if (!sessionKey) {
    sessionKey = request.headers['x-session-id'] as string;
  }
  
  // Try API key ID
  if (!sessionKey) {
    const apiKey = (request as any).apiKey;
    if (apiKey?.id) {
      sessionKey = apiKey.id;
    }
  }
  
  // Generate session key from IP + User-Agent (less stable)
  if (!sessionKey) {
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';
    sessionKey = crypto.createHash('md5').update(`${ip}:${userAgent}`).digest('hex');
  }
  
  return {
    request,
    capability,
    sessionKey,
    metadata: {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    },
  };
}

// Predefined model configurations for common AI services
export const COMMON_MODEL_CONFIGS = {
  OPENAI_GPT4: {
    id: 'openai-gpt4',
    name: 'OpenAI GPT-4',
    capabilities: ['text-generation', 'chat-completion'],
    weight: 10,
    maxConcurrency: 100,
  },
  OPENAI_GPT35: {
    id: 'openai-gpt35',
    name: 'OpenAI GPT-3.5',
    capabilities: ['text-generation', 'chat-completion'],
    weight: 5,
    maxConcurrency: 200,
  },
  ANTHROPIC_CLAUDE: {
    id: 'anthropic-claude',
    name: 'Anthropic Claude',
    capabilities: ['text-generation', 'chat-completion'],
    weight: 8,
    maxConcurrency: 50,
  },
  LOCAL_LLAMA: {
    id: 'local-llama',
    name: 'Local Llama',
    capabilities: ['text-generation'],
    weight: 3,
    maxConcurrency: 10,
  },
} as const;
