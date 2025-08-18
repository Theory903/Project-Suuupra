// ===================================================================
// ENHANCED API GATEWAY CONFIGURATION - PHASE 2 PRODUCTION-READY
// Integrates with Database Schemas & Kafka Event Streams
// ===================================================================

import { GatewayConfig, RouteConfig } from '../services/api-gateway/src/types/gateway';

// Enhanced service registry with health check and load balancer configurations
export const enhancedServiceRegistry: Record<string, {
  url: string;
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
  loadBalancer: {
    algorithm: 'round-robin' | 'weighted' | 'least-connections';
    maxConnections: number;
    connectionTimeout: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
  };
}> = {
  identity: {
    url: process.env.IDENTITY_SERVICE_URL || 'http://identity-service:8081',
    healthCheck: {
      path: '/health',
      interval: 30000,
      timeout: 5000,
      unhealthyThreshold: 3,
      healthyThreshold: 2
    },
    loadBalancer: {
      algorithm: 'least-connections',
      maxConnections: 100,
      connectionTimeout: 10000
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    }
  },
  content: {
    url: process.env.CONTENT_SERVICE_URL || 'http://content-service:8082',
    healthCheck: {
      path: '/health',
      interval: 30000,
      timeout: 5000,
      unhealthyThreshold: 3,
      healthyThreshold: 2
    },
    loadBalancer: {
      algorithm: 'round-robin',
      maxConnections: 200,
      connectionTimeout: 8000
    },
    circuitBreaker: {
      failureThreshold: 10,
      recoveryTimeout: 45000,
      monitoringPeriod: 60000
    }
  },
  commerce: {
    url: process.env.COMMERCE_SERVICE_URL || 'http://commerce-service:8083',
    healthCheck: {
      path: '/health',
      interval: 20000,
      timeout: 3000,
      unhealthyThreshold: 2,
      healthyThreshold: 1
    },
    loadBalancer: {
      algorithm: 'least-connections',
      maxConnections: 150,
      connectionTimeout: 6000
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 20000,
      monitoringPeriod: 30000
    }
  },
  payments: {
    url: process.env.PAYMENTS_SERVICE_URL || 'http://payments-service:8084',
    healthCheck: {
      path: '/health',
      interval: 15000, // More frequent for critical service
      timeout: 2000,
      unhealthyThreshold: 2,
      healthyThreshold: 1
    },
    loadBalancer: {
      algorithm: 'least-connections',
      maxConnections: 80,
      connectionTimeout: 5000
    },
    circuitBreaker: {
      failureThreshold: 3, // More sensitive for payments
      recoveryTimeout: 15000,
      monitoringPeriod: 30000
    }
  },
  'live-classes': {
    url: process.env.LIVE_CLASSES_SERVICE_URL || 'http://live-classes-service:8086',
    healthCheck: {
      path: '/health',
      interval: 30000,
      timeout: 5000,
      unhealthyThreshold: 3,
      healthyThreshold: 2
    },
    loadBalancer: {
      algorithm: 'weighted',
      maxConnections: 300,
      connectionTimeout: 12000
    },
    circuitBreaker: {
      failureThreshold: 8,
      recoveryTimeout: 60000,
      monitoringPeriod: 90000
    }
  },
  notifications: {
    url: process.env.NOTIFICATIONS_SERVICE_URL || 'http://notifications-service:8096',
    healthCheck: {
      path: '/health',
      interval: 45000,
      timeout: 6000,
      unhealthyThreshold: 4,
      healthyThreshold: 2
    },
    loadBalancer: {
      algorithm: 'round-robin',
      maxConnections: 120,
      connectionTimeout: 8000
    },
    circuitBreaker: {
      failureThreshold: 6,
      recoveryTimeout: 40000,
      monitoringPeriod: 60000
    }
  },
  analytics: {
    url: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8093',
    healthCheck: {
      path: '/health',
      interval: 60000, // Less frequent for analytics
      timeout: 10000,
      unhealthyThreshold: 5,
      healthyThreshold: 3
    },
    loadBalancer: {
      algorithm: 'round-robin',
      maxConnections: 180,
      connectionTimeout: 15000
    },
    circuitBreaker: {
      failureThreshold: 12,
      recoveryTimeout: 90000,
      monitoringPeriod: 120000
    }
  }
};

// Production-ready gateway configuration with comprehensive policies
export const enhancedGatewayConfig: GatewayConfig = {
  // Enable all production features
  features: {
    // Core routing and protocols
    requestRouting: true,
    protocolHttp2: true,
    protocolWebsocket: true,
    protocolGrpc: false, // Enable if needed for specific services
    transforms: true,
    cors: true,
    staticAssetProxy: false,

    // Authentication and authorization
    jwt: true,
    oauthOidc: true,
    sessions: true,
    rbac: true,
    apiKeys: true,
    multiTenant: true,

    // Traffic management and resilience
    rateLimiting: true,
    throttling: true,
    retries: true,
    perRouteTimeouts: true,
    circuitBreakers: true,
    requestQueueing: true,

    // AI capabilities
    aiStreamingProxy: true,
    aiBatching: true,
    aiModelRouting: true,
    aiContextInjection: true,

    // Cloud-native features
    serviceDiscovery: true,
    healthChecks: true,
    multiCdnRouting: false, // Enable when CDN is configured
    credentialProxying: true,
    k8sIngressCompatible: true,

    // Observability
    prometheusMetrics: true,
    structuredLogging: true,
    openTelemetry: true,
    debugDashboard: true,
    trafficReplay: false, // Enable for debugging if needed

    // Admin and development
    adminApi: true,
    hotReload: true,
    secretsMgmt: true,
    pluginSystem: true,
    dashboardUi: true,

    // Security and compliance
    tlsTermination: true,
    mTlsInternal: true,
    ipAllowDeny: true,
    waf: true,
    signedUrlProxy: true,
    auditLogging: true,

    // Media and content
    websocketSessionMgr: true,
    drmHeaders: false, // Enable when DRM is required
    webrtcSfuRouting: true,
    bandwidthAwareRouting: true,

    // DevOps and platform
    blueGreen: true,
    canary: true,
    featureFlags: true,
    gitopsRoutes: true,
    multiEnvAwareness: true
  },

  // Enhanced admin configuration
  admin: {
    apiEnabled: true,
    hotReloadEnabled: true,
    secretsManagementEnabled: true,
    dashboardUiEnabled: true
  },

  // Comprehensive route configurations
  routes: [
    // ===================================================================
    // IDENTITY SERVICE ROUTES
    // ===================================================================
    {
      id: 'identity-auth',
      matcher: { 
        pathPrefix: '/api/v1/auth', 
        methods: ['POST', 'PUT', 'DELETE'],
        hostnames: ['api.suuupra.io', 'suuupra.io']
      },
      target: { 
        serviceName: 'identity', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' },
        healthCheck: {
          activeProbePath: '/health',
          intervalMs: 30000,
          unhealthyThreshold: 3,
          healthyThreshold: 2
        }
      },
      policy: {
        // No JWT required for auth endpoints
        auth: { requireJwt: false },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 10, // Strict rate limiting for auth
          intervalMs: 60000, 
          keys: ['ip'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 2, 
          backoffInitialMs: 100, 
          retryOnMethods: ['POST'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 8000, 
          connectTimeoutMs: 3000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 8000, 
          errorThresholdPercentage: 30, 
          resetTimeoutMs: 20000 
        },
        security: {
          ipAllowDenyEnabled: false, // Allow all for auth, but monitor
          wafEnabled: true,
          auditLoggingEnabled: true
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true
        }
      }
    },

    {
      id: 'identity-profile',
      matcher: { 
        pathPrefix: '/api/v1/user', 
        methods: ['GET', 'PUT', 'PATCH'] 
      },
      target: { 
        serviceName: 'identity', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-api', 'suuupra-web'],
          oidcDiscoveryUrl: process.env.OIDC_DISCOVERY_URL || 'http://identity-service:8081/.well-known/openid-configuration',
          jwksCacheMaxAgeMs: 3600000 // 1 hour
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 200, 
          intervalMs: 60000, 
          keys: ['user', 'ip'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 3, 
          backoffInitialMs: 50, 
          retryOnMethods: ['GET'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 6000, 
          connectTimeoutMs: 2000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 6000, 
          errorThresholdPercentage: 50, 
          resetTimeoutMs: 30000 
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true
        }
      }
    },

    // ===================================================================
    // CONTENT SERVICE ROUTES
    // ===================================================================
    {
      id: 'content-catalog',
      matcher: { 
        pathPrefix: '/api/v1/courses', 
        methods: ['GET'] 
      },
      target: { 
        serviceName: 'content', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: { requireJwt: false }, // Public course catalog
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 500, 
          intervalMs: 60000, 
          keys: ['ip'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 3, 
          backoffInitialMs: 100, 
          retryOnMethods: ['GET'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 10000, 
          connectTimeoutMs: 3000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 10000, 
          errorThresholdPercentage: 60, 
          resetTimeoutMs: 45000 
        },
        transforms: {
          responseHeadersAdd: {
            'Cache-Control': 'public, max-age=300', // 5 min cache for catalog
            'X-Content-Version': '1.0'
          }
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true 
        }
      }
    },

    {
      id: 'content-lessons',
      matcher: { 
        pathPrefix: '/api/v1/courses/{courseId}/lessons', 
        methods: ['GET', 'POST'] 
      },
      target: { 
        serviceName: 'content', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          requiredRoles: ['student', 'instructor', 'admin'],
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-api']
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 300, 
          intervalMs: 60000, 
          keys: ['user', 'route'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 2, 
          backoffInitialMs: 200, 
          retryOnMethods: ['GET'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 15000, // Longer for video content
          connectTimeoutMs: 4000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 15000, 
          errorThresholdPercentage: 50, 
          resetTimeoutMs: 60000 
        },
        ai: {
          contextInjectionEnabled: true,
          contextMapping: [
            {
              claimPath: 'sub',
              headerName: 'x-user-id',
              required: true
            },
            {
              claimPath: 'tier',
              headerName: 'x-user-tier',
              required: false
            }
          ]
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true
        }
      }
    },

    // ===================================================================
    // COMMERCE SERVICE ROUTES  
    // ===================================================================
    {
      id: 'commerce-orders',
      matcher: { 
        pathPrefix: '/api/v1/orders', 
        methods: ['GET', 'POST'] 
      },
      target: { 
        serviceName: 'commerce', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          requiredRoles: ['user', 'admin'],
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-api']
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 50, // Limit order creation
          intervalMs: 60000, 
          keys: ['user'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 2, 
          backoffInitialMs: 500, 
          retryOnMethods: ['GET'] // Don't retry order creation
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 12000, 
          connectTimeoutMs: 3000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 12000, 
          errorThresholdPercentage: 40, 
          resetTimeoutMs: 30000 
        },
        security: {
          auditLoggingEnabled: true, // Critical for commerce
          wafEnabled: true
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true
        }
      }
    },

    // ===================================================================
    // PAYMENTS SERVICE ROUTES (CRITICAL)
    // ===================================================================
    {
      id: 'payments-process',
      matcher: { 
        pathPrefix: '/api/v1/payments', 
        methods: ['POST', 'PUT'] 
      },
      target: { 
        serviceName: 'payments', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          requiredRoles: ['user', 'admin'],
          requiredScopes: ['payment:write'],
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-api']
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 20, // Very strict for payments
          intervalMs: 60000, 
          keys: ['user'] 
        },
        retry: { 
          enabled: false // Never retry payment attempts automatically
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 8000, // Short timeout for payments
          connectTimeoutMs: 2000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 8000, 
          errorThresholdPercentage: 25, // Very sensitive
          resetTimeoutMs: 15000 
        },
        security: {
          auditLoggingEnabled: true,
          wafEnabled: true,
          ipAllowDenyEnabled: false // Allow from anywhere but audit everything
        },
        cloud: {
          credentialProxyingEnabled: true // For payment provider APIs
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true,
          trafficReplayEnabled: false // Don't replay payment traffic
        }
      }
    },

    // ===================================================================
    // LIVE CLASSES SERVICE ROUTES
    // ===================================================================
    {
      id: 'live-sessions',
      matcher: { 
        pathPrefix: '/api/v1/live', 
        methods: ['GET', 'POST', 'PATCH'] 
      },
      target: { 
        serviceName: 'live-classes', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          requiredRoles: ['student', 'instructor', 'admin'],
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-api']
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 100, 
          intervalMs: 60000, 
          keys: ['user'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 2, 
          backoffInitialMs: 300, 
          retryOnMethods: ['GET'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 20000, // Longer for live content
          connectTimeoutMs: 5000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 20000, 
          errorThresholdPercentage: 60, 
          resetTimeoutMs: 60000 
        },
        media: {
          websocketSessionMgrEnabled: true,
          webrtcSfuRoutingEnabled: true,
          bandwidthAwareRoutingEnabled: true
        },
        ai: {
          streamingProxyEnabled: true, // For real-time features
          contextInjectionEnabled: true,
          contextMapping: [
            {
              claimPath: 'sub',
              headerName: 'x-user-id',
              required: true
            },
            {
              claimPath: 'roles',
              headerName: 'x-user-roles',
              transform: 'csv',
              required: true
            }
          ]
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true
        }
      }
    },

    // ===================================================================
    // NOTIFICATIONS SERVICE ROUTES
    // ===================================================================
    {
      id: 'notifications',
      matcher: { 
        pathPrefix: '/api/v1/notifications', 
        methods: ['GET', 'POST', 'PATCH'] 
      },
      target: { 
        serviceName: 'notifications', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-api']
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 150, 
          intervalMs: 60000, 
          keys: ['user'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 3, 
          backoffInitialMs: 200, 
          retryOnMethods: ['GET', 'POST'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 8000, 
          connectTimeoutMs: 3000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 8000, 
          errorThresholdPercentage: 70, 
          resetTimeoutMs: 40000 
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true 
        }
      }
    },

    // ===================================================================
    // ANALYTICS SERVICE ROUTES
    // ===================================================================
    {
      id: 'analytics-events',
      matcher: { 
        pathPrefix: '/api/v1/analytics', 
        methods: ['POST'] 
      },
      target: { 
        serviceName: 'analytics', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: { requireJwt: false }, // Allow anonymous analytics
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 1000, // High volume analytics
          intervalMs: 60000, 
          keys: ['ip'] 
        },
        retry: { 
          enabled: false // Don't retry analytics events
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 5000, // Quick timeout for analytics
          connectTimeoutMs: 2000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 5000, 
          errorThresholdPercentage: 80, // More tolerant for analytics
          resetTimeoutMs: 90000 
        },
        ai: {
          batchingEnabled: true, // Batch analytics events
          queueingEnabled: true,
          concurrencyLimit: 100
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: false // Reduce log noise for high-volume analytics
        }
      }
    },

    // ===================================================================
    // WEBSOCKET ROUTES FOR REAL-TIME FEATURES
    // ===================================================================
    {
      id: 'websocket-live',
      matcher: { 
        pathPrefix: '/ws/live', 
        methods: ['GET'] // WebSocket upgrade
      },
      target: { 
        serviceName: 'live-classes', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-ws']
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 10, // Limit concurrent WS connections
          intervalMs: 60000, 
          keys: ['user'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 300000, // 5 minutes for WS
          connectTimeoutMs: 10000 
        },
        media: {
          websocketSessionMgrEnabled: true
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true
        }
      }
    },

    // ===================================================================
    // ADMIN API ROUTES (RESTRICTED)
    // ===================================================================
    {
      id: 'admin-api',
      matcher: { 
        pathPrefix: '/admin/api', 
        methods: ['GET', 'POST', 'PUT', 'DELETE'] 
      },
      target: { 
        serviceName: 'admin', 
        discovery: { type: 'k8s', namespace: 'suuupra-services' }
      },
      policy: {
        auth: {
          requireJwt: true,
          requiredRoles: ['admin', 'super-admin'],
          requiredScopes: ['admin:read', 'admin:write'],
          issuer: process.env.OIDC_ISSUER || 'http://identity-service:8081',
          audience: ['suuupra-admin']
        },
        rateLimit: { 
          enabled: true, 
          tokensPerInterval: 30, // Strict limits for admin
          intervalMs: 60000, 
          keys: ['user'] 
        },
        retry: { 
          enabled: true, 
          maxAttempts: 1, // Minimal retries for admin operations
          backoffInitialMs: 1000, 
          retryOnMethods: ['GET'] 
        },
        timeout: { 
          enabled: true, 
          socketTimeoutMs: 15000, 
          connectTimeoutMs: 3000 
        },
        breaker: { 
          enabled: true, 
          timeoutMs: 15000, 
          errorThresholdPercentage: 30, 
          resetTimeoutMs: 20000 
        },
        security: {
          auditLoggingEnabled: true,
          ipAllowDenyEnabled: true,
          ipAllowList: [
            '10.0.0.0/8',    // Internal network
            '172.16.0.0/12', // Private network
            '192.168.0.0/16' // Local network
          ],
          wafEnabled: true
        },
        observability: { 
          prometheusMetricsEnabled: true, 
          structuredLoggingEnabled: true,
          openTelemetryEnabled: true,
          trafficReplayEnabled: true // For debugging admin issues
        }
      }
    }
  ]
};

// Kafka event integration configuration
export const kafkaIntegrationConfig = {
  brokers: [process.env.KAFKA_BROKERS || 'kafka:9092'],
  clientId: 'api-gateway',
  groupId: 'api-gateway-service',
  
  // Event publishing configuration
  eventPublishing: {
    enabled: true,
    topics: {
      gatewayEvents: 'gateway-events',
      userEvents: 'user-events',
      analyticsEvents: 'analytics-events'
    },
    batchSize: 100,
    batchTimeoutMs: 5000,
    retries: 3,
    compression: 'gzip'
  },

  // Event consumption configuration
  eventConsumption: {
    enabled: true,
    topics: ['user-events', 'gateway-events'],
    autoOffsetReset: 'latest',
    sessionTimeoutMs: 30000,
    heartbeatIntervalMs: 3000,
    maxPollRecords: 500
  }
};

// Environment-specific overrides
export const environmentOverrides = {
  development: {
    features: {
      debugDashboard: true,
      trafficReplay: true,
      hotReload: true
    },
    rateLimitMultiplier: 0.1, // Relaxed rate limits in dev
    timeoutMultiplier: 2.0,   // Longer timeouts in dev
    circuitBreakerSensitivity: 0.5 // Less sensitive circuit breakers
  },
  
  staging: {
    features: {
      debugDashboard: true,
      trafficReplay: false,
      hotReload: false
    },
    rateLimitMultiplier: 0.5, // Moderate rate limits in staging
    timeoutMultiplier: 1.5,
    circuitBreakerSensitivity: 0.75
  },
  
  production: {
    features: {
      debugDashboard: false,
      trafficReplay: false,
      hotReload: false
    },
    rateLimitMultiplier: 1.0, // Full rate limits in production
    timeoutMultiplier: 1.0,
    circuitBreakerSensitivity: 1.0
  }
};

// Database connection configuration for gateway
export const databaseConfig = {
  host: process.env.DB_HOST || 'postgres-primary',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'suuupra_platform',
  username: process.env.DB_USER || 'api_gateway_user',
  password: process.env.DB_PASSWORD || 'secure_password',
  
  // Connection pooling
  pool: {
    min: 5,
    max: 20,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 60000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA,
    key: process.env.DB_SSL_KEY,
    cert: process.env.DB_SSL_CERT
  } : false
};

// Cache configuration (Redis)
export const cacheConfig = {
  host: process.env.REDIS_HOST || 'redis-primary',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Connection options
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  
  // Clustering (if using Redis Cluster)
  cluster: {
    enabled: process.env.REDIS_CLUSTER === 'true',
    nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || ['redis:6379']
  },
  
  // TTL configurations for different data types
  ttl: {
    jwtTokens: 3600,        // 1 hour
    userSessions: 7200,     // 2 hours  
    apiKeys: 1800,          // 30 minutes
    routeConfig: 300,       // 5 minutes
    healthChecks: 60,       // 1 minute
    rateLimitWindows: 3600  // 1 hour
  }
};

// Export function to build environment-specific config
export function buildGatewayConfig(environment: string = 'production'): GatewayConfig {
  const baseConfig = { ...enhancedGatewayConfig };
  const overrides = environmentOverrides[environment as keyof typeof environmentOverrides];
  
  if (overrides) {
    // Apply environment-specific feature overrides
    baseConfig.features = { ...baseConfig.features, ...overrides.features };
    
    // Apply rate limit multipliers
    if (overrides.rateLimitMultiplier !== 1.0) {
      baseConfig.routes.forEach(route => {
        if (route.policy.rateLimit?.enabled && route.policy.rateLimit.tokensPerInterval) {
          route.policy.rateLimit.tokensPerInterval = Math.ceil(
            route.policy.rateLimit.tokensPerInterval * overrides.rateLimitMultiplier
          );
        }
      });
    }
    
    // Apply timeout multipliers
    if (overrides.timeoutMultiplier !== 1.0) {
      baseConfig.routes.forEach(route => {
        if (route.policy.timeout?.enabled) {
          if (route.policy.timeout.socketTimeoutMs) {
            route.policy.timeout.socketTimeoutMs = Math.ceil(
              route.policy.timeout.socketTimeoutMs * overrides.timeoutMultiplier
            );
          }
          if (route.policy.timeout.connectTimeoutMs) {
            route.policy.timeout.connectTimeoutMs = Math.ceil(
              route.policy.timeout.connectTimeoutMs * overrides.timeoutMultiplier
            );
          }
        }
      });
    }
    
    // Apply circuit breaker sensitivity
    if (overrides.circuitBreakerSensitivity !== 1.0) {
      baseConfig.routes.forEach(route => {
        if (route.policy.breaker?.enabled) {
          if (route.policy.breaker.errorThresholdPercentage) {
            route.policy.breaker.errorThresholdPercentage = Math.ceil(
              route.policy.breaker.errorThresholdPercentage / overrides.circuitBreakerSensitivity
            );
          }
        }
      });
    }
  }
  
  return baseConfig;
}

// Export enhanced configuration
export default {
  serviceRegistry: enhancedServiceRegistry,
  gatewayConfig: enhancedGatewayConfig,
  kafkaIntegration: kafkaIntegrationConfig,
  database: databaseConfig,
  cache: cacheConfig,
  buildGatewayConfig
};
