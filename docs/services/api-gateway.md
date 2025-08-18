# API Gateway Service

## Overview

Production-ready Fastify service providing unified entry point for all platform services with routing, authentication, rate limiting, and observability.

## Quick Start

```bash
cd services/api-gateway
npm install
npm run dev

# Health check
curl localhost:8080/health
```

## Core Features

### Request Routing
- Path-based routing (`/api/v1/users` → Identity Service)
- Host-based routing (tenant isolation)
- Header-based routing (A/B testing)

### Authentication
- JWT verification with JWKS
- OAuth 2.0/OIDC integration
- API key authentication
- Session management

### Traffic Management
- Rate limiting (Redis token bucket)
- Circuit breakers (Opossum)
- Request/response transformation
- CORS handling

### AI-Aware Features
- Streaming proxy for LLM responses
- Model routing and load balancing
- Context injection for personalization
- Request batching optimization

## Configuration

### Route Configuration
```typescript
{
  "id": "users-api",
  "matcher": { "path": "/api/v1/users/*", "methods": ["GET"] },
  "target": { "type": "http", "url": "http://identity:8080" },
  "policy": {
    "auth": { "required": true },
    "rateLimit": { "tokensPerInterval": 100, "intervalMs": 60000 },
    "timeout": 5000
  }
}
```

### Authentication Policy
```json
{
  "auth": {
    "jwt": {
      "issuer": "https://identity.suuupra.local",
      "audience": "suuupra-api",
      "jwksUri": "https://identity.suuupra.local/.well-known/jwks.json",
      "requiredRoles": ["user"],
      "requiredScopes": ["api"]
    }
  }
}
```

## Admin API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/routes` | List all routes |
| POST | `/admin/routes` | Create route |
| PUT | `/admin/routes/{id}` | Update route |
| DELETE | `/admin/routes/{id}` | Delete route |
| POST | `/admin/reload` | Hot reload configuration |

## Monitoring

### Key Metrics
- `gateway_requests_total` - Request counter by route/status
- `gateway_request_duration_seconds` - Request latency histogram
- `gateway_rate_limit_hits_total` - Rate limit violations
- `gateway_circuit_breaker_state` - Circuit breaker status

### Health Endpoints
- `/health` - Service health
- `/metrics` - Prometheus metrics
- `/admin/health` - Admin API health

## Security

### Rate Limiting
```json
{
  "rateLimit": {
    "enabled": true,
    "tokensPerInterval": 100,
    "intervalMs": 60000,
    "keyGenerator": "ip", // or "user", "tenant"
    "skipSuccessfulRequests": false
  }
}
```

### IP Filtering
```json
{
  "ipFilter": {
    "allowlist": ["192.168.1.0/24"],
    "denylist": ["10.0.0.0/8"]
  }
}
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| 429 Too Many Requests | Rate limit exceeded | Check rate limit configuration |
| 503 Service Unavailable | Circuit breaker open | Check upstream service health |
| 401 Unauthorized | Invalid JWT | Verify token and JWKS configuration |
| 502 Bad Gateway | Upstream connection failed | Check service discovery |

## Performance Tuning

### Connection Pooling
```javascript
const pool = {
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000
}
```

### Caching
- JWKS cache: 10 minutes TTL
- Route cache: 5 minutes TTL
- Service discovery cache: 1 minute TTL

## Development

### Local Setup
```bash
# Prerequisites
node >= 18
redis >= 7

# Install
npm install

# Environment
cp .env.example .env

# Start dependencies
docker-compose up redis

# Start service
npm run dev
```

### Testing
```bash
npm test              # Unit tests
npm run test:integration  # Integration tests
npm run test:load     # Load tests
```
