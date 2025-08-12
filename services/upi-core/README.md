# Beyond‑UPI Core (UPI Switch)

## Overview

The Core service is the UPI‑compatible switch for Beyond‑UPI. It performs cryptographic verification, VPA resolution, intelligent bank routing, settlement accounting, and emits authoritative transaction events. It must meet strict SLOs and provide deterministic behavior for refunds, reversals, and reconciliation.

## 🎯 Purpose

This service serves as the backbone of the UPI network, providing:
- **Transaction Routing**: Intelligent routing of payments between different banks
- **Security Layer**: Digital signature verification and encryption
- **State Management**: Comprehensive transaction lifecycle management
- **Settlement Processing**: Real-time and batch settlement between banks
- **VPA Resolution**: Virtual Payment Address to bank account mapping
- **Audit Trail**: Complete transaction history and reconciliation

## Tech Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Language** | Go | 1.21+ | High-performance backend processing |
| **Framework** | gRPC | 1.58+ | Inter-service communication |
| **Database** | PostgreSQL | 15+ | ACID-compliant transaction storage |
| **Cache** | Redis | 7.0+ | High-speed routing and state cache |
| **Message Queue** | Apache Kafka | 3.5+ | Event streaming and notifications |
| **Cryptography** | Go Crypto | Latest | Digital signatures and encryption |
| **Monitoring** | OpenTelemetry | Latest | Distributed tracing and metrics |
| **Service Discovery** | Consul/etcd | Latest | Dynamic service registration |

## Architecture

The service follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                     gRPC API Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │Transaction  │ │    VPA      │ │       Settlement            │ │
│  │  Handler    │ │   Handler   │ │       Handler               │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   Application Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │  Use Cases  │ │ Orchestrator│ │      Event Publisher        │ │
│  │(Business    │ │  Services   │ │                            │ │
│  │  Logic)     │ │             │ │                            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Domain Layer                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │  Entities   │ │  Services   │ │      Repositories           │ │
│  │(Core Models)│ │(Domain      │ │     (Interfaces)            │ │
│  │             │ │ Logic)      │ │                            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │ PostgreSQL  │ │   Redis     │ │        Kafka                │ │
│  │  Database   │ │   Cache     │ │      Messaging              │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Go 1.21+
- PostgreSQL 15+
- Redis 7.0+
- Apache Kafka 3.5+
- Protocol Buffers compiler

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/upi-core
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Generate protobuf code**
   ```bash
   make proto-gen
   ```

4. **Setup database**
   ```bash
   make db-migrate
   make db-seed
   ```

5. **Run the service**
   ```bash
   # Development
   make run-dev
   
   # Production
   make run-prod
   ```

### Environment Setup

Create a `.env` file with the following configuration:

```env
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=50051
SERVER_READ_TIMEOUT=30s
SERVER_WRITE_TIMEOUT=30s

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=upi_core
DB_SSL_MODE=disable
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_POOL_SIZE=10

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=upi-core
KAFKA_TOPIC_TRANSACTIONS=upi.transactions
KAFKA_TOPIC_SETTLEMENTS=upi.settlements

# Security Configuration
PRIVATE_KEY_PATH=./keys/private.pem
PUBLIC_KEY_PATH=./keys/public.pem
ENABLE_TLS=true
TLS_CERT_FILE=./certs/server.crt
TLS_KEY_FILE=./certs/server.key

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

## Database Schema (abridged)

### Core Tables

```sql
-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    rrn VARCHAR(12) UNIQUE,
    payer_vpa VARCHAR(100) NOT NULL,
    payee_vpa VARCHAR(100) NOT NULL,
    amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
    currency VARCHAR(3) DEFAULT 'INR',
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    description TEXT,
    fees_paisa BIGINT DEFAULT 0,
    payer_bank_code VARCHAR(10) NOT NULL,
    payee_bank_code VARCHAR(10) NOT NULL,
    metadata JSONB,
    initiated_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VPA mappings table
CREATE TABLE vpa_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vpa VARCHAR(100) UNIQUE NOT NULL,
    bank_code VARCHAR(10) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_holder_name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Banks table
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_code VARCHAR(10) UNIQUE NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    ifsc_prefix VARCHAR(4) NOT NULL,
    endpoint_url VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    last_heartbeat TIMESTAMP,
    success_rate INTEGER DEFAULT 100,
    avg_response_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement batches table
CREATE TABLE settlement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id VARCHAR(50) UNIQUE NOT NULL,
    bank_code VARCHAR(10) NOT NULL,
    total_credit_paisa BIGINT DEFAULT 0,
    total_debit_paisa BIGINT DEFAULT 0,
    net_settlement_paisa BIGINT DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    settlement_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_transactions_payer_vpa ON transactions(payer_vpa);
CREATE INDEX idx_transactions_payee_vpa ON transactions(payee_vpa);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_rrn ON transactions(rrn) WHERE rrn IS NOT NULL;
CREATE INDEX idx_vpa_mappings_bank_code ON vpa_mappings(bank_code);
CREATE INDEX idx_banks_status ON banks(status);
```

## gRPC API (core services)

### Core Services

#### Transaction Processing
```protobuf
service UpiCore {
  // Process a new transaction
  rpc ProcessTransaction(TransactionRequest) returns (TransactionResponse);
  
  // Get transaction status and history
  rpc GetTransactionStatus(TransactionStatusRequest) returns (TransactionStatusResponse);
  
  // Cancel a pending transaction
  rpc CancelTransaction(CancelTransactionRequest) returns (CancelTransactionResponse);
}
```

#### VPA Management
```protobuf
service UpiCore {
  // Resolve VPA to bank and account information
  rpc ResolveVPA(ResolveVPARequest) returns (ResolveVPAResponse);
  
  // Register a new VPA mapping
  rpc RegisterVPA(RegisterVPARequest) returns (RegisterVPAResponse);
}
```

#### Bank Operations
```protobuf
service UpiCore {
  // Register a new bank in the network
  rpc RegisterBank(RegisterBankRequest) returns (RegisterBankResponse);
  
  // Get current bank status and health metrics
  rpc GetBankStatus(BankStatusRequest) returns (BankStatusResponse);
}
```

### Sample Usage

```go
// Client example
client := pb.NewUpiCoreClient(conn)

// Process a transaction
response, err := client.ProcessTransaction(ctx, &pb.TransactionRequest{
    TransactionId: "TXN123456789",
    PayerVpa:      "user@bank1",
    PayeeVpa:      "merchant@bank2",
    AmountPaisa:   10000, // ₹100.00
    Currency:      "INR",
    Type:          pb.TransactionType_TRANSACTION_TYPE_P2M,
    Description:   "Payment for goods",
    Signature:     "digital_signature_here",
    InitiatedAt:   timestamppb.Now(),
})
```

## Security Features

### Digital Signatures
- **RSA-SHA256** signatures for all transaction requests
- **Public key infrastructure** for bank authentication
- **Message integrity** verification at all levels
- **Non-repudiation** through cryptographic proofs

### Encryption
- **TLS 1.3** for all gRPC communication
- **mTLS** (mutual TLS) for bank-to-core communication
- **AES-256-GCM** for sensitive data encryption
- **Key rotation** support for long-term security

### Access Control
- **JWT-based** authentication for admin operations
- **Role-based access control** (RBAC) for different user types
- **Rate limiting** to prevent abuse
- **Audit logging** for all sensitive operations

## Transaction Flow

### Standard P2P Transaction
1. **Request Validation**: Verify transaction format and signature
2. **VPA Resolution**: Resolve both payer and payee VPAs to bank accounts
3. **Bank Routing**: Determine routing path based on bank availability
4. **Debit Processing**: Request debit from payer's bank
5. **Credit Processing**: Request credit to payee's bank
6. **Settlement**: Update settlement records
7. **Notification**: Send transaction events to interested parties
8. **Audit**: Log complete transaction trail

### Error Handling & Recovery
- **Circuit Breaker**: Prevent cascading failures when banks are down
- **Retry Logic**: Intelligent retry with exponential backoff
- **Transaction Reversal**: Automatic reversal on partial failures
- **Timeout Management**: Configurable timeouts for each operation
- **Dead Letter Queue**: Handle permanently failed transactions

## Performance & Scalability

### Performance Metrics
- **Transaction Throughput**: 10,000+ TPS sustained
- **Response Latency**: <100ms p95 for transaction processing
- **VPA Resolution**: <10ms p95 for cached lookups
- **Database Queries**: <5ms p95 for indexed operations

### Scalability Features
- **Horizontal Scaling**: Stateless service design
- **Database Sharding**: Partition by bank code or date
- **Redis Clustering**: Distributed caching for high availability
- **Load Balancing**: gRPC load balancing with health checks
- **Connection Pooling**: Efficient database connection management

## Monitoring & Observability

### Metrics (Prometheus)
```go
// Key metrics tracked
var (
    transactionCounter = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "upi_transactions_total",
            Help: "Total number of transactions processed",
        },
        []string{"status", "type", "bank_code"},
    )
    
    transactionDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "upi_transaction_duration_seconds",
            Help: "Transaction processing duration",
        },
        []string{"type", "bank_code"},
    )
    
    bankHealthGauge = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "upi_bank_health_score",
            Help: "Bank health score (0-100)",
        },
        []string{"bank_code"},
    )
)
```

### Distributed Tracing
- **OpenTelemetry** integration for full request tracing
- **Jaeger** backend for trace visualization
- **Custom spans** for transaction lifecycle stages
- **Correlation IDs** for cross-service request tracking

### Structured Logging
```go
// Example structured logging
log.Info("Transaction processed successfully",
    "transaction_id", txn.TransactionID,
    "payer_vpa", txn.PayerVPA,
    "payee_vpa", txn.PayeeVPA,
    "amount_paisa", txn.AmountPaisa,
    "processing_time_ms", processingTime.Milliseconds(),
    "payer_bank", txn.PayerBankCode,
    "payee_bank", txn.PayeeBankCode,
)
```

## 🧪 Testing

### Unit Tests
```bash
# Run all unit tests
make test

# Run with coverage
make test-coverage

# Run specific package tests
go test ./internal/domain/services/...
```

### Integration Tests
```bash
# Run integration tests (requires running dependencies)
make test-integration

# Run with Docker Compose
make test-integration-docker
```

### Load Testing
```bash
# Run load tests with k6
make load-test

# Custom load test scenarios
k6 run --vus 100 --duration 5m scripts/load-test.js
```

### Test Coverage Targets
- **Unit Tests**: >90% coverage for domain and application layers
- **Integration Tests**: Complete API coverage with realistic scenarios
- **End-to-End Tests**: Full transaction flows across multiple banks

## 🚀 Deployment

### Docker
```dockerfile
# Multi-stage build for optimized image
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o upi-core cmd/server/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/upi-core .
EXPOSE 50051 9090
CMD ["./upi-core"]
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: upi-core
spec:
  replicas: 3
  selector:
    matchLabels:
      app: upi-core
  template:
    metadata:
      labels:
        app: upi-core
    spec:
      containers:
      - name: upi-core
        image: upi-core:latest
        ports:
        - containerPort: 50051
          name: grpc
        - containerPort: 9090
          name: metrics
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: upi-core-secrets
              key: db-host
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          grpc:
            port: 50051
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          grpc:
            port: 50051
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Helm Chart
```bash
# Install with Helm
helm install upi-core ./helm/upi-core \
  --set image.tag=latest \
  --set database.host=postgres-service \
  --set redis.host=redis-service
```

## 🔧 Configuration

### Environment Variables
```bash
# Core service configuration
export SERVER_HOST=0.0.0.0
export SERVER_PORT=50051
export LOG_LEVEL=info

# Database configuration
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=postgres
export DB_PASSWORD=your_password
export DB_DATABASE=upi_core

# Redis configuration
export REDIS_HOST=localhost
export REDIS_PORT=6379

# Security configuration
export PRIVATE_KEY_PATH=./keys/private.pem
export PUBLIC_KEY_PATH=./keys/public.pem
export ENABLE_TLS=true
```

### Configuration File
```yaml
# config.yaml
server:
  host: "0.0.0.0"
  port: 50051
  read_timeout: "30s"
  write_timeout: "30s"

database:
  host: "localhost"
  port: 5432
  username: "postgres"
  database: "upi_core"
  max_open_conns: 25
  max_idle_conns: 5

redis:
  host: "localhost"
  port: 6379
  pool_size: 10

security:
  enable_tls: true
  cert_file: "./certs/server.crt"
  key_file: "./certs/server.key"
  private_key_path: "./keys/private.pem"
  public_key_path: "./keys/public.pem"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow Go coding standards and write comprehensive tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Standards
- Follow [Effective Go](https://golang.org/doc/effective_go.html) guidelines
- Use `gofmt` and `golint` for code formatting
- Write comprehensive unit tests (>90% coverage)
- Document public APIs with clear comments
- Use structured logging with appropriate log levels

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- **Email**: support@upi-core.com
- **Documentation**: [docs.upi-core.com](https://docs.upi-core.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/upi-core/issues)

---

**Built with ⚡ using Go and gRPC**
