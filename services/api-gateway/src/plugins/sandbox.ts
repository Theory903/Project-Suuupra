/**
 * What: Plugin sandbox system for custom request/response/error/stream hooks
 * Why: Enable extensibility while maintaining security and isolation
 * How: VM-based sandbox with limited API surface and resource constraints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { RouteConfig, PluginRegistration } from '../types/gateway';
import vm from 'vm';
import { Transform } from 'stream';

export interface PluginContext {
  route: RouteConfig;
  correlationId: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface PluginExecutionResult {
  success: boolean;
  error?: string;
  modified?: boolean;
  metadata?: Record<string, any>;
}

export interface SandboxConfig {
  timeout: number;
  memoryLimit: number;
  allowedModules: string[];
  maxExecutions: number;
}

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  timeout: 5000, // 5 seconds
  memoryLimit: 50 * 1024 * 1024, // 50MB
  allowedModules: ['crypto', 'util', 'querystring'],
  maxExecutions: 1000,
};

class PluginSandbox {
  private config: SandboxConfig;
  private executionCount = 0;
  private context: vm.Context;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.context = this.createSandboxContext();
  }

  private createSandboxContext(): vm.Context {
    const sandbox = {
      // Global objects
      console: {
        log: (...args: any[]) => console.log('[PLUGIN]', ...args),
        warn: (...args: any[]) => console.warn('[PLUGIN]', ...args),
        error: (...args: any[]) => console.error('[PLUGIN]', ...args),
      },
      
      // Utility functions
      JSON: JSON,
      Math: Math,
      Date: Date,
      RegExp: RegExp,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Array: Array,
      Object: Object,
      
      // Safe require for allowed modules
      require: (moduleName: string) => {
        if (this.config.allowedModules.includes(moduleName)) {
          return require(moduleName);
        }
        throw new Error(`Module '${moduleName}' is not allowed in plugin sandbox`);
      },

      // Plugin API
      setHeader: (headers: Record<string, any>, key: string, value: string) => {
        headers[key.toLowerCase()] = value;
      },
      
      removeHeader: (headers: Record<string, any>, key: string) => {
        delete headers[key.toLowerCase()];
      },

      getHeader: (headers: Record<string, any>, key: string) => {
        return headers[key.toLowerCase()];
      },

      parseJSON: (str: string) => {
        try {
          return JSON.parse(str);
        } catch {
          return null;
        }
      },

      base64Encode: (str: string) => Buffer.from(str).toString('base64'),
      base64Decode: (str: string) => Buffer.from(str, 'base64').toString(),

      urlEncode: (str: string) => encodeURIComponent(str),
      urlDecode: (str: string) => decodeURIComponent(str),

      // Metadata storage
      setMetadata: (ctx: PluginContext, key: string, value: any) => {
        ctx.metadata = ctx.metadata || {};
        ctx.metadata[key] = value;
      },

      getMetadata: (ctx: PluginContext, key: string) => {
        return ctx.metadata?.[key];
      },
    };

    return vm.createContext(sandbox);
  }

  async executePlugin(
    plugin: PluginRegistration,
    hookType: 'onRequest' | 'onResponse' | 'onError' | 'onStream',
    req: FastifyRequest,
    reply?: FastifyReply,
    context?: PluginContext,
    error?: unknown
  ): Promise<PluginExecutionResult> {
    if (this.executionCount >= this.config.maxExecutions) {
      return { success: false, error: 'Plugin execution limit exceeded' };
    }

    this.executionCount++;

    const hook = plugin[hookType];
    if (!hook) {
      return { success: true };
    }

    try {
      // Prepare sandbox globals
      const sandboxGlobals = {
        request: this.sanitizeRequest(req),
        response: reply ? this.sanitizeResponse(reply) : undefined,
        context: context || {},
        error: error ? { message: String(error), name: 'Error' } : undefined,
      };

      // Inject globals into sandbox
      Object.assign(this.context, sandboxGlobals);

      // Create the execution wrapper
      const code = `
        (async function() {
          const pluginFunction = ${hook.toString()};
          return await pluginFunction(request, context);
        })()
      `;

      // Execute with timeout
      const result = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Plugin execution timeout'));
        }, this.config.timeout);

        try {
          const script = new vm.Script(code);
          const promise = script.runInContext(this.context, {
            timeout: this.config.timeout,
            displayErrors: true,
          });

          if (promise && typeof promise.then === 'function') {
            promise
              .then((res: any) => {
                clearTimeout(timeout);
                resolve(res);
              })
              .catch((err: any) => {
                clearTimeout(timeout);
                reject(err);
              });
          } else {
            clearTimeout(timeout);
            resolve(promise);
          }
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });

      return {
        success: true,
        modified: Boolean(result?.modified),
        metadata: result?.metadata,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Plugin execution failed',
      };
    }
  }

  private sanitizeRequest(req: FastifyRequest): any {
    return {
      method: req.method,
      url: req.url,
      headers: { ...req.headers },
      query: req.query,
      params: req.params,
      body: req.body,
      ip: req.ip,
      hostname: req.hostname,
    };
  }

  private sanitizeResponse(reply: FastifyReply): any {
    return {
      statusCode: reply.statusCode,
      headers: { ...reply.getHeaders() },
    };
  }

  reset(): void {
    this.executionCount = 0;
    this.context = this.createSandboxContext();
  }

  getStats(): { executionCount: number; maxExecutions: number } {
    return {
      executionCount: this.executionCount,
      maxExecutions: this.config.maxExecutions,
    };
  }
}

// Global plugin registry
const pluginRegistry = new Map<string, PluginRegistration>();
const sandboxes = new Map<string, PluginSandbox>();

export function registerPlugin(plugin: PluginRegistration, config?: Partial<SandboxConfig>): void {
  pluginRegistry.set(plugin.name, plugin);
  sandboxes.set(plugin.name, new PluginSandbox(config));
}

export function unregisterPlugin(name: string): boolean {
  const removed = pluginRegistry.delete(name);
  sandboxes.delete(name);
  return removed;
}

export function listPlugins(): string[] {
  return Array.from(pluginRegistry.keys());
}

export async function executePluginHook(
  hookType: 'onRequest' | 'onResponse' | 'onError' | 'onStream',
  req: FastifyRequest,
  reply?: FastifyReply,
  context?: PluginContext,
  error?: unknown
): Promise<PluginExecutionResult[]> {
  const results: PluginExecutionResult[] = [];

  for (const [name, plugin] of pluginRegistry.entries()) {
    const sandbox = sandboxes.get(name);
    if (!sandbox) continue;

    try {
      const result = await sandbox.executePlugin(plugin, hookType, req, reply, context, error);
      results.push({ ...result, metadata: { ...result.metadata, pluginName: name } });
    } catch (error: any) {
      results.push({
        success: false,
        error: `Plugin ${name} failed: ${error.message}`,
        metadata: { pluginName: name },
      });
    }
  }

  return results;
}

// Example plugins
export const EXAMPLE_PLUGINS: PluginRegistration[] = [
  {
    name: 'request-logger',
    onRequest: async (req: any, ctx: any) => {
      console.log(`[${ctx.correlationId}] ${req.method} ${req.url}`);
      setMetadata(ctx, 'requestLogged', true);
      return { modified: false };
    },
  },
  {
    name: 'security-headers',
    onResponse: async (req: any, ctx: any) => {
      // This would be executed in the sandbox
      setHeader(req.headers, 'x-frame-options', 'DENY');
      setHeader(req.headers, 'x-content-type-options', 'nosniff');
      return { modified: true };
    },
  },
  {
    name: 'error-enricher',
    onError: async (req: any, ctx: any) => {
      console.error(`[${ctx.correlationId}] Error in route ${ctx.route.id}`);
      setMetadata(ctx, 'errorLogged', true);
      return { modified: false };
    },
  },
];

// Plugin management utilities
export function resetAllSandboxes(): void {
  for (const sandbox of sandboxes.values()) {
    sandbox.reset();
  }
}

export function getSandboxStats(): Record<string, any> {
  const stats: Record<string, any> = {};
  for (const [name, sandbox] of sandboxes.entries()) {
    stats[name] = sandbox.getStats();
  }
  return stats;
}
