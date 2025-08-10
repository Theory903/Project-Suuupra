# Bank Simulator Service

## 🏦 Overview

The **Bank Simulator Service** is a mock banking backend that simulates real bank behavior in the UPI ecosystem. It handles account management, balance tracking, and transaction processing for testing and development purposes.

## 🎯 Purpose

This service simulates multiple banks (HDFC, SBI, ICICI, etc.) and provides:
- Account creation and management
- Balance tracking and updates
- Transaction processing (debit/credit)
- UPI VPA to account mapping
- Realistic transaction responses and failures

## 🛠 Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Fastify (high-performance HTTP server)
- **Database**: PostgreSQL 15+ (ACID transactions)
- **ORM**: Prisma (type-safe database access)
- **Communication**: gRPC for internal services, REST for admin
- **Validation**: Zod schemas
- **Testing**: Jest with Testcontainers
- **Monitoring**: OpenTelemetry + Prometheus

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UPI Core      │───▶│  Bank Simulator  │───▶│   PostgreSQL    │
│   Service       │    │    Service       │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Admin Panel    │
                       │  (REST API)      │
                       └──────────────────┘
```

## 📊 Database Schema

### Core Tables
- `banks` - Bank information (IFSC, name, etc.)
- `accounts` - User bank accounts with balances
- `transactions` - All debit/credit operations
- `vpa_mappings` - UPI VPA to account mappings

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose

### Development Setup

```bash
# Install dependencies
npm install

# Setup database
docker-compose up -d postgres
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

### Using Docker

```bash
# Build and run all services
docker-compose up --build

# Run with specific bank configurations
docker-compose -f docker-compose.yml -f docker-compose.banks.yml up
```

## 🔌 API Endpoints

### gRPC Services (Internal)

```protobuf
service BankSimulator {
  rpc ProcessTransaction(TransactionRequest) returns (TransactionResponse);
  rpc GetAccountBalance(AccountBalanceRequest) returns (AccountBalanceResponse);
  rpc CreateAccount(CreateAccountRequest) returns (CreateAccountResponse);
  rpc LinkVPA(LinkVPARequest) returns (LinkVPAResponse);
}
```

### REST API (Admin)

```
GET    /api/banks                 # List all banks
POST   /api/banks                 # Create new bank
GET    /api/accounts              # List accounts
POST   /api/accounts              # Create account
GET    /api/accounts/:id/balance  # Get account balance
POST   /api/transactions          # Process transaction
GET    /api/transactions          # List transactions
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Load testing
npm run test:load

# Test specific bank scenarios
npm run test:scenarios
```

## 📈 Monitoring

- **Health Check**: `GET /health`
- **Metrics**: `GET /metrics` (Prometheus format)
- **Traces**: OpenTelemetry → Jaeger

### Key Metrics
- Transaction success rate
- Response latency (p50, p95, p99)
- Database connection pool usage
- Account balance consistency

## 🔧 Configuration

Environment variables:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bank_simulator
DATABASE_POOL_SIZE=20

# gRPC
GRPC_PORT=50051
GRPC_REFLECTION=true

# HTTP
HTTP_PORT=3000
HTTP_HOST=0.0.0.0

# Banks
SUPPORTED_BANKS=HDFC,SBI,ICICI,AXIS,KOTAK
DEFAULT_BANK_BALANCE=100000

# Simulation
FAILURE_RATE=0.01
LATENCY_SIMULATION=true
NETWORK_DELAY_MS=100
```

## 🏦 Supported Banks

The simulator supports major Indian banks:

- **HDFC Bank** (HDFC0000001)
- **State Bank of India** (SBIN0000001)
- **ICICI Bank** (ICIC0000001)
- **Axis Bank** (UTIB0000001)
- **Kotak Mahindra Bank** (KKBK0000001)

## 🔄 Transaction Flow

1. **Receive Transaction Request** (via gRPC)
2. **Validate Account & Balance**
3. **Apply Business Rules** (limits, KYC)
4. **Process Transaction** (atomic DB update)
5. **Send Response** (success/failure with details)
6. **Log & Audit** (for reconciliation)

## 🛡 Security Features

- Input validation and sanitization
- Rate limiting per account
- Transaction amount limits
- Audit logging for all operations
- Encrypted sensitive data storage

## 📋 Deployment

### Kubernetes

```yaml
# Deploy using Helm
helm install bank-simulator ./helm/bank-simulator \
  --set image.tag=latest \
  --set database.host=postgres-service
```

### Docker Swarm

```bash
# Deploy stack
docker stack deploy -c docker-compose.prod.yml bank-simulator
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check database connectivity
   npm run db:ping
   ```

2. **Transaction Failures**
   ```bash
   # Check account balances
   npm run check:balances
   ```

3. **Performance Issues**
   ```bash
   # Monitor database queries
   npm run db:slow-queries
   ```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
