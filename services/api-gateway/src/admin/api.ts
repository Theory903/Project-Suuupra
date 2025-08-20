/**
 * What: Admin API for CRUD operations on routes, services, and configuration
 * Why: Enable dynamic configuration management with audit trails and hot reload
 * How: REST API with validation, atomic config swaps, and audit logging
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RouteConfig, GatewayConfig } from '../types/gateway';
import * as crypto from 'crypto';
import { createApiKey, validateApiKey, revokeApiKey, listApiKeys, ApiKeyRecord } from '../middleware/apiKeys';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  changes?: any;
  success: boolean;
  error?: string;
}

class ConfigManager {
  private currentConfig: GatewayConfig;
  private auditLog: AuditLogEntry[] = [];
  private configVersion = 1;

  constructor(initialConfig: GatewayConfig) {
    this.currentConfig = JSON.parse(JSON.stringify(initialConfig));
  }

  async updateConfig(newConfig: Partial<GatewayConfig>, userId?: string): Promise<{ success: boolean; error?: string }> {
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'config_update',
      resource: 'gateway_config',
      userId,
      changes: newConfig,
      success: false,
    };

    try {
      // Validate config
      const merged = { ...this.currentConfig, ...newConfig };
      this.validateConfig(merged);

      // Atomic swap
      const oldConfig = this.currentConfig;
      this.currentConfig = merged;
      this.configVersion++;

      auditEntry.success = true;
      this.auditLog.push(auditEntry);

      // Trigger hot reload
      await this.notifyConfigChange();

      return { success: true };
    } catch (error: any) {
      auditEntry.error = error.message;
      this.auditLog.push(auditEntry);
      return { success: false, error: error.message };
    }
  }

  async addRoute(route: RouteConfig, userId?: string): Promise<{ success: boolean; error?: string }> {
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'route_create',
      resource: 'route',
      resourceId: route.id,
      userId,
      changes: route,
      success: false,
    };

    try {
      // Check for duplicate route ID
      if (this.currentConfig.routes.some(r => r.id === route.id)) {
        throw new Error(`Route with ID ${route.id} already exists`);
      }

      this.validateRoute(route);
      this.currentConfig.routes.push(route);
      this.configVersion++;

      auditEntry.success = true;
      this.auditLog.push(auditEntry);

      await this.notifyConfigChange();
      return { success: true };
    } catch (error: any) {
      auditEntry.error = error.message;
      this.auditLog.push(auditEntry);
      return { success: false, error: error.message };
    }
  }

  async updateRoute(routeId: string, updates: Partial<RouteConfig>, userId?: string): Promise<{ success: boolean; error?: string }> {
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'route_update',
      resource: 'route',
      resourceId: routeId,
      userId,
      changes: updates,
      success: false,
    };

    try {
      const routeIndex = this.currentConfig.routes.findIndex(r => r.id === routeId);
      if (routeIndex === -1) {
        throw new Error(`Route with ID ${routeId} not found`);
      }

      const updatedRoute = { ...this.currentConfig.routes[routeIndex], ...updates };
      this.validateRoute(updatedRoute);
      
      this.currentConfig.routes[routeIndex] = updatedRoute;
      this.configVersion++;

      auditEntry.success = true;
      this.auditLog.push(auditEntry);

      await this.notifyConfigChange();
      return { success: true };
    } catch (error: any) {
      auditEntry.error = error.message;
      this.auditLog.push(auditEntry);
      return { success: false, error: error.message };
    }
  }

  async deleteRoute(routeId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: 'route_delete',
      resource: 'route',
      resourceId: routeId,
      userId,
      success: false,
    };

    try {
      const routeIndex = this.currentConfig.routes.findIndex(r => r.id === routeId);
      if (routeIndex === -1) {
        throw new Error(`Route with ID ${routeId} not found`);
      }

      this.currentConfig.routes.splice(routeIndex, 1);
      this.configVersion++;

      auditEntry.success = true;
      this.auditLog.push(auditEntry);

      await this.notifyConfigChange();
      return { success: true };
    } catch (error: any) {
      auditEntry.error = error.message;
      this.auditLog.push(auditEntry);
      return { success: false, error: error.message };
    }
  }

  getConfig(): GatewayConfig {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }

  getRoutes(): RouteConfig[] {
    return JSON.parse(JSON.stringify(this.currentConfig.routes));
  }

  getRoute(routeId: string): RouteConfig | undefined {
    const route = this.currentConfig.routes.find(r => r.id === routeId);
    return route ? JSON.parse(JSON.stringify(route)) : undefined;
  }

  getAuditLog(limit = 100): AuditLogEntry[] {
    return this.auditLog.slice(-limit);
  }

  getConfigVersion(): number {
    return this.configVersion;
  }

  private validateConfig(config: GatewayConfig): void {
    if (!config.routes || !Array.isArray(config.routes)) {
      throw new Error('Config must have routes array');
    }

    for (const route of config.routes) {
      this.validateRoute(route);
    }
  }

  private validateRoute(route: RouteConfig): void {
    if (!route.id || typeof route.id !== 'string') {
      throw new Error('Route must have a valid ID');
    }

    if (!route.matcher || typeof route.matcher !== 'object') {
      throw new Error('Route must have a matcher object');
    }

    if (!route.target || !route.target.serviceName) {
      throw new Error('Route must have a target with serviceName');
    }

    if (!route.policy || typeof route.policy !== 'object') {
      throw new Error('Route must have a policy object');
    }
  }

  private async notifyConfigChange(): Promise<void> {
    // In a real implementation, this would notify all gateway instances
    console.log(`Config updated to version ${this.configVersion}`);
  }
}

// Global config manager instance
let configManager: ConfigManager;

export function initializeConfigManager(initialConfig: GatewayConfig): ConfigManager {
  configManager = new ConfigManager(initialConfig);
  return configManager;
}

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    throw new Error('Config manager not initialized');
  }
  return configManager;
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // Middleware to extract user from JWT
  const extractUser = async (request: FastifyRequest) => {
    const user = (request as any).user;
    return user?.sub || user?.id || 'unknown';
  };

  // Get current config
  app.get('/admin/config', async (request, reply) => {
    const config = getConfigManager().getConfig();
    reply.send({
      config,
      version: getConfigManager().getConfigVersion(),
    });
  });

  // Update config
  app.put('/admin/config', async (request, reply) => {
    const userId = await extractUser(request);
    const updates = request.body as Partial<GatewayConfig>;
    
    const result = await getConfigManager().updateConfig(updates, userId);
    
    if (result.success) {
      reply.send({ success: true, version: getConfigManager().getConfigVersion() });
    } else {
      reply.status(400).send({ success: false, error: result.error });
    }
  });

  // List routes
  app.get('/admin/routes', async (request, reply) => {
    const routes = getConfigManager().getRoutes();
    reply.send({ routes });
  });

  // Get specific route
  app.get('/admin/routes/:routeId', async (request, reply) => {
    const { routeId } = request.params as { routeId: string };
    const route = getConfigManager().getRoute(routeId);
    
    if (!route) {
      reply.status(404).send({ error: 'Route not found' });
      return;
    }
    
    reply.send({ route });
  });

  // Create route
  app.post('/admin/routes', async (request, reply) => {
    const userId = await extractUser(request);
    const route = request.body as RouteConfig;
    
    const result = await getConfigManager().addRoute(route, userId);
    
    if (result.success) {
      reply.status(201).send({ success: true, routeId: route.id });
    } else {
      reply.status(400).send({ success: false, error: result.error });
    }
  });

  // Update route
  app.put('/admin/routes/:routeId', async (request, reply) => {
    const userId = await extractUser(request);
    const { routeId } = request.params as { routeId: string };
    const updates = request.body as Partial<RouteConfig>;
    
    const result = await getConfigManager().updateRoute(routeId, updates, userId);
    
    if (result.success) {
      reply.send({ success: true });
    } else {
      reply.status(400).send({ success: false, error: result.error });
    }
  });

  // Delete route
  app.delete('/admin/routes/:routeId', async (request, reply) => {
    const userId = await extractUser(request);
    const { routeId } = request.params as { routeId: string };
    
    const result = await getConfigManager().deleteRoute(routeId, userId);
    
    if (result.success) {
      reply.send({ success: true });
    } else {
      reply.status(400).send({ success: false, error: result.error });
    }
  });

  // Get audit log
  app.get('/admin/audit', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const auditLog = getConfigManager().getAuditLog(limit ? parseInt(limit) : 100);
    reply.send({ auditLog });
  });

  // Health check
  app.get('/admin/health', async (request, reply) => {
    reply.send({
      status: 'healthy',
      version: getConfigManager().getConfigVersion(),
      timestamp: Date.now(),
    });
  });

  // API Key management routes
  
  // List API keys
  app.get('/admin/api-keys', async (request, reply) => {
    try {
      const keys = await listApiKeys();
      // Remove sensitive data
      const sanitized = keys.map(key => ({
        id: key.id,
        name: key.name,
        scopes: key.scopes,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        isActive: key.isActive,
        metadata: key.metadata,
      }));
      reply.send({ keys: sanitized });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  // Create API key
  app.post('/admin/api-keys', async (request, reply) => {
    const userId = await extractUser(request);
    const { name, scopes, expiresAt, metadata } = request.body as {
      name: string;
      scopes?: string[];
      expiresAt?: number;
      metadata?: Record<string, any>;
    };

    if (!name) {
      reply.status(400).send({ error: 'Name is required' });
      return;
    }

    try {
      const { key, record } = await createApiKey(name, scopes, expiresAt, metadata);
      
      // Log the creation
      getConfigManager().getAuditLog().push({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: 'api_key_create',
        resource: 'api_key',
        resourceId: record.id,
        userId,
        changes: { name, scopes, expiresAt },
        success: true,
      });

      reply.status(201).send({
        key, // Return the actual key only once
        record: {
          id: record.id,
          name: record.name,
          scopes: record.scopes,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          isActive: record.isActive,
        },
      });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  // Update API key (scopes, metadata, active status)
  app.put('/admin/api-keys/:keyId', async (request, reply) => {
    const userId = await extractUser(request);
    const { keyId } = request.params as { keyId: string };
    const { scopes, metadata, isActive } = request.body as {
      scopes?: string[];
      metadata?: Record<string, any>;
      isActive?: boolean;
    };

    try {
      // Validate input
      if (scopes && !Array.isArray(scopes)) {
        return reply.status(400).send({ error: 'Scopes must be an array' });
      }
      
      if (metadata && typeof metadata !== 'object') {
        return reply.status(400).send({ error: 'Metadata must be an object' });
      }
      
      // Import the updateApiKey function (assuming it exists or needs to be created)
      const { updateApiKey } = await import('../services/apiKeys');
      
      const updatedKey = await updateApiKey(keyId, {
        scopes: scopes || undefined,
        metadata: metadata || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      });
      
      if (!updatedKey) {
        return reply.status(404).send({ error: 'API key not found' });
      }
      
      // Log the update for audit purposes
      const auditLog = {
        action: 'api_key_updated',
        keyId: keyId,
        updatedBy: userId,
        changes: { scopes, metadata, isActive },
        timestamp: new Date().toISOString()
      };
      
      // Store audit log (this would typically go to a dedicated audit service)
      logger.info('API key updated', auditLog);
      
      reply.send({
        message: 'API key updated successfully',
        keyId: updatedKey.keyId,
        updatedAt: updatedKey.updatedAt
      });
      
    } catch (error) {
      logger.error('Failed to update API key', { keyId, userId, error: error.message });
      reply.status(500).send({ 
        error: 'Internal server error', 
        details: error.message 
      });
    }
  });

  // Revoke API key
  app.delete('/admin/api-keys/:keyId', async (request, reply) => {
    const userId = await extractUser(request);
    const { keyId } = request.params as { keyId: string };

    try {
      const success = await revokeApiKey(keyId);
      
      if (success) {
        // Log the revocation
        getConfigManager().getAuditLog().push({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          action: 'api_key_revoke',
          resource: 'api_key',
          resourceId: keyId,
          userId,
          success: true,
        });

        reply.send({ success: true });
      } else {
        reply.status(404).send({ error: 'API key not found' });
      }
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  // Validate API key (for testing)
  app.post('/admin/api-keys/validate', async (request, reply) => {
    const { key } = request.body as { key: string };
    
    if (!key) {
      reply.status(400).send({ error: 'Key is required' });
      return;
    }

    try {
      const result = await validateApiKey(key);
      reply.send({
        valid: result.valid,
        error: result.error,
        keyInfo: result.keyRecord ? {
          id: result.keyRecord.id,
          name: result.keyRecord.name,
          scopes: result.keyRecord.scopes,
          lastUsedAt: result.keyRecord.lastUsedAt,
        } : undefined,
      });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });
}
