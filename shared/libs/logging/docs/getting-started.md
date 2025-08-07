# Getting Started with Suuupra Global Logger

## 🎯 Overview

The Suuupra Global Logger implements the world's best logging techniques including:
- **Structured Logging**: JSON-based with arbitrary-wide events
- **Observability 2.0**: Single source of truth for request lifecycle
- **OpenTelemetry Integration**: Distributed tracing and metrics
- **Multi-Language Support**: Node.js, Python, Go, Java, Rust
- **Security-First**: Built-in PII masking and compliance

## 🚀 Quick Start

### Node.js/TypeScript

```bash
# Install dependencies (if using standalone)
npm install @opentelemetry/api @opentelemetry/auto-instrumentations-node
```

```typescript
import { createLogger, LogLevel } from '@suuupra/logging/node';

const logger = createLogger({
  service: 'my-service',
  environment: 'production',
  level: LogLevel.INFO,
  security: { maskPII: true }
});

logger.info('User login successful', {
  userId: '12345',
  ip: '192.168.1.1',
  duration: 150
});
```

### Python

```bash
pip install structlog opentelemetry-api
```

```python
from suuupra.logging import create_logger

logger = create_logger({
    'service': 'my-service',
    'environment': 'production',
    'mask_pii': True
})

logger.info('Payment processed', {
    'user_id': '12345',
    'amount': 100.50,
    'currency': 'USD'
})
```

### Go

```bash
go get github.com/suuupra/logging/go
```

```go
import "github.com/suuupra/logging/go"

logger := logging.New(logging.Config{
    Service:     "my-service",
    Environment: "production",
    Level:       logging.InfoLevel,
    MaskPII:     true,
})

logger.Info("Location updated",
    logging.String("user_id", "12345"),
    logging.Float64("lat", 37.7749),
    logging.Float64("lng", -122.4194),
)
```

## 🏗️ Architecture Concepts

### Wide Events

Instead of scattered logs across multiple systems, create one comprehensive event per unit-of-work:

```typescript
// ❌ Traditional scattered logging
logger.info('User authenticated');
logger.debug('Database query: 150ms');
logger.warn('Rate limit approaching');

// ✅ Wide Event approach
logger.info('Request processed', {
  // HTTP Context
  method: 'POST',
  url: '/api/users',
  statusCode: 201,
  duration: 245,
  
  // User Context  
  userId: '12345',
  userType: 'premium',
  
  // Business Context
  operation: 'create_user',
  tenantId: 'acme-corp',
  
  // Performance Context
  dbQueries: 3,
  dbDuration: 150,
  cacheHits: 2,
  
  // Security Context
  authMethod: 'oauth',
  ipAddress: '192.168.1.1',
  
  // Custom Dimensions
  featureFlags: { newUI: true },
  abTestVariant: 'control'
});
```

### Context Propagation

Automatically track requests across services:

```typescript
// Express middleware automatically adds context
app.use(expressLoggingMiddleware(logger));

// All logs in request handlers include correlation
app.get('/users/:id', async (req, res) => {
  // req.logger already has requestId, traceId, etc.
  req.logger.info('Fetching user', { userId: req.params.id });
  
  const user = await userService.getUser(req.params.id);
  
  req.logger.info('User fetched successfully', { 
    userId: req.params.id,
    found: !!user 
  });
});
```

### Performance Monitoring

Built-in performance tracking:

```typescript
const timer = logger.startTimer('database_operation');

try {
  const result = await database.query('SELECT * FROM users');
  
  timer.end({
    success: true,
    rowCount: result.length
  });
  
  return result;
} catch (error) {
  timer.end({
    success: false,
    error: error.message
  });
  throw error;
}
```

## 🔧 Framework Integration

### Express.js

```typescript
import { expressLoggingMiddleware } from '@suuupra/logging/node';

const logger = createLogger({ service: 'api-server' });
app.use(expressLoggingMiddleware(logger));
```

### Fastify

```typescript
import { fastifyLoggingPlugin } from '@suuupra/logging/node';

await fastify.register(fastifyLoggingPlugin, {
  service: 'api-server',
  level: LogLevel.INFO
});
```

### FastAPI (Python)

```python
from suuupra.logging import FastAPILoggingMiddleware

app = FastAPI()
app.add_middleware(FastAPILoggingMiddleware, logger=logger)
```

### Django (Python)

```python
# settings.py
MIDDLEWARE = [
    'suuupra.logging.DjangoLoggingMiddleware',
    # ... other middleware
]
```

## 📊 Observability Integration

### OpenTelemetry Setup

```typescript
import { OpenTelemetryManager } from '@suuupra/logging/observability';

const otelManager = new OpenTelemetryManager({
  serviceName: 'my-service',
  tracing: {
    enabled: true,
    otlp: { endpoint: 'http://jaeger:14268/api/traces' }
  },
  metrics: {
    enabled: true,
    prometheus: { port: 9090, endpoint: '/metrics' }
  }
});
```

### Prometheus Metrics

Automatic metrics collection:
- `suuupra_log_entries_total` - Total log entries by level
- `suuupra_log_errors_total` - Error log entries
- `suuupra_operation_duration_ms` - Operation timings
- `suuupra_active_spans_total` - Active trace spans

### Grafana Dashboards

Pre-built dashboards available in `/monitoring/grafana/dashboards/`:
- Service overview with SLOs
- Error rate and latency trends  
- Request volume and success rates
- Performance percentiles

## 🛡️ Security & Compliance

### PII Masking

Automatic detection and masking:

```typescript
logger.info('User data', {
  email: 'user@example.com',      // → '[EMAIL]'
  creditCard: '4111-1111-1111-1111', // → '[CARD]'
  ssn: '123-45-6789'              // → '[SSN]'
});
```

### Audit Logging

Compliance-ready audit trails:

```typescript
logger.logSecurityEvent({
  type: 'data_access',
  severity: 'high',
  userId: '12345',
  ip: '192.168.1.1',
  details: {
    resource: '/api/users/sensitive',
    operation: 'READ',
    dataClassification: 'PII'
  }
});
```

## 🎛️ Configuration

### Environment-based Config

```json
{
  "logging": {
    "environments": {
      "development": {
        "level": "DEBUG",
        "format": "pretty",
        "security": { "maskPII": false }
      },
      "production": {
        "level": "WARN", 
        "format": "json",
        "security": { "maskPII": true },
        "sampling": { "enabled": true, "rate": 0.1 }
      }
    }
  }
}
```

### Service-specific Settings

```json
{
  "services": {
    "payment-service": {
      "level": "INFO",
      "specialHandling": {
        "transactionLogs": {
          "auditTrail": true,
          "encryption": true
        }
      }
    }
  }
}
```

## 📈 Best Practices

### 1. Use Structured Data

```typescript
// ❌ Unstructured
logger.info(`User ${userId} completed payment of $${amount}`);

// ✅ Structured
logger.info('Payment completed', {
  userId,
  amount,
  currency: 'USD',
  paymentMethod: 'card'
});
```

### 2. Include Business Context

```typescript
logger.info('Order created', {
  orderId: '12345',
  userId: '67890',
  items: 3,
  total: 99.99,
  // Business context
  customerTier: 'premium',
  promotionCode: 'SAVE20',
  fulfillmentCenter: 'west-coast'
});
```

### 3. Performance Correlation

```typescript
const timer = logger.startTimer('checkout_process');

try {
  await validateCart();
  await processPayment();  
  await createOrder();
  await sendConfirmation();
  
  timer.end({ 
    success: true,
    steps: 4 
  });
} catch (error) {
  timer.end({ 
    success: false, 
    failedStep: getCurrentStep() 
  });
  throw error;
}
```

### 4. Error Context

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    operation: 'user_registration',
    userId: '12345',
    retryAttempt: 2,
    // Include recovery context
    canRetry: isRetryableError(error),
    fallbackAvailable: true
  });
}
```

## 🔍 Querying & Analysis

### Log Aggregation

With structured logs, you can easily:

```sql
-- Find all failed payments in the last hour
SELECT * FROM logs 
WHERE service = 'payment-service' 
  AND data.operation = 'process_payment'
  AND data.success = false
  AND timestamp > NOW() - INTERVAL 1 HOUR;

-- Calculate P95 latency by endpoint
SELECT 
  data.endpoint,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY data.duration) as p95_latency
FROM logs 
WHERE service = 'api-gateway'
  AND data.duration IS NOT NULL
GROUP BY data.endpoint;
```

### Honeycomb Queries

```
BREAKDOWN BY data.userId 
WHERE service = "api-gateway" 
  AND data.statusCode >= 500
  AND timestamp > -1h
```

### Grafana Alerts

```yaml
- alert: HighErrorRate
  expr: rate(suuupra_log_errors_total[5m]) > 0.05
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
```

## 🚀 Next Steps

1. **[API Reference](./api-reference.md)** - Detailed API documentation
2. **[Configuration Guide](./configuration.md)** - Advanced configuration options
3. **[Best Practices](./best-practices.md)** - Production recommendations
4. **[Migration Guide](./migration.md)** - Migrate from existing logging
5. **[Examples](../examples/)** - Real-world implementation examples

---

**Questions?** Check our [FAQ](./troubleshooting.md) or reach out to the team!
