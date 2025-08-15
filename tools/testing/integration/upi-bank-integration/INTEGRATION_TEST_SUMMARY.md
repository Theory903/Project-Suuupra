# UPI Core ↔ Bank Simulator Integration Test Suite

## Executive Summary

This comprehensive integration test suite validates the gRPC communication and transaction processing between UPI Core (Go, port 50052) and Bank Simulator (TypeScript, port 50050) services. The test suite ensures ACID transaction properties, proper error handling, and performance requirements are met across the payment ecosystem.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    UPI Integration Test Suite                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    gRPC    ┌─────────────────┐             │
│  │   UPI Core      │◄──────────►│ Bank Simulator  │             │
│  │   (Go)          │            │   (TypeScript)  │             │
│  │   Port: 50052   │            │   Port: 50050   │             │
│  └─────────────────┘            └─────────────────┘             │
│           │                              │                      │
│           ▼                              ▼                      │
│  ┌─────────────────┐            ┌─────────────────┐             │
│  │   PostgreSQL    │            │   PostgreSQL    │             │
│  │  (upi_core DB)  │            │(bank_simulator) │             │
│  └─────────────────┘            └─────────────────┘             │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │     Redis       │    │     Kafka       │    │   Jaeger    │  │
│  │   (Caching)     │    │  (Messaging)    │    │  (Tracing)  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Test Coverage Matrix

| Test Category | UPI Core | Bank Simulator | ACID Properties | Performance | Error Handling |
|---------------|----------|----------------|-----------------|-------------|----------------|
| Service Health | ✅ | ✅ | N/A | ✅ | ✅ |
| Account Creation | ✅ | ✅ | ✅ | ✅ | ✅ |
| VPA Resolution | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transaction Processing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Error Scenarios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Load Testing | ✅ | ✅ | ✅ | ✅ | ✅ |

## Key Test Scenarios

### 1. Service Health Validation
- **Purpose**: Ensure both services are operational and responsive
- **Methods**: gRPC health checks, service availability
- **Expected**: < 100ms response time, 100% availability

### 2. Account Creation Flow
```
UPI Core → Bank Simulator.CreateAccount() → Database Insert → Success Response
```
- **Validation**: Account number generation, IFSC code assignment, KYC validation
- **ACID**: Atomicity in account creation, consistency in data
- **Performance**: < 1s account creation time

### 3. VPA Resolution Flow
```
Client → UPI Core.ResolveVPA() → Bank Simulator.ResolveVPA() → Account Lookup
```
- **Validation**: VPA exists, bank code mapping, account holder details
- **Performance**: < 300ms resolution time (p99)
- **Cross-service**: UPI Core routing to correct bank

### 4. Transaction Processing Flow
```
P2P Transaction Flow:
1. UPI Core.ProcessTransaction() → Validation
2. Bank Simulator.ProcessTransaction(DEBIT) → Payer Account
3. Bank Simulator.ProcessTransaction(CREDIT) → Payee Account
4. Settlement & Confirmation
```
- **ACID Properties**:
  - **Atomicity**: All or nothing transaction processing
  - **Consistency**: Account balances remain consistent
  - **Isolation**: Concurrent transactions don't interfere
  - **Durability**: Transaction records persist after commit

### 5. Error Handling Scenarios
- **Insufficient Funds**: Proper error codes and rollback
- **Invalid VPA**: Graceful error handling
- **Service Timeouts**: Circuit breaker patterns
- **Database Failures**: Transaction rollback mechanisms

## Performance Requirements

| Operation | Latency (p99) | Throughput | Success Rate |
|-----------|---------------|------------|--------------|
| VPA Resolution | < 300ms | 1000 QPS | > 99.5% |
| Account Creation | < 1s | 100 TPS | > 99.9% |
| Transaction Processing | < 500ms | 500 TPS | > 99.99% |
| Health Checks | < 100ms | 5000 QPS | > 99.9% |

## Test Execution

### Quick Start
```bash
cd tools/testing/integration/upi-bank-integration
./run-tests.sh
```

### Advanced Usage
```bash
# Run with benchmarks
./run-tests.sh --benchmark

# Generate detailed reports
./run-tests.sh --report

# Run specific test category
./run-tests.sh --test TestTransactionProcessingFlow

# Load testing with k6
k6 run k6-load-test.js
```

### CI/CD Integration
```yaml
# GitHub Actions Example
- name: Run UPI Integration Tests
  run: |
    cd tools/testing/integration/upi-bank-integration
    ./run-tests.sh --report
    
- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: upi-integration-reports
    path: tools/testing/integration/upi-bank-integration/test_report_*.txt
```

## Test Data Management

### Account Test Data
```go
// Standard test account creation
CreateAccountRequest{
    BankCode: "HDFC",
    CustomerID: "CUST_{UUID}",
    AccountType: SAVINGS,
    InitialDeposit: 100000 paisa (1000 INR),
    KYC: {
        PAN: "ABCDE1234F",
        AadhaarMasked: "****5678",
        FullName: "Test Customer",
        DateOfBirth: "1990-01-01"
    }
}
```

### VPA Test Data
```go
// VPA linking pattern
LinkVPARequest{
    VPA: "test{uuid}@hdfc",
    BankCode: "HDFC", 
    AccountNumber: "{generated}",
    IsPrimary: true
}
```

### Transaction Test Data
```go
// P2P transaction pattern
TransactionRequest{
    TransactionID: "TXN_{UUID}",
    RRN: "RRN_{12chars}",
    PayerVPA: "payer@hdfc",
    PayeeVPA: "payee@hdfc", 
    Amount: 50000 paisa (500 INR),
    Currency: "INR",
    Type: P2P
}
```

## Monitoring and Observability

### Metrics Collected
- **Latency**: Response times for all operations
- **Throughput**: Transactions per second
- **Error Rates**: Failed operations percentage  
- **Success Rates**: Successful operations percentage
- **Resource Usage**: CPU, memory, database connections

### Distributed Tracing
- **Jaeger Integration**: Full request tracing across services
- **Span Details**: gRPC calls, database queries, business logic
- **Error Tracking**: Exception propagation and root cause analysis

### Logging
- **Structured Logs**: JSON format for easy parsing
- **Correlation IDs**: Track requests across service boundaries
- **Error Context**: Full stack traces and request context

## Quality Gates

### Test Execution Criteria
- ✅ All health checks pass
- ✅ Account creation success rate > 99.9%
- ✅ VPA resolution success rate > 99.5%
- ✅ Transaction processing success rate > 99.99%
- ✅ No memory leaks or resource exhaustion
- ✅ Error handling covers all edge cases

### Performance Criteria
- ✅ p99 latency within SLA thresholds
- ✅ System handles concurrent load without degradation
- ✅ Database connections properly managed
- ✅ Circuit breakers function correctly under stress

## Troubleshooting Guide

### Common Issues

#### 1. gRPC Connection Failures
```bash
# Check service availability
nc -z localhost 50050  # Bank Simulator
nc -z localhost 50052  # UPI Core

# View service logs
docker-compose -f docker-compose.integration.yml logs bank-simulator
docker-compose -f docker-compose.integration.yml logs upi-core
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL health
docker-compose -f docker-compose.integration.yml logs postgres

# Verify database creation
docker exec -it upi-postgres psql -U postgres -l
```

#### 3. Test Failures
```bash
# Run tests with verbose output
go test -v -run TestSpecificTest

# Check test data cleanup
# Ensure previous test runs don't leave stale data
```

#### 4. Performance Issues
```bash
# Check resource usage
docker stats

# Monitor database queries
# Enable query logging in PostgreSQL

# Check for connection leaks
# Monitor active connections in pgAdmin or psql
```

## Security Considerations

### Test Environment Security
- **Isolated Environment**: Tests run in Docker containers
- **Test Data**: No production data used
- **Credentials**: Test-only credentials, rotated regularly
- **Network**: Isolated Docker network for test services

### Security Test Coverage
- **Input Validation**: SQL injection, XSS prevention
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Encryption**: TLS 1.3 for all communications

## Continuous Improvement

### Metrics Dashboard
- **Success Rates**: Test pass/fail trends
- **Performance Trends**: Latency and throughput over time
- **Error Analysis**: Common failure patterns
- **Coverage Reports**: Code coverage from integration tests

### Feedback Loop
1. **Test Results** → Development Team
2. **Performance Metrics** → Infrastructure Team  
3. **Error Patterns** → Platform Team
4. **Coverage Gaps** → Test Engineering Team

## Future Enhancements

### Planned Improvements
1. **Chaos Engineering**: Failure injection testing
2. **Contract Testing**: Pact framework integration
3. **Multi-Bank Testing**: SBI, ICICI, Axis bank simulators
4. **Stress Testing**: Higher load scenarios
5. **Security Testing**: Penetration testing automation

### Scalability Testing
- **Multi-Region**: Test across geographical regions
- **High Volume**: 10K+ TPS transaction processing
- **Long Duration**: 24-hour soak testing
- **Recovery Testing**: Service restart and failover scenarios

## Conclusion

This comprehensive integration test suite provides confidence in the UPI Core ↔ Bank Simulator communication layer, ensuring:

- ✅ **Functional Correctness**: All business flows work as expected
- ✅ **Performance Requirements**: SLA targets are consistently met
- ✅ **Reliability**: Error handling and recovery mechanisms function properly
- ✅ **Observability**: Full visibility into system behavior
- ✅ **Quality Assurance**: Automated validation of critical payment flows

The test suite serves as a crucial component in the CI/CD pipeline, providing rapid feedback on system health and preventing regressions in the payment processing ecosystem.