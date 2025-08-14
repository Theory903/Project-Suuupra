# Bank Simulator Service - Comprehensive TODO

## 1. 🎯 Overview & Learning Objectives

The **Bank Simulator Service** is a comprehensive mock banking backend that simulates multiple Indian banks in the UPI ecosystem. It handles account management, transaction processing, VPA mapping, and realistic banking scenarios including failures, limits, and compliance checks.

### **Why this stack?**

*   **Node.js/TypeScript + Fastify**: High-performance, type-safe backend with excellent async handling for financial operations.
*   **PostgreSQL + Prisma**: ACID-compliant database with type-safe ORM for critical financial data integrity.
*   **gRPC + Protobuf**: Efficient inter-service communication with strong typing and backward compatibility.
*   **OpenTelemetry**: Comprehensive observability for financial transaction monitoring.

### **Learning Focus**:

*   **Financial System Design**: Build a realistic banking backend with proper transaction handling, audit trails, and compliance.
*   **Microservices Architecture**: Learn service-to-service communication, error handling, and distributed system patterns.
*   **Database Design**: Master financial data modeling, ACID transactions, and performance optimization.
*   **Security & Compliance**: Implement banking-grade security, audit logging, and regulatory compliance.
*   **Testing Financial Systems**: Learn to test financial workflows, edge cases, and failure scenarios.

---

## 2. 🚀 Implementation Plan (3 Weeks)

### **Week 1: Foundation & Multi-Bank Infrastructure** ✅ **Infrastructure Complete**

*   **Goal**: Set up the banking infrastructure supporting multiple banks with proper data modeling.

*   **Tasks**:
    *   [x] **Project Setup** ✅ **COMPLETED**: TypeScript/Fastify project with Docker containerization
    *   [x] **Database Schema Design** ✅ **COMPLETED**: Comprehensive Prisma schema for banks, accounts, transactions, and VPA mappings
    *   [x] **Database Connectivity** ✅ **COMPLETED**: PostgreSQL with Prisma ORM, proper connection handling and health checks
    *   [x] **Service Infrastructure** ✅ **COMPLETED**: 
        - HTTP server (Fastify) on port 3000 with REST API endpoints
        - gRPC server on port 50050 with banking operations
        - Metrics server on port 9094 for monitoring
        - Health checks and graceful shutdown
    *   [x] **Docker & Deployment** ✅ **COMPLETED**: 
        - Multi-stage Docker builds with Alpine Linux
        - OpenSSL compatibility for Prisma 
        - Proto file integration for gRPC services
        - Port conflict resolution and container orchestration
    *   [x] **Multi-Bank Support** ✅ **FOUNDATION**: Database schema supports multiple banks (HDFC, SBI, ICICI, Axis, Kotak)
    *   [ ] **Account Management**: Build account creation, KYC simulation, and balance management
    *   [ ] **VPA Mapping System**: Implement UPI VPA to bank account mapping with validation

### **Week 2: Transaction Engine & Business Logic**

*   **Goal**: Implement the core transaction processing engine with realistic banking scenarios.

*   **Tasks**:
    *   [ ] **Transaction Processing Engine**: Build atomic debit/credit operations with proper locking
    *   [ ] **Business Rules Engine**: Implement daily limits, minimum balance, KYC checks, and fraud detection
    *   [ ] **Failure Simulation**: Add realistic failure scenarios (insufficient funds, technical failures, timeouts)
    *   [ ] **Audit Trail System**: Implement comprehensive logging for all financial operations
    *   [ ] **Reconciliation Support**: Build transaction reconciliation and settlement reporting

### **Week 3: gRPC API, Testing & Production Readiness**

*   **Goal**: Complete the service with robust APIs, comprehensive testing, and production deployment.

*   **Tasks**:
    *   [ ] **gRPC Service Implementation**: Build complete gRPC API with proper error handling
    *   [ ] **REST Admin API**: Create admin endpoints for bank management and monitoring
    *   [ ] **Comprehensive Testing**: Unit tests, integration tests, and load testing with realistic scenarios
    *   [ ] **Observability**: Implement metrics, tracing, and health checks
    *   [ ] **Docker & Kubernetes**: Containerize and prepare for orchestrated deployment
    *   [ ] **Documentation**: Complete API docs, runbooks, and troubleshooting guides

---

## 3. 🔌 Enhanced API Design (gRPC)

```protobuf
syntax = "proto3";

package bank_simulator;

import "google/protobuf/timestamp.proto";

service BankSimulator {
  // Core transaction processing
  rpc ProcessTransaction(TransactionRequest) returns (TransactionResponse);
  rpc GetTransactionStatus(TransactionStatusRequest) returns (TransactionStatusResponse);
  
  // Account management
  rpc CreateAccount(CreateAccountRequest) returns (CreateAccountResponse);
  rpc GetAccountBalance(AccountBalanceRequest) returns (AccountBalanceResponse);
  rpc GetAccountDetails(AccountDetailsRequest) returns (AccountDetailsResponse);
  
  // VPA management
  rpc LinkVPA(LinkVPARequest) returns (LinkVPAResponse);
  rpc UnlinkVPA(UnlinkVPARequest) returns (UnlinkVPAResponse);
  rpc ResolveVPA(ResolveVPARequest) returns (ResolveVPAResponse);
  
  // Bank operations
  rpc GetBankInfo(BankInfoRequest) returns (BankInfoResponse);
  rpc CheckBankHealth(BankHealthRequest) returns (BankHealthResponse);
}

// Transaction messages
message TransactionRequest {
  string transaction_id = 1;
  string bank_code = 2;
  string account_number = 3;
  int64 amount_paisa = 4; // Amount in paisa to avoid floating point issues
  TransactionType type = 5;
  string reference = 6;
  string description = 7;
  map<string, string> metadata = 8;
}

message TransactionResponse {
  string transaction_id = 1;
  TransactionStatus status = 2;
  string bank_reference_id = 3;
  string error_code = 4;
  string error_message = 5;
  int64 account_balance_paisa = 6;
  google.protobuf.Timestamp processed_at = 7;
}

// Account messages
message CreateAccountRequest {
  string bank_code = 1;
  string customer_id = 2;
  string account_type = 3; // SAVINGS, CURRENT
  string mobile_number = 4;
  string email = 5;
  CustomerKYC kyc_details = 6;
}

message CreateAccountResponse {
  string account_number = 1;
  string ifsc_code = 2;
  AccountStatus status = 3;
  string error_message = 4;
}

message AccountBalanceRequest {
  string bank_code = 1;
  string account_number = 2;
}

message AccountBalanceResponse {
  string account_number = 1;
  int64 available_balance_paisa = 2;
  int64 ledger_balance_paisa = 3;
  google.protobuf.Timestamp last_updated = 4;
}

// VPA messages
message LinkVPARequest {
  string vpa = 1;
  string bank_code = 2;
  string account_number = 3;
  bool is_primary = 4;
}

message LinkVPAResponse {
  bool success = 1;
  string error_message = 2;
}

message ResolveVPARequest {
  string vpa = 1;
}

message ResolveVPAResponse {
  bool exists = 1;
  string bank_code = 2;
  string account_number = 3;
  string account_holder_name = 4;
  bool is_active = 5;
}

// Supporting types
enum TransactionType {
  TRANSACTION_TYPE_UNSPECIFIED = 0;
  TRANSACTION_TYPE_DEBIT = 1;
  TRANSACTION_TYPE_CREDIT = 2;
}

enum TransactionStatus {
  TRANSACTION_STATUS_UNSPECIFIED = 0;
  TRANSACTION_STATUS_PENDING = 1;
  TRANSACTION_STATUS_SUCCESS = 2;
  TRANSACTION_STATUS_FAILED = 3;
  TRANSACTION_STATUS_TIMEOUT = 4;
}

enum AccountStatus {
  ACCOUNT_STATUS_UNSPECIFIED = 0;
  ACCOUNT_STATUS_ACTIVE = 1;
  ACCOUNT_STATUS_INACTIVE = 2;
  ACCOUNT_STATUS_FROZEN = 3;
  ACCOUNT_STATUS_CLOSED = 4;
}

message CustomerKYC {
  string pan = 1;
  string aadhaar_masked = 2;
  string full_name = 3;
  string date_of_birth = 4;
  string address = 5;
}
```

---

## 4. 🗄️ Database Schema Design

```sql
-- Banks table
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_code VARCHAR(10) UNIQUE NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    ifsc_prefix VARCHAR(4) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    daily_limit_paisa BIGINT DEFAULT 10000000, -- 1 lakh default
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    bank_id UUID REFERENCES banks(id),
    ifsc_code VARCHAR(11) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    account_holder_name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15),
    email VARCHAR(100),
    balance_paisa BIGINT DEFAULT 0,
    available_balance_paisa BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    kyc_status VARCHAR(20) DEFAULT 'PENDING',
    daily_limit_paisa BIGINT DEFAULT 2500000, -- 25k default
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT positive_balance CHECK (balance_paisa >= 0),
    CONSTRAINT positive_available_balance CHECK (available_balance_paisa >= 0)
);

-- VPA mappings
CREATE TABLE vpa_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vpa VARCHAR(100) UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts(id),
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    bank_reference_id VARCHAR(50) UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts(id),
    type VARCHAR(20) NOT NULL,
    amount_paisa BIGINT NOT NULL,
    balance_before_paisa BIGINT NOT NULL,
    balance_after_paisa BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    reference VARCHAR(100),
    description TEXT,
    metadata JSONB,
    error_code VARCHAR(20),
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT positive_amount CHECK (amount_paisa > 0)
);

-- Daily transaction limits tracking
CREATE TABLE daily_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    limit_date DATE NOT NULL,
    total_debited_paisa BIGINT DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(account_id, limit_date)
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_accounts_bank_id ON accounts(bank_id);
CREATE INDEX idx_accounts_customer_id ON accounts(customer_id);
CREATE INDEX idx_accounts_mobile ON accounts(mobile_number);
CREATE INDEX idx_vpa_mappings_account_id ON vpa_mappings(account_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_daily_limits_account_date ON daily_limits(account_id, limit_date);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

---

## 5. 🏦 Multi-Bank Configuration

```typescript
// Bank configuration
export const SUPPORTED_BANKS = {
  HDFC: {
    code: 'HDFC',
    name: 'HDFC Bank',
    ifscPrefix: 'HDFC',
    dailyLimitPaisa: 10000000, // 1 lakh
    minBalancePaisa: 1000000,  // 10k
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS']
  },
  SBI: {
    code: 'SBI',
    name: 'State Bank of India',
    ifscPrefix: 'SBIN',
    dailyLimitPaisa: 10000000,
    minBalancePaisa: 300000,   // 3k
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS']
  },
  ICICI: {
    code: 'ICICI',
    name: 'ICICI Bank',
    ifscPrefix: 'ICIC',
    dailyLimitPaisa: 20000000, // 2 lakh
    minBalancePaisa: 1000000,
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS']
  },
  AXIS: {
    code: 'AXIS',
    name: 'Axis Bank',
    ifscPrefix: 'UTIB',
    dailyLimitPaisa: 10000000,
    minBalancePaisa: 1000000,
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS']
  },
  KOTAK: {
    code: 'KOTAK',
    name: 'Kotak Mahindra Bank',
    ifscPrefix: 'KKBK',
    dailyLimitPaisa: 10000000,
    minBalancePaisa: 1000000,
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS']
  }
};
```

---

## 6. 🧪 Testing Strategy

### **Unit Tests**
- Account creation and validation
- Transaction processing logic
- Balance calculations and limits
- VPA mapping and resolution
- Business rule validations

### **Integration Tests**
- gRPC service endpoints
- Database transaction integrity
- Multi-bank scenario testing
- Failure and recovery testing
- Concurrent transaction handling

### **Load Tests**
- High-volume transaction processing
- Concurrent user scenarios
- Database performance under load
- Memory and CPU usage profiling
- Network latency simulation

### **Scenario Tests**
- Insufficient funds handling
- Daily limit breaches
- Invalid VPA resolution
- Bank downtime simulation
- Network partition recovery

---

## 7. 📊 Monitoring & Observability

### **Metrics**
- Transaction success/failure rates
- Response latency percentiles
- Database connection pool usage
- Account balance consistency checks
- Daily transaction volumes per bank

### **Alerts**
- High transaction failure rate (>1%)
- Database connection issues
- Unusual transaction patterns
- Account balance inconsistencies
- Service health degradation

### **Dashboards**
- Real-time transaction monitoring
- Bank-wise performance metrics
- Account and VPA statistics
- Error rate and latency trends
- System resource utilization
