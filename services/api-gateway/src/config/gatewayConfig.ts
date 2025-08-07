/**
 * What: Declarative gateway configuration (services registry, routes, policies)
 * Why: Keep behavior data-driven and hot-reloadable; decouple code from config
 * How: Export a typed `gatewayConfig` consumed by routing/proxy subsystems
 */

import { GatewayConfig } from '../types/gateway';

export const serviceRegistry: Record<string, string> = {
  identity: 'http://localhost:3001',
  content: 'http://localhost:3002',
  commerce: 'http://localhost:3003',
  payments: 'http://localhost:3004',
  ledger: 'http://localhost:3005',
  'live-classes': 'http://localhost:3006',
  vod: 'http://localhost:3007',
  'mass-live': 'http://localhost:3008',
  'creator-studio': 'http://localhost:3009',
  recommendations: 'http://localhost:3010',
  'search-crawler': 'http://localhost:3011',
  'llm-tutor': 'http://localhost:3012',
  analytics: 'http://localhost:3013',
  counters: 'http://localhost:3014',
  'live-tracking': 'http://localhost:3015',
  notifications: 'http://localhost:3016',
  admin: 'http://localhost:3017',
};

export const gatewayConfig: GatewayConfig = {
  features: {
    requestRouting: true,
    protocolHttp2: false,
    protocolWebsocket: true,
    protocolGrpc: false,
    transforms: true,
    cors: true,
    staticAssetProxy: false,
    jwt: true,
    oauthOidc: false,
    sessions: false,
    rbac: true,
    apiKeys: true,
    multiTenant: true,
    rateLimiting: true,
    throttling: true,
    retries: true,
    perRouteTimeouts: true,
    circuitBreakers: true,
    requestQueueing: false,
    aiStreamingProxy: true,
    aiBatching: false,
    aiModelRouting: false,
    aiContextInjection: true,
    serviceDiscovery: true,
    healthChecks: false,
    multiCdnRouting: false,
    credentialProxying: false,
    k8sIngressCompatible: true,
    prometheusMetrics: true,
    structuredLogging: true,
    openTelemetry: false,
    debugDashboard: false,
    trafficReplay: false,
    adminApi: false,
    hotReload: false,
    secretsMgmt: false,
    pluginSystem: true,
    dashboardUi: false,
    tlsTermination: false,
    mTlsInternal: false,
    ipAllowDeny: false,
    waf: false,
    signedUrlProxy: true,
    auditLogging: true,
    websocketSessionMgr: true,
    drmHeaders: false,
    webrtcSfuRouting: false,
    bandwidthAwareRouting: false,
    blueGreen: false,
    canary: false,
    featureFlags: true,
    gitopsRoutes: false,
    multiEnvAwareness: true,
  },
  admin: {
    apiEnabled: false,
    hotReloadEnabled: false,
    secretsManagementEnabled: false,
  },
  routes: [
    {
      id: 'identity-default',
      matcher: { pathPrefix: '/identity', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
      target: { serviceName: 'identity', discovery: { type: 'static' } },
      policy: {
        auth: { requireJwt: true },
        rateLimit: { enabled: true, tokensPerInterval: 100, intervalMs: 60_000, keys: ['ip', 'user'] },
        retry: { enabled: true, maxAttempts: 2, backoffInitialMs: 50, backoffJitterMs: 25, retryOnMethods: ['GET'] },
        timeout: { enabled: true, socketTimeoutMs: 5_000, connectTimeoutMs: 1_000 },
        breaker: { enabled: true, timeoutMs: 5_000, errorThresholdPercentage: 50, resetTimeoutMs: 30_000 },
        observability: { prometheusMetricsEnabled: true, structuredLoggingEnabled: true },
      },
    },
  ],
};

export const GATEWAY_LLD_DOC_PATH = 'docs/design/gateway/LLD-APIGateway.md';


