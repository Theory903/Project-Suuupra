/**
 * What: Service discovery providers (DNS, K8s, Consul) with caching and health checks
 * Why: Dynamic service resolution with fault tolerance and load balancing
 * How: Abstract provider interface with concrete implementations and health tracking
 */

import dns from 'dns/promises';
import { DiscoveryConfig, HealthCheckConfig } from '../types/gateway';

export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  weight?: number;
  healthy: boolean;
  lastHealthCheck?: number;
  metadata?: Record<string, any>;
}

export interface DiscoveryProvider {
  discover(serviceName: string, config: DiscoveryConfig): Promise<ServiceInstance[]>;
  healthCheck(instance: ServiceInstance, config?: HealthCheckConfig): Promise<boolean>;
}

class StaticDiscoveryProvider implements DiscoveryProvider {
  async discover(serviceName: string, config: DiscoveryConfig): Promise<ServiceInstance[]> {
    // For static discovery, we rely on the service registry
    const { serviceRegistry } = await import('../config/gatewayConfig');
    const url = serviceRegistry[serviceName];
    if (!url) return [];
    
    const parsed = new URL(url);
    return [{
      id: `${serviceName}-static`,
      host: parsed.hostname,
      port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
      healthy: true,
      weight: 1,
    }];
  }

  async healthCheck(instance: ServiceInstance, config?: HealthCheckConfig): Promise<boolean> {
    if (!config?.activeProbePath) return true;
    
    try {
      const url = `http://${instance.host}:${instance.port}${config.activeProbePath}`;
      const response = await fetch(url, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

class DNSDiscoveryProvider implements DiscoveryProvider {
  private cache = new Map<string, { instances: ServiceInstance[]; expires: number }>();

  async discover(serviceName: string, config: DiscoveryConfig): Promise<ServiceInstance[]> {
    const cacheKey = `${serviceName}-${config.name || serviceName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.instances;
    }

    try {
      const hostname = config.name || `${serviceName}.service.consul`;
      const addresses = await dns.resolve4(hostname);
      
      const instances: ServiceInstance[] = addresses.map((addr, idx) => ({
        id: `${serviceName}-dns-${idx}`,
        host: addr,
        port: 80, // Default port, should be configurable
        healthy: true,
        weight: 1,
      }));

      // Cache for 30 seconds
      this.cache.set(cacheKey, {
        instances,
        expires: Date.now() + 30000,
      });

      return instances;
    } catch (error) {
      console.error(`DNS discovery failed for ${serviceName}:`, error);
      return cached?.instances || [];
    }
  }

  async healthCheck(instance: ServiceInstance, config?: HealthCheckConfig): Promise<boolean> {
    return new StaticDiscoveryProvider().healthCheck(instance, config);
  }
}

class KubernetesDiscoveryProvider implements DiscoveryProvider {
  private cache = new Map<string, { instances: ServiceInstance[]; expires: number }>();

  async discover(serviceName: string, config: DiscoveryConfig): Promise<ServiceInstance[]> {
    const cacheKey = `${serviceName}-${config.namespace || 'default'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.instances;
    }

    try {
      // In a real K8s environment, this would use the K8s API
      // For now, we'll simulate with environment-based discovery
      const namespace = config.namespace || 'default';
      const serviceHost = process.env[`${serviceName.toUpperCase().replace('-', '_')}_SERVICE_HOST`];
      const servicePort = process.env[`${serviceName.toUpperCase().replace('-', '_')}_SERVICE_PORT`];
      
      if (!serviceHost || !servicePort) {
        return [];
      }

      const instances: ServiceInstance[] = [{
        id: `${serviceName}-k8s`,
        host: serviceHost,
        port: parseInt(servicePort),
        healthy: true,
        weight: 1,
        metadata: { namespace },
      }];

      // Cache for 60 seconds
      this.cache.set(cacheKey, {
        instances,
        expires: Date.now() + 60000,
      });

      return instances;
    } catch (error) {
      console.error(`K8s discovery failed for ${serviceName}:`, error);
      return cached?.instances || [];
    }
  }

  async healthCheck(instance: ServiceInstance, config?: HealthCheckConfig): Promise<boolean> {
    return new StaticDiscoveryProvider().healthCheck(instance, config);
  }
}

// Provider registry
const providers: Record<string, DiscoveryProvider> = {
  static: new StaticDiscoveryProvider(),
  dns: new DNSDiscoveryProvider(),
  k8s: new KubernetesDiscoveryProvider(),
  consul: new DNSDiscoveryProvider(), // Use DNS for Consul for now
};

export function getDiscoveryProvider(type: string): DiscoveryProvider {
  return providers[type] || providers.static;
}

// Health check manager
export class HealthCheckManager {
  private healthStatus = new Map<string, boolean>();
  private checkIntervals = new Map<string, NodeJS.Timeout>();

  startHealthChecks(instances: ServiceInstance[], config?: HealthCheckConfig) {
    if (!config?.activeProbePath) return;

    const interval = config.intervalMs || 30000;
    
    for (const instance of instances) {
      const key = `${instance.host}:${instance.port}`;
      
      // Clear existing interval
      const existing = this.checkIntervals.get(key);
      if (existing) {
        clearInterval(existing);
      }

      // Start new interval
      const intervalId = setInterval(async () => {
        const provider = getDiscoveryProvider('static');
        const healthy = await provider.healthCheck(instance, config);
        this.healthStatus.set(key, healthy);
        
        if (!healthy) {
          console.warn(`Health check failed for ${key}`);
        }
      }, interval);
      
      this.checkIntervals.set(key, intervalId);
    }
  }

  isHealthy(instance: ServiceInstance): boolean {
    const key = `${instance.host}:${instance.port}`;
    return this.healthStatus.get(key) ?? true;
  }

  stopHealthChecks() {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    this.healthStatus.clear();
  }
}

// Global health check manager instance
export const healthCheckManager = new HealthCheckManager();
