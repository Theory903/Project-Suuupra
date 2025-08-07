/**
 * What: Load balancer with health checks and outlier detection for service instances
 * Why: Intelligent traffic distribution with automatic failure detection and recovery
 * How: Multiple selection algorithms, active/passive health checks, outlier ejection
 */

import { ServiceInstance } from './providers';
import { EventEmitter } from 'events';

export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'weighted' | 'least-connections' | 'least-response-time' | 'ip-hash';
  healthCheckEnabled: boolean;
  outlierDetectionEnabled: boolean;
  outlierDetectionConfig: OutlierDetectionConfig;
  stickySessionEnabled: boolean;
}

export interface OutlierDetectionConfig {
  consecutiveErrors: number; // Eject after N consecutive errors
  interval: number; // Check interval in ms
  baseEjectionTime: number; // Base ejection time in ms
  maxEjectionPercent: number; // Max % of instances to eject
  minHealthyInstances: number; // Always keep at least N instances
}

export interface SelectionContext {
  clientIp?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface InstanceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  lastError?: Date;
  consecutiveErrors: number;
  isEjected: boolean;
  ejectedUntil?: Date;
}

const DEFAULT_CONFIG: LoadBalancerConfig = {
  algorithm: 'round-robin',
  healthCheckEnabled: true,
  outlierDetectionEnabled: true,
  outlierDetectionConfig: {
    consecutiveErrors: 5,
    interval: 30000, // 30 seconds
    baseEjectionTime: 30000, // 30 seconds
    maxEjectionPercent: 50, // 50%
    minHealthyInstances: 1,
  },
  stickySessionEnabled: false,
};

export class LoadBalancer extends EventEmitter {
  private config: LoadBalancerConfig;
  private instances = new Map<string, ServiceInstance>();
  private instanceStats = new Map<string, InstanceStats>();
  private roundRobinIndex = 0;
  private stickySessionMap = new Map<string, string>(); // sessionId -> instanceId
  private outlierTimer?: NodeJS.Timeout;

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.outlierDetectionEnabled) {
      this.startOutlierDetection();
    }
  }

  addInstance(instance: ServiceInstance): void {
    this.instances.set(instance.id, instance);
    
    if (!this.instanceStats.has(instance.id)) {
      this.instanceStats.set(instance.id, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        consecutiveErrors: 0,
        isEjected: false,
      });
    }

    this.emit('instance_added', { instance });
  }

  removeInstance(instanceId: string): void {
    this.instances.delete(instanceId);
    this.instanceStats.delete(instanceId);
    
    // Remove sticky sessions pointing to this instance
    for (const [sessionId, mappedInstanceId] of this.stickySessionMap.entries()) {
      if (mappedInstanceId === instanceId) {
        this.stickySessionMap.delete(sessionId);
      }
    }

    this.emit('instance_removed', { instanceId });
  }

  updateInstanceHealth(instanceId: string, healthy: boolean): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.healthy = healthy;
      this.emit('instance_health_changed', { instanceId, healthy });
    }
  }

  selectInstance(context: SelectionContext = {}): ServiceInstance | null {
    const eligibleInstances = this.getEligibleInstances();
    
    if (eligibleInstances.length === 0) {
      return null;
    }

    // Check for sticky session
    if (this.config.stickySessionEnabled && context.sessionId) {
      const stickyInstance = this.getStickyInstance(context.sessionId, eligibleInstances);
      if (stickyInstance) {
        return stickyInstance;
      }
    }

    // Apply load balancing algorithm
    const selectedInstance = this.applyAlgorithm(eligibleInstances, context);
    
    // Create sticky session if enabled
    if (this.config.stickySessionEnabled && context.sessionId && selectedInstance) {
      this.stickySessionMap.set(context.sessionId, selectedInstance.id);
    }

    return selectedInstance;
  }

  recordRequestResult(instanceId: string, success: boolean, responseTime: number): void {
    const stats = this.instanceStats.get(instanceId);
    if (!stats) return;

    stats.totalRequests++;
    
    if (success) {
      stats.successfulRequests++;
      stats.consecutiveErrors = 0;
    } else {
      stats.failedRequests++;
      stats.consecutiveErrors++;
      stats.lastError = new Date();
    }

    // Update average response time (simple moving average)
    stats.avgResponseTime = (stats.avgResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;

    // Check for outlier detection
    if (this.config.outlierDetectionEnabled && !success) {
      this.checkForOutlier(instanceId);
    }
  }

  private getEligibleInstances(): ServiceInstance[] {
    const eligible: ServiceInstance[] = [];
    const now = new Date();
    
    for (const instance of this.instances.values()) {
      // Check health
      if (this.config.healthCheckEnabled && !instance.healthy) {
        continue;
      }

      // Check if ejected
      const stats = this.instanceStats.get(instance.id);
      if (stats?.isEjected && stats.ejectedUntil && now < stats.ejectedUntil) {
        continue;
      }

      eligible.push(instance);
    }

    return eligible;
  }

  private getStickyInstance(sessionId: string, eligibleInstances: ServiceInstance[]): ServiceInstance | null {
    const instanceId = this.stickySessionMap.get(sessionId);
    if (!instanceId) return null;

    return eligibleInstances.find(i => i.id === instanceId) || null;
  }

  private applyAlgorithm(instances: ServiceInstance[], context: SelectionContext): ServiceInstance | null {
    if (instances.length === 0) return null;
    if (instances.length === 1) return instances[0];

    switch (this.config.algorithm) {
      case 'round-robin':
        return this.roundRobinSelection(instances);
      
      case 'weighted':
        return this.weightedSelection(instances);
      
      case 'least-connections':
        return this.leastConnectionsSelection(instances);
      
      case 'least-response-time':
        return this.leastResponseTimeSelection(instances);
      
      case 'ip-hash':
        return this.ipHashSelection(instances, context.clientIp);
      
      default:
        return this.roundRobinSelection(instances);
    }
  }

  private roundRobinSelection(instances: ServiceInstance[]): ServiceInstance {
    const selected = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex++;
    return selected;
  }

  private weightedSelection(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + (instance.weight || 1), 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (const instance of instances) {
      cumulativeWeight += (instance.weight || 1);
      if (random <= cumulativeWeight) {
        return instance;
      }
    }
    
    return instances[0];
  }

  private leastConnectionsSelection(instances: ServiceInstance[]): ServiceInstance {
    // For simplicity, use request count as proxy for connections
    return instances.reduce((least, current) => {
      const leastStats = this.instanceStats.get(least.id);
      const currentStats = this.instanceStats.get(current.id);
      
      const leastConnections = leastStats?.totalRequests || 0;
      const currentConnections = currentStats?.totalRequests || 0;
      
      return currentConnections < leastConnections ? current : least;
    });
  }

  private leastResponseTimeSelection(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((fastest, current) => {
      const fastestStats = this.instanceStats.get(fastest.id);
      const currentStats = this.instanceStats.get(current.id);
      
      const fastestTime = fastestStats?.avgResponseTime || 0;
      const currentTime = currentStats?.avgResponseTime || 0;
      
      return currentTime < fastestTime ? current : fastest;
    });
  }

  private ipHashSelection(instances: ServiceInstance[], clientIp?: string): ServiceInstance {
    if (!clientIp) {
      return this.roundRobinSelection(instances);
    }

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < clientIp.length; i++) {
      const char = clientIp.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    const index = Math.abs(hash) % instances.length;
    return instances[index];
  }

  private checkForOutlier(instanceId: string): void {
    const stats = this.instanceStats.get(instanceId);
    if (!stats || stats.isEjected) return;

    const config = this.config.outlierDetectionConfig;
    
    if (stats.consecutiveErrors >= config.consecutiveErrors) {
      this.ejectInstance(instanceId);
    }
  }

  private ejectInstance(instanceId: string): void {
    const stats = this.instanceStats.get(instanceId);
    if (!stats) return;

    // Check if we can eject (don't eject too many instances)
    const totalInstances = this.instances.size;
    const ejectedInstances = Array.from(this.instanceStats.values()).filter(s => s.isEjected).length;
    const ejectionPercent = (ejectedInstances / totalInstances) * 100;
    
    if (ejectionPercent >= this.config.outlierDetectionConfig.maxEjectionPercent) {
      return; // Don't eject more instances
    }

    const healthyInstances = totalInstances - ejectedInstances;
    if (healthyInstances <= this.config.outlierDetectionConfig.minHealthyInstances) {
      return; // Keep minimum healthy instances
    }

    // Eject the instance
    stats.isEjected = true;
    stats.ejectedUntil = new Date(Date.now() + this.config.outlierDetectionConfig.baseEjectionTime);

    this.emit('instance_ejected', { instanceId, ejectedUntil: stats.ejectedUntil });
  }

  private startOutlierDetection(): void {
    this.outlierTimer = setInterval(() => {
      this.checkEjectedInstances();
    }, this.config.outlierDetectionConfig.interval);
  }

  private checkEjectedInstances(): void {
    const now = new Date();
    
    for (const [instanceId, stats] of this.instanceStats.entries()) {
      if (stats.isEjected && stats.ejectedUntil && now >= stats.ejectedUntil) {
        // Re-admit the instance
        stats.isEjected = false;
        stats.ejectedUntil = undefined;
        stats.consecutiveErrors = 0; // Reset error count
        
        this.emit('instance_readmitted', { instanceId });
      }
    }
  }

  getInstanceStats(): Map<string, InstanceStats> {
    return new Map(this.instanceStats);
  }

  getLoadBalancerStats(): {
    totalInstances: number;
    healthyInstances: number;
    ejectedInstances: number;
    stickySessionCount: number;
    algorithm: string;
  } {
    const totalInstances = this.instances.size;
    const healthyInstances = Array.from(this.instances.values()).filter(i => i.healthy).length;
    const ejectedInstances = Array.from(this.instanceStats.values()).filter(s => s.isEjected).length;
    
    return {
      totalInstances,
      healthyInstances,
      ejectedInstances,
      stickySessionCount: this.stickySessionMap.size,
      algorithm: this.config.algorithm,
    };
  }

  updateConfig(newConfig: Partial<LoadBalancerConfig>): void {
    const oldConfig = this.config;
    this.config = { ...this.config, ...newConfig };

    // Handle outlier detection changes
    if (oldConfig.outlierDetectionEnabled && !this.config.outlierDetectionEnabled) {
      if (this.outlierTimer) {
        clearInterval(this.outlierTimer);
        this.outlierTimer = undefined;
      }
      // Re-admit all ejected instances
      for (const stats of this.instanceStats.values()) {
        if (stats.isEjected) {
          stats.isEjected = false;
          stats.ejectedUntil = undefined;
        }
      }
    } else if (!oldConfig.outlierDetectionEnabled && this.config.outlierDetectionEnabled) {
      this.startOutlierDetection();
    }

    // Clear sticky sessions if disabled
    if (!this.config.stickySessionEnabled) {
      this.stickySessionMap.clear();
    }
  }

  shutdown(): void {
    if (this.outlierTimer) {
      clearInterval(this.outlierTimer);
      this.outlierTimer = undefined;
    }
  }
}

// Global load balancers per service
const loadBalancers = new Map<string, LoadBalancer>();

export function getLoadBalancer(serviceName: string, config?: Partial<LoadBalancerConfig>): LoadBalancer {
  let balancer = loadBalancers.get(serviceName);
  
  if (!balancer) {
    balancer = new LoadBalancer(config);
    loadBalancers.set(serviceName, balancer);
  } else if (config) {
    balancer.updateConfig(config);
  }
  
  return balancer;
}

export function removeLoadBalancer(serviceName: string): void {
  const balancer = loadBalancers.get(serviceName);
  if (balancer) {
    balancer.shutdown();
    loadBalancers.delete(serviceName);
  }
}
