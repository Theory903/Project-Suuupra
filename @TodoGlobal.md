# 🚀 Suuupra Platform: Ultimate 2025 Implementation TODO Roadmap

**Document Type**: SENIOR DEVELOPER INSTRUCTION MANUAL  
**Target Audience**: Junior to Mid-Level Development Team  
**Estimated Timeline**: 6 Months to Production Excellence  
**Last Updated**: January 2025

---

## 📌 CRITICAL: READ THIS FIRST (AVOID 90% OF MISTAKES)

### Common Pitfalls That Will Break Production
1. **NEVER deploy without health checks** - Services will get killed by K8s
2. **NEVER hardcode secrets** - Use HashiCorp Vault or die trying
3. **NEVER skip distributed tracing** - You'll be blind during incidents
4. **NEVER ignore retry logic** - Network failures are guaranteed
5. **NEVER use synchronous calls for >100ms operations** - Use Kafka events
6. **NEVER deploy without circuit breakers** - Cascade failures will kill you
7. **NEVER skip the outbox pattern** - You'll lose events and data consistency
8. **NEVER use localStorage in production** - It's not available in many environments
9. **NEVER trust client input** - Validate everything server-side
10. **NEVER deploy Friday afternoon** - Unless you love weekend debugging

---

## 🎯 PHASE 0: FOUNDATION (WEEKS 1-2) - DO THIS OR EVERYTHING FAILS

### ✅ TODO-001: Setup Development Environment Correctly
**Priority**: P0 CRITICAL  
**Owner**: All Developers  
**Deadline**: Day 1  

```bash
# Step 1: Install EXACT versions (version mismatch = pain)
brew install node@20.11.0  # NOT 21, it breaks some packages
brew install go@1.22       # NOT 1.23, compatibility issues
brew install rust@1.75     # For high-performance services
brew install python@3.11   # NOT 3.12, some libs incompatible
brew install kubectl@1.29  # Match your cluster version!
brew install helm@3.14
brew install docker
brew install docker-compose
brew install minikube      # For local K8s testing

# Step 2: Setup Node correctly (AVOID npm hell)
npm install -g pnpm@8.15.1  # Use pnpm, NOT npm (30% faster)
echo 'auto-install-peers=true' >> ~/.npmrc
echo 'shamefully-hoist=true' >> ~/.npmrc

# Step 3: Configure Git properly (AVOID merge disasters)
git config --global pull.rebase true
git config --global fetch.prune true
git config --global diff.colorMoved zebra
git config --global merge.conflictstyle diff3
git config --global commit.gpgsign true  # Sign your commits!

# Step 4: Install development tools
brew install --cask visual-studio-code
brew install --cask postman
brew install --cask lens  # K8s IDE
brew install jq yq        # JSON/YAML processors
brew install httpie       # Better than curl
brew install dive          # Docker image analyzer
brew install k9s           # Terminal K8s UI
```

**Common Mistakes to Avoid:**
- ❌ Using different Node versions across team = dependency hell
- ❌ Not using pnpm = slower builds and larger node_modules
- ❌ Skipping GPG signing = security audit failures
- ✅ Solution: Use `.nvmrc` file in every service root

### ✅ TODO-002: Setup Local Kubernetes Correctly
**Priority**: P0 CRITICAL  
**Time Required**: 2 hours  

```bash
# Step 1: Start Minikube with proper resources
minikube start \
  --cpus=4 \
  --memory=8192 \
  --disk-size=50g \
  --driver=docker \
  --kubernetes-version=v1.29.0

# Step 2: Enable CRITICAL addons
minikube addons enable ingress
minikube addons enable ingress-dns
minikube addons enable metrics-server
minikube addons enable dashboard
minikube addons enable registry

# Step 3: Install Linkerd (NOT Istio - 40% faster)
curl --proto '=https' --tlsv1.2 -sSfL https://run.linkerd.io/install | sh
linkerd check --pre
linkerd install --crds | kubectl apply -f -
linkerd install | kubectl apply -f -
linkerd check

# Step 4: Setup namespaces properly
kubectl create namespace suuupra-dev
kubectl create namespace suuupra-staging  
kubectl create namespace suuupra-prod
kubectl label namespace suuupra-dev linkerd.io/inject=enabled
kubectl label namespace suuupra-staging linkerd.io/inject=enabled
```

**Gotchas:**
- ⚠️ Minikube needs Docker Desktop running first
- ⚠️ Linkerd injection must be namespace-level, not pod-level
- ⚠️ Always use `--dry-run=client` first for any kubectl apply

### ✅ TODO-003: Setup Kafka 4.0 with KRaft (NO More ZooKeeper!)
**Priority**: P0 CRITICAL  
**Complexity**: HIGH  

```yaml
# kafka-kraft-config.yaml - USE THIS EXACT CONFIG
apiVersion: v1
kind: ConfigMap
metadata:
  name: kafka-config
  namespace: suuupra-dev
data:
  server.properties: |
    # KRaft Mode Configuration (Kafka 4.0)
    process.roles=broker,controller
    node.id=1
    controller.quorum.voters=1@kafka-0:9093,2@kafka-1:9093,3@kafka-2:9093
    
    # Listeners - CRITICAL: Get these wrong = nothing works
    listeners=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093,EXTERNAL://0.0.0.0:9094
    advertised.listeners=PLAINTEXT://kafka:9092,EXTERNAL://localhost:9094
    listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
    
    # Performance Tuning for 1M+ events/sec
    num.network.threads=8
    num.io.threads=8
    socket.send.buffer.bytes=102400
    socket.receive.buffer.bytes=102400
    socket.request.max.bytes=104857600
    
    # Replication for zero data loss
    min.insync.replicas=2
    default.replication.factor=3
    
    # Enable exactly-once semantics
    transaction.state.log.replication.factor=3
    transaction.state.log.min.isr=2
    
    # Log retention (7 days default)
    log.retention.hours=168
    log.segment.bytes=1073741824
    
    # Compression (70% reduction!)
    compression.type=zstd
```

```bash
# Deploy Kafka cluster
kubectl apply -f kafka-kraft-config.yaml

# Create topics with proper partitioning
kubectl exec -it kafka-0 -- kafka-topics.sh \
  --create \
  --topic user.events \
  --partitions 50 \
  --replication-factor 3 \
  --config min.insync.replicas=2 \
  --config compression.type=zstd \
  --bootstrap-server kafka:9092

# CRITICAL: Test Kafka is working
kubectl exec -it kafka-0 -- kafka-console-producer.sh \
  --topic test \
  --bootstrap-server kafka:9092
  
# Type: "Hello Kafka 4.0" then Ctrl+C

kubectl exec -it kafka-0 -- kafka-console-consumer.sh \
  --topic test \
  --from-beginning \
  --bootstrap-server kafka:9092
```

**Production Checklist:**
- [ ] Enable SASL/SCRAM authentication
- [ ] Setup ACLs for topic access control  
- [ ] Configure log.dirs on separate disks
- [ ] Monitor lag with Burrow or Kafka Manager
- [ ] Setup Confluent Schema Registry

---

## 🔐 PHASE 1: SECURITY FOUNDATION (WEEKS 3-4)

### ✅ TODO-004: Implement Zero-Trust Service Mesh Security
**Priority**: P0 CRITICAL  
**Security Level**: MILITARY GRADE  

```yaml
# linkerd-security-policy.yaml
apiVersion: policy.linkerd.io/v1beta1
kind: ServerAuthorization
metadata:
  name: api-gateway-to-services
  namespace: suuupra-prod
spec:
  server:
    name: all-services
  client:
    # ONLY API Gateway can call backend services
    meshTLS:
      serviceAccounts:
        - name: api-gateway
          namespace: suuupra-prod
---
apiVersion: policy.linkerd.io/v1beta1
kind: NetworkAuthentication
metadata:
  name: backend-services
  namespace: suuupra-prod
spec:
  # Force mTLS for ALL service communication
  meshTLS:
    mode: required
```

```bash
# Step 1: Generate certificates (DON'T use self-signed in prod!)
step certificate create root.linkerd.cluster.local ca.crt ca.key \
  --profile root-ca --no-password --insecure

step certificate create identity.linkerd.cluster.local issuer.crt issuer.key \
  --profile intermediate-ca --not-after 8760h --no-password --insecure \
  --ca ca.crt --ca-key ca.key

# Step 2: Install with custom certificates
linkerd install \
  --identity-trust-domain=cluster.local \
  --identity-trust-anchors-file ca.crt \
  --identity-issuer-certificate-file issuer.crt \
  --identity-issuer-key-file issuer.key \
  | kubectl apply -f -

# Step 3: Verify mTLS is working
linkerd viz edges deployment
linkerd viz tap deploy/api-gateway
```

**Security Hardening Checklist:**
- [ ] Rotate certificates every 90 days maximum
- [ ] Use cert-manager for automatic rotation
- [ ] Enable PodSecurityPolicies
- [ ] Implement NetworkPolicies for defense in depth
- [ ] Audit all service account permissions

### ✅ TODO-005: JWT Implementation That Actually Works
**Priority**: P0 CRITICAL  
**Common Failures**: 80% of implementations are vulnerable  

```typescript
// auth-middleware.ts - PRODUCTION READY VERSION
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

// MISTAKE #1: Hardcoded secrets (I've seen this in prod!)
// NEVER DO: const SECRET = "my-secret-key";

// CORRECT: Use rotating keys from JWKS endpoint
const jwksClient = jwksRsa({
  cache: true,           // CRITICAL: Cache keys or die from latency
  cacheMaxEntries: 5,    
  cacheMaxAge: 600000,   // 10 minutes
  rateLimit: true,       // Prevent JWKS endpoint DDoS
  jwksRequestsPerMinute: 10,
  jwksUri: process.env.JWKS_URI || 'https://auth.suuupra.com/.well-known/jwks.json'
});

// Token validation with ALL security checks
export async function validateJWT(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Decode header to get kid (key ID)
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Get the signing key
    const key = await getSigningKey(decoded.header.kid);
    
    // CRITICAL: Verify with ALL options
    const verified = jwt.verify(token, key, {
      algorithms: ['RS256'],  // NEVER allow 'none' or 'HS256' with RS256 keys!
      issuer: process.env.JWT_ISSUER || 'https://auth.suuupra.com',
      audience: process.env.JWT_AUDIENCE || 'https://api.suuupra.com',
      maxAge: '1h',          // Tokens expire in 1 hour max
      clockTolerance: 10     // Allow 10 second clock skew
    });

    // Additional security checks
    if (!verified.sub || !verified.email_verified) {
      return res.status(403).json({ error: 'Unverified account' });
    }

    // Check token binding (prevents token theft)
    const tokenFingerprint = crypto
      .createHash('sha256')
      .update(req.ip + req.get('user-agent'))
      .digest('hex');
    
    if (verified.jti !== tokenFingerprint) {
      // Log potential token theft attempt!
      logger.security('Token binding mismatch', { 
        user: verified.sub, 
        ip: req.ip 
      });
      return res.status(401).json({ error: 'Invalid token binding' });
    }

    // Attach user to request
    req.user = verified as User;
    next();
  } catch (error) {
    logger.error('JWT validation failed', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Helper to extract token (handles multiple formats)
function extractToken(req: Request): string | null {
  // Priority 1: Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Priority 2: Cookie (for web apps)
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  
  // Priority 3: Query param (ONLY for WebSocket upgrade)
  if (req.query.token && req.path === '/ws') {
    return req.query.token as string;
  }
  
  return null;
}
```

**Token Refresh Implementation (CRITICAL for UX):**
```typescript
// MISTAKE: No refresh token = users login every hour
// CORRECT: Implement refresh token rotation

export async function refreshToken(req: Request, res: Response) {
  const refreshToken = req.cookies?.refresh_token;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    // Verify refresh token (different secret!)
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET!) as any;
    
    // Check if refresh token is blacklisted (token rotation)
    const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);
    if (isBlacklisted) {
      // Potential token theft! Invalidate all tokens for this user
      await redis.setex(`revoked:user:${decoded.sub}`, 86400, '1');
      return res.status(401).json({ error: 'Token revoked' });
    }
    
    // Issue new token pair
    const newAccessToken = generateAccessToken(decoded.sub);
    const newRefreshToken = generateRefreshToken(decoded.sub);
    
    // Blacklist old refresh token (rotation)
    await redis.setex(`blacklist:${decoded.jti}`, 86400 * 7, '1');
    
    // Set secure cookies
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });
    
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 604800000, // 7 days
      path: '/auth/refresh' // CRITICAL: Limit refresh token scope
    });
    
    res.json({ access_token: newAccessToken });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}
```

### ✅ TODO-006: Implement Vault for Secrets (Stop Hardcoding!)
**Priority**: P0 CRITICAL  
**Time Required**: 4 hours  

```bash
# Step 1: Deploy Vault in K8s
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --set server.ha.enabled=true \
  --set server.ha.replicas=3 \
  --namespace vault \
  --create-namespace

# Step 2: Initialize Vault (SAVE THESE KEYS!)
kubectl exec -it vault-0 -n vault -- vault operator init \
  -key-shares=5 \
  -key-threshold=3

# Step 3: Unseal Vault (need 3 of 5 keys)
kubectl exec -it vault-0 -n vault -- vault operator unseal <KEY_1>
kubectl exec -it vault-0 -n vault -- vault operator unseal <KEY_2>
kubectl exec -it vault-0 -n vault -- vault operator unseal <KEY_3>

# Step 4: Configure Kubernetes auth
kubectl exec -it vault-0 -n vault -- vault auth enable kubernetes
kubectl exec -it vault-0 -n vault -- vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"
```

**Application Integration:**
```javascript
// vault-client.js - Auto-rotating secrets
const vault = require('node-vault')({
  endpoint: process.env.VAULT_ADDR || 'https://vault:8200',
  token: process.env.VAULT_TOKEN // Use K8s service account in prod
});

class SecretManager {
  constructor() {
    this.cache = new Map();
    this.rotationInterval = 3600000; // 1 hour
  }

  async getSecret(path) {
    // Check cache first
    if (this.cache.has(path)) {
      const cached = this.cache.get(path);
      if (cached.expiry > Date.now()) {
        return cached.value;
      }
    }

    try {
      // Fetch from Vault
      const result = await vault.read(path);
      
      // Cache with expiry
      this.cache.set(path, {
        value: result.data,
        expiry: Date.now() + this.rotationInterval
      });

      // Setup automatic rotation
      setTimeout(() => this.getSecret(path), this.rotationInterval);

      return result.data;
    } catch (error) {
      // Fallback to cached value if Vault is down
      if (this.cache.has(path)) {
        logger.warn(`Using cached secret for ${path} due to Vault error`);
        return this.cache.get(path).value;
      }
      throw error;
    }
  }

  // Database password rotation
  async rotateDatabasePassword(dbName) {
    const newPassword = crypto.randomBytes(32).toString('hex');
    
    // Update in Vault
    await vault.write(`database/rotate/${dbName}`, {
      password: newPassword
    });
    
    // Update database
    await db.query(`ALTER USER app_user PASSWORD '${newPassword}'`);
    
    // Clear cache
    this.cache.delete(`database/creds/${dbName}`);
    
    logger.info(`Rotated password for database ${dbName}`);
  }
}

// Usage in application
const secrets = new SecretManager();
const dbCreds = await secrets.getSecret('database/creds/postgres');
const apiKey = await secrets.getSecret('external/stripe/api-key');
```

---

## 🚀 PHASE 2: SERVICE IMPLEMENTATION (WEEKS 5-8)

### ✅ TODO-007: API Gateway That Won't Fall Over
**Priority**: P0 CRITICAL  
**Technology**: Kong Gateway (NOT nginx!)  

```yaml
# kong-config.yaml - Production configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-config
data:
  kong.yml: |
    _format_version: "3.0"
    
    # Rate limiting by user tier
    plugins:
    - name: rate-limiting
      config:
        minute: 100    # Free tier
        policy: redis  # Use Redis for distributed rate limiting
        redis_host: redis-master
        redis_port: 6379
        redis_database: 0
        hide_client_headers: false
    
    # Circuit breaker to prevent cascade failures  
    - name: circuit-breaker
      config:
        error_threshold: 50
        volume_threshold: 100
        timeout: 30
        half_open_timeout: 60
    
    # Request size limiting (prevent DoS)
    - name: request-size-limiting
      config:
        allowed_payload_size: 10  # 10MB max
        size_unit: megabytes
    
    # CORS configuration
    - name: cors
      config:
        origins:
        - https://app.suuupra.com
        - http://localhost:3000  # Dev only
        methods:
        - GET
        - POST
        - PUT
        - DELETE
        - OPTIONS
        headers:
        - Accept
        - Accept-Version
        - Content-Length
        - Content-Type
        - Authorization
        exposed_headers:
        - X-Request-Id
        - X-RateLimit-Remaining
        credentials: true
        max_age: 3600
    
    services:
    # Identity Service
    - name: identity-service
      url: http://identity.suuupra-prod:8080
      routes:
      - name: identity-routes
        paths:
        - /api/v1/auth
        strip_path: false
      plugins:
      - name: rate-limiting
        config:
          minute: 20  # Stricter for auth endpoints
      
    # Payment Service with extra security
    - name: payment-service
      url: http://payments.suuupra-prod:8080
      routes:
      - name: payment-routes
        paths:
        - /api/v1/payments
      plugins:
      - name: request-transformer
        config:
          add:
            headers:
            - X-Payment-Gateway:Kong
      - name: response-transformer
        config:
          remove:
            headers:
            - X-Internal-Service-Version  # Don't leak internals
```

**Kong Deployment with Postgres:**
```bash
# Deploy Postgres for Kong
helm install kong-db bitnami/postgresql \
  --set postgresqlUsername=kong \
  --set postgresqlPassword=kong \
  --set postgresqlDatabase=kong \
  --namespace kong \
  --create-namespace

# Deploy Kong
helm install kong kong/kong \
  --namespace kong \
  --set env.database=postgres \
  --set env.pg_host=kong-db-postgresql.kong.svc.cluster.local \
  --set env.pg_password=kong \
  --set proxy.type=LoadBalancer \
  --set proxy.http.nodePort=30080 \
  --set proxy.tls.nodePort=30443 \
  --set admin.enabled=true \
  --set admin.http.enabled=true

# Configure Kong
kubectl apply -f kong-config.yaml
```

**Critical Performance Tuning:**
```lua
-- custom-nginx.conf for Kong
worker_processes auto;
worker_rlimit_nofile 65536;

events {
    worker_connections 16384;
    use epoll;  # Linux only
    multi_accept on;
}

http {
    # Keep-alive connections
    keepalive_timeout 65;
    keepalive_requests 100;
    
    # Buffers optimization
    client_body_buffer_size 10K;
    client_header_buffer_size 1k;
    client_max_body_size 10m;
    large_client_header_buffers 2 1k;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml application/atom+xml image/svg+xml 
               text/x-js text/x-cross-domain-policy application/x-font-ttf 
               application/x-font-opentype application/vnd.ms-fontobject 
               image/x-icon;
    
    # Cache
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m 
                     max_size=1g inactive=60m use_temp_path=off;
    
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=3r/s;
    limit_req_zone $binary_remote_addr zone=payment:10m rate=5r/s;
}
```

### ✅ TODO-008: Event-Driven Microservices with Kafka
**Priority**: P0 CRITICAL  
**Pattern**: Event Sourcing + CQRS  

```typescript
// event-publisher.ts - Guaranteed delivery pattern
import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

class ReliableEventPublisher {
  private producer: Producer;
  private outboxRepo: OutboxRepository;
  
  constructor() {
    const kafka = new Kafka({
      clientId: 'payment-service',
      brokers: process.env.KAFKA_BROKERS!.split(','),
      ssl: true,  // Always use SSL in production
      sasl: {     // Authentication
        mechanism: 'scram-sha-512',
        username: process.env.KAFKA_USERNAME!,
        password: process.env.KAFKA_PASSWORD!
      },
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,  // NEVER auto-create in prod
      transactionalId: 'payment-service-tx',  // For exactly-once
      idempotent: true,
      compression: CompressionTypes.ZSTD  // 70% size reduction!
    });
  }

  // Transactional outbox pattern for guaranteed delivery
  async publishWithOutbox(event: DomainEvent, dbTx: DatabaseTransaction) {
    try {
      // Step 1: Save to outbox table IN THE SAME DB TRANSACTION
      const outboxEvent = {
        id: uuidv4(),
        aggregate_id: event.aggregateId,
        event_type: event.type,
        payload: JSON.stringify(event),
        created_at: new Date(),
        published: false
      };
      
      await dbTx.query(
        `INSERT INTO outbox_events 
         (id, aggregate_id, event_type, payload, created_at, published) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        Object.values(outboxEvent)
      );
      
      // Step 2: Commit database transaction
      await dbTx.commit();
      
      // Step 3: Publish to Kafka (AFTER DB commit)
      await this.producer.send({
        topic: this.getTopicForEvent(event.type),
        messages: [{
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.type,
            'correlation-id': event.correlationId,
            'causation-id': event.causationId,
            'timestamp': new Date().toISOString()
          }
        }]
      });
      
      // Step 4: Mark as published
      await this.outboxRepo.markAsPublished(outboxEvent.id);
      
    } catch (error) {
      // Event is in outbox, will be retried by outbox processor
      logger.error('Failed to publish event', { error, event });
      throw error;
    }
  }
  
  // Background job to publish failed events
  async processOutbox() {
    const unpublished = await this.outboxRepo.getUnpublishedEvents(100);
    
    for (const event of unpublished) {
      try {
        await this.producer.send({
          topic: this.getTopicForEvent(event.event_type),
          messages: [{
            key: event.aggregate_id,
            value: event.payload
          }]
        });
        
        await this.outboxRepo.markAsPublished(event.id);
        
      } catch (error) {
        logger.error('Outbox processing failed', { error, eventId: event.id });
        
        // Increment retry count
        await this.outboxRepo.incrementRetryCount(event.id);
        
        // Move to DLQ after max retries
        if (event.retry_count > 5) {
          await this.outboxRepo.moveToDLQ(event.id);
        }
      }
    }
  }
  
  private getTopicForEvent(eventType: string): string {
    // Route events to correct topics
    const topicMap: Record<string, string> = {
      'UserCreated': 'user.events',
      'UserUpdated': 'user.events',
      'OrderCreated': 'order.events',
      'PaymentProcessed': 'payment.events',
      'PaymentFailed': 'payment.events'
    };
    
    return topicMap[eventType] || 'dead-letter-queue';
  }
}

// Consumer with idempotency
class IdempotentEventConsumer {
  private consumer: Consumer;
  private processedEvents: Set<string> = new Set();
  
  async consume(topic: string, handler: EventHandler) {
    await this.consumer.subscribe({ 
      topic, 
      fromBeginning: false  // Start from latest in prod
    });
    
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const eventId = message.headers?.['event-id']?.toString();
        
        // Idempotency check
        if (eventId && this.processedEvents.has(eventId)) {
          logger.info('Skipping duplicate event', { eventId });
          return;
        }
        
        try {
          // Parse event
          const event = JSON.parse(message.value!.toString());
          
          // Process with retry
          await this.withRetry(() => handler(event), 3);
          
          // Mark as processed
          if (eventId) {
            this.processedEvents.add(eventId);
            // Also persist to Redis for distributed idempotency
            await redis.setex(`processed:${eventId}`, 86400, '1');
          }
          
        } catch (error) {
          // Send to DLQ
          await this.sendToDLQ(message, error);
        }
      }
    });
  }
}
```

### ✅ TODO-009: Database Schema That Scales
**Priority**: P0 CRITICAL  
**Mistakes to Avoid**: No indexes = death at scale  

```sql
-- migrations/001_initial_schema.sql
-- ALWAYS use migrations, NEVER manual schema changes!

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Users table with proper constraints
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    email_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(email)) STORED,
    password_hash VARCHAR(255) NOT NULL,  -- Use bcrypt or argon2
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,  -- Soft delete
    version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking
    
    -- Constraints
    CONSTRAINT email_unique UNIQUE(email_normalized),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- CRITICAL: Indexes for performance
CREATE INDEX idx_users_email_normalized ON users(email_normalized) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Payments table with financial precision
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(19,4) NOT NULL,  -- NEVER use FLOAT for money!
    currency CHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    
    -- Idempotency
    idempotency_key VARCHAR(255) NOT NULL,
    
    -- Metadata
    gateway_response JSONB,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT amount_positive CHECK (amount > 0),
    CONSTRAINT currency_valid CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT idempotency_unique UNIQUE(user_id, idempotency_key)
);

-- Partition by month for large tables
CREATE TABLE events (
    id UUID DEFAULT uuid_generate_v4(),
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE events_2025_01 PARTITION OF events
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_2025_02 PARTITION OF events
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Add more partitions as needed

-- Automatic partition creation function
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    partition_name := 'events_' || to_char(start_date, 'YYYY_MM');
    
    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('create-partition', '0 0 1 * *', 'SELECT create_monthly_partition()');
```

**Query Optimization Rules:**
```sql
-- BAD: No index scan
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- GOOD: Uses index on generated column
SELECT * FROM users WHERE email_normalized = 'user@example.com';

-- BAD: No pagination
SELECT * FROM payments WHERE user_id = $1;

-- GOOD: Cursor pagination (scales infinitely)
SELECT * FROM payments 
WHERE user_id = $1 
  AND created_at < $2  -- cursor
ORDER BY created_at DESC 
LIMIT 100;

-- CRITICAL: Monitor slow queries
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries slower than 100ms
ORDER BY mean_exec_time DESC;
```

---

## 📊 PHASE 3: OBSERVABILITY & MONITORING (WEEKS 9-10)

### ✅ TODO-010: OpenTelemetry Setup (See EVERYTHING)
**Priority**: P0 CRITICAL  
**Stack**: OpenTelemetry + Prometheus + Grafana + Tempo  

```yaml
# otel-collector-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
data:
  otel-collector-config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
      
      # Collect metrics from Kubernetes
      prometheus:
        config:
          scrape_configs:
          - job_name: 'kubernetes-pods'
            kubernetes_sd_configs:
            - role: pod
            relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
              action: keep
              regex: true
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
              action: replace
              target_label: __metrics_path__
              regex: (.+)
      
      # Collect logs from containers
      filelog:
        include: [ /var/log/pods/*/*/*.log ]
        start_at: end
        operators:
        - type: regex_parser
          regex: '^(?P<time>[^ ^Z]+Z) (?P<stream>stdout|stderr) (?P<logtag>[^ ]*) ?(?P<log>.*)$'
          timestamp:
            parse_from: attributes.time
            layout: '%Y-%m-%dT%H:%M:%S.%LZ'
    
    processors:
      batch:
        send_batch_size: 10000
        timeout: 10s
      
      # Add resource attributes
      resource:
        attributes:
        - key: environment
          value: production
          action: insert
        - key: cluster
          value: suuupra-prod
          action: insert
      
      # Memory limiter to prevent OOM
      memory_limiter:
        check_interval: 1s
        limit_percentage: 75
        spike_limit_percentage: 25
      
      # Tail sampling for traces (keep interesting ones)
      tail_sampling:
        decision_wait: 10s
        policies:
        - name: errors-policy
          type: status_code
          status_code: {status_codes: [ERROR]}
        - name: slow-traces-policy
          type: latency
          latency: {threshold_ms: 1000}
        - name: probabilistic-policy
          type: probabilistic
          probabilistic: {sampling_percentage: 10}
    
    exporters:
      # Metrics to Prometheus
      prometheus:
        endpoint: "0.0.0.0:8889"
        namespace: suuupra
        send_timestamps: true
        enable_open_metrics: true
      
      # Traces to Tempo
      otlp/tempo:
        endpoint: tempo:4317
        tls:
          insecure: false
          ca_file: /etc/ssl/certs/ca.crt
      
      # Logs to Loki
      loki:
        endpoint: http://loki:3100/loki/api/v1/push
        labels:
          resource:
            service.name: service_name
            host.name: hostname
    
    service:
      telemetry:
        logs:
          level: info
        metrics:
          level: detailed
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch, resource, tail_sampling]
          exporters: [otlp/tempo]
        metrics:
          receivers: [otlp, prometheus]
          processors: [memory_limiter, batch, resource]
          exporters: [prometheus]
        logs:
          receivers: [otlp, filelog]
          processors: [memory_limiter, batch, resource]
          exporters: [loki]
```

**Application Instrumentation:**
```typescript
// telemetry.ts - Auto-instrument EVERYTHING
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
  
  // Auto-instrument all libraries
  instrumentations: getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': {
      enabled: false,  // Too noisy
    },
  }),
  
  // Metric reader
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    }),
    exportIntervalMillis: 10000,
  }),
});

// Start SDK
sdk.start();

// Custom metrics
const meter = metrics.getMeter('suuupra-app');

// Business metrics
const revenueCounter = meter.createCounter('revenue_total', {
  description: 'Total revenue in cents',
  unit: 'cents',
});

const activeUsersGauge = meter.createObservableGauge('active_users', {
  description: 'Currently active users',
});

// Set callback for gauge
activeUsersGauge.addCallback(async (observableResult) => {
  const count = await redis.get('active_users_count');
  observableResult.observe(parseInt(count || '0'), {
    tier: 'premium',
  });
});

// Add to business logic
export function processPayment(amount: number, currency: string) {
  const span = trace.getActiveSpan();
  span?.setAttributes({
    'payment.amount': amount,
    'payment.currency': currency,
  });
  
  try {
    // Process payment...
    
    // Record business metric
    revenueCounter.add(amount * 100, {
      currency,
      payment_method: 'card',
    });
    
    span?.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span?.recordException(error);
    span?.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  }
}
```

### ✅ TODO-011: Grafana Dashboards That Actually Help
**Priority**: P1 HIGH  
**Goal**: Find problems in <30 seconds  

```json
// golden-signals-dashboard.json
{
  "dashboard": {
    "title": "Golden Signals - Suuupra Platform",
    "panels": [
      {
        "title": "Request Rate (RED)",
        "targets": [{
          "expr": "sum(rate(http_requests_total[5m])) by (service, method, route)"
        }]
      },
      {
        "title": "Error Rate (RED)",
        "targets": [{
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)"
        }]
      },
      {
        "title": "Response Time P95 (RED)",
        "targets": [{
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le))"
        }]
      },
      {
        "title": "Saturation - CPU (USE)",
        "targets": [{
          "expr": "100 * (1 - avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])))"
        }]
      },
      {
        "title": "Kafka Lag",
        "targets": [{
          "expr": "kafka_consumer_lag_sum"
        }],
        "alert": {
          "condition": "> 10000",
          "message": "Kafka consumer lag is too high!"
        }
      },
      {
        "title": "Database Connections",
        "targets": [{
          "expr": "pg_stat_database_numbackends / pg_settings_max_connections"
        }],
        "alert": {
          "condition": "> 0.8",
          "message": "Database connection pool near limit!"
        }
      }
    ]
  }
}
```

**Alert Rules That Don't Wake You at 3am:**
```yaml
# prometheus-alerts.yaml
groups:
- name: critical
  interval: 30s
  rules:
  # Only alert on USER-FACING issues
  - alert: HighErrorRate
    expr: |
      (
        sum(rate(http_requests_total{status=~"5..",job="api-gateway"}[5m]))
        /
        sum(rate(http_requests_total{job="api-gateway"}[5m]))
      ) > 0.05
    for: 5m  # Wait 5 minutes to avoid flapping
    labels:
      severity: critical
      team: platform
    annotations:
      summary: "High error rate on API Gateway"
      description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
      runbook_url: "https://wiki.suuupra.com/runbooks/high-error-rate"
  
  # Don't alert on internal service errors, only gateway
  - alert: ServiceDown
    expr: up{job="api-gateway"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "API Gateway is down"
      
  # Smart alerting for Kafka lag
  - alert: KafkaConsumerLag
    expr: |
      kafka_consumer_lag > 10000
      AND
      rate(kafka_consumer_lag[5m]) > 0  # Only if lag is growing
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Kafka consumer lag is growing"
```

---

## 🔥 PHASE 4: PRODUCTION HARDENING (WEEKS 11-12)

### ✅ TODO-012: Chaos Engineering (Break It Before Users Do)
**Priority**: P1 HIGH  
**Tools**: Litmus Chaos  

```yaml
# chaos-experiments.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: api-gateway-chaos
spec:
  appinfo:
    appns: suuupra-prod
    applabel: app=api-gateway
  chaosServiceAccount: litmus-admin
  experiments:
  # Kill pods randomly
  - name: pod-delete
    spec:
      components:
        env:
        - name: TOTAL_CHAOS_DURATION
          value: '60'
        - name: CHAOS_INTERVAL
          value: '10'
        - name: FORCE
          value: 'false'
  
  # Network latency injection
  - name: pod-network-latency
    spec:
      components:
        env:
        - name: NETWORK_INTERFACE
          value: 'eth0'
        - name: NETWORK_LATENCY
          value: '2000'  # 2 second latency
        - name: TOTAL_CHAOS_DURATION
          value: '60'
  
  # CPU stress
  - name: pod-cpu-hog
    spec:
      components:
        env:
        - name: CPU_CORES
          value: '2'
        - name: TOTAL_CHAOS_DURATION
          value: '60'
```

**Automated Chaos Testing:**
```bash
#!/bin/bash
# chaos-test.sh - Run every Friday at 2pm (when you can fix it)

# Check if it's production
if [[ "$ENVIRONMENT" != "production" ]]; then
  echo "Chaos testing in staging first!"
  exit 1
fi

# Notify team
curl -X POST $SLACK_WEBHOOK -d '{
  "text": "Starting chaos engineering tests in production"
}'

# Run experiments gradually
echo "Phase 1: Network latency test"
kubectl apply -f chaos/network-latency.yaml
sleep 300

echo "Phase 2: Pod failure test"
kubectl apply -f chaos/pod-delete.yaml
sleep 300

echo "Phase 3: Database connection limit test"
kubectl apply -f chaos/db-connection-limit.yaml
sleep 300

# Check if services recovered
HEALTH_CHECK=$(curl -s https://api.suuupra.com/health)
if [[ "$HEALTH_CHECK" != *"ok"* ]]; then
  echo "FAILED: Services did not recover!"
  # Rollback
  kubectl rollout undo deployment --all -n suuupra-prod
  exit 1
fi

echo "SUCCESS: All chaos tests passed!"
```

### ✅ TODO-013: Multi-Region Deployment
**Priority**: P1 HIGH  
**Regions**: US-East, EU-West, AP-Southeast  

```yaml
# multi-region-deployment.yaml
apiVersion: v1
kind: Service
metadata:
  name: global-api
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
    external-dns.alpha.kubernetes.io/hostname: api.suuupra.com
spec:
  type: LoadBalancer
  selector:
    app: api-gateway
  ports:
  - port: 443
    targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 10  # Per region
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 0  # Zero downtime
  template:
    spec:
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: api-gateway
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - api-gateway
            topologyKey: kubernetes.io/hostname
```

**Database Replication Across Regions:**
```sql
-- Setup streaming replication
-- On PRIMARY (us-east-1)
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'secure-password';
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 10;
ALTER SYSTEM SET wal_keep_segments = 64;
SELECT pg_reload_conf();

-- On REPLICA (eu-west-1)
-- Stop postgres and clear data directory
systemctl stop postgresql
rm -rf /var/lib/postgresql/14/main/*

-- Base backup from primary
pg_basebackup -h primary.us-east-1.rds.amazonaws.com \
  -D /var/lib/postgresql/14/main \
  -U replicator \
  -v -P -W \
  -X stream

-- Configure replica
cat > /var/lib/postgresql/14/main/postgresql.auto.conf <<EOF
primary_conninfo = 'host=primary.us-east-1.rds.amazonaws.com port=5432 user=replicator'
primary_slot_name = 'eu_west_1_slot'
hot_standby = on
EOF

-- Start replica
systemctl start postgresql
```

### ✅ TODO-014: Load Testing That Simulates Real Users
**Priority**: P1 HIGH  
**Tool**: K6 (NOT JMeter!)  

```javascript
// load-test.js - Realistic user behavior
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up
    { duration: '10m', target: 100 },  // Stay at 100 users
    { duration: '5m', target: 500 },   // Spike to 500
    { duration: '10m', target: 500 },  // Stay at 500
    { duration: '5m', target: 1000 },  // Push to 1000
    { duration: '10m', target: 1000 }, // Stay at 1000
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% of requests under 500ms
    'errors': ['rate<0.01'],              // Error rate under 1%
  },
};

// Realistic user journey
export default function() {
  // 1. Visit homepage
  let res = http.get('https://api.suuupra.com/');
  check(res, {
    'homepage loaded': (r) => r.status === 200,
  });
  sleep(randomBetween(1, 3));
  
  // 2. Login
  const loginData = {
    email: `user${__VU}@example.com`,  // Virtual user ID
    password: 'password123',
  };
  
  res = http.post(
    'https://api.suuupra.com/auth/login',
    JSON.stringify(loginData),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  const token = res.json('access_token');
  check(res, {
    'login successful': (r) => r.status === 200 && token,
  });
  
  if (!token) {
    errorRate.add(1);
    return;
  }
  
  // 3. Browse courses (most common action)
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };
  
  res = http.get('https://api.suuupra.com/courses', authHeaders);
  check(res, {
    'courses loaded': (r) => r.status === 200,
  });
  sleep(randomBetween(2, 5));
  
  // 4. Watch video (bandwidth intensive)
  if (Math.random() > 0.3) {  // 70% of users watch videos
    res = http.get('https://api.suuupra.com/video/stream/course-101', authHeaders);
    check(res, {
      'video streaming': (r) => r.status === 206,  // Partial content
    });
    sleep(randomBetween(30, 120));  // Watch for 30-120 seconds
  }
  
  // 5. Make payment (critical path)
  if (Math.random() > 0.9) {  // 10% of users make payments
    const paymentData = {
      amount: 99.99,
      currency: 'USD',
      payment_method: 'card',
    };
    
    res = http.post(
      'https://api.suuupra.com/payments',
      JSON.stringify(paymentData),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': `${__VU}-${__ITER}`,
        },
      }
    );
    
    check(res, {
      'payment processed': (r) => r.status === 200,
    });
    
    if (res.status !== 200) {
      errorRate.add(1);
    }
  }
  
  sleep(randomBetween(1, 3));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

**Run load test with monitoring:**
```bash
#!/bin/bash
# run-load-test.sh

# Start monitoring
echo "Starting monitoring..."
kubectl port-forward svc/grafana 3000:3000 &
GRAFANA_PID=$!

# Run load test
echo "Starting load test..."
k6 run \
  --out influxdb=http://localhost:8086/k6 \
  --summary-export=results.json \
  load-test.js

# Analyze results
echo "Analyzing results..."
cat results.json | jq '.metrics.http_req_duration.p95'

# Check for errors
ERROR_RATE=$(cat results.json | jq '.metrics.errors.rate')
if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
  echo "ERROR: Error rate too high: $ERROR_RATE"
  exit 1
fi

# Cleanup
kill $GRAFANA_PID
echo "Load test complete!"
```

---

## 🚨 PHASE 5: DISASTER RECOVERY (WEEKS 13-14)

### ✅ TODO-015: Backup Strategy That Actually Works
**Priority**: P0 CRITICAL  
**RPO**: 1 hour, **RTO**: 4 hours  

```yaml
# velero-backup-schedule.yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  template:
    ttl: 720h0m0s  # Keep for 30 days
    includedNamespaces:
    - suuupra-prod
    excludedResources:
    - events
    - events.events.k8s.io
    storageLocation: aws-s3-backup
    volumeSnapshotLocations:
    - aws-ebs-snapshots
```

**Database Backup with Point-in-Time Recovery:**
```bash
#!/bin/bash
# backup-database.sh

# Continuous WAL archiving to S3
cat >> /etc/postgresql/14/main/postgresql.conf <<EOF
archive_mode = on
archive_command = 'aws s3 cp %p s3://suuupra-backups/wal/%f'
archive_timeout = 300  # Force archive every 5 minutes
EOF

# Daily base backup
pg_basebackup \
  -D /tmp/backup_$(date +%Y%m%d) \
  -Ft -z -P \
  -X fetch \
  -h localhost \
  -U postgres

# Upload to S3 with encryption
aws s3 cp \
  /tmp/backup_$(date +%Y%m%d).tar.gz \
  s3://suuupra-backups/base/backup_$(date +%Y%m%d).tar.gz \
  --sse aws:kms \
  --sse-kms-key-id $KMS_KEY_ID

# Test restore (CRITICAL - untested backups = no backups)
echo "Testing restore..."
createdb test_restore
pg_restore -d test_restore /tmp/backup_$(date +%Y%m%d).tar.gz
if [ $? -eq 0 ]; then
  echo "Backup test successful"
  dropdb test_restore
else
  echo "BACKUP TEST FAILED!"
  exit 1
fi
```

### ✅ TODO-016: Incident Response Playbook
**Priority**: P0 CRITICAL  
**First Rule**: Don't Panic  

```markdown
# INCIDENT RESPONSE PLAYBOOK

## 1. IMMEDIATE ACTIONS (First 5 Minutes)
1. **Acknowledge alert** in PagerDuty
2. **Join incident channel** in Slack: #incident-YYYYMMDD-HHMM
3. **Assign roles**:
   - Incident Commander (IC)
   - Technical Lead
   - Communications Lead
   - Scribe

## 2. ASSESSMENT (5-15 Minutes)
```bash
# Quick health check
kubectl get pods -n suuupra-prod | grep -v Running
kubectl top nodes
kubectl top pods -n suuupra-prod

# Check recent deployments
kubectl rollout history deployment -n suuupra-prod

# Check error rates
curl -s http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])
```

## 3. MITIGATION STRATEGIES

### If API Gateway is down:
```bash
# Immediate: Switch to backup gateway
kubectl patch service api-gateway -p '{"spec":{"selector":{"version":"backup"}}}'

# Root cause investigation
kubectl logs -n suuupra-prod deployment/api-gateway --tail=100
kubectl describe pod -n suuupra-prod -l app=api-gateway
```

### If Database is slow:
```sql
-- Kill long-running queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 minutes';

-- Check for lock contention
SELECT * FROM pg_locks WHERE NOT granted;

-- Emergency connection limit increase
ALTER SYSTEM SET max_connections = 500;
SELECT pg_reload_conf();
```

### If Kafka is lagging:
```bash
# Increase consumer instances
kubectl scale deployment payment-consumer --replicas=10

# Reset consumer group offset (LAST RESORT)
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --group payment-processor \
  --reset-offsets \
  --to-latest \
  --execute
```

## 4. COMMUNICATION TEMPLATE
```
**Status**: [Investigating/Identified/Monitoring/Resolved]
**Impact**: [User-facing description]
**Started**: [Time]
**Updates**: Every 30 minutes

We are currently experiencing [issue description].
Impact: [Specific user impact]
We are [current action].
Next update in 30 minutes.
```
```

---

## 💡 PHASE 6: OPTIMIZATION & EXCELLENCE (WEEKS 15-16)

### ✅ TODO-017: Cost Optimization Without Breaking Things
**Priority**: P2 MEDIUM  
**Target**: 40% cost reduction  

```yaml
# spot-instances.yaml - Save 70% on compute
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-node-termination-handler
data:
  enableSpotInterruptionDraining: "true"
  enableScheduledEventDraining: "true"
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: aws-node-termination-handler
spec:
  template:
    spec:
      nodeSelector:
        lifecycle: Ec2Spot  # Only on spot instances
      containers:
      - name: handler
        image: amazon/aws-node-termination-handler:v1.19.0
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
```

**Autoscaling Configuration:**
```yaml
# hpa-config.yaml - Scale based on REAL metrics
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 100
  metrics:
  # CPU (basic)
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  
  # Memory (important!)
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  
  # Custom metrics (BEST)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  
  # Scale up fast, scale down slow
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100  # Double pods
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 minutes
      policies:
      - type: Percent
        value: 10  # Remove 10% of pods
        periodSeconds: 60
```

### ✅ TODO-018: Performance Optimization Checklist
**Priority**: P2 MEDIUM  
**Target**: <100ms p99 latency  

```typescript
// performance-optimizations.ts

// 1. Connection Pooling (HUGE impact)
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // CRITICAL settings
  max: 20,                     // Max connections
  idleTimeoutMillis: 30000,    // Close idle connections
  connectionTimeoutMillis: 2000, // Fail fast
  
  // Performance settings
  statement_timeout: 10000,     // Kill slow queries
  query_timeout: 10000,
  
  // Prepared statements (30% faster)
  parseInputDatesAsUTC: true,
});

// 2. Redis Caching with Cache-Aside Pattern
import Redis from 'ioredis';

const redis = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 },
], {
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Cache miss - fetch data
  const data = await fetcher();
  
  // Write to cache (don't wait)
  redis.setex(key, ttl, JSON.stringify(data)).catch(err => {
    logger.error('Cache write failed', err);
  });
  
  return data;
}

// 3. Batch Operations (10x faster)
async function batchInsert(records: any[]) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Use COPY for bulk insert (FASTEST)
    const stream = client.query(
      copyFrom('COPY users (id, email, created_at) FROM STDIN')
    );
    
    for (const record of records) {
      stream.write(`${record.id}\t${record.email}\t${record.created_at}\n`);
    }
    
    stream.end();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 4. Optimize JSON Serialization
import { serialize } from 'v8';

// 3x faster than JSON.stringify for large objects
function fastSerialize(obj: any): Buffer {
  return serialize(obj);
}

// 5. Use DataLoader for N+1 query prevention
import DataLoader from 'dataloader';

const userLoader = new DataLoader(async (userIds: string[]) => {
  const users = await pool.query(
    'SELECT * FROM users WHERE id = ANY($1)',
    [userIds]
  );
  
  // CRITICAL: Return in same order as input
  const userMap = new Map(users.rows.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id));
});

// Usage prevents N+1
async function getUsersWithPosts(userIds: string[]) {
  // 1 query instead of N
  const users = await userLoader.loadMany(userIds);
  // ...
}
```

---

## 📝 CRITICAL PRODUCTION CHECKLIST

### Before EVERY Deployment:
```bash
#!/bin/bash
# pre-deployment-checklist.sh

echo "🔍 Pre-Deployment Checklist"

# 1. Run ALL tests
echo "Running tests..."
npm test || exit 1
npm run test:integration || exit 1
npm run test:e2e || exit 1

# 2. Security scan
echo "Security scanning..."
npm audit || exit 1
trivy image $IMAGE_NAME || exit 1

# 3. Check resource limits
echo "Checking resource limits..."
kubectl get resourcequota -n suuupra-prod

# 4. Verify backups
echo "Verifying backups..."
aws s3 ls s3://suuupra-backups/ | head -1 || exit 1

# 5. Check monitoring
echo "Checking monitoring..."
curl -f http://prometheus:9090/-/healthy || exit 1
curl -f http://grafana:3000/api/health || exit 1

# 6. Verify rollback plan
echo "Testing rollback..."
kubectl rollout history deployment/api-gateway || exit 1

echo "✅ All checks passed! Safe to deploy."
```

### Production Readiness Score:
- [ ] Zero hardcoded secrets
- [ ] All services have health checks
- [ ] Distributed tracing enabled
- [ ] Circuit breakers configured
- [ ] Rate limiting enabled
- [ ] Backups tested
- [ ] Chaos testing passed
- [ ] Load testing passed
- [ ] Security scanning clean
- [ ] Monitoring dashboards ready
- [ ] Alerts configured
- [ ] Runbooks written
- [ ] Incident response tested
- [ ] Multi-region deployed
- [ ] Cost optimization applied

---

## 🎯 FINAL WORDS OF WISDOM

1. **Always use structured logging** - You'll thank yourself at 3am
2. **Never trust the network** - It WILL fail
3. **Cache everything** - But invalidate correctly
4. **Monitor business metrics** - Not just technical ones
5. **Practice incident response** - Before you need it
6. **Automate everything** - Humans make mistakes
7. **Document decisions** - Future you will forget
8. **Test in production** - But safely with feature flags
9. **Keep it simple** - Complex systems fail in complex ways
10. **Sleep is important** - Tired developers write bugs

**Remember**: Every line of code is a liability. Every service is a potential point of failure. Every dependency is a risk. Build accordingly.

---

**Document Version**: 1.0.0  
**Last Updated**: January 2025  
**Next Review**: February 2025  
**Maintainer**: Platform Team  

**Questions?** Slack: #platform-team