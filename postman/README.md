# 🚀 Suuupra EdTech Platform - API Testing Suite

## Overview

This is a **production-grade API testing suite** for the Suuupra EdTech Platform, featuring comprehensive testing of all 20+ microservices through the API Gateway. Built with Postman Collections and Newman CLI for automated testing, CI/CD integration, and performance monitoring.

## 🎯 Features

### ✅ Comprehensive Coverage
- **20+ Microservices** tested through API Gateway
- **200+ API endpoints** with full request/response validation
- **Authentication flows** including OAuth 2.0/OIDC
- **Business workflows** like order processing, payments, content management
- **Error handling** and edge case testing

### 🔧 Production-Ready Testing
- **Automated test execution** with Newman CLI
- **Multiple environments** (Local, Staging, Production)
- **Performance monitoring** with SLA validation
- **Detailed reporting** (HTML, JSON, JUnit)
- **CI/CD integration** ready

### 📊 Advanced Features
- **Correlation ID tracking** for distributed tracing
- **Token management** with auto-refresh
- **Rate limiting** and retry mechanisms
- **Security testing** with header validation
- **Load testing** capabilities

## 🚀 Quick Start

### Prerequisites
```bash
# Install Node.js 18+
node --version  # Should be 18+

# Install Newman globally
npm install -g newman newman-reporter-html
```

### Installation
```bash
cd postman/
npm install
```

### Run Tests
```bash
# Run complete test suite (local environment)
npm test

# Run health checks only
npm run test:health

# Run specific service tests
npm run test:auth
npm run test:payments
npm run test:commerce

# Run production tests
npm run test:production
```

## 📁 Project Structure

```
postman/
├── Suuupra-EdTech-Platform.postman_collection.json  # Main collection
├── environments/
│   ├── Local-Development.postman_environment.json   # Local env
│   └── Production.postman_environment.json          # Production env
├── newman-runner.js                                 # Test runner
├── package.json                                     # Dependencies
├── README.md                                        # This file
└── reports/                                         # Generated reports
    ├── newman-report.html                           # HTML report
    ├── newman-report.json                           # JSON report
    └── newman-junit.xml                             # JUnit XML
```

## 🔐 Authentication Flow

The test suite automatically handles authentication:

1. **User Registration** - Creates test user
2. **Login** - Obtains access/refresh tokens
3. **Token Storage** - Stores in environment variables
4. **Auto-Refresh** - Refreshes expired tokens
5. **Cleanup** - Removes test data after execution

## 🧪 Test Categories

### 1. 🔐 Authentication & Authorization
- OIDC Discovery
- JWKS validation
- User registration/login
- Token management
- Profile operations

### 2. 💳 Payment Gateway
- Payment intent creation
- Transaction processing
- Refund handling
- Risk assessment
- Multi-rail routing

### 3. 🏪 Commerce & Orders
- Shopping cart operations
- Order creation with saga
- Inventory management
- CQRS/Event Sourcing validation

### 4. 📚 Content Management
- Content CRUD operations
- File upload (multipart)
- Search functionality
- Workflow management

### 5. 🏦 Banking Simulation
- Bank operations
- Account management
- Transaction processing
- VPA resolution

### 6. 🔄 UPI Core
- UPI transaction processing
- VPA management
- Bank routing
- Settlement operations

### 7. 📊 Analytics & Tracking
- Event tracking
- User analytics
- Performance metrics
- Reporting

### 8. 🔔 Notifications
- Email notifications
- SMS alerts
- Push notifications
- Template management

### 9. 🎓 Live Classes
- Session management
- Streaming operations
- Participant handling
- Recording management

### 10. 🤖 LLM Tutor
- AI question answering
- Context management
- Personalization
- Performance optimization

### 11. 📈 Recommendations
- User recommendations
- Content suggestions
- ML model integration
- A/B testing

### 12. 🔧 Admin Operations
- System monitoring
- User management
- Configuration updates
- Health checks

## 📊 Reporting & Monitoring

### HTML Report
```bash
npm run report  # Opens HTML report in browser
```

### Performance Metrics
- **Response Times**: Average, Min, Max
- **Success Rates**: Per service and overall
- **Error Analysis**: Detailed failure breakdown
- **SLA Validation**: Automated compliance checking

### SLA Targets
- Average Response Time: < 2000ms
- Max Response Time: < 5000ms
- Success Rate: > 95%
- Error Rate: < 5%

## 🔧 Configuration

### Environment Variables
```json
{
  "gateway_url": "http://localhost:8080",
  "api_version": "v1",
  "access_token": "{{auto-generated}}",
  "test_user_id": "{{auto-generated}}",
  "correlation_id": "{{auto-generated}}"
}
```

### Custom Test Options
```javascript
// newman-runner.js configuration
const config = {
  timeout: 30000,        // 30 seconds
  delayRequest: 100,     // 100ms between requests
  iterationCount: 1,     // Single iteration
  bail: false           // Continue on failures
};
```

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
name: API Tests
on: [push, pull_request]
jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd postman && npm ci
      - run: cd postman && npm test
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: postman/reports/
```

### Jenkins Pipeline
```groovy
pipeline {
    agent any
    stages {
        stage('API Tests') {
            steps {
                dir('postman') {
                    sh 'npm ci'
                    sh 'npm test'
                }
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'postman/reports',
                        reportFiles: 'newman-report.html',
                        reportName: 'API Test Report'
                    ])
                }
            }
        }
    }
}
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Authentication Failures
```bash
# Check API Gateway health
curl http://localhost:8080/healthz

# Verify Identity service
curl http://localhost:8080/identity/.well-known/openid-configuration
```

#### 2. Service Unavailable
```bash
# Check Docker containers
docker-compose ps

# Restart specific service
docker-compose restart api-gateway
```

#### 3. Token Expiry
```bash
# Clear environment tokens
# Tokens will auto-refresh on next run
```

#### 4. Network Issues
```bash
# Test connectivity
ping localhost
telnet localhost 8080
```

### Debug Mode
```bash
# Enable verbose logging
newman run collection.json -e environment.json --verbose

# Debug specific folder
newman run collection.json -e environment.json --folder "Authentication" --verbose
```

## 📈 Performance Testing

### Load Testing
```bash
# Run with multiple iterations
newman run collection.json -e environment.json -n 10

# Parallel execution
npm run test:auth & npm run test:payments & wait
```

### Stress Testing
```bash
# High iteration count with minimal delay
newman run collection.json -e environment.json -n 100 --delay-request 10
```

## 🔒 Security Testing

### Security Headers Validation
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security

### Authentication Testing
- Token validation
- Expired token handling
- Invalid token rejection
- Role-based access control

## 📚 Best Practices

### 1. Test Organization
- Group related tests in folders
- Use descriptive test names
- Include setup/teardown logic

### 2. Data Management
- Use dynamic test data
- Clean up after tests
- Avoid hardcoded values

### 3. Error Handling
- Test both success and failure scenarios
- Validate error responses
- Check HTTP status codes

### 4. Performance
- Monitor response times
- Set appropriate timeouts
- Use correlation IDs for tracing

## 🤝 Contributing

### Adding New Tests
1. Create test in appropriate folder
2. Add environment variables if needed
3. Include assertions and error handling
4. Update documentation

### Test Guidelines
- Follow naming conventions
- Include comprehensive assertions
- Test both positive and negative cases
- Add performance validations

## 📞 Support

For issues or questions:
- Create GitHub issue
- Contact DevOps team
- Check service logs
- Review API documentation

---

**Built with ❤️ by the Suuupra EdTech Team**

*Production-ready API testing for billion-user scale platforms*
