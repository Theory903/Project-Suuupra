# 🌍 Suuupra Global Logger

## World's Best Logging Techniques Implementation

A comprehensive, multi-lingual, structured logging library implementing "Observability 2.0" with wide events, OpenTelemetry integration, and support for all languages in your platform.

## 🚀 Key Features

### ✨ Modern Logging Techniques
- **Structured Logging**: JSON-based with arbitrary-wide events
- **OpenTelemetry Integration**: Distributed tracing and metrics
- **Correlation IDs**: Request tracing across microservices  
- **Context Propagation**: Rich contextual information
- **Sampling & Rate Limiting**: Performance-optimized for scale
- **Security-First**: PII masking and compliance-ready

### 🌐 Multi-Language Support
- **Node.js/TypeScript**: High-performance structured logging
- **Python**: Rich context with FastAPI/Django integration
- **Go**: Ultra-fast logging with minimal allocations
- **Java**: Enterprise-grade with Spring Boot integration
- **Rust**: Zero-cost abstractions for performance-critical services

### 📊 Observability 2.0
- **Wide Events**: Single source of truth for request lifecycle
- **Rich Context**: Hundreds of dimensions per log event
- **Real-time Analysis**: Query and visualize in real-time
- **Distributed Tracing**: End-to-end request tracking
- **SLO Monitoring**: Built-in performance metrics

## 📁 Structure

```
shared/libs/logging/
├── core/                    # Core logging interfaces and types
├── node/                    # Node.js/TypeScript implementation  
├── python/                  # Python implementation
├── go/                      # Go implementation
├── java/                    # Java implementation
├── rust/                    # Rust implementation (for live-tracking)
├── config/                  # Shared configuration schemas
├── observability/           # OpenTelemetry and monitoring
├── examples/                # Usage examples for each language
└── docs/                    # Comprehensive documentation
```

## 🎯 Design Principles

1. **Wide Events**: One event per unit-of-work with rich context
2. **Structured Data**: Machine-readable JSON with semantic conventions
3. **Performance-First**: Minimal overhead with smart sampling
4. **Security-Aware**: Built-in PII protection and compliance
5. **Developer-Friendly**: Simple APIs with powerful features
6. **Production-Ready**: Enterprise-grade reliability and monitoring

## 🔧 Quick Start

### Node.js/TypeScript
```typescript
import { createLogger } from '@suuupra/logging/node';

const logger = createLogger({
  service: 'api-gateway',
  environment: 'production'
});

logger.info('Request processed', {
  userId: '12345',
  duration: 150,
  endpoint: '/api/users'
});
```

### Python
```python
from suuupra.logging import create_logger

logger = create_logger(
    service='payment-service',
    environment='production'
)

logger.info('Payment processed', {
    'user_id': '12345',
    'amount': 100.50,
    'currency': 'USD'
})
```

### Go
```go
import "github.com/suuupra/logging/go"

logger := logging.New(logging.Config{
    Service:     "live-tracking",
    Environment: "production",
})

logger.Info("Location updated", 
    logging.String("user_id", "12345"),
    logging.Float64("lat", 37.7749),
    logging.Float64("lng", -122.4194),
)
```

## 📈 Integration

### Observability Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Dashboards and visualization  
- **Jaeger**: Distributed tracing
- **OpenTelemetry**: Unified telemetry collection

### Log Aggregation
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Fluentd**: Log forwarding and processing
- **Cloud Logging**: AWS CloudWatch, GCP Cloud Logging
- **Honeycomb**: Advanced log analysis and querying

## 🛡️ Security & Compliance

- **PII Masking**: Automatic detection and masking of sensitive data
- **Encryption**: Log encryption at rest and in transit
- **Access Control**: Role-based access to log data
- **Audit Trails**: Compliance-ready audit logging
- **Retention Policies**: Automated log lifecycle management

## 📚 Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Configuration Guide](./docs/configuration.md)
- [Best Practices](./docs/best-practices.md)
- [Migration Guide](./docs/migration.md)
- [Troubleshooting](./docs/troubleshooting.md)

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to the global logger.

---

**Built with ❤️ by the Suuupra Engineering Team**
