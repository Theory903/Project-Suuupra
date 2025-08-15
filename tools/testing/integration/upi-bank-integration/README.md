# UPI Core ↔ Bank Simulator Integration Tests

This directory contains comprehensive integration tests for validating communication between UPI Core (Go, gRPC port 50052) and Bank Simulator (TypeScript, gRPC port 50050) services.

## Overview

The integration test suite validates:

1. **Service Health Checks** - Verify both services are operational
2. **Account Creation Flow** - Test UPI Core calling Bank Simulator's CreateAccount gRPC method
3. **VPA Resolution** - Test VPA lookup and validation across services
4. **Transaction Processing** - Test end-to-end payment flow with ACID properties
5. **Error Handling** - Validate proper error responses and edge cases
6. **Performance Benchmarks** - Measure response times and throughput

## Architecture

```
┌─────────────────┐    gRPC     ┌─────────────────┐
│   UPI Core      │◄──────────►│ Bank Simulator  │
│   (Go)          │             │   (TypeScript)  │
│   Port: 50052   │             │   Port: 50050   │
└─────────────────┘             └─────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│   PostgreSQL    │             │   PostgreSQL    │
│   (UPI Core DB) │             │ (Bank Sim DB)   │
└─────────────────┘             └─────────────────┘
```

## Quick Start

### Prerequisites

- Go 1.21+
- Docker and Docker Compose
- netcat (nc)

### Running Tests

```bash
# Run all integration tests
./run-tests.sh

# Run with performance benchmarks
./run-tests.sh --benchmark

# Run specific test
./run-tests.sh --test TestAccountCreationFlow

# Generate detailed report
./run-tests.sh --report

# Get help
./run-tests.sh --help
```

## Test Categories

### 1. Service Health Checks

Validates that both UPI Core and Bank Simulator services are healthy and responding.

```go
TestServiceHealthChecks
├── BankSimulator_HealthCheck
└── UpiCore_HealthCheck
```

### 2. Account Creation Flow

Tests the account creation process through Bank Simulator's gRPC interface.

```go
TestAccountCreationFlow
├── CreateAccount_Success
└── GetAccountDetails_AfterCreation
```

**Test Data:**
- Bank Code: HDFC
- Account Type: Savings
- Initial Deposit: 1000 INR (100000 paisa)

### 3. VPA Resolution Flow

Tests Virtual Payment Address (VPA) management and resolution.

```go
TestVPAResolutionFlow
├── CreateAccount_ForVPA
├── LinkVPA_Success
├── ResolveVPA_BankSimulator
└── ResolveVPA_UpiCore
```

**Test Scenarios:**
- Link VPA to account
- Resolve VPA through Bank Simulator
- Resolve VPA through UPI Core
- Cross-service VPA validation

### 4. Transaction Processing Flow

Tests end-to-end transaction processing with both debit and credit operations.

```go
TestTransactionProcessingFlow
├── Setup_PayerAndPayeeAccounts
├── Setup_VPAs
├── ProcessTransaction_BankSimulator_Debit
├── ProcessTransaction_BankSimulator_Credit
└── ProcessTransaction_UpiCore_E2E
```

**Test Flow:**
1. Create payer and payee accounts
2. Set up VPAs for both accounts
3. Process debit transaction (payer)
4. Process credit transaction (payee)
5. End-to-end UPI transaction

### 5. Error Handling and Edge Cases

Tests error scenarios and edge cases to ensure robust error handling.

```go
TestErrorHandlingAndEdgeCases
├── ResolveVPA_NonExistent
├── ProcessTransaction_InsufficientFunds
└── GetAccountDetails_NonExistent
```

### 6. Performance Baseline

Establishes performance benchmarks for critical operations.

```go
TestPerformanceBaseline
├── VPA_Resolution_Performance
└── Transaction_Processing_Performance
```

**Performance Requirements:**
- VPA Resolution: < 300ms (p99)
- Transaction Processing: < 500ms (p99)

## Test Data Management

### Account Creation
```go
CreateAccountRequest{
    BankCode: "HDFC",
    AccountType: SAVINGS,
    InitialDeposit: 100000 paisa (1000 INR),
    KYC: {
        PAN: "ABCDE1234F",
        AadhaarMasked: "****5678",
        FullName: "Test Customer"
    }
}
```

### VPA Management
```go
LinkVPARequest{
    VPA: "test{uuid}@hdfc",
    BankCode: "HDFC",
    AccountNumber: "{generated}",
    IsPrimary: true
}
```

### Transaction Processing
```go
TransactionRequest{
    Amount: 50000 paisa (500 INR),
    Type: P2P/DEBIT/CREDIT,
    Currency: "INR",
    Reference: "INTEGRATION_TEST"
}
```

## Benchmarks

The suite includes performance benchmarks accessible via:

```bash
go test -bench=. -benchmem
```

### Available Benchmarks:
- `BenchmarkVPAResolution` - VPA resolution performance
- `BenchmarkTransactionProcessing` - Transaction processing performance

## Configuration

### Test Configuration
```go
const (
    BankSimulatorAddress = "localhost:50050"
    UpiCoreAddress       = "localhost:50052"
    TestBankCode         = "HDFC"
    InitialDepositPaisa  = 100000  // 1000 INR
    TransactionAmount    = 50000   // 500 INR
)
```

### Service Endpoints
- Bank Simulator gRPC: `localhost:50050`
- UPI Core gRPC: `localhost:50052`
- Bank Simulator HTTP: `http://localhost:3000`
- UPI Core HTTP: `http://localhost:8081`

## Test Reports

The test suite can generate detailed reports including:

- Test execution results
- Performance metrics
- Service health status
- Error logs and debugging information

Reports are saved as `test_report_{timestamp}.txt`.

## Docker Environment

The tests use `docker-compose.integration.yml` which includes:

- PostgreSQL (shared database)
- Redis (caching layer)
- Kafka (event streaming)
- Bank Simulator service
- UPI Core service
- Monitoring stack (Prometheus, Grafana, Jaeger)

## Troubleshooting

### Common Issues

1. **Services not starting:**
   ```bash
   # Check service logs
   docker-compose -f docker-compose.integration.yml logs bank-simulator
   docker-compose -f docker-compose.integration.yml logs upi-core
   ```

2. **Connection refused:**
   ```bash
   # Verify services are listening
   nc -z localhost 50050  # Bank Simulator
   nc -z localhost 50052  # UPI Core
   ```

3. **Database connection errors:**
   ```bash
   # Check PostgreSQL is ready
   docker-compose -f docker-compose.integration.yml logs postgres
   ```

### Debug Mode

For verbose output, run tests with:
```bash
go test -v -run TestSpecificTest
```

### Manual Testing

Keep services running after tests:
```bash
./run-tests.sh
# Choose 'y' when prompted to keep services running
```

## CI/CD Integration

The test suite is designed for CI/CD integration:

```yaml
# Example GitHub Actions step
- name: Run Integration Tests
  run: |
    cd tools/testing/integration/upi-bank-integration
    ./run-tests.sh --report
    
- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: integration-test-reports
    path: tools/testing/integration/upi-bank-integration/test_report_*.txt
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Include proper cleanup in test teardown
4. Add performance benchmarks for critical paths
5. Update this documentation

## Files Structure

```
upi-bank-integration/
├── README.md                    # This documentation
├── go.mod                       # Go module definition
├── types.go                     # gRPC message type definitions
├── clients.go                   # gRPC client interfaces and mocks
├── upi_bank_integration_test.go # Main test file
├── run-tests.sh                 # Test runner script
├── generate.sh                  # Proto generation script
└── proto/                       # Protocol buffer definitions
    ├── bank_simulator.proto
    └── upi_core.proto
```

## Next Steps

1. **Load Testing**: Implement k6 scripts for high-volume testing
2. **Chaos Engineering**: Add failure injection tests
3. **Security Testing**: Add authentication and authorization tests
4. **Contract Testing**: Implement Pact framework for API contracts