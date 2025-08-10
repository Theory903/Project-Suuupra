/**
 * What: Declarative gateway configuration (services registry, routes, policies)
 * Why: Keep behavior data-driven and hot-reloadable; decouple code from config
 * How: Export a typed `gatewayConfig` consumed by routing/proxy subsystems
 */

import { GatewayConfig } from '../types/gateway';

export const serviceRegistry: Record<string, string> = {
  identity: 'http://localhost:8081',
  content: 'http://localhost:8082',
  commerce: 'http://localhost:8083',
  payments: 'http://localhost:8084',
  ledger: 'http://localhost:8085',
  'live-classes': 'http://localhost:8086',
  vod: 'http://localhost:8087',
  'mass-live': 'http://localhost:8088',
  'creator-studio': 'http://localhost:8089',
  recommendations: 'http://localhost:8090',
  'search-crawler': 'http://localhost:8091',
  'llm-tutor': 'http://localhost:8092',
  analytics: 'http://localhost:8093',
  counters: 'http://localhost:8094',
  'live-tracking': 'http://localhost:8095',
  notifications: 'http://localhost:8096',
  admin: 'http://localhost:8097',
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
        // For local testing, do not require JWT for identity proxy route
        auth: { requireJwt: false },
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


