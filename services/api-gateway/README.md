# 🌐 Suuupra API Gateway

The central entry point for all Suuupra microservices, providing authentication, routing, rate limiting, and observability.

## 📋 Overview

The API Gateway serves as the single point of entry for all client requests to the Suuupra ecosystem. It handles:

- **Authentication & Authorization**: JWT token validation and user authentication
- **Service Routing**: Intelligent request routing to appropriate microservices
- **Rate Limiting**: Request throttling and abuse prevention
- **Circuit Breaking**: Fault tolerance and service protection
- **Load Balancing**: Distributing traffic across service instances
- **Observability**: Metrics, logging, and distributed tracing

## 🏗️ Architecture

```
Client Request → API Gateway → Service Discovery → Target Service
                     ↓
              [Auth, Rate Limit, Circuit Breaker]
```

### Key Components
- **Fastify**: High-performance HTTP server
- **JWT Authentication**: Token-based security
- **Redis**: Session storage and rate limiting
- **Circuit Breaker**: Service resilience with Opossum
- **OpenTelemetry**: Distributed tracing and metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 22.18.0+
- Redis server
- Target microservices running

### Installation
```bash
npm install
```

### Configuration
Copy and configure the environment variables:
```bash
cp .env.example .env
```

Key configuration options:
- `PORT`: Gateway port (default: 8000)
- `JWT_SECRET`: JWT signing secret
- `REDIS_HOST`: Redis server host
- `LOG_LEVEL`: Logging level (info, debug, error)

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health & Status
- `GET /health` - Health check endpoint
- `GET /metrics` - Prometheus metrics
- `GET /api/gateway/status` - Gateway status information

### Authentication Routes
- `POST /api/v1/auth/*` - Proxied to Identity service
- Authentication happens automatically for protected routes

### Service Proxying
All other requests are proxied to appropriate services based on routing rules:

- `/api/v1/admin/*` → Admin Service
- `/api/v1/commerce/*` → Commerce Service  
- `/api/v1/content/*` → Content Service
- `/api/v1/payments/*` → Payments Service
- `/api/v1/analytics/*` → Analytics Service

## 🔧 Configuration

### Service Registration
Services are configured in `config/config.yaml`:

```yaml
services:
  admin:
    url: http://localhost:3001
    timeout_ms: 5000
    retries: 3
```

### Rate Limiting
Configure rate limits per endpoint:

```yaml
rate_limiting:
  default:
    requests_per_minute: 100
  by_endpoint:
    "/api/v1/auth/login":
      requests_per_minute: 10
```

### Circuit Breaker
Automatic fault tolerance:

```yaml
circuit_breaker:
  failure_threshold: 5
  recovery_timeout_seconds: 30
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

## 📊 Monitoring

### Metrics
The gateway exposes Prometheus metrics at `/metrics`:

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `circuit_breaker_state` - Circuit breaker status
- `rate_limit_exceeded_total` - Rate limit violations

### Health Checks
Health endpoint provides service status:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "redis": "connected",
    "downstream_services": "available"
  }
}
```

### Distributed Tracing
OpenTelemetry integration provides distributed tracing across all services.

## 🔒 Security

### Authentication
- JWT-based authentication with RS256 algorithm
- Token validation on all protected routes
- Automatic token refresh handling

### Rate Limiting
- IP-based rate limiting
- Endpoint-specific limits
- Redis-backed distributed limiting

### CORS
- Configurable CORS policies
- Origin validation
- Credential handling

## 🚨 Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid or expired token",
    "request_id": "req_123456789"
  }
}
```

### Circuit Breaker
When services are down, the gateway returns:
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE", 
    "message": "Service temporarily unavailable",
    "retry_after": 30
  }
}
```

## 🔄 Deployment

### Docker
```bash
docker build -t suuupra-api-gateway .
docker run -p 8000:8000 suuupra-api-gateway
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

### Environment Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port
- `JWT_SECRET`: JWT signing secret
- `REDIS_HOST`: Redis server
- `LOG_LEVEL`: Logging level

## 📈 Performance

### Benchmarks
- **Throughput**: 10,000+ requests/second
- **Latency**: <50ms p99 for proxied requests
- **Memory**: ~150MB under normal load
- **CPU**: <5% under normal load

### Optimization Tips
1. Use connection pooling for downstream services
2. Enable HTTP/2 for better multiplexing
3. Configure appropriate timeouts
4. Monitor circuit breaker metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📚 Related Documentation

- [Authentication Guide](../identity/README.md)
- [Service Discovery](../docs/service-discovery.md)
- [Deployment Guide](../docs/deployment.md)
- [Monitoring Setup](../docs/monitoring.md)

## 🆘 Troubleshooting

### Common Issues

**Gateway not starting**
- Check Redis connectivity
- Verify port availability
- Review configuration syntax

**Authentication failures**
- Verify JWT secret configuration
- Check token expiration settings
- Review Identity service connectivity

**High latency**
- Monitor circuit breaker status
- Check downstream service health
- Review timeout configurations

### Support
For technical support, please refer to the [main documentation](../../README.md) or create an issue in the repository.