# 🚪 API Gateway Service - Implementation Guide

## 📋 Service Overview

**Role**: Central entry point for all client requests, handling authentication, rate limiting, request routing, and service mesh integration. Acts as the protective barrier and traffic orchestrator for the entire Suuupra platform.

**Learning Objectives**: 
- Master JWT authentication and token lifecycle management
- Implement distributed rate limiting algorithms
- Design high-performance reverse proxy systems
- Understand service mesh integration patterns
- Apply circuit breaker and bulkhead patterns

**System Requirements**:
- Handle 50k+ RPS with <150ms p99 latency
- 99.99% uptime with graceful degradation
- Support OAuth2, JWT, and API key authentication
- Implement distributed rate limiting across instances

---

## 🏗️ Architecture & Design

### Core Components Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Service                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Authentication │   Rate Limiting  │    Request Routing      │
│   - JWT Verify  │   - Token Bucket │   - Service Discovery   │
│   - OAuth2 Flow │   - Sliding Win  │   - Health Checks       │
│   - API Keys    │   - Redis Store  │   - Load Balancing      │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Circuit Breaker │   Monitoring     │    Request/Response     │
│   - Failure Det │   - Metrics      │    - Logging           │
│   - Fallbacks   │   - Tracing      │    - Transformation    │
│   - Recovery    │   - Alerting     │    - Validation        │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Technology Stack
- **Runtime**: Node.js 22+ with TypeScript
- **Framework**: Fastify (high-performance HTTP server)
- **Authentication**: jsonwebtoken, @fastify/oauth2
- **Caching/Rate Limiting**: Redis 7+ with RedisJSON
- **Service Discovery**: Consul or Kubernetes DNS
- **Monitoring**: OpenTelemetry, Prometheus metrics

### Data Structures & Algorithms

**Hash Tables (O(1) lookups)**:
- JWT token blacklist management
- API key validation cache
- Service endpoint routing table

**Token Bucket Algorithm**:
```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private capacity: number,
    private refillRate: number // tokens per second
  ) {}
  
  canConsume(tokens: number = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
}
```

**Sliding Window Rate Limiting**:
```typescript
interface SlidingWindowCounter {
  windowSize: number;
  buckets: Map<number, number>; // timestamp -> count
  
  isAllowed(userId: string, limit: number): boolean;
}
```

---

## 📅 Week-by-Week Implementation Plan

### Week 1: Foundation & Authentication (Days 1-7)

#### Day 1-2: Project Setup & JWT Foundation
**Learning Focus**: JWT structure, cryptographic signing, token lifecycle

**Tasks**:
- [ ] Initialize Node.js TypeScript project with Fastify
- [ ] Setup development environment with hot reload
- [ ] Create JWT service with RS256 signing
- [ ] Implement token generation, validation, and refresh logic
- [ ] Create JWT blacklist with Redis for logout/revoke

**Code Example - JWT Service**:
```typescript
interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  scope: string[];
  sessionId: string;
}

class JWTService {
  private publicKey: string;
  private privateKey: string;
  
  async generateTokens(userId: string, scopes: string[]) {
    const accessToken = await this.signJWT({
      sub: userId,
      scope: scopes,
      sessionId: generateSessionId()
    }, '15m');
    
    const refreshToken = await this.signJWT({
      sub: userId,
      tokenType: 'refresh'
    }, '7d');
    
    return { accessToken, refreshToken };
  }
  
  async validateToken(token: string): Promise<JWTPayload> {
    // Verify signature and check blacklist
    const payload = jwt.verify(token, this.publicKey) as JWTPayload;
    
    const isBlacklisted = await this.redis.get(`blacklist:${payload.sessionId}`);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token revoked');
    }
    
    return payload;
  }
}
```

#### Day 3-4: OAuth2 Integration
**Learning Focus**: OAuth2 flows, PKCE, authorization servers

**Tasks**:
- [ ] Implement OAuth2 authorization code flow
- [ ] Add PKCE (Proof Key for Code Exchange) support
- [ ] Create OAuth2 client registration system
- [ ] Build authorization endpoint with consent UI
- [ ] Implement token introspection and user info endpoints

**OAuth2 Flow Implementation**:
```typescript
class OAuth2Service {
  async authorizeRequest(req: AuthorizeRequest): Promise<AuthorizeResponse> {
    // Validate client_id, redirect_uri, response_type
    // Generate authorization code with PKCE challenge
    // Store code with expiration (10 minutes)
    
    const authCode = await this.generateAuthCode({
      clientId: req.client_id,
      userId: req.userId,
      codeChallenge: req.code_challenge,
      codeChallengeMethod: req.code_challenge_method,
      scope: req.scope
    });
    
    return {
      code: authCode,
      state: req.state,
      redirect_uri: req.redirect_uri
    };
  }
  
  async exchangeCodeForTokens(req: TokenRequest): Promise<TokenResponse> {
    // Verify authorization code and PKCE verifier
    // Generate access and refresh tokens
    // Implement token rotation for security
  }
}
```

#### Day 5-7: API Key Management
**Learning Focus**: API key generation, hashing, scope-based authorization

**Tasks**:
- [ ] Create API key generation with cryptographic randomness
- [ ] Implement API key hashing and storage (SHA-256)
- [ ] Build scope-based authorization system
- [ ] Add API key rotation and versioning
- [ ] Create API key usage analytics and monitoring

### Week 2: Rate Limiting & Request Management (Days 8-14)

#### Day 8-10: Distributed Rate Limiting
**Learning Focus**: Rate limiting algorithms, distributed coordination, Redis patterns

**Tasks**:
- [ ] Implement token bucket algorithm with Redis
- [ ] Create sliding window rate limiting
- [ ] Build hierarchical rate limiting (user, IP, global)
- [ ] Add rate limit headers (X-RateLimit-* standard)
- [ ] Implement rate limit bypass for premium users

**Rate Limiting Implementation**:
```typescript
class DistributedRateLimiter {
  constructor(
    private redis: Redis,
    private windowSize: number = 60000, // 1 minute
    private maxRequests: number = 1000
  ) {}
  
  async isAllowed(key: string, weight: number = 1): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.zcount(key, windowStart, now);
    pipeline.expire(key, Math.ceil(this.windowSize / 1000));
    
    const results = await pipeline.exec();
    const currentCount = results[2][1] as number;
    
    return {
      allowed: currentCount <= this.maxRequests,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - currentCount),
      resetTime: now + this.windowSize
    };
  }
}
```

#### Day 11-12: Request Routing & Service Discovery
**Learning Focus**: Service mesh patterns, health checking, load balancing algorithms

**Tasks**:
- [ ] Implement dynamic service discovery with Consul/K8s
- [ ] Create weighted round-robin load balancing
- [ ] Build health checking with exponential backoff
- [ ] Add request routing based on headers/path patterns
- [ ] Implement canary deployment support

**Service Discovery & Routing**:
```typescript
interface ServiceEndpoint {
  id: string;
  address: string;
  port: number;
  weight: number;
  health: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: Date;
}

class ServiceRegistry {
  private services = new Map<string, ServiceEndpoint[]>();
  
  async getHealthyEndpoint(serviceName: string): Promise<ServiceEndpoint | null> {
    const endpoints = this.services.get(serviceName) || [];
    const healthy = endpoints.filter(ep => ep.health === 'healthy');
    
    if (healthy.length === 0) return null;
    
    // Weighted random selection
    const totalWeight = healthy.reduce((sum, ep) => sum + ep.weight, 0);
    const randomWeight = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const endpoint of healthy) {
      currentWeight += endpoint.weight;
      if (randomWeight <= currentWeight) {
        return endpoint;
      }
    }
    
    return healthy[0]; // fallback
  }
}
```

#### Day 13-14: Circuit Breaker Implementation
**Learning Focus**: Failure detection, state machines, graceful degradation

**Tasks**:
- [ ] Implement circuit breaker state machine
- [ ] Add failure threshold configuration
- [ ] Create fallback response strategies
- [ ] Build circuit breaker metrics and monitoring
- [ ] Test failure scenarios and recovery

### Week 3: Advanced Features & Performance (Days 15-21)

#### Day 15-17: Request/Response Pipeline
**Learning Focus**: HTTP processing, transformation, caching strategies

**Tasks**:
- [ ] Implement request/response logging with correlation IDs
- [ ] Add request transformation and validation
- [ ] Create response caching with TTL management
- [ ] Build request deduplication for idempotent operations
- [ ] Add compression and content negotiation

**Request Pipeline**:
```typescript
interface RequestPipeline {
  authenticate(req: FastifyRequest): Promise<AuthContext>;
  authorize(ctx: AuthContext, resource: string): Promise<boolean>;
  rateLimit(ctx: AuthContext): Promise<RateLimitResult>;
  route(req: FastifyRequest): Promise<ServiceEndpoint>;
  transform(req: FastifyRequest): Promise<TransformedRequest>;
  forward(req: TransformedRequest, endpoint: ServiceEndpoint): Promise<Response>;
}

class GatewayHandler {
  async handleRequest(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = req.headers['x-correlation-id'] || generateId();
    const startTime = process.hrtime.bigint();
    
    try {
      // Authentication
      const authContext = await this.pipeline.authenticate(req);
      
      // Rate limiting
      const rateLimitResult = await this.pipeline.rateLimit(authContext);
      if (!rateLimitResult.allowed) {
        return reply.status(429).send({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.resetTime
        });
      }
      
      // Service routing
      const endpoint = await this.pipeline.route(req);
      if (!endpoint) {
        return reply.status(503).send({ error: 'Service unavailable' });
      }
      
      // Forward request
      const response = await this.pipeline.forward(req, endpoint);
      
      // Set rate limit headers
      reply.headers({
        'X-RateLimit-Limit': rateLimitResult.limit,
        'X-RateLimit-Remaining': rateLimitResult.remaining,
        'X-Correlation-ID': correlationId
      });
      
      return reply.status(response.status).send(response.body);
      
    } catch (error) {
      this.handleError(error, reply, correlationId);
    } finally {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      this.metrics.recordRequestDuration(duration);
    }
  }
}
```

#### Day 18-19: WebSocket Gateway
**Learning Focus**: WebSocket proxying, real-time communication patterns

**Tasks**:
- [ ] Implement WebSocket authentication and authorization
- [ ] Create WebSocket connection pooling and routing
- [ ] Add WebSocket message transformation and filtering
- [ ] Build connection state management
- [ ] Implement WebSocket rate limiting

#### Day 20-21: Performance Optimization
**Learning Focus**: Profiling, memory management, CPU optimization

**Tasks**:
- [ ] Implement connection pooling for upstream services
- [ ] Add HTTP/2 support with server push
- [ ] Optimize memory usage and garbage collection
- [ ] Create performance benchmarking suite
- [ ] Add CPU and memory profiling

---

## 📊 Database Schema Design

### Redis Schema for Rate Limiting
```redis
# Token bucket for user rate limiting
SET rate_limit:user:${userId} '{"tokens": 100, "lastRefill": ${timestamp}}'

# Sliding window counters
ZADD rate_limit:sliding:${userId} ${timestamp} "${timestamp}-${requestId}"

# API key cache
HSET api_keys:${keyId} "userId" "${userId}" "scopes" "${scopes}" "lastUsed" "${timestamp}"

# JWT blacklist
SET jwt_blacklist:${sessionId} "revoked" EX 86400

# Circuit breaker state
HSET circuit_breaker:${serviceName} "state" "OPEN" "failures" "5" "lastFailure" "${timestamp}"
```

### PostgreSQL Schema for Configuration
```sql
-- API Gateway configuration
CREATE TABLE gateway_routes (
    id SERIAL PRIMARY KEY,
    path_pattern VARCHAR(255) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    auth_required BOOLEAN DEFAULT true,
    rate_limit_rpm INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(path_pattern, method)
);

-- Rate limiting policies
CREATE TABLE rate_limit_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(100) UNIQUE NOT NULL,
    requests_per_minute INTEGER NOT NULL,
    burst_capacity INTEGER NOT NULL,
    window_size_seconds INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API clients and keys
CREATE TABLE api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(255) NOT NULL,
    client_secret_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    scopes TEXT[] DEFAULT '{}',
    rate_limit_policy_id INTEGER REFERENCES rate_limit_policies(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service registry
CREATE TABLE service_registry (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    endpoint_url VARCHAR(255) NOT NULL,
    health_check_url VARCHAR(255),
    weight INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    last_health_check TIMESTAMP,
    health_status VARCHAR(20) DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 API Design & Specifications

### OpenAPI 3.0 Specification
```yaml
openapi: 3.0.3
info:
  title: Suuupra API Gateway
  version: 1.0.0
  description: Central API Gateway for Suuupra EdTech Platform

paths:
  /auth/login:
    post:
      summary: Authenticate user and generate tokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                mfaToken:
                  type: string
                  description: Multi-factor authentication token
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken:
                    type: string
                    description: JWT access token
                  refreshToken:
                    type: string
                    description: Refresh token for token renewal
                  expiresIn:
                    type: integer
                    description: Access token expiry in seconds
                  tokenType:
                    type: string
                    default: "Bearer"

  /auth/refresh:
    post:
      summary: Refresh access token
      security:
        - refreshToken: []
      responses:
        '200':
          description: Token refreshed successfully
        '401':
          description: Invalid or expired refresh token

  /oauth2/authorize:
    get:
      summary: OAuth2 authorization endpoint
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
        - name: state
          in: query
          schema:
            type: string
        - name: code_challenge
          in: query
          required: true
          schema:
            type: string
        - name: code_challenge_method
          in: query
          required: true
          schema:
            type: string
            enum: [S256]

  # Proxy endpoints for all services
  /{service}/{path*}:
    x-fastify-prefix: /
    all:
      summary: Proxy all requests to downstream services
      parameters:
        - name: service
          in: path
          required: true
          schema:
            type: string
            enum: [identity, content, commerce, payments, live-classes, vod]
        - name: path
          in: path
          required: false
          schema:
            type: string
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
        '503':
          description: Service unavailable

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
    refreshToken:
      type: http
      scheme: bearer
      bearerFormat: refresh_token
```

---

## 🧪 Testing Strategy

### Unit Tests (Target: 90% Coverage)
```typescript
// JWT Service Tests
describe('JWTService', () => {
  test('should generate valid JWT tokens', async () => {
    const tokens = await jwtService.generateTokens('user123', ['read', 'write']);
    
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    
    const payload = await jwtService.validateToken(tokens.accessToken);
    expect(payload.sub).toBe('user123');
    expect(payload.scope).toEqual(['read', 'write']);
  });
  
  test('should reject blacklisted tokens', async () => {
    const tokens = await jwtService.generateTokens('user123', ['read']);
    await jwtService.revokeToken(tokens.accessToken);
    
    await expect(jwtService.validateToken(tokens.accessToken))
      .rejects.toThrow('Token revoked');
  });
});

// Rate Limiter Tests
describe('DistributedRateLimiter', () => {
  test('should allow requests within limit', async () => {
    const limiter = new DistributedRateLimiter(redis, 60000, 100);
    
    const result = await limiter.isAllowed('user123');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });
  
  test('should deny requests exceeding limit', async () => {
    const limiter = new DistributedRateLimiter(redis, 60000, 1);
    
    await limiter.isAllowed('user123'); // First request
    const result = await limiter.isAllowed('user123'); // Second request
    
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
```

### Integration Tests
```typescript
describe('Gateway Integration', () => {
  test('should proxy authenticated requests', async () => {
    const authToken = await getValidJWTToken();
    
    const response = await request(app)
      .get('/identity/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
      
    expect(response.headers['x-correlation-id']).toBeDefined();
  });
  
  test('should handle circuit breaker scenarios', async () => {
    // Simulate service failure
    mockService.simulateFailure();
    
    // Multiple requests to trigger circuit breaker
    for (let i = 0; i < 10; i++) {
      await request(app).get('/failing-service/test');
    }
    
    const response = await request(app)
      .get('/failing-service/test')
      .expect(503);
      
    expect(response.body.error).toContain('Circuit breaker');
  });
});
```

### Load Tests (K6)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<150'], // 99% of requests under 150ms
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
  },
};

export default function () {
  let authToken = 'your-jwt-token';
  
  let response = http.get('http://localhost:3000/identity/profile', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'X-API-Key': 'test-api-key',
    },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 150ms': (r) => r.timings.duration < 150,
    'has correlation id': (r) => r.headers['X-Correlation-ID'] !== undefined,
  });
  
  sleep(1);
}
```

---

## 🚀 Performance Targets & Optimization

### Performance Requirements
- **Latency**: p99 < 150ms for all proxy requests
- **Throughput**: 50,000+ RPS per instance
- **Memory**: < 1GB RAM under normal load
- **CPU**: < 70% utilization at peak load
- **Error Rate**: < 0.1% for healthy downstream services

### Optimization Techniques

#### 1. Connection Pooling
```typescript
class HTTPClientPool {
  private pools = new Map<string, Agent>();
  
  getAgent(baseURL: string): Agent {
    if (!this.pools.has(baseURL)) {
      this.pools.set(baseURL, new Agent({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000
      }));
    }
    return this.pools.get(baseURL)!;
  }
}
```

#### 2. Response Caching
```typescript
interface CacheEntry {
  data: any;
  expiry: number;
  etag: string;
}

class ResponseCache {
  private cache = new LRUCache<string, CacheEntry>({ max: 10000 });
  
  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }
}
```

#### 3. Memory Management
```typescript
// Implement object pooling for high-frequency objects
class RequestContextPool {
  private pool: RequestContext[] = [];
  
  acquire(): RequestContext {
    return this.pool.pop() || new RequestContext();
  }
  
  release(ctx: RequestContext): void {
    ctx.reset();
    if (this.pool.length < 100) {
      this.pool.push(ctx);
    }
  }
}
```

---

## 🔒 Security Considerations

### Security Requirements
- OWASP Top 10 compliance
- JWT security best practices
- Rate limiting to prevent DDoS
- Input validation and sanitization
- Secure headers implementation

### Security Implementation
```typescript
// Security headers middleware
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input validation
const loginSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+'
    }
  },
  additionalProperties: false
};
```

### JWT Security Best Practices
```typescript
class SecureJWTService {
  // Use short-lived access tokens
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  
  // Implement token rotation
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = await this.validateRefreshToken(refreshToken);
    
    // Invalidate old refresh token
    await this.revokeRefreshToken(refreshToken);
    
    // Generate new token pair
    return this.generateTokens(payload.sub, payload.scope);
  }
  
  // Add token binding to prevent token theft
  generateBoundToken(userId: string, clientFingerprint: string) {
    return this.signJWT({
      sub: userId,
      client_fingerprint: hash(clientFingerprint)
    });
  }
}
```

---

## 📊 Monitoring & Observability

### Metrics Collection
```typescript
// Prometheus metrics
const requestDuration = new Histogram({
  name: 'gateway_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'service']
});

const requestsTotal = new Counter({
  name: 'gateway_requests_total',
  help: 'Total number of requests',
  labelNames: ['method', 'route', 'status_code', 'service']
});

const rateLimitExceeded = new Counter({
  name: 'gateway_rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['user_id', 'client_id', 'policy']
});

const circuitBreakerState = new Gauge({
  name: 'gateway_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service']
});
```

### Distributed Tracing
```typescript
// OpenTelemetry integration
const tracer = opentelemetry.trace.getTracer('api-gateway');

async function traceRequest(req: FastifyRequest, reply: FastifyReply) {
  const span = tracer.startSpan(`${req.method} ${req.url}`);
  
  span.setAttributes({
    'http.method': req.method,
    'http.url': req.url,
    'user.id': req.user?.id,
    'http.request_content_length': req.headers['content-length']
  });
  
  try {
    await handleRequest(req, reply);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
  } finally {
    span.end();
  }
}
```

### Health Checks
```typescript
// Comprehensive health check
app.get('/health', async (request, reply) => {
  const checks = await Promise.allSettled([
    checkRedisConnection(),
    checkDatabaseConnection(),
    checkDownstreamServices(),
    checkCertificateExpiry()
  ]);
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      redis: checks[0].status === 'fulfilled',
      database: checks[1].status === 'fulfilled',
      services: checks[2].status === 'fulfilled',
      certificates: checks[3].status === 'fulfilled'
    }
  };
  
  const isHealthy = Object.values(health.checks).every(Boolean);
  health.status = isHealthy ? 'healthy' : 'degraded';
  
  return reply.status(isHealthy ? 200 : 503).send(health);
});
```

---

## 🎯 Learning Milestones & CS Concepts

### Week 1 Milestones
- [ ] **Understanding JWT Architecture**: Learn token-based authentication, cryptographic signatures, and security implications
- [ ] **OAuth2 Protocol Mastery**: Implement authorization flows with deep understanding of security considerations
- [ ] **Hash Table Applications**: Apply hash tables for O(1) token lookups and caching strategies

### Week 2 Milestones  
- [ ] **Rate Limiting Algorithms**: Master token bucket and sliding window algorithms with mathematical analysis
- [ ] **Distributed Systems Coordination**: Implement distributed rate limiting with Redis coordination
- [ ] **Load Balancing Algorithms**: Apply weighted round-robin and consistent hashing concepts

### Week 3 Milestones
- [ ] **State Machine Design**: Implement circuit breaker as finite state machine with transition logic
- [ ] **Performance Engineering**: Apply profiling techniques and performance optimization strategies
- [ ] **Reliability Patterns**: Master bulkhead, timeout, and retry patterns for system resilience

### Computer Science Concepts Applied

**Algorithms & Data Structures**:
- Hash Tables: O(1) token validation, API key lookups, routing table
- Trees: Service discovery hierarchy, permission trees
- State Machines: Circuit breaker states, OAuth2 flow states
- Time-based Algorithms: Token bucket, sliding window counters

**Distributed Systems**:
- Consistency Models: Eventually consistent rate limiting across instances
- CAP Theorem: Trade-offs between consistency and availability in rate limiting
- Distributed Coordination: Redis-based coordination for shared state

**Security & Cryptography**:
- Digital Signatures: JWT RS256 signing and verification
- Hash Functions: API key hashing, secure token generation
- Time-based Security: Token expiration, replay attack prevention

---

## ✅ Completion Checklist

### Core Functionality
- [ ] JWT authentication with RS256 signing
- [ ] OAuth2 authorization code flow with PKCE
- [ ] API key management and validation
- [ ] Distributed rate limiting with Redis
- [ ] Service discovery and health checking
- [ ] Circuit breaker implementation
- [ ] Request/response transformation
- [ ] Comprehensive logging and tracing

### Performance & Scale
- [ ] Achieve <150ms p99 latency under 50k RPS load
- [ ] Memory usage stays under 1GB under peak load
- [ ] Connection pooling reduces connection overhead
- [ ] Response caching improves frequently accessed endpoints
- [ ] Load balancing distributes traffic evenly

### Security & Compliance
- [ ] OWASP Top 10 vulnerabilities addressed
- [ ] Secure JWT implementation with short expiry
- [ ] Rate limiting prevents DDoS attacks
- [ ] Input validation prevents injection attacks
- [ ] Security headers implemented correctly

### Monitoring & Operations
- [ ] Prometheus metrics collection
- [ ] Distributed tracing with correlation IDs
- [ ] Comprehensive health checks
- [ ] Alerting for critical failure scenarios
- [ ] Performance dashboards for monitoring

### Documentation & Testing
- [ ] OpenAPI specification complete
- [ ] Unit test coverage >90%
- [ ] Integration tests for key workflows
- [ ] Load tests validate performance requirements
- [ ] Deployment documentation and runbooks

**Next Service**: Move to `services/identity/TODO.md` for OAuth2 server and user management implementation.

---

*This API Gateway serves as the foundation for secure, scalable access to all Suuupra platform services. Master the concepts here before proceeding to domain-specific services.*