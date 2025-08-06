# 🚪 API Gateway Service - Comprehensive Implementation Guide

## 📋 Service Overview

**Role**: Central entry point and traffic orchestrator for all client requests in the Suuupra EdTech platform. This service acts as a protective barrier, intelligent router, and performance optimizer handling authentication, authorization, rate limiting, service mesh integration, and real-time communication.

**Learning Objectives**:
- Master production-grade API Gateway patterns and architectures
- Implement enterprise-level JWT authentication and OAuth2 authorization
- Design high-performance distributed rate limiting using advanced algorithms
- Build resilient systems with circuit breaker and bulkhead patterns
- Apply hash tables and consistent hashing for optimal performance
- Understand service mesh integration with Istio
- Implement WebSocket proxying for real-time features

**Performance Targets**:
- **Latency**: p99 < 150ms for all proxy requests
- **Throughput**: 50,000+ RPS per instance
- **Availability**: 99.99% uptime with graceful degradation
- **Memory Efficiency**: < 1GB RAM under peak load
- **Error Rate**: < 0.1% for healthy downstream services

---

## 🏗️ System Architecture & Design

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Cluster                       │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Load Balancer │  Rate Limiting   │      Authentication        │
│   - Nginx/Istio │  - Token Bucket  │      - JWT Validation      │
│   - Health Check│  - Sliding Window│      - OAuth2 Flows        │
│   - SSL Term    │  - Redis Cluster │      - API Key Mgmt        │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Service Discovery│ Circuit Breaker  │    Request Pipeline        │
│ - Consul/K8s DNS│ - Failure Detect │    - Correlation IDs       │
│ - Health Checks │ - Fallback Logic │    - Request Validation    │
│ - Weight Routing│ - Recovery Auto  │    - Response Transform    │
├─────────────────┼─────────────────┼─────────────────────────────┤
│   Monitoring    │  WebSocket Proxy │      Service Mesh          │
│   - OpenTelemetry│ - Real-time Auth │     - Istio Integration    │
│   - Prometheus  │ - Connection Pool│     - mTLS Enforcement     │
│   - Jaeger      │ - Message Filter │     - Traffic Policies     │
└─────────────────┴─────────────────┴─────────────────────────────┘
                           │
                    ┌─────────────┐
                    │ Downstream  │
                    │  Services   │
                    │ ┌─────────┐ │
                    │ │Identity │ │
                    │ │Content  │ │
                    │ │Commerce │ │
                    │ │Payments │ │
                    │ │Live-Cls │ │
                    │ │Analytics│ │
                    │ └─────────┘ │
                    └─────────────┘
```

### Technology Stack
- **Runtime**: Node.js 20+ with TypeScript 5.0+
- **Framework**: Fastify 4.x (high-performance HTTP server)
- **Authentication**: `jsonwebtoken`, `@fastify/oauth2`
- **Rate Limiting**: Redis 7+ with RedisJSON and RedisTimeSeries
- **Service Discovery**: Consul or Kubernetes Service Discovery
- **Monitoring**: OpenTelemetry, Prometheus, Grafana, Jaeger
- **Service Mesh**: Istio for mTLS and advanced traffic management
- **WebSocket**: `ws` library with custom connection management

---

## 📅 Week 3-4 Implementation Timeline

### Week 3: Core Gateway Infrastructure (Days 15-21)

#### Day 15-16: Project Foundation & JWT Authentication
**Learning Focus**: JWT cryptography, token lifecycle, secure session management

**Core Concepts**:
- **Hash Tables**: O(1) token validation using in-memory caches
- **Digital Signatures**: RS256 algorithm for JWT security
- **Time Complexity**: Token validation, blacklist lookups

**Tasks**:
- [ ] Initialize TypeScript project with Fastify and production dependencies
- [ ] Configure development environment with hot reload and debugging
- [ ] Implement JWT service with RSA key pair generation
- [ ] Create token generation with customizable expiration policies
- [ ] Build JWT validation with signature verification and blacklist checking
- [ ] Implement refresh token rotation mechanism

**Code Implementation - JWT Service**:
```typescript
interface JWTPayload {
  sub: string;                 // Subject (User ID)
  iat: number;                 // Issued At
  exp: number;                 // Expiration
  jti: string;                 // JWT ID (for revocation)
  scope: string[];             // Authorization scopes
  sessionId: string;           // Session identifier
  deviceId?: string;           // Device binding
  clientFingerprint?: string;  // Client binding hash
}

class JWTService {
  private publicKey: string;
  private privateKey: string;
  private redis: Redis;
  private blacklistCache = new Map<string, boolean>(); // In-memory cache
  
  constructor(redis: Redis) {
    this.redis = redis;
    this.generateKeyPair();
  }

  private generateKeyPair(): void {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  async generateTokens(
    userId: string, 
    scopes: string[], 
    deviceId?: string
  ): Promise<TokenPair> {
    const sessionId = crypto.randomUUID();
    const jti = crypto.randomUUID();
    
    const accessTokenPayload: JWTPayload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      jti,
      scope: scopes,
      sessionId,
      deviceId
    };

    const refreshTokenPayload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      jti: crypto.randomUUID(),
      tokenType: 'refresh',
      sessionId
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(accessTokenPayload),
      this.signToken(refreshTokenPayload)
    ]);

    // Store session metadata in Redis
    await this.redis.hset(`session:${sessionId}`, {
      userId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      deviceId: deviceId || 'unknown',
      scopes: scopes.join(',')
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  async validateToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256']
      }) as JWTPayload;

      // Check blacklist (with caching for performance)
      const isBlacklisted = await this.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked');
      }

      // Update session last used timestamp
      if (payload.sessionId) {
        await this.redis.hset(`session:${payload.sessionId}`, 'lastUsed', Date.now());
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw error;
    }
  }

  private async isTokenBlacklisted(jti: string): boolean {
    // Check memory cache first (O(1) lookup)
    if (this.blacklistCache.has(jti)) {
      return this.blacklistCache.get(jti)!;
    }

    // Check Redis if not in cache
    const result = await this.redis.exists(`blacklist:${jti}`);
    const isBlacklisted = result === 1;
    
    // Cache result for 5 minutes to reduce Redis calls
    this.blacklistCache.set(jti, isBlacklisted);
    setTimeout(() => this.blacklistCache.delete(jti), 5 * 60 * 1000);
    
    return isBlacklisted;
  }

  async revokeToken(token: string): Promise<void> {
    const payload = jwt.decode(token) as JWTPayload;
    if (!payload) throw new Error('Invalid token');

    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      // Add to blacklist with TTL matching token expiry
      await this.redis.setex(`blacklist:${payload.jti}`, ttl, 'revoked');
      // Update memory cache
      this.blacklistCache.set(payload.jti, true);
    }

    // Invalidate entire session
    if (payload.sessionId) {
      await this.redis.del(`session:${payload.sessionId}`);
    }
  }
}
```

#### Day 17: OAuth2 Implementation with PKCE
**Learning Focus**: OAuth2 security, PKCE flow, authorization server patterns

**Tasks**:
- [ ] Implement OAuth2 authorization endpoint with consent management
- [ ] Add PKCE (Proof Key for Code Exchange) for mobile/SPA security
- [ ] Create client registration and management system
- [ ] Build token exchange endpoint with proper validation
- [ ] Implement scope-based authorization controls

**OAuth2 Authorization Server**:
```typescript
interface OAuth2AuthRequest {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  code_challenge: string;
  code_challenge_method: 'S256';
}

interface OAuth2TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string;
  client_id: string;
  client_secret?: string;
  redirect_uri?: string;
  code_verifier?: string;
  refresh_token?: string;
}

class OAuth2Service {
  private redis: Redis;
  private jwtService: JWTService;
  
  constructor(redis: Redis, jwtService: JWTService) {
    this.redis = redis;
    this.jwtService = jwtService;
  }

  async authorize(req: OAuth2AuthRequest, userId: string): Promise<string> {
    // Validate client and redirect URI
    const client = await this.validateClient(req.client_id, req.redirect_uri);
    if (!client) {
      throw new BadRequestError('Invalid client or redirect URI');
    }

    // Validate PKCE challenge
    if (!req.code_challenge || req.code_challenge_method !== 'S256') {
      throw new BadRequestError('PKCE challenge required');
    }

    // Generate authorization code
    const authCode = crypto.randomBytes(32).toString('base64url');
    const codeData = {
      client_id: req.client_id,
      user_id: userId,
      redirect_uri: req.redirect_uri,
      scope: req.scope,
      code_challenge: req.code_challenge,
      code_challenge_method: req.code_challenge_method,
      created_at: Date.now()
    };

    // Store with 10-minute expiration
    await this.redis.setex(`oauth2:code:${authCode}`, 600, JSON.stringify(codeData));

    return authCode;
  }

  async exchangeCodeForTokens(req: OAuth2TokenRequest): Promise<TokenResponse> {
    if (req.grant_type === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(req);
    } else if (req.grant_type === 'refresh_token') {
      return this.handleRefreshTokenGrant(req);
    }
    
    throw new BadRequestError('Unsupported grant type');
  }

  private async handleAuthorizationCodeGrant(req: OAuth2TokenRequest): Promise<TokenResponse> {
    // Validate authorization code
    const codeDataStr = await this.redis.get(`oauth2:code:${req.code}`);
    if (!codeDataStr) {
      throw new BadRequestError('Invalid or expired authorization code');
    }

    const codeData = JSON.parse(codeDataStr);
    
    // Validate client
    if (codeData.client_id !== req.client_id) {
      throw new BadRequestError('Client ID mismatch');
    }

    // Validate PKCE verifier
    if (!req.code_verifier) {
      throw new BadRequestError('Code verifier required');
    }

    const expectedChallenge = crypto
      .createHash('sha256')
      .update(req.code_verifier)
      .digest('base64url');
      
    if (expectedChallenge !== codeData.code_challenge) {
      throw new BadRequestError('Invalid code verifier');
    }

    // Delete used authorization code
    await this.redis.del(`oauth2:code:${req.code}`);

    // Generate tokens
    const scopes = codeData.scope.split(' ');
    const tokens = await this.jwtService.generateTokens(codeData.user_id, scopes);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      scope: codeData.scope
    };
  }
}
```

#### Day 18-19: Advanced Rate Limiting with Redis
**Learning Focus**: Distributed algorithms, sliding window counters, hash table optimization

**Core Algorithms**:
- **Token Bucket**: For burst traffic handling
- **Sliding Window**: For precise rate limiting
- **Hash Tables**: Redis hash structures for O(1) operations
- **Time Series**: Redis TimeSeries for advanced analytics

**Tasks**:
- [ ] Implement token bucket algorithm with Redis atomic operations
- [ ] Create sliding window rate limiter with precise counting
- [ ] Build hierarchical rate limiting (global, user, IP, API key)
- [ ] Add rate limit policies configuration system
- [ ] Implement rate limit analytics and monitoring

**Distributed Rate Limiting Implementation**:
```typescript
interface RateLimitPolicy {
  id: string;
  name: string;
  requests_per_minute: number;
  requests_per_hour: number;
  burst_capacity: number;
  window_size: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

class DistributedRateLimiter {
  private redis: Redis;
  private policies = new Map<string, RateLimitPolicy>(); // Hash table cache

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Token Bucket Algorithm Implementation
   * Time Complexity: O(1) - constant time operations
   * Space Complexity: O(1) per bucket
   */
  async checkTokenBucket(
    key: string, 
    capacity: number, 
    refillRate: number
  ): Promise<RateLimitResult> {
    const bucketKey = `bucket:${key}`;
    const now = Date.now();

    // Use Lua script for atomic operations
    const luaScript = `
      local bucket_key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local tokens_requested = tonumber(ARGV[4])

      -- Get current bucket state
      local bucket = redis.call('HMGET', bucket_key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now

      -- Calculate tokens to add based on time elapsed
      local time_elapsed = (now - last_refill) / 1000
      local tokens_to_add = math.floor(time_elapsed * refill_rate)
      tokens = math.min(capacity, tokens + tokens_to_add)

      -- Check if request can be fulfilled
      local allowed = tokens >= tokens_requested
      if allowed then
        tokens = tokens - tokens_requested
      end

      -- Update bucket state
      redis.call('HMSET', bucket_key, 'tokens', tokens, 'last_refill', now)
      redis.call('EXPIRE', bucket_key, 3600)

      return {allowed and 1 or 0, tokens, capacity, now + ((capacity - tokens) / refill_rate) * 1000}
    `;

    const result = await this.redis.eval(
      luaScript, 
      1, 
      bucketKey, 
      capacity.toString(), 
      refillRate.toString(), 
      now.toString(), 
      '1'
    ) as [number, number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      limit: result[2],
      resetTime: result[3]
    };
  }

  /**
   * Sliding Window Counter Implementation
   * More accurate than fixed windows, handles edge cases better
   */
  async checkSlidingWindow(
    key: string,
    windowSizeMs: number,
    maxRequests: number,
    weight: number = 1
  ): Promise<RateLimitResult> {
    const windowKey = `sliding:${key}`;
    const now = Date.now();
    const windowStart = now - windowSizeMs;

    const luaScript = `
      local window_key = KEYS[1]
      local window_start = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local max_requests = tonumber(ARGV[3])
      local weight = tonumber(ARGV[4])

      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', window_key, 0, window_start)

      -- Get current count
      local current_count = redis.call('ZCARD', window_key)

      -- Check if request is allowed
      local allowed = (current_count + weight) <= max_requests
      
      if allowed then
        -- Add new entry with unique score to handle concurrent requests
        local unique_score = now + math.random()
        redis.call('ZADD', window_key, unique_score, unique_score .. ':' .. math.random())
        current_count = current_count + weight
      end

      -- Set expiry for cleanup
      redis.call('EXPIRE', window_key, math.ceil(window_size_ms / 1000))

      return {allowed and 1 or 0, current_count, max_requests, now + window_size_ms}
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      windowKey,
      windowStart.toString(),
      now.toString(),
      maxRequests.toString(),
      weight.toString()
    ) as [number, number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: Math.max(0, result[2] - result[1]),
      limit: result[2],
      resetTime: result[3]
    };
  }

  /**
   * Hierarchical Rate Limiting
   * Apply multiple rate limits in order of precedence
   */
  async checkRateLimit(
    userId: string,
    clientId: string,
    ipAddress: string,
    endpoint: string
  ): Promise<RateLimitResult[]> {
    const checks = [
      // Global rate limit (most restrictive)
      this.checkSlidingWindow(`global:${endpoint}`, 60000, 10000),
      
      // Per-IP rate limit
      this.checkSlidingWindow(`ip:${ipAddress}`, 60000, 1000),
      
      // Per-client rate limit
      this.checkSlidingWindow(`client:${clientId}`, 60000, 5000),
      
      // Per-user rate limit (least restrictive for authenticated users)
      this.checkSlidingWindow(`user:${userId}`, 60000, 2000)
    ];

    const results = await Promise.all(checks);
    return results;
  }
}
```

#### Day 20-21: Service Discovery & Circuit Breaker
**Learning Focus**: Distributed systems patterns, state machines, health monitoring

**Tasks**:
- [ ] Implement service discovery with health checking
- [ ] Create circuit breaker with failure detection
- [ ] Build load balancing with consistent hashing
- [ ] Add fallback response strategies
- [ ] Implement automatic service recovery

### Week 4: Advanced Features & Production Readiness (Days 22-28)

#### Day 22-23: Request Pipeline & WebSocket Support
**Learning Focus**: HTTP processing, WebSocket proxying, connection management

**Tasks**:
- [ ] Build request/response transformation pipeline
- [ ] Implement comprehensive request logging with correlation IDs
- [ ] Create WebSocket authentication and authorization
- [ ] Add WebSocket connection pooling and routing
- [ ] Implement WebSocket message filtering and rate limiting

**WebSocket Gateway Implementation**:
```typescript
interface WebSocketConnection {
  id: string;
  userId: string;
  clientId: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  lastActivity: number;
  metadata: Record<string, any>;
}

class WebSocketGateway {
  private connections = new Map<string, WebSocketConnection>(); // Hash table for O(1) lookup
  private subscriptions = new Map<string, Set<string>>(); // Topic -> Connection IDs
  private rateLimiter: DistributedRateLimiter;

  constructor(rateLimiter: DistributedRateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  async handleConnection(ws: WebSocket, token: string): Promise<void> {
    try {
      // Authenticate WebSocket connection
      const payload = await this.jwtService.validateToken(token);
      
      const connectionId = crypto.randomUUID();
      const connection: WebSocketConnection = {
        id: connectionId,
        userId: payload.sub,
        clientId: payload.sessionId,
        socket: ws,
        subscriptions: new Set(),
        lastActivity: Date.now(),
        metadata: {}
      };

      this.connections.set(connectionId, connection);

      ws.on('message', (data) => this.handleMessage(connection, data));
      ws.on('close', () => this.handleDisconnection(connectionId));
      ws.on('error', (error) => this.handleError(connectionId, error));

      // Send connection acknowledgment
      this.sendMessage(connection, {
        type: 'connection_ack',
        connectionId,
        timestamp: Date.now()
      });

    } catch (error) {
      ws.close(1008, 'Authentication failed');
    }
  }

  private async handleMessage(connection: WebSocketConnection, data: Buffer): Promise<void> {
    try {
      // Rate limit WebSocket messages
      const rateLimitResult = await this.rateLimiter.checkSlidingWindow(
        `ws:${connection.userId}`,
        60000, // 1 minute window
        100    // 100 messages per minute
      );

      if (!rateLimitResult.allowed) {
        this.sendError(connection, 'RATE_LIMIT_EXCEEDED', 'Too many messages');
        return;
      }

      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscription(connection, message.topic);
          break;
        case 'unsubscribe':
          await this.handleUnsubscription(connection, message.topic);
          break;
        case 'message':
          await this.handleUserMessage(connection, message);
          break;
        default:
          this.sendError(connection, 'INVALID_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
      }

      connection.lastActivity = Date.now();

    } catch (error) {
      this.sendError(connection, 'MESSAGE_ERROR', 'Invalid message format');
    }
  }

  private async handleSubscription(connection: WebSocketConnection, topic: string): Promise<void> {
    // Validate subscription permissions
    const canSubscribe = await this.validateSubscriptionPermission(connection.userId, topic);
    if (!canSubscribe) {
      this.sendError(connection, 'PERMISSION_DENIED', `Cannot subscribe to topic: ${topic}`);
      return;
    }

    // Add to subscriptions
    connection.subscriptions.add(topic);
    
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(connection.id);

    this.sendMessage(connection, {
      type: 'subscription_ack',
      topic,
      timestamp: Date.now()
    });
  }

  broadcast(topic: string, message: any): void {
    const connectionIds = this.subscriptions.get(topic);
    if (!connectionIds) return;

    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.socket.readyState === WebSocket.OPEN) {
        this.sendMessage(connection, {
          type: 'broadcast',
          topic,
          data: message,
          timestamp: Date.now()
        });
      }
    }
  }
}
```

#### Day 24-25: Service Mesh Integration (Istio)
**Learning Focus**: Service mesh concepts, mTLS, traffic management

**Tasks**:
- [ ] Configure Istio sidecar injection for API Gateway
- [ ] Implement mTLS certificate management
- [ ] Create traffic routing policies for canary deployments
- [ ] Add distributed tracing integration
- [ ] Configure security policies and RBAC

**Istio Configuration**:
```yaml
# Gateway VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-gateway-vs
  namespace: suuupra
spec:
  hosts:
  - api.suuupra.com
  gateways:
  - api-gateway-gw
  http:
  - match:
    - uri:
        prefix: /auth/
    route:
    - destination:
        host: identity-service
        port:
          number: 8080
      weight: 100
  - match:
    - uri:
        prefix: /content/
    route:
    - destination:
        host: content-service
        port:
          number: 8080
      weight: 90
    - destination:
        host: content-service-canary
        port:
          number: 8080
      weight: 10
  - fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
    match:
    - uri:
        prefix: /payments/
    route:
    - destination:
        host: payment-service
        port:
          number: 8080

---
# Security Policy
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: api-gateway-peer-auth
  namespace: suuupra
spec:
  selector:
    matchLabels:
      app: api-gateway
  mtls:
    mode: STRICT

---
# Authorization Policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-gateway-authz
  namespace: suuupra
spec:
  selector:
    matchLabels:
      app: api-gateway
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/istio-system/sa/istio-proxy"]
  - to:
    - operation:
        methods: ["GET", "POST", "PUT", "DELETE"]
    when:
    - key: custom.jwt_validated
      values: ["true"]
```

#### Day 26-27: Comprehensive Monitoring & Observability
**Learning Focus**: Metrics design, distributed tracing, performance monitoring

**Tasks**:
- [ ] Implement OpenTelemetry integration for distributed tracing
- [ ] Create Prometheus metrics for all critical operations
- [ ] Build Grafana dashboards for real-time monitoring
- [ ] Add alerting rules for critical failure scenarios
- [ ] Implement performance profiling and optimization

**Monitoring Implementation**:
```typescript
// Prometheus Metrics
const requestDuration = new Histogram({
  name: 'api_gateway_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'service', 'user_type'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
});

const requestsTotal = new Counter({
  name: 'api_gateway_requests_total',
  help: 'Total number of requests processed',
  labelNames: ['method', 'route', 'status_code', 'service']
});

const rateLimitHits = new Counter({
  name: 'api_gateway_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['limit_type', 'user_id', 'client_id']
});

const circuitBreakerState = new Gauge({
  name: 'api_gateway_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service']
});

const activeWebSocketConnections = new Gauge({
  name: 'api_gateway_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['user_type']
});

// OpenTelemetry Tracing
const tracer = opentelemetry.trace.getTracer('api-gateway', '1.0.0');

class TracingMiddleware {
  static async traceRequest(
    request: FastifyRequest, 
    reply: FastifyReply, 
    next: () => Promise<void>
  ): Promise<void> {
    const span = tracer.startSpan(`${request.method} ${request.url}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.scheme': 'https',
        'http.host': request.headers.host,
        'user.id': request.user?.id || 'anonymous',
        'client.id': request.headers['x-client-id'],
        'correlation.id': request.headers['x-correlation-id']
      }
    });

    const startTime = process.hrtime.bigint();

    try {
      await next();
      
      span.setAttributes({
        'http.status_code': reply.statusCode,
        'http.response_size': reply.getHeader('content-length') || 0
      });
      
      if (reply.statusCode >= 400) {
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: `HTTP ${reply.statusCode}` 
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: (error as Error).message 
      });
      throw error;
    } finally {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
      
      // Record metrics
      requestDuration.labels(
        request.method,
        request.routerPath || request.url,
        reply.statusCode.toString(),
        reply.getHeader('x-upstream-service') as string || 'unknown',
        request.user?.type || 'anonymous'
      ).observe(duration);

      requestsTotal.labels(
        request.method,
        request.routerPath || request.url,
        reply.statusCode.toString(),
        reply.getHeader('x-upstream-service') as string || 'unknown'
      ).inc();

      span.end();
    }
  }
}
```

#### Day 28: Performance Testing & Optimization
**Learning Focus**: Load testing, performance profiling, optimization techniques

**Tasks**:
- [ ] Create comprehensive load testing suite with K6
- [ ] Implement connection pooling optimization
- [ ] Add response caching with intelligent invalidation
- [ ] Perform memory profiling and optimization
- [ ] Validate performance targets (50k RPS, <150ms p99)

---

## 📊 Database & Caching Schema

### Redis Schema Design

```redis
# JWT Blacklist (Hash Table for O(1) lookup)
SET "jwt:blacklist:${jti}" "revoked" EX ${ttl}

# Session Management
HSET "session:${sessionId}" 
  "userId" "${userId}"
  "createdAt" "${timestamp}"
  "lastUsed" "${timestamp}"
  "deviceId" "${deviceId}"
  "scopes" "${scopes}"
  EX 604800  # 7 days

# Token Bucket Rate Limiting
HSET "rate:bucket:${key}"
  "tokens" "${tokenCount}"
  "lastRefill" "${timestamp}"
  EX 3600

# Sliding Window Rate Limiting
ZADD "rate:sliding:${key}" ${timestamp} "${timestamp}:${requestId}"
EXPIRE "rate:sliding:${key}" 300

# API Key Cache (Hash optimization)
HSET "apikey:${hashedKey}"
  "userId" "${userId}"
  "clientId" "${clientId}"
  "scopes" "${scopes}"
  "lastUsed" "${timestamp}"
  "requestCount" "${count}"
  EX 86400  # 24 hours

# Circuit Breaker State
HSET "circuit:${serviceName}"
  "state" "${state}"        # CLOSED, OPEN, HALF_OPEN
  "failures" "${count}"
  "lastFailure" "${timestamp}"
  "recoveryTime" "${timestamp}"
  EX 3600

# Service Registry with Health Status
HSET "service:${serviceName}:${instanceId}"
  "address" "${host}:${port}"
  "weight" "${weight}"
  "health" "${status}"      # healthy, unhealthy, unknown
  "lastCheck" "${timestamp}"
  "responseTime" "${ms}"
  EX 300

# WebSocket Connection Registry
HSET "ws:connection:${connectionId}"
  "userId" "${userId}"
  "clientId" "${clientId}"
  "subscriptions" "${topics}"
  "lastActivity" "${timestamp}"
  EX 7200  # 2 hours

# Real-time Analytics (Using RedisTimeSeries)
TS.CREATE "metrics:requests:${endpoint}" RETENTION 86400
TS.CREATE "metrics:latency:${service}" RETENTION 86400
TS.CREATE "metrics:errors:${errorType}" RETENTION 86400
```

### PostgreSQL Configuration Schema

```sql
-- API Gateway Routes Configuration
CREATE TABLE gateway_routes (
    id SERIAL PRIMARY KEY,
    route_pattern VARCHAR(255) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    auth_required BOOLEAN DEFAULT true,
    rate_limit_policy_id INTEGER,
    timeout_ms INTEGER DEFAULT 30000,
    retry_attempts INTEGER DEFAULT 3,
    circuit_breaker_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_pattern, http_method)
);

-- Rate Limiting Policies
CREATE TABLE rate_limit_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Rate limits per time window
    requests_per_second INTEGER,
    requests_per_minute INTEGER,
    requests_per_hour INTEGER,
    requests_per_day INTEGER,
    
    -- Burst handling
    burst_capacity INTEGER,
    
    -- Advanced settings
    algorithm VARCHAR(20) DEFAULT 'sliding_window', -- sliding_window, token_bucket
    window_size_seconds INTEGER DEFAULT 60,
    
    -- User tiers
    user_tier VARCHAR(20) DEFAULT 'standard', -- basic, standard, premium, enterprise
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth2 Client Registration
CREATE TABLE oauth2_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    client_name VARCHAR(255) NOT NULL,
    client_type VARCHAR(20) NOT NULL, -- public, confidential
    
    -- OAuth2 Configuration
    grant_types TEXT[] DEFAULT ARRAY['authorization_code'],
    response_types TEXT[] DEFAULT ARRAY['code'],
    redirect_uris TEXT[] NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['read'],
    
    -- Security Settings
    require_pkce BOOLEAN DEFAULT true,
    require_consent BOOLEAN DEFAULT true,
    token_lifetime_seconds INTEGER DEFAULT 3600,
    refresh_token_lifetime_seconds INTEGER DEFAULT 604800,
    
    -- Rate limiting
    rate_limit_policy_id INTEGER REFERENCES rate_limit_policies(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Registry and Health Management
CREATE TABLE service_registry (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    
    -- Connection details
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    protocol VARCHAR(10) DEFAULT 'http',
    base_path VARCHAR(255) DEFAULT '/',
    
    -- Health check configuration
    health_check_path VARCHAR(255) DEFAULT '/health',
    health_check_interval_seconds INTEGER DEFAULT 30,
    health_check_timeout_seconds INTEGER DEFAULT 5,
    health_check_retries INTEGER DEFAULT 3,
    
    -- Load balancing
    weight INTEGER DEFAULT 1,
    max_connections INTEGER DEFAULT 100,
    
    -- Circuit breaker settings
    failure_threshold INTEGER DEFAULT 5,
    recovery_timeout_seconds INTEGER DEFAULT 60,
    
    -- Status tracking
    current_health VARCHAR(20) DEFAULT 'unknown', -- healthy, unhealthy, unknown
    last_health_check TIMESTAMP,
    consecutive_failures INTEGER DEFAULT 0,
    average_response_time_ms INTEGER,
    
    -- Metadata
    version VARCHAR(50),
    environment VARCHAR(20) DEFAULT 'production',
    region VARCHAR(50),
    availability_zone VARCHAR(50),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(service_name, instance_id, environment)
);

-- Request/Response Transformation Rules
CREATE TABLE transformation_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    route_pattern VARCHAR(255),
    
    -- Transformation types
    request_transformation JSONB,  -- JSON rules for request transformation
    response_transformation JSONB, -- JSON rules for response transformation
    header_modifications JSONB,   -- Header addition/removal rules
    
    -- Conditions
    conditions JSONB,              -- When to apply transformations
    priority INTEGER DEFAULT 100,  -- Rule application order
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Usage Analytics
CREATE TABLE api_usage_analytics (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Request details
    user_id UUID,
    client_id UUID,
    api_key_id UUID,
    correlation_id UUID,
    
    -- Request metadata
    http_method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    service_name VARCHAR(100),
    
    -- Response details
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    response_size_bytes INTEGER,
    
    -- Client details
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    
    -- Geographic data
    country_code CHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    
    -- Error tracking
    error_type VARCHAR(100),
    error_message TEXT,
    
    -- Indexes for query performance
    INDEX idx_api_usage_timestamp (timestamp),
    INDEX idx_api_usage_user_id (user_id),
    INDEX idx_api_usage_endpoint (endpoint),
    INDEX idx_api_usage_service (service_name)
) PARTITION BY RANGE (timestamp);

-- Create partitions for analytics table (monthly partitions)
CREATE TABLE api_usage_analytics_2024_03 PARTITION OF api_usage_analytics
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

---

## 🔌 OpenAPI 3.0 Specification

```yaml
openapi: 3.0.3
info:
  title: Suuupra API Gateway
  version: 2.0.0
  description: |
    Enterprise-grade API Gateway for Suuupra EdTech Platform
    
    Features:
    - JWT & OAuth2 authentication
    - Distributed rate limiting
    - Circuit breaker patterns
    - WebSocket support
    - Real-time monitoring
    
  contact:
    name: Suuupra Engineering
    url: https://suuupra.com/docs
    email: engineering@suuupra.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.suuupra.com
    description: Production API Gateway
  - url: https://staging-api.suuupra.com
    description: Staging API Gateway
  - url: https://dev-api.suuupra.com
    description: Development API Gateway

paths:
  /health:
    get:
      summary: Health Check
      description: Comprehensive health check including downstream services
      operationId: getHealth
      tags:
        - System
      responses:
        '200':
          description: System is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
        '503':
          description: System is degraded or unhealthy

  /metrics:
    get:
      summary: Prometheus Metrics
      description: Export Prometheus-compatible metrics
      operationId: getMetrics
      tags:
        - Monitoring
      responses:
        '200':
          description: Metrics in Prometheus format
          content:
            text/plain:
              schema:
                type: string

  # Authentication Endpoints
  /auth/login:
    post:
      summary: User Authentication
      description: Authenticate user credentials and generate JWT tokens
      operationId: login
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'
        '401':
          description: Invalid credentials
        '429':
          description: Rate limit exceeded
          headers:
            X-RateLimit-Limit:
              schema:
                type: integer
            X-RateLimit-Remaining:
              schema:
                type: integer
            X-RateLimit-Reset:
              schema:
                type: integer

  /auth/refresh:
    post:
      summary: Token Refresh
      description: Refresh access token using refresh token
      operationId: refreshToken
      tags:
        - Authentication
      security:
        - refreshToken: []
      responses:
        '200':
          description: Token refreshed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'
        '401':
          description: Invalid or expired refresh token

  /auth/logout:
    post:
      summary: User Logout
      description: Revoke tokens and end session
      operationId: logout
      tags:
        - Authentication
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Logout successful
        '401':
          description: Invalid token

  # OAuth2 Endpoints
  /oauth2/authorize:
    get:
      summary: OAuth2 Authorization
      description: OAuth2 authorization endpoint with PKCE support
      operationId: authorize
      tags:
        - OAuth2
      parameters:
        - name: response_type
          in: query
          required: true
          schema:
            type: string
            enum: [code]
        - name: client_id
          in: query
          required: true
          schema:
            type: string
        - name: redirect_uri
          in: query
          required: true
          schema:
            type: string
            format: uri
        - name: scope
          in: query
          schema:
            type: string
            example: "read write profile"
        - name: state
          in: query
          schema:
            type: string
        - name: code_challenge
          in: query
          required: true
          schema:
            type: string
            description: PKCE code challenge
        - name: code_challenge_method
          in: query
          required: true
          schema:
            type: string
            enum: [S256]
      responses:
        '302':
          description: Redirect to client with authorization code
        '400':
          description: Invalid request parameters
        '401':
          description: User authentication required

  /oauth2/token:
    post:
      summary: OAuth2 Token Exchange
      description: Exchange authorization code for tokens
      operationId: tokenExchange
      tags:
        - OAuth2
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              $ref: '#/components/schemas/TokenRequest'
      responses:
        '200':
          description: Tokens generated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OAuth2TokenResponse'
        '400':
          description: Invalid request or PKCE verification failed

  # WebSocket Connection Endpoint
  /ws:
    get:
      summary: WebSocket Connection
      description: Establish authenticated WebSocket connection
      operationId: connectWebSocket
      tags:
        - WebSocket
      parameters:
        - name: token
          in: query
          required: true
          schema:
            type: string
            description: JWT token for authentication
      responses:
        '101':
          description: Switching Protocols
        '401':
          description: Authentication failed
        '429':
          description: Connection rate limit exceeded

  # Proxy Endpoints for Downstream Services
  /{service}/{path*}:
    parameters:
      - name: service
        in: path
        required: true
        schema:
          type: string
          enum: 
            - identity
            - content
            - commerce
            - payments
            - live-classes
            - vod
            - analytics
            - notifications
        description: Target service name
      - name: path
        in: path
        required: false
        schema:
          type: string
        description: Service-specific path
    get:
      summary: Proxy GET Request
      description: Proxy GET request to downstream service
      operationId: proxyGet
      tags:
        - Proxy
      security:
        - bearerAuth: []
        - apiKey: []
      responses:
        '200':
          description: Request proxied successfully
        '401':
          description: Authentication required
        '403':
          description: Insufficient permissions
        '429':
          description: Rate limit exceeded
        '502':
          description: Bad gateway - upstream service error
        '503':
          description: Service unavailable - circuit breaker open
        '504':
          description: Gateway timeout
    post:
      summary: Proxy POST Request
      operationId: proxyPost
      tags:
        - Proxy
      security:
        - bearerAuth: []
        - apiKey: []
      responses:
        '200':
          description: Request proxied successfully
        '401':
          description: Authentication required
        '403':
          description: Insufficient permissions
        '429':
          description: Rate limit exceeded
        '502':
          description: Bad gateway
        '503':
          description: Service unavailable
    put:
      summary: Proxy PUT Request
      operationId: proxyPut
      tags:
        - Proxy
      security:
        - bearerAuth: []
        - apiKey: []
      responses:
        '200':
          description: Request proxied successfully
        '401':
          description: Authentication required
        '403':
          description: Insufficient permissions
        '429':
          description: Rate limit exceeded
        '502':
          description: Bad gateway
        '503':
          description: Service unavailable
    delete:
      summary: Proxy DELETE Request
      operationId: proxyDelete
      tags:
        - Proxy
      security:
        - bearerAuth: []
        - apiKey: []
      responses:
        '200':
          description: Request proxied successfully
        '401':
          description: Authentication required
        '403':
          description: Insufficient permissions
        '429':
          description: Rate limit exceeded
        '502':
          description: Bad gateway
        '503':
          description: Service unavailable

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from /auth/login
    
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for service-to-service communication
    
    refreshToken:
      type: http
      scheme: bearer
      bearerFormat: refresh_token
      description: Refresh token for token renewal

  schemas:
    HealthResponse:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        timestamp:
          type: string
          format: date-time
        version:
          type: string
        uptime:
          type: integer
          description: Uptime in seconds
        checks:
          type: object
          properties:
            redis:
              type: boolean
            database:
              type: boolean
            services:
              type: object
              additionalProperties:
                type: boolean
            certificates:
              type: boolean
        metrics:
          type: object
          properties:
            requestsPerSecond:
              type: number
            averageLatency:
              type: number
            errorRate:
              type: number
            activeConnections:
              type: integer

    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
          maxLength: 255
        password:
          type: string
          minLength: 8
          maxLength: 128
        mfaToken:
          type: string
          description: Multi-factor authentication token
        deviceId:
          type: string
          description: Unique device identifier
        remember:
          type: boolean
          default: false
          description: Generate longer-lived tokens

    TokenResponse:
      type: object
      properties:
        accessToken:
          type: string
          description: JWT access token
        refreshToken:
          type: string
          description: Refresh token for token renewal
        tokenType:
          type: string
          default: Bearer
        expiresIn:
          type: integer
          description: Access token expiry in seconds
        scope:
          type: string
          description: Granted scopes

    TokenRequest:
      type: object
      required:
        - grant_type
      properties:
        grant_type:
          type: string
          enum: [authorization_code, refresh_token]
        code:
          type: string
          description: Authorization code (for authorization_code grant)
        client_id:
          type: string
        client_secret:
          type: string
          description: Required for confidential clients
        redirect_uri:
          type: string
        code_verifier:
          type: string
          description: PKCE code verifier
        refresh_token:
          type: string
          description: Refresh token (for refresh_token grant)

    OAuth2TokenResponse:
      type: object
      properties:
        access_token:
          type: string
        refresh_token:
          type: string
        token_type:
          type: string
          default: Bearer
        expires_in:
          type: integer
        scope:
          type: string

    Error:
      type: object
      properties:
        error:
          type: string
          description: Error code
        error_description:
          type: string
          description: Human-readable error description
        error_uri:
          type: string
          format: uri
          description: URI with error information
        correlation_id:
          type: string
          description: Request correlation ID for debugging
        timestamp:
          type: string
          format: date-time

  responses:
    Unauthorized:
      description: Authentication required or invalid
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
      headers:
        WWW-Authenticate:
          schema:
            type: string
    
    Forbidden:
      description: Insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    RateLimitExceeded:
      description: Rate limit exceeded
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
      headers:
        X-RateLimit-Limit:
          schema:
            type: integer
        X-RateLimit-Remaining:
          schema:
            type: integer
        X-RateLimit-Reset:
          schema:
            type: integer
        Retry-After:
          schema:
            type: integer

  headers:
    X-Correlation-ID:
      description: Request correlation ID
      schema:
        type: string
        format: uuid
    
    X-Request-ID:
      description: Unique request identifier
      schema:
        type: string
        format: uuid
        
    X-Response-Time:
      description: Response time in milliseconds
      schema:
        type: integer
```

---

## 🧪 Comprehensive Testing Strategy

### Unit Tests (Target: 95+ Coverage)

```typescript
// Jest Configuration
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts']
};

// JWT Service Tests
describe('JWTService', () => {
  let jwtService: JWTService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    jwtService = new JWTService(mockRedis);
  });

  describe('generateTokens', () => {
    test('should generate valid JWT tokens with correct structure', async () => {
      const userId = 'user123';
      const scopes = ['read', 'write', 'admin'];
      const deviceId = 'device456';

      const tokens = await jwtService.generateTokens(userId, scopes, deviceId);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900); // 15 minutes

      const payload = jwt.decode(tokens.accessToken) as JWTPayload;
      expect(payload.sub).toBe(userId);
      expect(payload.scope).toEqual(scopes);
      expect(payload.deviceId).toBe(deviceId);
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('should store session metadata in Redis', async () => {
      await jwtService.generateTokens('user123', ['read']);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringMatching(/^session:/),
        expect.objectContaining({
          userId: 'user123',
          scopes: 'read'
        })
      );
    });
  });

  describe('validateToken', () => {
    test('should validate legitimate tokens successfully', async () => {
      const tokens = await jwtService.generateTokens('user123', ['read']);
      
      const payload = await jwtService.validateToken(tokens.accessToken);
      
      expect(payload.sub).toBe('user123');
      expect(payload.scope).toEqual(['read']);
    });

    test('should reject blacklisted tokens', async () => {
      const tokens = await jwtService.generateTokens('user123', ['read']);
      mockRedis.exists.mockResolvedValue(1); // Token is blacklisted
      
      await expect(jwtService.validateToken(tokens.accessToken))
        .rejects.toThrow('Token has been revoked');
    });

    test('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 3600 },
        'fake-key'
      );
      
      await expect(jwtService.validateToken(expiredToken))
        .rejects.toThrow('Invalid token');
    });

    test('should handle malformed tokens gracefully', async () => {
      await expect(jwtService.validateToken('invalid.token.here'))
        .rejects.toThrow('Invalid token');
    });
  });

  describe('revokeToken', () => {
    test('should blacklist token and invalidate session', async () => {
      const tokens = await jwtService.generateTokens('user123', ['read']);
      
      await jwtService.revokeToken(tokens.accessToken);
      
      const payload = jwt.decode(tokens.accessToken) as JWTPayload;
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `blacklist:${payload.jti}`,
        expect.any(Number),
        'revoked'
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`session:${payload.sessionId}`);
    });
  });
});

// Rate Limiter Tests
describe('DistributedRateLimiter', () => {
  let rateLimiter: DistributedRateLimiter;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    rateLimiter = new DistributedRateLimiter(mockRedis);
  });

  describe('checkSlidingWindow', () => {
    test('should allow requests within limit', async () => {
      mockRedis.eval.mockResolvedValue([1, 1, 100, Date.now() + 60000]);
      
      const result = await rateLimiter.checkSlidingWindow('user123', 60000, 100);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.limit).toBe(100);
    });

    test('should deny requests exceeding limit', async () => {
      mockRedis.eval.mockResolvedValue([0, 100, 100, Date.now() + 60000]);
      
      const result = await rateLimiter.checkSlidingWindow('user123', 60000, 100);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should handle concurrent requests correctly', async () => {
      // Simulate high concurrency scenario
      const promises = Array.from({ length: 50 }, (_, i) =>
        rateLimiter.checkSlidingWindow(`user${i}`, 60000, 100)
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('limit');
      });
    });
  });

  describe('checkTokenBucket', () => {
    test('should refill tokens based on elapsed time', async () => {
      const now = Date.now();
      // Mock bucket with tokens from 30 seconds ago
      mockRedis.eval.mockResolvedValue([1, 75, 100, now + 25000]);
      
      const result = await rateLimiter.checkTokenBucket('user123', 100, 1);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(75);
    });

    test('should respect bucket capacity limits', async () => {
      mockRedis.eval.mockResolvedValue([1, 99, 100, Date.now() + 1000]);
      
      const result = await rateLimiter.checkTokenBucket('user123', 100, 10);
      
      expect(result.remaining).toBeLessThanOrEqual(100);
    });
  });

  describe('checkRateLimit - Hierarchical', () => {
    test('should apply multiple rate limits correctly', async () => {
      mockRedis.eval
        .mockResolvedValueOnce([1, 50, 1000, Date.now() + 60000])  // Global
        .mockResolvedValueOnce([1, 20, 100, Date.now() + 60000])   // IP
        .mockResolvedValueOnce([1, 45, 500, Date.now() + 60000])   // Client
        .mockResolvedValueOnce([1, 15, 200, Date.now() + 60000]);  // User
      
      const results = await rateLimiter.checkRateLimit('user123', 'client456', '192.168.1.1', '/api/test');
      
      expect(results).toHaveLength(4);
      expect(results.every(r => r.allowed)).toBe(true);
    });

    test('should deny if any rate limit is exceeded', async () => {
      mockRedis.eval
        .mockResolvedValueOnce([1, 50, 1000, Date.now() + 60000])  // Global - OK
        .mockResolvedValueOnce([0, 100, 100, Date.now() + 60000])  // IP - EXCEEDED
        .mockResolvedValueOnce([1, 45, 500, Date.now() + 60000])   // Client - OK
        .mockResolvedValueOnce([1, 15, 200, Date.now() + 60000]);  // User - OK
      
      const results = await rateLimiter.checkRateLimit('user123', 'client456', '192.168.1.1', '/api/test');
      
      expect(results[1].allowed).toBe(false); // IP limit exceeded
    });
  });
});

// Circuit Breaker Tests
describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    circuitBreaker = new CircuitBreaker(mockRedis, {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      requestTimeout: 30000
    });
  });

  test('should start in CLOSED state', async () => {
    mockRedis.hget.mockResolvedValue(null);
    
    const state = await circuitBreaker.getState('test-service');
    
    expect(state).toBe(CircuitBreakerState.CLOSED);
  });

  test('should transition to OPEN after threshold failures', async () => {
    // Mock service with failures at threshold
    mockRedis.hgetall.mockResolvedValue({
      state: CircuitBreakerState.CLOSED,
      failures: '4', // One less than threshold
      lastFailure: String(Date.now())
    });

    await circuitBreaker.recordFailure('test-service');
    
    expect(mockRedis.hset).toHaveBeenCalledWith(
      'circuit:test-service',
      expect.objectContaining({
        state: CircuitBreakerState.OPEN
      })
    );
  });

  test('should allow limited requests in HALF_OPEN state', async () => {
    const recoveryTime = Date.now() - 61000; // Past recovery timeout
    mockRedis.hgetall.mockResolvedValue({
      state: CircuitBreakerState.OPEN,
      failures: '5',
      lastFailure: String(recoveryTime)
    });

    const canExecute = await circuitBreaker.canExecute('test-service');
    
    expect(canExecute).toBe(true);
    expect(mockRedis.hset).toHaveBeenCalledWith(
      'circuit:test-service',
      expect.objectContaining({
        state: CircuitBreakerState.HALF_OPEN
      })
    );
  });

  test('should reset to CLOSED after successful requests', async () => {
    mockRedis.hgetall.mockResolvedValue({
      state: CircuitBreakerState.HALF_OPEN,
      failures: '2',
      lastFailure: String(Date.now() - 30000)
    });

    await circuitBreaker.recordSuccess('test-service');
    
    expect(mockRedis.hset).toHaveBeenCalledWith(
      'circuit:test-service',
      expect.objectContaining({
        state: CircuitBreakerState.CLOSED,
        failures: '0'
      })
    );
  });
});
```

### Integration Tests

```typescript
describe('API Gateway Integration', () => {
  let app: FastifyInstance;
  let redis: Redis;
  let testServer: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    // Setup test environment
    redis = new Redis(process.env.REDIS_TEST_URL);
    app = await createApp({ redis });
    testServer = await app.listen({ port: 0 });
  });

  afterAll(async () => {
    await testServer.close();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up test data
    await redis.flushall();
  });

  describe('Authentication Flow', () => {
    test('should authenticate valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'securePassword123!',
        deviceId: 'test-device'
      };

      const response = await request(testServer.url)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: expect.any(Number)
      });

      // Verify JWT structure
      const payload = jwt.decode(response.body.accessToken) as any;
      expect(payload.sub).toBeDefined();
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('should reject invalid credentials', async () => {
      const response = await request(testServer.url)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongPassword'
        })
        .expect(401);

      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });

    test('should enforce rate limiting on login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongPassword'
      };

      // Make multiple failed attempts
      const promises = Array.from({ length: 10 }, () =>
        request(testServer.url)
          .post('/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Request Proxying', () => {
    test('should proxy authenticated requests to downstream services', async () => {
      const authToken = await getValidJWTToken();
      
      // Mock downstream service
      const mockService = nock('http://identity-service:8080')
        .get('/profile')
        .reply(200, { id: 'user123', name: 'Test User' });

      const response = await request(testServer.url)
        .get('/identity/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({ id: 'user123', name: 'Test User' });
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(mockService.isDone()).toBe(true);
    });

    test('should reject unauthenticated requests', async () => {
      await request(testServer.url)
        .get('/identity/profile')
        .expect(401);
    });

    test('should handle downstream service failures gracefully', async () => {
      const authToken = await getValidJWTToken();
      
      // Mock service failure
      nock('http://identity-service:8080')
        .get('/profile')
        .reply(500, { error: 'Internal Server Error' });

      const response = await request(testServer.url)
        .get('/identity/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(502);

      expect(response.body.error).toContain('Bad Gateway');
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('should open circuit after multiple failures', async () => {
      const authToken = await getValidJWTToken();
      
      // Mock service to fail consistently
      const scope = nock('http://failing-service:8080')
        .persist()
        .get('/test')
        .reply(500);

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await request(testServer.url)
          .get('/failing-service/test')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(502);
      }

      // Next request should fail fast with circuit breaker
      const response = await request(testServer.url)
        .get('/failing-service/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body.error).toContain('Circuit breaker');
      scope.done();
    });
  });

  describe('WebSocket Integration', () => {
    test('should establish authenticated WebSocket connection', (done) => {
      getValidJWTToken().then(token => {
        const ws = new WebSocket(`ws://localhost:${testServer.port}/ws?token=${token}`);
        
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            topic: 'test-topic'
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'connection_ack') {
            expect(message.connectionId).toBeDefined();
          } else if (message.type === 'subscription_ack') {
            expect(message.topic).toBe('test-topic');
            ws.close();
            done();
          }
        });

        ws.on('error', done);
      });
    });

    test('should reject unauthenticated WebSocket connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${testServer.port}/ws?token=invalid`);
      
      ws.on('close', (code) => {
        expect(code).toBe(1008); // Authentication failed
        done();
      });
    });
  });

  // Helper functions
  async function getValidJWTToken(): Promise<string> {
    const response = await request(testServer.url)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
        deviceId: 'test-device'
      });
    
    return response.body.accessToken;
  }
});
```

### Load Testing with K6

```javascript
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const authFailures = new Counter('auth_failures');
const rateLimitHits = new Counter('rate_limit_hits');

export let options = {
  stages: [
    { duration: '2m', target: 100 },    // Ramp up to 100 users
    { duration: '5m', target: 100 },    // Stay at 100 users
    { duration: '2m', target: 500 },    // Ramp to 500 users
    { duration: '10m', target: 500 },   // Stay at 500 users
    { duration: '3m', target: 1000 },   // Spike to 1000 users
    { duration: '5m', target: 1000 },   // Stay at peak
    { duration: '5m', target: 0 },      // Ramp down
  ],
  thresholds: {
    // Performance requirements
    http_req_duration: ['p(99)<150'], // 99% of requests under 150ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
    error_rate: ['rate<0.01'],        // Custom error rate under 1%
    
    // Authentication requirements
    'http_req_duration{endpoint:auth}': ['p(95)<200'],
    
    // Rate limiting requirements
    rate_limit_hits: ['count>0'], // Ensure rate limiting is working
  },
};

// Test data
const users = Array.from({ length: 1000 }, (_, i) => ({
  email: `user${i}@example.com`,
  password: 'testPassword123!',
  id: `user${i}`
}));

let authTokens = {};

export function setup() {
  // Authenticate test users and get tokens
  const batchSize = 10;
  const tokens = {};
  
  for (let i = 0; i < Math.min(100, users.length); i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const requests = batch.map(user => ({
      method: 'POST',
      url: 'http://api-gateway:3000/auth/login',
      body: JSON.stringify({
        email: user.email,
        password: user.password
      }),
      headers: { 'Content-Type': 'application/json' }
    }));

    const responses = http.batch(requests);
    responses.forEach((response, index) => {
      if (response.status === 200) {
        const user = batch[index];
        tokens[user.id] = JSON.parse(response.body).accessToken;
      }
    });
  }
  
  return { tokens };
}

export default function(data) {
  const userId = `user${Math.floor(Math.random() * 100)}`;
  const token = data.tokens[userId];
  
  if (!token) {
    // Fallback authentication
    authenticateUser(userId);
    return;
  }

  // Test different endpoint categories
  const testScenarios = [
    () => testAuthentication(),
    () => testServiceProxy(token),
    () => testRateLimiting(token),
    () => testHealthCheck(),
  ];

  // Randomly select test scenario
  const scenario = testScenarios[Math.floor(Math.random() * testScenarios.length)];
  scenario();

  sleep(Math.random() * 2); // Random sleep between 0-2 seconds
}

function authenticateUser(userId) {
  const user = users.find(u => u.id === userId) || users[0];
  
  const response = http.post('http://api-gateway:3000/auth/login', 
    JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  const success = check(response, {
    'authentication successful': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 500,
  });

  if (!success) {
    authFailures.add(1);
  }

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testServiceProxy(token) {
  const services = ['identity', 'content', 'commerce', 'payments'];
  const endpoints = ['/profile', '/health', '/list', '/status'];
  
  const service = services[Math.floor(Math.random() * services.length)];
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const response = http.get(`http://api-gateway:3000/${service}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Client-ID': 'load-test-client'
    }
  });

  const success = check(response, {
    'proxy request successful': (r) => r.status >= 200 && r.status < 300,
    'response has correlation id': (r) => r.headers['X-Correlation-Id'] !== undefined,
    'response time under threshold': (r) => r.timings.duration < 150,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testRateLimiting(token) {
  // Burst requests to test rate limiting
  const requests = Array.from({ length: 20 }, () => ({
    method: 'GET',
    url: 'http://api-gateway:3000/identity/profile',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Client-ID': 'rate-limit-test'
    }
  }));

  const responses = http.batch(requests);
  
  let rateLimited = 0;
  responses.forEach(response => {
    if (response.status === 429) {
      rateLimited++;
      rateLimitHits.add(1);
      
      check(response, {
        'rate limit headers present': (r) => 
          r.headers['X-RateLimit-Limit'] && r.headers['X-RateLimit-Remaining']
      });
    }
  });

  // Should hit rate limit with burst requests
  check({ rateLimited }, {
    'rate limiting active': (data) => data.rateLimited > 0
  });
}

function testHealthCheck() {
  const response = http.get('http://api-gateway:3000/health');
  
  check(response, {
    'health check responds': (r) => r.status === 200,
    'health check fast': (r) => r.timings.duration < 50,
    'health status valid': (r) => {
      const body = JSON.parse(r.body);
      return ['healthy', 'degraded'].includes(body.status);
    }
  });
}

export function testWebSocket() {
  const userId = `user${Math.floor(Math.random() * 100)}`;
  const token = authTokens[userId];
  
  if (!token) return;

  const url = `ws://api-gateway:3000/ws?token=${token}`;
  const response = ws.connect(url, {}, function(socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'subscribe',
        topic: 'test-topic'
      }));
    });

    socket.on('message', (data) => {
      const message = JSON.parse(data);
      check(message, {
        'websocket message valid': (msg) => msg.type && msg.timestamp
      });
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000); // Close after 30 seconds
  });

  check(response, {
    'websocket connection established': (r) => r && r.status === 101
  });
}

export function teardown(data) {
  // Cleanup: logout test users
  Object.keys(data.tokens).forEach(userId => {
    const token = data.tokens[userId];
    http.post('http://api-gateway:3000/auth/logout', {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  });
}
```

---

## 🚀 Performance Targets & Optimization

### Performance Engineering Approach

**Benchmarking Methodology**:
1. **Baseline Measurements**: Establish current performance metrics
2. **Bottleneck Identification**: Use profiling to identify slow components  
3. **Iterative Optimization**: Apply optimizations and measure improvements
4. **Load Testing Validation**: Validate improvements under load

### Memory Optimization Strategies

```typescript
// Object Pooling for High-Frequency Objects
class RequestContextPool {
  private pool: RequestContext[] = [];
  private maxPoolSize = 1000;
  
  acquire(): RequestContext {
    return this.pool.pop() || new RequestContext();
  }
  
  release(ctx: RequestContext): void {
    if (this.pool.length < this.maxPoolSize) {
      ctx.reset(); // Clear all properties
      this.pool.push(ctx);
    }
  }
}

// String Interning for Common Values
class StringInterner {
  private cache = new Map<string, string>();
  
  intern(str: string): string {
    let interned = this.cache.get(str);
    if (!interned) {
      interned = str;
      this.cache.set(str, interned);
    }
    return interned;
  }
}

// Memory-Efficient Response Caching
class LRUResponseCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 10000;
  private currentSize = 0;
  
  set(key: string, value: any, ttl: number): void {
    if (this.currentSize >= this.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
      size: this.calculateSize(value)
    });
    this.currentSize++;
  }
  
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.currentSize--;
    }
  }
}
```

### CPU Optimization Techniques

```typescript
// Fast Path for Common Operations
class OptimizedJWTValidator {
  private cache = new Map<string, { payload: JWTPayload; expiry: number }>();
  
  async validateToken(token: string): Promise<JWTPayload> {
    // Check cache first (avoid crypto operations)
    const cached = this.cache.get(token);
    if (cached && Date.now() < cached.expiry) {
      return cached.payload;
    }
    
    // Full validation (expensive path)
    const payload = await this.fullValidation(token);
    
    // Cache for short duration to avoid repeated validation
    this.cache.set(token, {
      payload,
      expiry: Date.now() + 60000 // 1 minute cache
    });
    
    return payload;
  }
}

// Batch Operations for Redis
class BatchedRedisOperations {
  private pipeline: Redis.Pipeline | null = null;
  private batchTimeout: NodeJS.Timeout | null = null;
  
  async batchedGet(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 1) {
      // Fast path for single key
      return [await this.redis.get(keys[0])];
    }
    
    // Use pipeline for multiple keys
    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    
    return results?.map(result => result[1] as string | null) || [];
  }
}

// Efficient Route Matching
class TrieRouter {
  private root = new TrieNode();
  
  add(pattern: string, handler: RouteHandler): void {
    let node = this.root;
    for (const segment of pattern.split('/')) {
      if (!node.children[segment]) {
        node.children[segment] = new TrieNode();
      }
      node = node.children[segment];
    }
    node.handler = handler;
  }
  
  match(path: string): RouteHandler | null {
    let node = this.root;
    for (const segment of path.split('/')) {
      node = node.children[segment] || node.children['*']; // Wildcard support
      if (!node) return null;
    }
    return node.handler;
  }
}
```

### Network Optimization

```typescript
// HTTP/2 Server Push for Critical Resources
class HTTP2OptimizedGateway {
  async handleRequest(stream: Http2ServerRequest, headers: IncomingHttpHeaders): Promise<void> {
    if (headers[':path'] === '/') {
      // Push critical resources
      stream.pushStream({
        ':method': 'GET',
        ':path': '/api/user/profile',
        'authorization': headers.authorization
      }, (err, pushStream) => {
        if (!err) {
          this.handleProfileRequest(pushStream);
        }
      });
    }
  }
}

// Connection Pooling with Circuit Breaker
class IntelligentHTTPClient {
  private pools = new Map<string, ConnectionPool>();
  
  async request(url: string, options: RequestOptions): Promise<Response> {
    const pool = this.getOrCreatePool(url);
    
    if (pool.circuitBreaker.isOpen()) {
      throw new ServiceUnavailableError('Circuit breaker open');
    }
    
    try {
      const response = await pool.request(options);
      pool.circuitBreaker.recordSuccess();
      return response;
    } catch (error) {
      pool.circuitBreaker.recordFailure();
      throw error;
    }
  }
  
  private getOrCreatePool(url: string): ConnectionPool {
    if (!this.pools.has(url)) {
      this.pools.set(url, new ConnectionPool({
        maxConnections: 50,
        keepAliveTimeout: 30000,
        requestTimeout: 30000
      }));
    }
    return this.pools.get(url)!;
  }
}
```

---

## 🔒 Security Implementation

### Comprehensive Security Headers

```typescript
// Security Middleware with OWASP Compliance
class SecurityMiddleware {
  static configure(app: FastifyInstance): void {
    app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true
    });

    // Custom security headers
    app.addHook('onSend', async (request, reply, payload) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-XSS-Protection', '1; mode=block');
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });
  }
}
```

### Input Validation & Sanitization

```typescript
// Comprehensive Input Validation
const schemas = {
  loginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        pattern: '^[^<>()\\[\\]\\\\.,;:\\s@"]+@[^<>()\\[\\]\\\\.,;:\\s@"]+\\.[^<>()\\[\\]\\\\.,;:\\s@"]{2,}$'
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128
      },
      deviceId: {
        type: 'string',
        maxLength: 255,
        pattern: '^[a-zA-Z0-9_-]+$'
      }
    },
    additionalProperties: false
  },
  
  proxyRequest: {
    type: 'object',
    properties: {
      headers: {
        type: 'object',
        patternProperties: {
          '^[a-zA-Z0-9-_]+$': {
            type: 'string',
            maxLength: 8192
          }
        }
      }
    }
  }
};

// SQL Injection Prevention
class QuerySanitizer {
  static sanitizeInput(input: string): string {
    return input
      .replace(/['"\\;]/g, '') // Remove dangerous characters
      .replace(/\b(union|select|insert|update|delete|drop|exec|script)\b/gi, '') // Remove SQL keywords
      .substring(0, 1000); // Limit length
  }
  
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
```

### Advanced Threat Protection

```typescript
// Anomaly Detection for Security
class AnomalyDetector {
  private userBehavior = new Map<string, UserBehaviorProfile>();
  
  async analyzeRequest(userId: string, request: SecurityContext): Promise<ThreatLevel> {
    const profile = this.getUserProfile(userId);
    const anomalies = [];
    
    // Unusual request patterns
    if (this.detectUnusualFrequency(profile, request)) {
      anomalies.push('unusual_frequency');
    }
    
    // Geographic anomalies
    if (this.detectGeographicAnomaly(profile, request)) {
      anomalies.push('geographic_anomaly');
    }
    
    // Device fingerprint changes
    if (this.detectDeviceAnomaly(profile, request)) {
      anomalies.push('device_anomaly');
    }
    
    // Time-based anomalies
    if (this.detectTimeAnomaly(profile, request)) {
      anomalies.push('time_anomaly');
    }
    
    return this.calculateThreatLevel(anomalies);
  }
  
  private calculateThreatLevel(anomalies: string[]): ThreatLevel {
    const score = anomalies.length;
    if (score >= 3) return ThreatLevel.HIGH;
    if (score >= 2) return ThreatLevel.MEDIUM;
    if (score >= 1) return ThreatLevel.LOW;
    return ThreatLevel.NORMAL;
  }
}

// Automated Security Response
class SecurityResponseSystem {
  async handleThreat(threatLevel: ThreatLevel, context: SecurityContext): Promise<void> {
    switch (threatLevel) {
      case ThreatLevel.HIGH:
        await this.blockUser(context.userId);
        await this.notifySecurityTeam(context);
        break;
        
      case ThreatLevel.MEDIUM:
        await this.requireAdditionalAuth(context);
        await this.increaseMonitoring(context.userId);
        break;
        
      case ThreatLevel.LOW:
        await this.logSuspiciousActivity(context);
        break;
    }
  }
}
```

---

## 📊 Comprehensive Monitoring

### Advanced Metrics Collection

```typescript
// Custom Metrics for Business Intelligence
const businessMetrics = {
  userAuthentications: new Counter({
    name: 'gateway_user_authentications_total',
    help: 'Total user authentication attempts',
    labelNames: ['method', 'success', 'user_tier', 'country']
  }),
  
  apiEndpointUsage: new Counter({
    name: 'gateway_api_endpoint_usage_total',
    help: 'API endpoint usage by service and method',
    labelNames: ['service', 'endpoint', 'method', 'user_tier']
  }),
  
  revenueImpactingRequests: new Counter({
    name: 'gateway_revenue_requests_total',
    help: 'Requests that directly impact revenue',
    labelNames: ['service', 'transaction_type', 'amount_bucket']
  }),
  
  userJourneyMetrics: new Histogram({
    name: 'gateway_user_journey_duration',
    help: 'Time spent in different user journey stages',
    labelNames: ['journey_stage', 'user_tier'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300, 600]
  })
};

// Real-time Dashboard Metrics
class RealTimeDashboard {
  private metrics = {
    activeUsers: new Set<string>(),
    requestsPerSecond: 0,
    averageLatency: 0,
    errorRate: 0
  };
  
  private windowSize = 60000; // 1 minute
  private requestWindow: number[] = [];
  
  recordRequest(userId: string, latency: number, isError: boolean): void {
    const now = Date.now();
    
    // Update active users
    this.metrics.activeUsers.add(userId);
    
    // Update request window
    this.requestWindow.push(now);
    this.requestWindow = this.requestWindow.filter(t => now - t < this.windowSize);
    
    // Calculate RPS
    this.metrics.requestsPerSecond = this.requestWindow.length / (this.windowSize / 1000);
    
    // Update latency (exponential moving average)
    this.metrics.averageLatency = this.metrics.averageLatency * 0.9 + latency * 0.1;
    
    // Update error rate
    if (isError) {
      this.metrics.errorRate = this.metrics.errorRate * 0.9 + 0.1;
    } else {
      this.metrics.errorRate = this.metrics.errorRate * 0.9;
    }
  }
  
  getSnapshot(): DashboardSnapshot {
    return {
      activeUsers: this.metrics.activeUsers.size,
      requestsPerSecond: Math.round(this.metrics.requestsPerSecond),
      averageLatency: Math.round(this.metrics.averageLatency),
      errorRate: Math.round(this.metrics.errorRate * 100) / 100,
      timestamp: Date.now()
    };
  }
}
```

### Intelligent Alerting System

```typescript
// Multi-level Alerting with Context
class IntelligentAlertManager {
  private alertRules: AlertRule[] = [
    {
      name: 'High Error Rate',
      condition: (metrics) => metrics.errorRate > 0.05,
      severity: AlertSeverity.CRITICAL,
      cooldown: 300000, // 5 minutes
      actions: ['page_oncall', 'slack_critical', 'auto_scale']
    },
    {
      name: 'High Latency',
      condition: (metrics) => metrics.p99Latency > 200,
      severity: AlertSeverity.WARNING,
      cooldown: 180000, // 3 minutes
      actions: ['slack_warning', 'investigate_auto']
    },
    {
      name: 'Rate Limit Threshold',
      condition: (metrics) => metrics.rateLimitHitRate > 0.1,
      severity: AlertSeverity.INFO,
      cooldown: 600000, // 10 minutes
      actions: ['log_analysis', 'capacity_review']
    }
  ];
  
  async evaluateAlerts(metrics: SystemMetrics): Promise<void> {
    for (const rule of this.alertRules) {
      if (rule.condition(metrics)) {
        await this.triggerAlert(rule, metrics);
      }
    }
  }
  
  private async triggerAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    const alertKey = `alert:${rule.name}`;
    const lastAlerted = await this.redis.get(alertKey);
    
    if (lastAlerted && Date.now() - parseInt(lastAlerted) < rule.cooldown) {
      return; // Still in cooldown
    }
    
    // Execute alert actions
    for (const action of rule.actions) {
      await this.executeAction(action, rule, metrics);
    }
    
    // Set cooldown
    await this.redis.setex(alertKey, Math.ceil(rule.cooldown / 1000), Date.now().toString());
  }
}
```

---

## 🎯 Learning Milestones & Computer Science Concepts

### Distributed Systems Concepts Applied

**1. Consistency Models in Rate Limiting**
```typescript
// Eventually Consistent Rate Limiting
class EventuallyConsistentRateLimiter {
  /**
   * Implements eventual consistency for distributed rate limiting
   * Trade-off: Slight over-limit allowances for better performance
   * 
   * CAP Theorem Application:
   * - Choosing Availability over strict Consistency
   * - Partition tolerance maintained through Redis clustering
   */
  
  async checkLimit(key: string, limit: number): Promise<boolean> {
    // Local cache check (fast path)
    const localCount = this.localCache.get(key) || 0;
    
    if (localCount > limit * 1.1) { // 10% tolerance
      return false; // Definitely over limit
    }
    
    if (localCount < limit * 0.8) { // 20% under limit
      this.localCache.set(key, localCount + 1);
      this.scheduleAsyncSync(key); // Eventual consistency
      return true;
    }
    
    // Uncertain region - check Redis
    return this.checkRedisLimit(key, limit);
  }
}
```

**2. Consistent Hashing for Load Balancing**
```typescript
// Consistent Hashing Implementation
class ConsistentHashLoadBalancer {
  private ring = new Map<number, ServiceNode>();
  private virtualNodes = 150; // Reduces hotspots
  
  addNode(node: ServiceNode): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${node.id}:${i}`);
      this.ring.set(hash, node);
    }
  }
  
  getNode(key: string): ServiceNode {
    const hash = this.hash(key);
    const keys = Array.from(this.ring.keys()).sort((a, b) => a - b);
    
    // Find first node >= hash (clockwise)
    const nodeHash = keys.find(k => k >= hash) || keys[0];
    return this.ring.get(nodeHash)!;
  }
  
  private hash(input: string): number {
    // SHA-1 hash function for even distribution
    return crypto.createHash('sha1').update(input).digest().readUInt32BE(0);
  }
}
```

**3. State Machines for Circuit Breaker**
```typescript
// Finite State Machine Implementation
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN', 
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreakerStateMachine {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  
  /**
   * State Transition Logic:
   * CLOSED -> OPEN: After threshold failures
   * OPEN -> HALF_OPEN: After recovery timeout
   * HALF_OPEN -> CLOSED: After successful requests
   * HALF_OPEN -> OPEN: On failure
   */
  
  handleRequest(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
        
      case CircuitState.OPEN:
        if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;
        
      case CircuitState.HALF_OPEN:
        return true; // Allow limited requests
    }
  }
  
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED);
      this.failureCount = 0;
    }
  }
  
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.CLOSED && 
        this.failureCount >= this.threshold) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    }
  }
}
```

### Advanced Algorithm Applications

**4. Sliding Window Algorithm Analysis**
```typescript
/**
 * Time Complexity Analysis:
 * - ZADD: O(log N) where N is number of elements in sorted set
 * - ZREMRANGEBYSCORE: O(log N + M) where M is elements removed
 * - ZCARD: O(1)
 * 
 * Space Complexity: O(W) where W is window size in requests
 * 
 * Advantages over Token Bucket:
 * - More precise rate limiting
 * - Better handling of burst traffic
 * - Exact sliding window vs approximated fixed windows
 */

class SlidingWindowAnalysis {
  async benchmark(): Promise<void> {
    const measurements = [];
    
    for (let load = 100; load <= 10000; load += 100) {
      const startTime = process.hrtime.bigint();
      
      // Simulate load
      for (let i = 0; i < load; i++) {
        await this.checkSlidingWindow(`user${i}`, 60000, 1000);
      }
      
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // ms
      measurements.push({ load, duration, opsPerSecond: load / (duration / 1000) });
    }
    
    console.log('Sliding Window Performance:');
    measurements.forEach(m => 
      console.log(`Load: ${m.load}, Duration: ${m.duration}ms, OPS: ${m.opsPerSecond}`)
    );
  }
}
```

**5. Hash Table Optimization Strategies**
```typescript
// Multiple Hash Table Strategies for Different Use Cases
class OptimizedHashTables {
  // Robin Hood Hashing for API Key Cache
  private apiKeyCache = new RobinHoodHashMap<string, APIKeyData>();
  
  // Cuckoo Hashing for JWT Blacklist (constant worst-case lookup)
  private jwtBlacklist = new CuckooHashMap<string, boolean>();
  
  // Consistent Hashing for Service Selection
  private serviceRing = new ConsistentHashRing<ServiceEndpoint>();
  
  /**
   * Hash Table Selection Criteria:
   * 
   * 1. API Key Cache: Robin Hood Hashing
   *    - High load factor acceptable
   *    - Good cache locality
   *    - Reasonable worst-case performance
   * 
   * 2. JWT Blacklist: Cuckoo Hashing
   *    - O(1) worst-case lookup crucial for security
   *    - Insert performance less critical
   *    - Space efficiency important
   * 
   * 3. Service Selection: Consistent Hashing
   *    - Minimal disruption on node changes
   *    - Even load distribution
   *    - Virtual nodes reduce hotspots
   */
  
  async benchmarkHashTables(): Promise<void> {
    const results = {
      robinHood: await this.benchmarkRobinHood(),
      cuckoo: await this.benchmarkCuckoo(),
      consistent: await this.benchmarkConsistent()
    };
    
    console.log('Hash Table Performance Comparison:', results);
  }
}
```

### Week 3-4 Learning Checkpoints

**Week 3 Achievements**:
- [ ] **JWT Cryptography Mastery**: Understand RSA signatures, key rotation, and security implications
- [ ] **OAuth2 Security Model**: Implement PKCE, understand attack vectors, and security best practices  
- [ ] **Rate Limiting Mathematics**: Master token bucket and sliding window algorithms with complexity analysis
- [ ] **Redis Data Structures**: Apply sorted sets, hash maps, and atomic operations effectively

**Week 4 Achievements**:
- [ ] **Distributed Systems Patterns**: Circuit breaker state machines, service discovery, and failure handling
- [ ] **Performance Engineering**: Connection pooling, memory optimization, and profiling techniques
- [ ] **Security Engineering**: Threat detection, anomaly analysis, and automated response systems
- [ ] **Observability Engineering**: Metrics design, distributed tracing, and intelligent alerting

### Final Assessment Criteria

**Technical Mastery (40%)**:
- Correct implementation of all core algorithms
- Understanding of time/space complexity trade-offs
- Proper application of data structures
- Security best practices implementation

**System Design (30%)**:
- Scalability considerations and bottleneck identification
- Fault tolerance and graceful degradation
- Monitoring and observability design
- Performance optimization strategies

**Code Quality (20%)**:
- Clean, maintainable, and well-documented code
- Comprehensive test coverage (>90%)
- Error handling and edge case management
- Consistent coding standards and patterns

**Production Readiness (10%)**:
- Deployment configuration and automation
- Security hardening and compliance
- Operational runbooks and troubleshooting guides
- Performance validation under load

---

## ✅ Final Implementation Checklist

### Core Functionality ✅
- [ ] **JWT Authentication System**
  - [ ] RSA key pair generation and management
  - [ ] Token generation with configurable expiration
  - [ ] Signature verification with performance optimization
  - [ ] Blacklist management with Redis integration
  - [ ] Refresh token rotation mechanism

- [ ] **OAuth2 Authorization Server**
  - [ ] Authorization endpoint with PKCE support
  - [ ] Token exchange with proper validation
  - [ ] Client registration and management
  - [ ] Scope-based authorization controls
  - [ ] Security compliance (RFC 6749, RFC 7636)

- [ ] **Distributed Rate Limiting**
  - [ ] Token bucket algorithm implementation
  - [ ] Sliding window counter system
  - [ ] Hierarchical rate limiting (global, user, IP, API key)
  - [ ] Redis-based coordination with atomic operations
  - [ ] Rate limit policy configuration system

- [ ] **Request Routing & Load Balancing**
  - [ ] Dynamic service discovery integration
  - [ ] Consistent hashing for load distribution
  - [ ] Health checking with exponential backoff
  - [ ] Circuit breaker with state machine implementation
  - [ ] Fallback response strategies

### Advanced Features ✅
- [ ] **WebSocket Gateway**
  - [ ] Authenticated WebSocket connections
  - [ ] Message routing and filtering
  - [ ] Connection pooling and management
  - [ ] Real-time rate limiting
  - [ ] Subscription management system

- [ ] **Service Mesh Integration**
  - [ ] Istio sidecar configuration
  - [ ] mTLS certificate management
  - [ ] Traffic routing policies
  - [ ] Security policies and RBAC
  - [ ] Distributed tracing integration

- [ ] **Request/Response Pipeline**
  - [ ] Request transformation and validation
  - [ ] Response caching with intelligent invalidation
  - [ ] Correlation ID management
  - [ ] Request deduplication
  - [ ] Compression and content negotiation

### Performance & Reliability ✅
- [ ] **Performance Targets Achievement**
  - [ ] <150ms p99 latency under 50k RPS load
  - [ ] Memory usage <1GB under peak load
  - [ ] Error rate <0.1% for healthy services
  - [ ] 99.99% uptime with graceful degradation

- [ ] **Optimization Implementation**
  - [ ] Connection pooling for upstream services
  - [ ] HTTP/2 support with server push
  - [ ] Memory management and garbage collection tuning
  - [ ] CPU optimization with fast paths
  - [ ] Response caching strategies

### Security & Compliance ✅
- [ ] **Security Implementation**
  - [ ] OWASP Top 10 compliance
  - [ ] Input validation and sanitization
  - [ ] Security headers (CSP, HSTS, etc.)
  - [ ] Threat detection and response
  - [ ] Audit logging and compliance

- [ ] **Authentication Security**
  - [ ] JWT security best practices
  - [ ] Token binding and fingerprinting
  - [ ] Secure key management
  - [ ] Multi-factor authentication support
  - [ ] Session management security

### Monitoring & Operations ✅
- [ ] **Comprehensive Monitoring**
  - [ ] Prometheus metrics collection
  - [ ] Grafana dashboards
  - [ ] OpenTelemetry distributed tracing
  - [ ] Real-time alerting system
  - [ ] Performance profiling tools

- [ ] **Operational Excellence**
  - [ ] Health check endpoints
  - [ ] Configuration management
  - [ ] Deployment automation
  - [ ] Disaster recovery procedures
  - [ ] Operational runbooks

### Testing & Quality ✅
- [ ] **Testing Coverage**
  - [ ] Unit tests >95% coverage
  - [ ] Integration tests for key workflows
  - [ ] Load testing with K6
  - [ ] Security testing and penetration testing
  - [ ] Chaos engineering validation

- [ ] **Documentation**
  - [ ] API documentation (OpenAPI 3.0)
  - [ ] Architecture decision records
  - [ ] Deployment guides
  - [ ] Troubleshooting guides
  - [ ] Performance tuning guides

---

**🎓 Learning Outcome**: By completing this API Gateway implementation, you will have mastered enterprise-grade distributed systems patterns, advanced algorithms and data structures, security engineering practices, and production-level performance optimization techniques.

**Next Steps**: Proceed to `services/identity/TODO.md` for OAuth2 server and user management implementation, or `services/content/TODO.md` for content delivery and media processing systems.

---

*This comprehensive API Gateway forms the critical foundation of the Suuupra platform, applying cutting-edge computer science concepts to real-world distributed systems challenges. The implementation balances theoretical rigor with practical engineering excellence.*