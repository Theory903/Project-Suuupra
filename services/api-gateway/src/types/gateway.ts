/**
 * What: Strongly-typed gateway configuration primitives (routes, policies, features)
 * Why: Centralize type definitions for clarity, IDE help, and safe evolution
 * How: Export granular interfaces composed into a top-level GatewayConfig
 */

export interface GatewayFeatureFlags {
  // Core
  requestRouting: boolean;
  protocolHttp2: boolean;
  protocolWebsocket: boolean;
  protocolGrpc: boolean;
  transforms: boolean;
  cors: boolean;
  staticAssetProxy: boolean;

  // AuthZ/AuthN
  jwt: boolean;
  oauthOidc: boolean;
  sessions: boolean;
  rbac: boolean;
  apiKeys: boolean;
  multiTenant: boolean;

  // Traffic & Resilience
  rateLimiting: boolean;
  throttling: boolean;
  retries: boolean;
  perRouteTimeouts: boolean;
  circuitBreakers: boolean;
  requestQueueing: boolean;

  // AI
  aiStreamingProxy: boolean;
  aiBatching: boolean;
  aiModelRouting: boolean;
  aiContextInjection: boolean;

  // Cloud-Native
  serviceDiscovery: boolean;
  healthChecks: boolean;
  multiCdnRouting: boolean;
  credentialProxying: boolean;
  k8sIngressCompatible: boolean;

  // Observability
  prometheusMetrics: boolean;
  structuredLogging: boolean;
  openTelemetry: boolean;
  debugDashboard: boolean;
  trafficReplay: boolean;

  // Admin + Dev UX
  adminApi: boolean;
  hotReload: boolean;
  secretsMgmt: boolean;
  pluginSystem: boolean;
  dashboardUi: boolean;

  // Security & Compliance
  tlsTermination: boolean;
  mTlsInternal: boolean;
  ipAllowDeny: boolean;
  waf: boolean;
  signedUrlProxy: boolean;
  auditLogging: boolean;

  // Content & Media
  websocketSessionMgr: boolean;
  drmHeaders: boolean;
  webrtcSfuRouting: boolean;
  bandwidthAwareRouting: boolean;

  // DevOps & Platform
  blueGreen: boolean;
  canary: boolean;
  featureFlags: boolean;
  gitopsRoutes: boolean;
  multiEnvAwareness: boolean;
}

export interface RouteMatcher {
  pathPrefix?: string;
  methods?: string[];
  hostnames?: string[];
  headerMatches?: Record<string, string | RegExp>;
}

export interface AuthPolicy {
  requireJwt?: boolean;
  requireApiKey?: boolean;
  requiredRoles?: string[];
  oauthOidcEnabled?: boolean;
  multiTenantEnabled?: boolean;

  // JWT/JWKS per-route configuration
  issuer?: string;
  audience?: string | string[];
  jwksUri?: string;
  oidcDiscoveryUrl?: string; // if provided, discover jwks_uri from here
  jwksCacheMaxAgeMs?: number; // cache lifetime for JWKS endpoints
  requiredScopes?: string[]; // optional OAuth scopes to enforce
}

export interface RateLimitPolicy {
  enabled?: boolean;
  tokensPerInterval?: number;
  intervalMs?: number;
  burstMultiplier?: number;
  keys?: Array<'ip' | 'user' | 'tenant' | 'route'>;
}

export interface RetryPolicy {
  enabled?: boolean;
  maxAttempts?: number; // includes the first attempt
  backoffInitialMs?: number;
  backoffJitterMs?: number;
  retryOnMethods?: string[];
  retryOnStatusCodes?: number[];
}

export interface TimeoutPolicy {
  enabled?: boolean;
  socketTimeoutMs?: number;
  connectTimeoutMs?: number;
}

export interface CircuitBreakerPolicy {
  enabled?: boolean;
  timeoutMs?: number;
  errorThresholdPercentage?: number;
  resetTimeoutMs?: number;
}

export interface AiPolicy {
  streamingProxyEnabled?: boolean;
  batchingEnabled?: boolean;
  modelRoutingEnabled?: boolean;
  contextInjectionEnabled?: boolean;
  concurrencyLimit?: number; // max in-flight per route
  queueingEnabled?: boolean; // if true, queue beyond limit instead of rejecting
  contextMapping?: ContextMappingRule[]; // safe claims → headers mapping
}

export interface ContextMappingRule {
  claimPath: string; // e.g., "sub", "user.id", "roles"
  headerName: string; // e.g., "x-user-id", "x-user-roles"
  transform?: 'string' | 'json' | 'csv'; // how to serialize the value
  required?: boolean; // fail request if claim is missing
}

export interface CloudPolicy {
  serviceDiscoveryEnabled?: boolean;
  healthChecksEnabled?: boolean;
  multiCdnRoutingEnabled?: boolean;
  credentialProxyingEnabled?: boolean;
  k8sIngressCompatible?: boolean;
}

export interface ObservabilityPolicy {
  prometheusMetricsEnabled?: boolean;
  structuredLoggingEnabled?: boolean;
  openTelemetryEnabled?: boolean;
  debugDashboardEnabled?: boolean;
  trafficReplayEnabled?: boolean;
}

export interface SecurityPolicy {
  tlsTerminationEnabled?: boolean;
  mTlsInternalEnabled?: boolean;
  ipAllowDenyEnabled?: boolean;
  ipAllowList?: string[];
  ipDenyList?: string[];
  wafEnabled?: boolean;
  signedUrlProxyEnabled?: boolean;
  signedUrlSecret?: string;
  auditLoggingEnabled?: boolean;
}

export interface MediaPolicy {
  websocketSessionMgrEnabled?: boolean;
  drmHeadersEnabled?: boolean;
  webrtcSfuRoutingEnabled?: boolean;
  bandwidthAwareRoutingEnabled?: boolean;
}

export interface DevOpsPolicy {
  blueGreenEnabled?: boolean;
  canaryEnabled?: boolean;
  featureFlagsEnabled?: boolean;
  gitopsRoutesEnabled?: boolean;
  multiEnvAwarenessEnabled?: boolean;
}

export interface RoutePolicy {
  auth?: AuthPolicy;
  rateLimit?: RateLimitPolicy;
  retry?: RetryPolicy;
  timeout?: TimeoutPolicy;
  breaker?: CircuitBreakerPolicy;
  ai?: AiPolicy;
  cloud?: CloudPolicy;
  observability?: ObservabilityPolicy;
  security?: SecurityPolicy;
  media?: MediaPolicy;
  devops?: DevOpsPolicy;
  transforms?: TransformsPolicy;
}

export interface TransformsPolicy {
  requestHeadersAdd?: Record<string, string>;
  requestHeadersRemove?: string[];
  responseHeadersAdd?: Record<string, string>;
  responseHeadersRemove?: string[];
}

export interface DiscoveryConfig {
  type: 'static' | 'dns' | 'k8s' | 'consul';
  name?: string;
  namespace?: string;
}

export interface HealthCheckConfig {
  activeProbePath?: string;
  intervalMs?: number;
  unhealthyThreshold?: number;
  healthyThreshold?: number;
}

export interface ServiceTarget {
  serviceName: string;
  discovery: DiscoveryConfig;
  healthCheck?: HealthCheckConfig;
}

export interface RouteConfig {
  id: string;
  matcher: RouteMatcher;
  target: ServiceTarget;
  policy: RoutePolicy;
}

export interface AdminConfig {
  apiEnabled: boolean;
  hotReloadEnabled: boolean;
  secretsManagementEnabled: boolean;
  dashboardUiEnabled?: boolean;
}

export interface PluginContext {
  route: RouteConfig;
}

export type PluginOnRequest = (req: any, ctx: PluginContext) => Promise<void> | void;
export type PluginOnResponse = (res: any, ctx: PluginContext) => Promise<void> | void;
export type PluginOnError = (err: unknown, ctx: PluginContext) => Promise<void> | void;

export interface PluginRegistration {
  name: string;
  onRequest?: PluginOnRequest;
  onResponse?: PluginOnResponse;
  onError?: PluginOnError;
}

export interface GatewayConfig {
  routes: RouteConfig[];
  admin: AdminConfig;
  features: Partial<GatewayFeatureFlags>;
}


