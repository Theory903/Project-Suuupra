/**
 * What: Kubernetes Ingress controller to translate K8s resources to GatewayConfig
 * Why: Enable GitOps and K8s-native configuration management for the gateway
 * How: Watch K8s Ingress/CRDs, parse annotations, generate GatewayConfig
 */

import { GatewayConfig, RouteConfig, AuthPolicy, RateLimitPolicy } from '../types/gateway';
import { getConfigManager } from '../admin/api';

export interface KubernetesIngress {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };
  spec: {
    ingressClassName?: string;
    defaultBackend?: IngressBackend;
    tls?: IngressTLS[];
    rules: IngressRule[];
  };
}

export interface IngressRule {
  host?: string;
  http: {
    paths: IngressPath[];
  };
}

export interface IngressPath {
  path?: string;
  pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
  backend: IngressBackend;
}

export interface IngressBackend {
  service: {
    name: string;
    port: {
      number?: number;
      name?: string;
    };
  };
}

export interface IngressTLS {
  hosts?: string[];
  secretName?: string;
}

export interface GatewayIngressCRD {
  apiVersion: 'gateway.suuupra.io/v1';
  kind: 'GatewayRoute';
  metadata: {
    name: string;
    namespace: string;
    annotations?: Record<string, string>;
  };
  spec: {
    hostnames?: string[];
    paths: GatewayPath[];
    policies?: GatewayPolicies;
  };
}

export interface GatewayPath {
  path: string;
  pathType: 'Exact' | 'Prefix' | 'Regex';
  methods?: string[];
  backend: {
    serviceName: string;
    port?: number;
    discovery?: {
      type: 'static' | 'dns' | 'k8s' | 'consul';
      namespace?: string;
    };
  };
}

export interface GatewayPolicies {
  auth?: {
    requireJwt?: boolean;
    requireApiKey?: boolean;
    requiredRoles?: string[];
    issuer?: string;
    audience?: string[];
    jwksUri?: string;
  };
  rateLimit?: {
    enabled?: boolean;
    tokensPerInterval?: number;
    intervalMs?: number;
    keys?: string[];
  };
  timeout?: {
    socketTimeoutMs?: number;
    connectTimeoutMs?: number;
  };
  retry?: {
    maxAttempts?: number;
    backoffInitialMs?: number;
  };
  cors?: {
    allowOrigins?: string[];
    allowMethods?: string[];
    allowHeaders?: string[];
  };
}

export interface IngressControllerConfig {
  enabled: boolean;
  watchNamespaces?: string[]; // If empty, watch all namespaces
  ingressClass: string;
  syncIntervalMs: number;
  kubeconfig?: string;
  dryRun: boolean; // If true, don't actually update gateway config
}

const DEFAULT_CONFIG: IngressControllerConfig = {
  enabled: false,
  ingressClass: 'suuupra-gateway',
  syncIntervalMs: 30000, // 30 seconds
  dryRun: false,
};

export class IngressController {
  private config: IngressControllerConfig;
  private syncTimer?: NodeJS.Timeout;
  private lastSyncVersion = 0;

  constructor(config: Partial<IngressControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (!this.config.enabled) {
      console.log('Ingress controller disabled');
      return;
    }

    console.log('Starting Kubernetes Ingress controller');
    this.syncTimer = setInterval(() => {
      this.syncIngresses().catch(error => {
        console.error('Error syncing ingresses:', error);
      });
    }, this.config.syncIntervalMs);

    // Initial sync
    this.syncIngresses().catch(error => {
      console.error('Error in initial ingress sync:', error);
    });
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
    console.log('Stopped Kubernetes Ingress controller');
  }

  private async syncIngresses(): Promise<void> {
    try {
      const ingresses = await this.fetchIngresses();
      const crds = await this.fetchGatewayCRDs();
      
      const gatewayConfig = this.translateToGatewayConfig([...ingresses, ...crds]);
      
      if (!this.config.dryRun) {
        await this.applyGatewayConfig(gatewayConfig);
      } else {
        console.log('Dry run - would apply config:', JSON.stringify(gatewayConfig, null, 2));
      }

      this.lastSyncVersion++;
      console.log(`Synced ${ingresses.length} ingresses and ${crds.length} CRDs (version: ${this.lastSyncVersion})`);
    } catch (error) {
      console.error('Failed to sync ingresses:', error);
    }
  }

  private async fetchIngresses(): Promise<KubernetesIngress[]> {
    // In a real implementation, this would use the Kubernetes API
    // For now, simulate with mock data or environment variables
    const mockIngresses: KubernetesIngress[] = [];
    
    // Check for ingress definitions in environment
    const ingressConfig = process.env.K8S_INGRESS_CONFIG;
    if (ingressConfig) {
      try {
        const parsed = JSON.parse(ingressConfig);
        if (Array.isArray(parsed)) {
          mockIngresses.push(...parsed);
        }
      } catch (error) {
        console.error('Failed to parse K8S_INGRESS_CONFIG:', error);
      }
    }

    return mockIngresses;
  }

  private async fetchGatewayCRDs(): Promise<GatewayIngressCRD[]> {
    // In a real implementation, this would use the Kubernetes API
    // For now, simulate with mock data or environment variables
    const mockCRDs: GatewayIngressCRD[] = [];
    
    const crdConfig = process.env.K8S_GATEWAY_CRDS;
    if (crdConfig) {
      try {
        const parsed = JSON.parse(crdConfig);
        if (Array.isArray(parsed)) {
          mockCRDs.push(...parsed);
        }
      } catch (error) {
        console.error('Failed to parse K8S_GATEWAY_CRDS:', error);
      }
    }

    return mockCRDs;
  }

  private translateToGatewayConfig(resources: (KubernetesIngress | GatewayIngressCRD)[]): Partial<GatewayConfig> {
    const routes: RouteConfig[] = [];

    for (const resource of resources) {
      if (resource.kind === 'Ingress') {
        routes.push(...this.translateIngress(resource as KubernetesIngress));
      } else if (resource.kind === 'GatewayRoute') {
        routes.push(...this.translateGatewayCRD(resource as GatewayIngressCRD));
      }
    }

    return {
      routes,
      // Preserve existing admin and features config
      admin: getConfigManager().getConfig().admin,
      features: getConfigManager().getConfig().features,
    };
  }

  private translateIngress(ingress: KubernetesIngress): RouteConfig[] {
    const routes: RouteConfig[] = [];
    const annotations = ingress.metadata.annotations || {};

    for (const rule of ingress.spec.rules) {
      for (const path of rule.http.paths) {
        const routeId = this.generateRouteId(ingress, rule, path);
        
        const route: RouteConfig = {
          id: routeId,
          matcher: {
            pathPrefix: this.convertIngressPath(path.path || '/', path.pathType),
            methods: this.parseAnnotation(annotations['suuupra.io/methods'], ['GET', 'POST', 'PUT', 'DELETE']),
            hostnames: rule.host ? [rule.host] : undefined,
          },
          target: {
            serviceName: path.backend.service.name,
            discovery: {
              type: 'k8s',
              namespace: ingress.metadata.namespace,
            },
          },
          policy: this.parseIngressAnnotations(annotations),
        };

        routes.push(route);
      }
    }

    return routes;
  }

  private translateGatewayCRD(crd: GatewayIngressCRD): RouteConfig[] {
    const routes: RouteConfig[] = [];

    for (const path of crd.spec.paths) {
      const routeId = `${crd.metadata.namespace}-${crd.metadata.name}-${path.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      const route: RouteConfig = {
        id: routeId,
        matcher: {
          pathPrefix: path.path,
          methods: path.methods || ['GET', 'POST', 'PUT', 'DELETE'],
          hostnames: crd.spec.hostnames,
        },
        target: {
          serviceName: path.backend.serviceName,
          discovery: path.backend.discovery || {
            type: 'k8s',
            namespace: crd.metadata.namespace,
          },
        },
        policy: this.translateGatewayPolicies(crd.spec.policies),
      };

      routes.push(route);
    }

    return routes;
  }

  private convertIngressPath(path: string, pathType: string): string {
    switch (pathType) {
      case 'Exact':
        return path;
      case 'Prefix':
        return path.endsWith('/') ? path : `${path}/`;
      case 'ImplementationSpecific':
      default:
        return path;
    }
  }

  private generateRouteId(ingress: KubernetesIngress, rule: IngressRule, path: IngressPath): string {
    const namespace = ingress.metadata.namespace;
    const name = ingress.metadata.name;
    const host = rule.host || 'default';
    const pathStr = (path.path || '/').replace(/[^a-zA-Z0-9]/g, '-');
    return `${namespace}-${name}-${host}-${pathStr}`;
  }

  private parseIngressAnnotations(annotations: Record<string, string>): any {
    const policy: any = {};

    // Authentication
    if (annotations['suuupra.io/auth-type']) {
      policy.auth = {};
      const authType = annotations['suuupra.io/auth-type'];
      if (authType.includes('jwt')) {
        policy.auth.requireJwt = true;
        policy.auth.issuer = annotations['suuupra.io/jwt-issuer'];
        policy.auth.audience = this.parseAnnotation(annotations['suuupra.io/jwt-audience']);
        policy.auth.jwksUri = annotations['suuupra.io/jwks-uri'];
      }
      if (authType.includes('api-key')) {
        policy.auth.requireApiKey = true;
      }
      policy.auth.requiredRoles = this.parseAnnotation(annotations['suuupra.io/required-roles']);
    }

    // Rate limiting
    if (annotations['suuupra.io/rate-limit-enabled'] === 'true') {
      policy.rateLimit = {
        enabled: true,
        tokensPerInterval: parseInt(annotations['suuupra.io/rate-limit-tokens'] || '100'),
        intervalMs: parseInt(annotations['suuupra.io/rate-limit-interval'] || '60000'),
        keys: this.parseAnnotation(annotations['suuupra.io/rate-limit-keys'], ['ip']),
      };
    }

    // Timeouts
    if (annotations['suuupra.io/timeout-socket']) {
      policy.timeout = {
        socketTimeoutMs: parseInt(annotations['suuupra.io/timeout-socket']),
        connectTimeoutMs: parseInt(annotations['suuupra.io/timeout-connect'] || '5000'),
      };
    }

    // Retries
    if (annotations['suuupra.io/retry-enabled'] === 'true') {
      policy.retry = {
        enabled: true,
        maxAttempts: parseInt(annotations['suuupra.io/retry-max-attempts'] || '3'),
        backoffInitialMs: parseInt(annotations['suuupra.io/retry-backoff'] || '100'),
      };
    }

    // CORS
    if (annotations['suuupra.io/cors-enabled'] === 'true') {
      policy.cors = {
        allowOrigins: this.parseAnnotation(annotations['suuupra.io/cors-origins'], ['*']),
        allowMethods: this.parseAnnotation(annotations['suuupra.io/cors-methods'], ['GET', 'POST', 'PUT', 'DELETE']),
        allowHeaders: this.parseAnnotation(annotations['suuupra.io/cors-headers'], ['Content-Type', 'Authorization']),
      };
    }

    return policy;
  }

  private translateGatewayPolicies(policies?: GatewayPolicies): any {
    if (!policies) return {};

    const policy: any = {};

    if (policies.auth) {
      policy.auth = {
        requireJwt: policies.auth.requireJwt,
        requireApiKey: policies.auth.requireApiKey,
        requiredRoles: policies.auth.requiredRoles,
        issuer: policies.auth.issuer,
        audience: policies.auth.audience,
        jwksUri: policies.auth.jwksUri,
      };
    }

    if (policies.rateLimit) {
      policy.rateLimit = {
        enabled: policies.rateLimit.enabled,
        tokensPerInterval: policies.rateLimit.tokensPerInterval,
        intervalMs: policies.rateLimit.intervalMs,
        keys: policies.rateLimit.keys,
      };
    }

    if (policies.timeout) {
      policy.timeout = {
        socketTimeoutMs: policies.timeout.socketTimeoutMs,
        connectTimeoutMs: policies.timeout.connectTimeoutMs,
      };
    }

    if (policies.retry) {
      policy.retry = {
        enabled: true,
        maxAttempts: policies.retry.maxAttempts,
        backoffInitialMs: policies.retry.backoffInitialMs,
      };
    }

    return policy;
  }

  private parseAnnotation(value?: string, defaultValue?: any): any {
    if (!value) return defaultValue;
    
    try {
      // Try to parse as JSON first
      return JSON.parse(value);
    } catch {
      // If not JSON, split by comma for arrays
      if (value.includes(',')) {
        return value.split(',').map(s => s.trim());
      }
      return value;
    }
  }

  private async applyGatewayConfig(config: Partial<GatewayConfig>): Promise<void> {
    try {
      const configManager = getConfigManager();
      await configManager.updateConfig(config, 'ingress-controller');
      console.log(`Applied gateway config with ${config.routes?.length || 0} routes`);
    } catch (error) {
      console.error('Failed to apply gateway config:', error);
      throw error;
    }
  }

  getStatus(): {
    enabled: boolean;
    lastSyncVersion: number;
    config: IngressControllerConfig;
  } {
    return {
      enabled: this.config.enabled,
      lastSyncVersion: this.lastSyncVersion,
      config: { ...this.config },
    };
  }

  updateConfig(newConfig: Partial<IngressControllerConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };

    if (!wasEnabled && this.config.enabled) {
      this.start();
    } else if (wasEnabled && !this.config.enabled) {
      this.stop();
    }
  }
}

// Global ingress controller instance
let ingressController: IngressController;

export function initializeIngressController(config: Partial<IngressControllerConfig>): IngressController {
  ingressController = new IngressController(config);
  return ingressController;
}

export function getIngressController(): IngressController {
  if (!ingressController) {
    ingressController = new IngressController();
  }
  return ingressController;
}

// Example ingress configurations
export const EXAMPLE_INGRESS: KubernetesIngress = {
  apiVersion: 'networking.k8s.io/v1',
  kind: 'Ingress',
  metadata: {
    name: 'api-gateway-ingress',
    namespace: 'default',
    annotations: {
      'kubernetes.io/ingress.class': 'suuupra-gateway',
      'suuupra.io/auth-type': 'jwt,api-key',
      'suuupra.io/jwt-issuer': 'https://identity.suuupra.io',
      'suuupra.io/jwks-uri': 'https://identity.suuupra.io/.well-known/jwks.json',
      'suuupra.io/rate-limit-enabled': 'true',
      'suuupra.io/rate-limit-tokens': '1000',
      'suuupra.io/rate-limit-interval': '60000',
      'suuupra.io/cors-enabled': 'true',
    },
  },
  spec: {
    rules: [
      {
        host: 'api.suuupra.io',
        http: {
          paths: [
            {
              path: '/api/v1/identity',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'identity-service',
                  port: { number: 80 },
                },
              },
            },
          ],
        },
      },
    ],
  },
};

export const EXAMPLE_GATEWAY_CRD: GatewayIngressCRD = {
  apiVersion: 'gateway.suuupra.io/v1',
  kind: 'GatewayRoute',
  metadata: {
    name: 'llm-tutor-route',
    namespace: 'ai',
  },
  spec: {
    hostnames: ['ai.suuupra.io'],
    paths: [
      {
        path: '/api/v1/chat',
        pathType: 'Prefix',
        methods: ['POST'],
        backend: {
          serviceName: 'llm-tutor',
          discovery: {
            type: 'k8s',
            namespace: 'ai',
          },
        },
      },
    ],
    policies: {
      auth: {
        requireJwt: true,
        issuer: 'https://identity.suuupra.io',
        requiredRoles: ['user', 'premium'],
      },
      rateLimit: {
        enabled: true,
        tokensPerInterval: 100,
        intervalMs: 60000,
        keys: ['user', 'tenant'],
      },
    },
  },
};
