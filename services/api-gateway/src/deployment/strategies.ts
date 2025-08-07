/**
 * What: Deployment strategies with blue-green, canary, and SLO-based auto-rollback
 * Why: Safe, automated deployments with automatic failure detection and rollback
 * How: Traffic splitting, metric monitoring, SLO validation, automated rollback
 */

import { EventEmitter } from 'events';

export interface DeploymentStrategy {
  type: 'blue-green' | 'canary' | 'rolling';
  config: BlueGreenConfig | CanaryConfig | RollingConfig;
}

export interface BlueGreenConfig {
  healthCheckPath: string;
  healthCheckTimeout: number;
  switchDelay: number; // Time to wait before switching traffic
  rollbackOnFailure: boolean;
}

export interface CanaryConfig {
  initialTrafficPercent: number;
  trafficIncrementPercent: number;
  incrementInterval: number; // Time between increments
  maxTrafficPercent: number;
  sloThresholds: SLOThreshold[];
  rollbackOnSLOBreach: boolean;
}

export interface RollingConfig {
  batchSize: number;
  batchDelay: number;
  healthCheckPath: string;
  maxUnavailable: number;
}

export interface SLOThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  duration: number; // Time window in ms
  description: string;
}

export interface DeploymentTarget {
  id: string;
  version: string;
  endpoint: string;
  replicas: number;
  healthy: boolean;
  trafficWeight: number;
  metadata: Record<string, any>;
}

export interface DeploymentState {
  id: string;
  strategy: DeploymentStrategy;
  currentTargets: DeploymentTarget[];
  newTarget: DeploymentTarget;
  phase: 'preparing' | 'deploying' | 'validating' | 'completed' | 'rolling-back' | 'failed';
  startedAt: number;
  completedAt?: number;
  metrics: DeploymentMetrics;
  sloBreaches: SLOBreach[];
  rollbackReason?: string;
}

export interface DeploymentMetrics {
  requestCount: number;
  errorRate: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  timestamp: number;
}

export interface SLOBreach {
  metric: string;
  threshold: number;
  actualValue: number;
  timestamp: number;
  description: string;
}

export interface DeploymentManagerConfig {
  metricsCollectionInterval: number;
  sloCheckInterval: number;
  defaultHealthCheckTimeout: number;
  maxConcurrentDeployments: number;
}

const DEFAULT_CONFIG: DeploymentManagerConfig = {
  metricsCollectionInterval: 30000, // 30 seconds
  sloCheckInterval: 10000, // 10 seconds
  defaultHealthCheckTimeout: 30000, // 30 seconds
  maxConcurrentDeployments: 3,
};

export class DeploymentManager extends EventEmitter {
  private config: DeploymentManagerConfig;
  private activeDeployments = new Map<string, DeploymentState>();
  private metricsTimer?: NodeJS.Timeout;
  private sloCheckTimer?: NodeJS.Timeout;

  constructor(config: Partial<DeploymentManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startMetricsCollection();
    this.startSLOMonitoring();
  }

  async startDeployment(
    deploymentId: string,
    strategy: DeploymentStrategy,
    currentTargets: DeploymentTarget[],
    newTarget: DeploymentTarget
  ): Promise<void> {
    if (this.activeDeployments.has(deploymentId)) {
      throw new Error(`Deployment ${deploymentId} already in progress`);
    }

    if (this.activeDeployments.size >= this.config.maxConcurrentDeployments) {
      throw new Error('Maximum concurrent deployments reached');
    }

    const deploymentState: DeploymentState = {
      id: deploymentId,
      strategy,
      currentTargets: [...currentTargets],
      newTarget: { ...newTarget },
      phase: 'preparing',
      startedAt: Date.now(),
      metrics: this.createEmptyMetrics(),
      sloBreaches: [],
    };

    this.activeDeployments.set(deploymentId, deploymentState);
    this.emit('deployment_started', { deploymentId, strategy: strategy.type });

    try {
      await this.executeDeployment(deploymentState);
    } catch (error) {
      deploymentState.phase = 'failed';
      deploymentState.completedAt = Date.now();
      deploymentState.rollbackReason = (error as Error).message;
      this.emit('deployment_failed', { deploymentId, error: error as Error });
      throw error;
    }
  }

  async rollbackDeployment(deploymentId: string, reason?: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (deployment.phase === 'completed' || deployment.phase === 'failed') {
      throw new Error(`Cannot rollback deployment in phase: ${deployment.phase}`);
    }

    deployment.phase = 'rolling-back';
    deployment.rollbackReason = reason || 'Manual rollback';

    this.emit('deployment_rollback_started', { deploymentId, reason });

    try {
      await this.executeRollback(deployment);
      deployment.phase = 'completed';
      deployment.completedAt = Date.now();
      this.emit('deployment_rollback_completed', { deploymentId });
    } catch (error) {
      deployment.phase = 'failed';
      deployment.completedAt = Date.now();
      this.emit('deployment_rollback_failed', { deploymentId, error: error as Error });
      throw error;
    }
  }

  private async executeDeployment(deployment: DeploymentState): Promise<void> {
    switch (deployment.strategy.type) {
      case 'blue-green':
        await this.executeBlueGreenDeployment(deployment);
        break;
      case 'canary':
        await this.executeCanaryDeployment(deployment);
        break;
      case 'rolling':
        await this.executeRollingDeployment(deployment);
        break;
      default:
        throw new Error(`Unknown deployment strategy: ${deployment.strategy.type}`);
    }
  }

  private async executeBlueGreenDeployment(deployment: DeploymentState): Promise<void> {
    const config = deployment.strategy.config as BlueGreenConfig;
    
    deployment.phase = 'deploying';
    this.emit('deployment_phase_changed', { deploymentId: deployment.id, phase: 'deploying' });

    // Deploy new version (green)
    deployment.newTarget.trafficWeight = 0; // No traffic initially
    await this.deployTarget(deployment.newTarget);

    // Health check new version
    const isHealthy = await this.performHealthCheck(
      deployment.newTarget,
      config.healthCheckPath,
      config.healthCheckTimeout
    );

    if (!isHealthy) {
      throw new Error('Health check failed for new version');
    }

    // Wait for switch delay
    await this.sleep(config.switchDelay);

    deployment.phase = 'validating';
    this.emit('deployment_phase_changed', { deploymentId: deployment.id, phase: 'validating' });

    // Switch traffic (blue -> green)
    await this.switchTraffic(deployment.currentTargets, deployment.newTarget);

    // Monitor for a short period
    await this.sleep(30000); // 30 seconds monitoring

    deployment.phase = 'completed';
    deployment.completedAt = Date.now();
    this.emit('deployment_completed', { deploymentId: deployment.id });
  }

  private async executeCanaryDeployment(deployment: DeploymentState): Promise<void> {
    const config = deployment.strategy.config as CanaryConfig;
    
    deployment.phase = 'deploying';
    this.emit('deployment_phase_changed', { deploymentId: deployment.id, phase: 'deploying' });

    // Deploy canary version
    deployment.newTarget.trafficWeight = config.initialTrafficPercent;
    await this.deployTarget(deployment.newTarget);
    await this.updateTrafficWeights(deployment.currentTargets, deployment.newTarget);

    let currentTrafficPercent = config.initialTrafficPercent;

    while (currentTrafficPercent < config.maxTrafficPercent) {
      deployment.phase = 'validating';
      this.emit('deployment_phase_changed', { deploymentId: deployment.id, phase: 'validating' });

      // Wait for increment interval
      await this.sleep(config.incrementInterval);

      // Check SLOs
      const sloBreaches = await this.checkSLOs(deployment, config.sloThresholds);
      if (sloBreaches.length > 0 && config.rollbackOnSLOBreach) {
        deployment.sloBreaches.push(...sloBreaches);
        throw new Error(`SLO breaches detected: ${sloBreaches.map(b => b.description).join(', ')}`);
      }

      // Increment traffic
      currentTrafficPercent = Math.min(
        currentTrafficPercent + config.trafficIncrementPercent,
        config.maxTrafficPercent
      );

      deployment.newTarget.trafficWeight = currentTrafficPercent;
      await this.updateTrafficWeights(deployment.currentTargets, deployment.newTarget);

      this.emit('canary_traffic_increased', {
        deploymentId: deployment.id,
        trafficPercent: currentTrafficPercent,
      });
    }

    // Final validation
    await this.sleep(config.incrementInterval);
    const finalSLOBreaches = await this.checkSLOs(deployment, config.sloThresholds);
    if (finalSLOBreaches.length > 0 && config.rollbackOnSLOBreach) {
      deployment.sloBreaches.push(...finalSLOBreaches);
      throw new Error(`Final SLO validation failed: ${finalSLOBreaches.map(b => b.description).join(', ')}`);
    }

    // Complete canary - switch all traffic
    deployment.newTarget.trafficWeight = 100;
    await this.updateTrafficWeights(deployment.currentTargets, deployment.newTarget);

    deployment.phase = 'completed';
    deployment.completedAt = Date.now();
    this.emit('deployment_completed', { deploymentId: deployment.id });
  }

  private async executeRollingDeployment(deployment: DeploymentState): Promise<void> {
    const config = deployment.strategy.config as RollingConfig;
    
    deployment.phase = 'deploying';
    this.emit('deployment_phase_changed', { deploymentId: deployment.id, phase: 'deploying' });

    // Rolling deployment logic would go here
    // For simplicity, treating it like blue-green for now
    await this.executeBlueGreenDeployment(deployment);
  }

  private async executeRollback(deployment: DeploymentState): Promise<void> {
    // Restore traffic to current targets
    deployment.newTarget.trafficWeight = 0;
    const totalCurrentWeight = deployment.currentTargets.reduce((sum, target) => sum + target.trafficWeight, 0);
    
    if (totalCurrentWeight === 0) {
      // Distribute traffic evenly among current targets
      const weightPerTarget = 100 / deployment.currentTargets.length;
      deployment.currentTargets.forEach(target => {
        target.trafficWeight = weightPerTarget;
      });
    }

    await this.updateTrafficWeights(deployment.currentTargets, deployment.newTarget);

    // Remove new target
    await this.removeTarget(deployment.newTarget);
  }

  private async deployTarget(target: DeploymentTarget): Promise<void> {
    // In a real implementation, this would deploy to K8s/Docker/etc.
    console.log(`Deploying target ${target.id} version ${target.version}`);
    await this.sleep(5000); // Simulate deployment time
    target.healthy = true;
  }

  private async removeTarget(target: DeploymentTarget): Promise<void> {
    // In a real implementation, this would remove from K8s/Docker/etc.
    console.log(`Removing target ${target.id} version ${target.version}`);
    await this.sleep(2000); // Simulate removal time
  }

  private async performHealthCheck(
    target: DeploymentTarget,
    healthCheckPath: string,
    timeout: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`${target.endpoint}${healthCheckPath}`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      });
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${target.id}:`, error);
      return false;
    }
  }

  private async switchTraffic(
    currentTargets: DeploymentTarget[],
    newTarget: DeploymentTarget
  ): Promise<void> {
    // Switch all traffic to new target
    currentTargets.forEach(target => {
      target.trafficWeight = 0;
    });
    newTarget.trafficWeight = 100;

    await this.updateTrafficWeights(currentTargets, newTarget);
  }

  private async updateTrafficWeights(
    currentTargets: DeploymentTarget[],
    newTarget: DeploymentTarget
  ): Promise<void> {
    // In a real implementation, this would update load balancer/service mesh
    console.log('Updating traffic weights:');
    currentTargets.forEach(target => {
      console.log(`  ${target.id}: ${target.trafficWeight}%`);
    });
    console.log(`  ${newTarget.id}: ${newTarget.trafficWeight}%`);
    
    await this.sleep(1000); // Simulate update time
  }

  private async checkSLOs(
    deployment: DeploymentState,
    thresholds: SLOThreshold[]
  ): Promise<SLOBreach[]> {
    const breaches: SLOBreach[] = [];
    const metrics = await this.collectMetrics(deployment);

    for (const threshold of thresholds) {
      const actualValue = this.getMetricValue(metrics, threshold.metric);
      const breached = this.evaluateThreshold(actualValue, threshold.operator, threshold.threshold);

      if (breached) {
        breaches.push({
          metric: threshold.metric,
          threshold: threshold.threshold,
          actualValue,
          timestamp: Date.now(),
          description: threshold.description,
        });
      }
    }

    return breaches;
  }

  private async collectMetrics(deployment: DeploymentState): Promise<DeploymentMetrics> {
    // In a real implementation, this would collect metrics from monitoring system
    const mockMetrics: DeploymentMetrics = {
      requestCount: Math.floor(Math.random() * 1000) + 100,
      errorRate: Math.random() * 5, // 0-5%
      averageLatency: Math.random() * 100 + 50, // 50-150ms
      p95Latency: Math.random() * 200 + 100, // 100-300ms
      p99Latency: Math.random() * 300 + 200, // 200-500ms
      throughput: Math.random() * 1000 + 500, // 500-1500 RPS
      timestamp: Date.now(),
    };

    deployment.metrics = mockMetrics;
    return mockMetrics;
  }

  private getMetricValue(metrics: DeploymentMetrics, metricName: string): number {
    switch (metricName) {
      case 'error_rate':
        return metrics.errorRate;
      case 'avg_latency':
        return metrics.averageLatency;
      case 'p95_latency':
        return metrics.p95Latency;
      case 'p99_latency':
        return metrics.p99Latency;
      case 'throughput':
        return metrics.throughput;
      default:
        return 0;
    }
  }

  private evaluateThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      for (const deployment of this.activeDeployments.values()) {
        if (deployment.phase === 'validating' || deployment.phase === 'deploying') {
          this.collectMetrics(deployment).catch(error => {
            console.error(`Failed to collect metrics for deployment ${deployment.id}:`, error);
          });
        }
      }
    }, this.config.metricsCollectionInterval);
  }

  private startSLOMonitoring(): void {
    this.sloCheckTimer = setInterval(() => {
      for (const deployment of this.activeDeployments.values()) {
        if (deployment.phase === 'validating' && deployment.strategy.type === 'canary') {
          const config = deployment.strategy.config as CanaryConfig;
          if (config.rollbackOnSLOBreach) {
            this.checkSLOs(deployment, config.sloThresholds).then(breaches => {
              if (breaches.length > 0) {
                deployment.sloBreaches.push(...breaches);
                this.rollbackDeployment(deployment.id, `SLO breaches: ${breaches.map(b => b.description).join(', ')}`);
              }
            }).catch(error => {
              console.error(`Failed to check SLOs for deployment ${deployment.id}:`, error);
            });
          }
        }
      }
    }, this.config.sloCheckInterval);
  }

  private createEmptyMetrics(): DeploymentMetrics {
    return {
      requestCount: 0,
      errorRate: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      timestamp: Date.now(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDeploymentStatus(deploymentId: string): DeploymentState | undefined {
    return this.activeDeployments.get(deploymentId);
  }

  listActiveDeployments(): DeploymentState[] {
    return Array.from(this.activeDeployments.values());
  }

  getStats(): {
    activeDeployments: number;
    completedDeployments: number;
    failedDeployments: number;
  } {
    const deployments = Array.from(this.activeDeployments.values());
    return {
      activeDeployments: deployments.filter(d => d.phase !== 'completed' && d.phase !== 'failed').length,
      completedDeployments: deployments.filter(d => d.phase === 'completed').length,
      failedDeployments: deployments.filter(d => d.phase === 'failed').length,
    };
  }

  shutdown(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    if (this.sloCheckTimer) {
      clearInterval(this.sloCheckTimer);
    }
  }
}

// Global deployment manager instance
let deploymentManager: DeploymentManager;

export function initializeDeploymentManager(config: Partial<DeploymentManagerConfig>): DeploymentManager {
  deploymentManager = new DeploymentManager(config);
  return deploymentManager;
}

export function getDeploymentManager(): DeploymentManager {
  if (!deploymentManager) {
    deploymentManager = new DeploymentManager();
  }
  return deploymentManager;
}

// Common SLO thresholds
export const COMMON_SLO_THRESHOLDS: Record<string, SLOThreshold[]> = {
  BASIC: [
    {
      metric: 'error_rate',
      operator: 'lt',
      threshold: 5, // Less than 5%
      duration: 60000, // 1 minute
      description: 'Error rate below 5%',
    },
    {
      metric: 'p99_latency',
      operator: 'lt',
      threshold: 1000, // Less than 1 second
      duration: 60000,
      description: 'P99 latency below 1s',
    },
  ],
  STRICT: [
    {
      metric: 'error_rate',
      operator: 'lt',
      threshold: 1, // Less than 1%
      duration: 60000,
      description: 'Error rate below 1%',
    },
    {
      metric: 'p95_latency',
      operator: 'lt',
      threshold: 500, // Less than 500ms
      duration: 60000,
      description: 'P95 latency below 500ms',
    },
    {
      metric: 'throughput',
      operator: 'gt',
      threshold: 100, // More than 100 RPS
      duration: 60000,
      description: 'Throughput above 100 RPS',
    },
  ],
};
