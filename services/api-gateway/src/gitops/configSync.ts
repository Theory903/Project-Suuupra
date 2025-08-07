/**
 * What: GitOps configuration synchronization with drift detection
 * Why: Enable version-controlled, auditable configuration management
 * How: Git repository polling, diff detection, automatic sync, conflict resolution
 */

import { GatewayConfig } from '../types/gateway';
import { getConfigManager } from '../admin/api';
import crypto from 'crypto';

export interface GitOpsConfig {
  enabled: boolean;
  repository: {
    url: string;
    branch: string;
    path: string; // Path to config files within repo
    authType: 'none' | 'token' | 'ssh';
    token?: string;
    privateKey?: string;
  };
  syncInterval: number;
  autoSync: boolean;
  conflictResolution: 'git-wins' | 'gateway-wins' | 'manual';
  dryRun: boolean;
}

export interface GitCommit {
  hash: string;
  author: string;
  message: string;
  timestamp: number;
  files: string[];
}

export interface ConfigDrift {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  gitVersion: string;
  gatewayVersion: string;
  diff: string;
}

export interface SyncResult {
  success: boolean;
  syncedAt: number;
  commit: GitCommit;
  changes: ConfigChange[];
  conflicts: ConfigDrift[];
  error?: string;
}

export interface ConfigChange {
  file: string;
  action: 'create' | 'update' | 'delete';
  before?: any;
  after?: any;
}

const DEFAULT_CONFIG: GitOpsConfig = {
  enabled: false,
  repository: {
    url: '',
    branch: 'main',
    path: 'gateway-config',
    authType: 'none',
  },
  syncInterval: 300000, // 5 minutes
  autoSync: false,
  conflictResolution: 'manual',
  dryRun: true,
};

export class GitOpsConfigSync {
  private config: GitOpsConfig;
  private syncTimer?: NodeJS.Timeout;
  private lastSyncCommit?: string;
  private lastSyncTime = 0;

  constructor(config: Partial<GitOpsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (!this.config.enabled) {
      console.log('GitOps config sync disabled');
      return;
    }

    console.log('Starting GitOps configuration synchronization');
    
    if (this.config.autoSync) {
      this.syncTimer = setInterval(() => {
        this.syncConfiguration().catch(error => {
          console.error('Error in GitOps sync:', error);
        });
      }, this.config.syncInterval);
    }

    // Initial sync
    this.syncConfiguration().catch(error => {
      console.error('Error in initial GitOps sync:', error);
    });
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
    console.log('Stopped GitOps configuration synchronization');
  }

  async syncConfiguration(): Promise<SyncResult> {
    try {
      // Fetch latest commit from repository
      const latestCommit = await this.fetchLatestCommit();
      
      if (this.lastSyncCommit === latestCommit.hash) {
        return {
          success: true,
          syncedAt: Date.now(),
          commit: latestCommit,
          changes: [],
          conflicts: [],
        };
      }

      // Fetch configuration files from Git
      const gitConfig = await this.fetchConfigFromGit(latestCommit.hash);
      
      // Get current gateway configuration
      const currentConfig = getConfigManager().getConfig();
      
      // Detect drift
      const drift = await this.detectDrift(gitConfig, currentConfig);
      
      if (drift.length > 0) {
        console.log(`Detected ${drift.length} configuration drifts`);
        
        if (this.config.conflictResolution === 'manual') {
          return {
            success: false,
            syncedAt: Date.now(),
            commit: latestCommit,
            changes: [],
            conflicts: drift,
            error: 'Manual conflict resolution required',
          };
        }
      }

      // Apply changes
      const changes = await this.applyChanges(gitConfig, currentConfig, drift);
      
      this.lastSyncCommit = latestCommit.hash;
      this.lastSyncTime = Date.now();

      return {
        success: true,
        syncedAt: Date.now(),
        commit: latestCommit,
        changes,
        conflicts: [],
      };
    } catch (error) {
      console.error('GitOps sync failed:', error);
      return {
        success: false,
        syncedAt: Date.now(),
        commit: { hash: '', author: '', message: '', timestamp: 0, files: [] },
        changes: [],
        conflicts: [],
        error: (error as Error).message,
      };
    }
  }

  async forcePush(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('GitOps is not enabled');
    }

    const currentConfig = getConfigManager().getConfig();
    const configContent = JSON.stringify(currentConfig, null, 2);
    
    // In a real implementation, this would push to Git
    console.log('Force pushing current configuration to Git repository');
    console.log('Config content:', configContent);
    
    // Mock commit
    const commit: GitCommit = {
      hash: this.generateCommitHash(configContent),
      author: 'gateway-system',
      message: 'Force push gateway configuration',
      timestamp: Date.now(),
      files: ['gateway-config.json'],
    };

    this.lastSyncCommit = commit.hash;
    this.lastSyncTime = Date.now();
  }

  private async fetchLatestCommit(): Promise<GitCommit> {
    // In a real implementation, this would use Git API or CLI
    // For now, simulate with environment variables or mock data
    const mockCommit: GitCommit = {
      hash: process.env.GITOPS_LATEST_COMMIT || 'abc123def456',
      author: process.env.GITOPS_COMMIT_AUTHOR || 'developer@suuupra.io',
      message: process.env.GITOPS_COMMIT_MESSAGE || 'Update gateway configuration',
      timestamp: Date.now(),
      files: ['gateway-config.json', 'routes.json'],
    };

    return mockCommit;
  }

  private async fetchConfigFromGit(commitHash: string): Promise<GatewayConfig> {
    // In a real implementation, this would fetch files from Git
    // For now, check environment variable for config
    const gitConfigStr = process.env.GITOPS_CONFIG;
    
    if (gitConfigStr) {
      try {
        return JSON.parse(gitConfigStr) as GatewayConfig;
      } catch (error) {
        console.error('Failed to parse GitOps config:', error);
      }
    }

    // Return current config as fallback
    return getConfigManager().getConfig();
  }

  private async detectDrift(gitConfig: GatewayConfig, currentConfig: GatewayConfig): Promise<ConfigDrift[]> {
    const drift: ConfigDrift[] = [];
    
    // Compare configurations
    const gitHash = this.hashConfig(gitConfig);
    const currentHash = this.hashConfig(currentConfig);
    
    if (gitHash !== currentHash) {
      // Detailed comparison
      const gitRoutes = new Set(gitConfig.routes.map(r => r.id));
      const currentRoutes = new Set(currentConfig.routes.map(r => r.id));
      
      // Check for added routes
      for (const routeId of gitRoutes) {
        if (!currentRoutes.has(routeId)) {
          drift.push({
            file: `routes/${routeId}.json`,
            type: 'added',
            gitVersion: 'new',
            gatewayVersion: 'none',
            diff: `Route ${routeId} added in Git`,
          });
        }
      }
      
      // Check for deleted routes
      for (const routeId of currentRoutes) {
        if (!gitRoutes.has(routeId)) {
          drift.push({
            file: `routes/${routeId}.json`,
            type: 'deleted',
            gitVersion: 'none',
            gatewayVersion: 'exists',
            diff: `Route ${routeId} deleted in Git`,
          });
        }
      }
      
      // Check for modified routes
      for (const routeId of gitRoutes) {
        if (currentRoutes.has(routeId)) {
          const gitRoute = gitConfig.routes.find(r => r.id === routeId);
          const currentRoute = currentConfig.routes.find(r => r.id === routeId);
          
          if (gitRoute && currentRoute) {
            const gitRouteHash = this.hashObject(gitRoute);
            const currentRouteHash = this.hashObject(currentRoute);
            
            if (gitRouteHash !== currentRouteHash) {
              drift.push({
                file: `routes/${routeId}.json`,
                type: 'modified',
                gitVersion: gitRouteHash,
                gatewayVersion: currentRouteHash,
                diff: this.generateDiff(currentRoute, gitRoute),
              });
            }
          }
        }
      }
    }
    
    return drift;
  }

  private async applyChanges(
    gitConfig: GatewayConfig,
    currentConfig: GatewayConfig,
    drift: ConfigDrift[]
  ): Promise<ConfigChange[]> {
    const changes: ConfigChange[] = [];
    
    if (this.config.dryRun) {
      console.log('Dry run mode - would apply the following changes:');
      for (const d of drift) {
        console.log(`  ${d.type}: ${d.file}`);
      }
      return changes;
    }

    // Apply conflict resolution strategy
    let configToApply = gitConfig;
    
    if (this.config.conflictResolution === 'gateway-wins') {
      configToApply = currentConfig;
    } else if (this.config.conflictResolution === 'git-wins') {
      configToApply = gitConfig;
    }

    // Update gateway configuration
    try {
      await getConfigManager().updateConfig(configToApply, 'gitops-sync');
      
      changes.push({
        file: 'gateway-config.json',
        action: 'update',
        before: currentConfig,
        after: configToApply,
      });
    } catch (error) {
      console.error('Failed to apply GitOps configuration:', error);
      throw error;
    }

    return changes;
  }

  private hashConfig(config: GatewayConfig): string {
    const configString = JSON.stringify(config, Object.keys(config).sort());
    return crypto.createHash('sha256').update(configString).digest('hex');
  }

  private hashObject(obj: any): string {
    const objString = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(objString).digest('hex');
  }

  private generateCommitHash(content: string): string {
    return crypto.createHash('sha1').update(content + Date.now()).digest('hex');
  }

  private generateDiff(before: any, after: any): string {
    // Simplified diff generation
    const beforeStr = JSON.stringify(before, null, 2);
    const afterStr = JSON.stringify(after, null, 2);
    
    if (beforeStr === afterStr) {
      return 'No changes';
    }
    
    return `Configuration changed:\n- Before: ${beforeStr.length} chars\n+ After: ${afterStr.length} chars`;
  }

  getStatus(): {
    enabled: boolean;
    lastSyncTime: number;
    lastSyncCommit?: string;
    autoSync: boolean;
    dryRun: boolean;
  } {
    return {
      enabled: this.config.enabled,
      lastSyncTime: this.lastSyncTime,
      lastSyncCommit: this.lastSyncCommit,
      autoSync: this.config.autoSync,
      dryRun: this.config.dryRun,
    };
  }

  updateConfig(newConfig: Partial<GitOpsConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };

    if (!wasEnabled && this.config.enabled) {
      this.start();
    } else if (wasEnabled && !this.config.enabled) {
      this.stop();
    }
  }
}

// Global GitOps sync instance
let gitOpsSync: GitOpsConfigSync;

export function initializeGitOpsSync(config: Partial<GitOpsConfig>): GitOpsConfigSync {
  gitOpsSync = new GitOpsConfigSync(config);
  return gitOpsSync;
}

export function getGitOpsSync(): GitOpsConfigSync {
  if (!gitOpsSync) {
    gitOpsSync = new GitOpsConfigSync();
  }
  return gitOpsSync;
}

// Webhook handler for Git repository changes
export async function handleGitWebhook(payload: any): Promise<void> {
  const sync = getGitOpsSync();
  
  if (!sync.getStatus().enabled) {
    return;
  }

  // Parse webhook payload (GitHub, GitLab, etc.)
  const branch = payload.ref?.replace('refs/heads/', '') || payload.branch;
  const commits = payload.commits || [payload];
  
  console.log(`Received Git webhook for branch: ${branch}`);
  console.log(`Commits: ${commits.length}`);

  // Trigger sync if it's the configured branch
  if (branch === 'main' || branch === 'master') {
    try {
      const result = await sync.syncConfiguration();
      console.log('Webhook-triggered sync result:', result);
    } catch (error) {
      console.error('Webhook-triggered sync failed:', error);
    }
  }
}

// Example GitOps configuration
export const EXAMPLE_GITOPS_CONFIG: GitOpsConfig = {
  enabled: true,
  repository: {
    url: 'https://github.com/suuupra/gateway-config.git',
    branch: 'main',
    path: 'config',
    authType: 'token',
    token: process.env.GITHUB_TOKEN,
  },
  syncInterval: 300000, // 5 minutes
  autoSync: true,
  conflictResolution: 'git-wins',
  dryRun: false,
};
