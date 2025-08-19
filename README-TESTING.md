# 🧪 Suuupra Services Testing Framework

Comprehensive testing solution for all 19+ Suuupra microservices with edge cases, mocks, authentication flows, and automated reporting.

## 🎯 Overview

This testing framework provides:

- **🔧 Service Orchestration**: Automatic start/stop of services with API Gateway + Identity as global auth
- **🧪 Comprehensive Testing**: Unit, integration, edge cases, security, performance tests
- **🎭 Mock Data Generation**: Realistic test data with boundary conditions and malicious inputs
- **📊 Detailed Reporting**: HTML reports with metrics, success rates, and failure analysis
- **🔄 CI/CD Ready**: Automated pipeline integration with Docker infrastructure

## 🚀 Quick Start

### Prerequisites

```bash
# Required tools
node --version    # >= 18.0.0
python3 --version # >= 3.8
go version        # Latest
java --version    # >= 17
rustc --version   # Latest
docker --version  # Latest
```

### 1. Setup and Run All Tests

```bash
# One command to rule them all
./test-runner.sh

# Or step by step
./test-runner.sh setup    # Install deps + infrastructure
./test-runner.sh test     # Run comprehensive tests
./test-runner.sh report   # Generate HTML report
./test-runner.sh cleanup  # Clean up resources
```

### 2. Run Individual Commands

```bash
# Verbose testing with debug logs
npm run test:verbose

# Test specific service
node test-single-service.js payments

# Load testing only
npm run test:load

# Contract testing
npm run test:contracts
```

## 🏗️ Architecture

### Core Components

1. **test-orchestrator.js** - Main orchestration engine
2. **test-mocks.js** - Mock data generator with edge cases
3. **test-runner.sh** - Shell script for complete pipeline
4. **docker-compose.test.yml** - Test infrastructure (auto-generated)

### Service Testing Flow

```mermaid
graph TD
    A[Start Test Orchestrator] --> B[Setup Infrastructure]
    B --> C[Start API Gateway :3000]
    C --> D[Start Identity Service :8080]
    D --> E[Get Auth Token]
    E --> F[Test Business Services]
    F --> G{For Each Service}
    G --> H[Start Service]
    G --> I[Health Checks]
    I --> J[Auth Tests]
    J --> K[Functional Tests]
    K --> L[Edge Case Tests]
    L --> M[Performance Tests]
    M --> N[Stop Service]
    N --> O[Next Service]
    O --> G
    G --> P[Generate Report]
    P --> Q[Cleanup]
```

## 🧪 Test Categories

### 1. Health & Infrastructure Tests
- Basic health endpoints (`/health`, `/ready`, `/metrics`)
- Service startup and shutdown
- Database connectivity
- External service dependencies

### 2. Authentication & Authorization Tests
- **No Auth**: Blocked access to protected endpoints
- **Invalid Token**: Malformed/expired JWT rejection  
- **Valid Token**: Proper access with Identity service token
- **Role-based**: Admin/User/Creator permission checks

### 3. Functional Tests
- **Service-specific endpoints** with realistic payloads
- **CRUD operations** for all data models
- **Business logic validation** 
- **Integration flows** between services

### 4. Edge Case & Security Tests
- **Large payloads** (10MB+ data)
- **Malformed JSON** and invalid inputs
- **SQL injection** attempts (`'; DROP TABLE users; --`)
- **XSS attacks** (`<script>alert("xss")</script>`)
- **Path traversal** (`../../../etc/passwd`)
- **Unicode handling** (🚀, 汉字)
- **Boundary values** (MAX_INT, MIN_INT, NaN)

### 5. Performance Tests
- **Response time** validation (< 500ms for health checks)
- **Concurrent requests** (10 simultaneous, 80% success rate)
- **Load testing** with k6 (if available)
- **Memory/CPU profiling**

## 🎭 Mock Data

The framework includes comprehensive mock data generators:

### User Data
```javascript
{
  id: "user_1",
  email: "user1@test.com", 
  role: "ADMIN|TEACHER|STUDENT|CREATOR",
  status: "ACTIVE|INACTIVE|SUSPENDED",
  profile: { avatar, bio, skills }
}
```

### Payment Data  
```javascript
{
  id: "payment_1",
  amount: 1500.50,
  currency: "INR",
  method: "UPI|CARD|NETBANKING|WALLET",
  status: "SUCCESS|FAILED|PENDING|REFUNDED",
  fraudChecks: { velocity, device, location }
}
```

### Course Data
```javascript
{
  id: "course_1", 
  title: "Advanced React Development",
  category: "programming",
  price: 2999,
  materials: [{ type: "video|document|quiz", url }]
}
```

### Edge Case Data
- **Malicious strings**: XSS, SQL injection, template injection
- **Invalid formats**: emails, phone numbers, JSON
- **Boundary numbers**: MAX_INT, MIN_INT, Infinity, NaN
- **File uploads**: malicious extensions, oversized files
- **Unicode**: emojis, international characters

## 📊 Service Configuration

Each service is configured with:

```javascript
'service-name': {
  type: 'node|python|go|java|rust',
  port: 3000,
  healthCheck: '/health',
  auth: true,              // Requires authentication
  priority: 1,             // Start order
  persistent: false        // Stop after testing
}
```

### Core Services (Always Running)
- **api-gateway** (:3000) - Central routing and auth
- **identity** (:8080) - User management and JWT tokens

### Business Services (Test & Stop)
- **admin** (:3001) - Admin panel and user management
- **payments** (:8009) - Payment processing and UPI
- **content** (:3003) - Course management and search
- **live-classes** (:3005) - WebRTC classes
- **commerce** (:8002) - Order processing
- **analytics** (:8001) - Real-time analytics
- *...and 12 more services*

## 🐳 Test Infrastructure

Auto-generated Docker infrastructure includes:

```yaml
services:
  postgres-test:    # :5433 - PostgreSQL for Identity/Commerce
  mysql-test:       # :3307 - MySQL for Payments/Ledger  
  redis-test:       # :6380 - Redis for caching/sessions
  mongodb-test:     # :27018 - MongoDB for Content
  elasticsearch-test: # :9201 - Elasticsearch for search
```

All services are health-checked and ready before tests begin.

## 📈 Test Results

### Console Output
```bash
🎯 SUUUPRA SERVICES TEST SUMMARY
=====================================
📅 Timestamp: 2024-01-15T10:30:00.000Z
🏢 Services Tested: 17
✅ Services Passed: 15
❌ Services Failed: 2
🧪 Total Tests: 425
✅ Tests Passed: 389
❌ Tests Failed: 36
📈 Success Rate: 91.5%
```

### HTML Report
Detailed HTML report generated at `test-results/test-report.html` with:
- Service-by-service breakdown
- Test category results (health, auth, functional, edge cases)
- Error details and stack traces
- Performance metrics
- Interactive charts and tables

### JSON Output
Machine-readable results in `test-results.json`:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "totalServices": 17,
    "passedServices": 15,
    "failedServices": 2,
    "successRate": 91.5
  },
  "services": {
    "payments": {
      "passed": 25,
      "failed": 2,
      "errors": ["Auth test failed: Invalid token accepted"],
      "duration": 45000
    }
  }
}
```

## 🎯 Service-Specific Test Cases

### API Gateway
- Route matching and proxy functionality
- Rate limiting enforcement (1000 req/min)
- JWT validation and forwarding
- Circuit breaker behavior
- WebSocket proxy for live services

### Identity Service
- User registration and login flows
- JWT token generation and validation  
- Role-based access control (RBAC)
- Password strength requirements
- Account lockout after failed attempts

### Payments Service
- UPI payment processing with bank simulator
- Card payment validation
- Idempotency key handling
- Fraud detection algorithms
- Webhook delivery and retry logic
- Double-entry ledger validation

### Content Service
- File upload with virus scanning
- Elasticsearch indexing and search
- Video transcoding workflows
- Content moderation pipelines
- CDN integration for media delivery

### Live Classes
- WebRTC peer connection establishment
- Real-time chat and screen sharing
- Recording and playback functionality
- Participant management (mute/kick)
- Scalability with MediaSoup SFU

## 🔧 Customization

### Adding New Services

1. **Add service configuration**:
```javascript
// In test-orchestrator.js
'new-service': {
  type: 'node',
  port: 3010,
  healthCheck: '/health',
  auth: true,
  priority: 21,
  persistent: false
}
```

2. **Add service-specific tests**:
```javascript
// In loadServiceTestCases()
'new-service': {
  'createResource': {
    method: 'POST',
    path: '/api/v1/resources',
    body: { name: 'test', type: 'example' },
    expectedStatus: 201
  }
}
```

### Custom Mock Data
```javascript
// In test-mocks.js
generateCustomMockData() {
  return Array.from({ length: 100 }, (_, i) => ({
    id: `custom_${i}`,
    customField: `value_${i}`,
    // ... your fields
  }));
}
```

### Environment Configuration
```bash
# Set custom environment variables
export POSTGRES_URL="postgresql://user:pass@host:port/db"
export REDIS_URL="redis://host:port"
export DEBUG=1  # Enable verbose logging
export TEST_TIMEOUT=30000  # 30s timeout per test
```

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
name: Service Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Suuupra Tests
        run: |
          chmod +x ./test-runner.sh
          ./test-runner.sh
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

### Docker Integration
```bash
# Run tests in Docker environment
docker run --rm -v $(pwd):/app -w /app node:18 ./test-runner.sh

# With custom Docker Compose
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## 🎁 Advanced Features

### Load Testing with k6
Each service can include k6 scripts in `tests/load/`:
```javascript
// services/payments/tests/load/payment-load.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 50,        // 50 virtual users
  duration: '5m',  // Run for 5 minutes
};

export default function() {
  const response = http.post('http://localhost:8009/api/v1/payments', {
    amount: 100,
    currency: 'INR'
  });
  
  check(response, {
    'payment processed': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### Contract Testing
Validate API contracts between services:
```javascript
// test-contracts.js  
const { validateContract } = require('./contract-validator');

await validateContract('api-gateway', 'identity', {
  endpoint: '/auth/validate',
  expectedSchema: userTokenSchema
});
```

### Chaos Engineering
Inject failures to test resilience:
```javascript
// In test orchestrator
await injectChaos('payments', {
  type: 'network-delay',
  duration: '30s',
  latency: '2s'
});
```

## 🛠️ Troubleshooting

### Common Issues

**Port conflicts**:
```bash
# Check what's using ports
lsof -i :3000
# Kill conflicting processes  
pkill -f "node.*server"
```

**Database connection failures**:
```bash
# Check Docker containers
docker ps
docker-compose -f docker-compose.test.yml logs postgres-test
```

**Service startup timeouts**:
```bash
# Increase timeout in test-orchestrator.js
await this.waitForHealthCheck(serviceName, 60); // 60 retries
```

**Memory issues**:
```bash
# Monitor memory usage
docker stats
# Increase Docker memory limits
# Add to service in docker-compose.test.yml:
# mem_limit: 1g
```

### Debug Mode
```bash
# Enable detailed logging
DEBUG=1 ./test-runner.sh
export DEBUG=1
npm run test:verbose
```

## 📚 Best Practices

1. **Always test locally** before committing
2. **Keep test data realistic** but anonymized
3. **Test edge cases** extensively 
4. **Monitor test performance** and optimize slow tests
5. **Use meaningful test names** and descriptions
6. **Clean up resources** after each test
7. **Document service-specific requirements**
8. **Keep mock data generators updated** with schema changes

## 🤝 Contributing

1. Add tests for new services in `test-orchestrator.js`
2. Update mock data in `test-mocks.js` for new models
3. Extend edge case coverage for security vulnerabilities  
4. Add performance benchmarks for critical paths
5. Update this README with new features

---

**Happy Testing! 🎉**

The Suuupra testing framework ensures your microservices are production-ready with comprehensive coverage, realistic scenarios, and automated reporting.