# Bank Simulator Service API Documentation

## Overview

The Bank Simulator is a **production-ready mock banking backend** built with TypeScript and Fastify. It provides comprehensive banking operations simulation with ACID-compliant transactions, supporting both REST APIs and gRPC services for the UPI ecosystem.

**Service Endpoints:**
- **HTTP Server**: `localhost:8080`
- **gRPC Server**: `localhost:50051`
- **Metrics**: `localhost:9090`
- **Swagger UI**: `localhost:8080/docs` (development only)

---

## Supported Banks Configuration

The service simulates **5 major Indian banks** with realistic processing characteristics:

| Bank Code | Bank Name | IFSC Prefix | Daily Limit | Processing Delay | Failure Rate | Features |
|-----------|-----------|-------------|-------------|------------------|--------------|----------|
| HDFC | HDFC Bank | HDFC | ₹1 Crore | 50ms | 0.5% | UPI, IMPS, NEFT, RTGS |
| SBI | State Bank of India | SBIN | ₹75 Lakhs | 80ms | 0.3% | UPI, IMPS, NEFT, RTGS |
| ICICI | ICICI Bank | ICIC | ₹1 Crore | 60ms | 0.4% | UPI, IMPS, NEFT, RTGS |
| AXIS | Axis Bank | UTIB | ₹50 Lakhs | 70ms | 0.7% | UPI, IMPS, NEFT, RTGS |
| KOTAK | Kotak Mahindra Bank | KKBK | ₹25 Lakhs | 65ms | 0.8% | UPI, IMPS, NEFT, RTGS |

---

## Database Schema

### Banks Table
```sql
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_code VARCHAR(10) UNIQUE NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    ifsc_prefix VARCHAR(4) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    daily_limit_paisa BIGINT DEFAULT 10000000000, -- ₹1 crore
    min_balance_paisa BIGINT DEFAULT 1000000,     -- ₹10,000
    features TEXT[] DEFAULT ARRAY['UPI', 'IMPS', 'NEFT', 'RTGS'],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Accounts Table
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    bank_id UUID REFERENCES banks(id),
    ifsc_code VARCHAR(11) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) DEFAULT 'SAVINGS',
    account_holder_name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(15),
    email VARCHAR(255),
    balance_paisa BIGINT DEFAULT 0,
    available_balance_paisa BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    kyc_status VARCHAR(20) DEFAULT 'VERIFIED',
    daily_limit_paisa BIGINT DEFAULT 2500000,     -- ₹25,000
    pan_number VARCHAR(10),
    aadhaar_masked VARCHAR(12),
    date_of_birth DATE,
    address JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### VPA Mappings Table
```sql
CREATE TABLE vpa_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vpa VARCHAR(255) UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts(id),
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    bank_reference_id VARCHAR(50) UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts(id),
    type VARCHAR(10) NOT NULL, -- DEBIT, CREDIT
    amount_paisa BIGINT NOT NULL,
    balance_before_paisa BIGINT NOT NULL,
    balance_after_paisa BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    reference VARCHAR(255),
    description VARCHAR(500),
    metadata JSONB,
    error_code VARCHAR(20),
    error_message VARCHAR(500),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Daily Limits Table
```sql
CREATE TABLE daily_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    limit_date DATE NOT NULL,
    total_debited_paisa BIGINT DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, limit_date)
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## REST API Endpoints

### Health & Status

#### Health Check
```http
GET /health
Content-Type: application/json

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 7890,
  "database": {
    "status": "connected",
    "latency_ms": 2.5
  },
  "memory": {
    "used_mb": 145.2,
    "free_mb": 1878.8,
    "total_mb": 2024.0
  }
}
```

#### Ready Check
```http
GET /ready
Content-Type: application/json

Response:
{
  "status": "ready",
  "database": true,
  "services": {
    "prisma": true,
    "redis": true
  }
}
```

#### Live Check
```http
GET /live
Content-Type: application/json

Response:
{
  "status": "alive",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Banks API

#### List All Banks
```http
GET /api/banks
Content-Type: application/json

Response:
[
  {
    "code": "HDFC",
    "name": "HDFC Bank",
    "ifscPrefix": "HDFC",
    "isActive": true,
    "dailyLimitPaisa": 10000000000,
    "minBalancePaisa": 1000000,
    "features": ["UPI", "IMPS", "NEFT", "RTGS"],
    "processingCharacteristics": {
      "avgDelayMs": 50,
      "failureRatePercent": 0.5,
      "successRatePercent": 99.5
    }
  }
  // ... other banks
]
```

#### Get Specific Bank
```http
GET /api/banks/{bankCode}
Content-Type: application/json

Response:
{
  "code": "HDFC",
  "name": "HDFC Bank",
  "ifscPrefix": "HDFC",
  "isActive": true,
  "dailyLimitPaisa": 10000000000,
  "minBalancePaisa": 1000000,
  "features": ["UPI", "IMPS", "NEFT", "RTGS"],
  "transactionFees": {
    "processingFeePaisa": 10,
    "serviceTaxPaisa": 2,
    "totalFeePaisa": 12
  },
  "limits": {
    "perTransactionMaxPaisa": 20000000,
    "dailyMaxPaisa": 10000000000,
    "monthlyMaxPaisa": 100000000000
  }
}
```

#### Get Bank Health
```http
GET /api/banks/{bankCode}/health
Content-Type: application/json

Response:
{
  "bankCode": "HDFC",
  "status": "healthy",
  "successRatePercent": 99.73,
  "avgResponseTimeMs": 47,
  "totalTransactionsToday": 15420,
  "successfulTransactionsToday": 15378,
  "failedTransactionsToday": 42,
  "lastHealthCheck": "2025-01-15T10:29:45.000Z",
  "features": ["UPI", "IMPS", "NEFT", "RTGS"],
  "operationalWindows": {
    "upi": "24x7",
    "imps": "24x7",
    "neft": "00:30-23:30",
    "rtgs": "07:00-18:00"
  }
}
```

### Real Transactions API

#### Process Transaction
```http
POST /api/real-transactions/process
Content-Type: application/json

Request:
{
  "transactionId": "TXN20250115103000001",
  "bankCode": "HDFC",
  "accountNumber": "50100123456789",
  "amountPaisa": 150000,
  "type": "DEBIT",
  "reference": "UPI/123456789012/Payment for groceries",
  "description": "UPI payment via PhonePe",
  "metadata": {
    "upiTransactionId": "UPI123456789012",
    "payerVpa": "user@paytm",
    "payeeVpa": "merchant@phonepe",
    "merchantCategory": "5411"
  }
}

Response:
{
  "success": true,
  "transactionId": "TXN20250115103000001",
  "bankReferenceId": "HDFC202501151030001",
  "status": "SUCCESS",
  "amountPaisa": 150000,
  "fees": {
    "processingFeePaisa": 10,
    "serviceTaxPaisa": 2,
    "totalFeePaisa": 12
  },
  "accountDetails": {
    "bankCode": "HDFC",
    "accountNumber": "50100123456789",
    "balanceBeforePaisa": 500000,
    "balanceAfterPaisa": 349988,
    "availableBalancePaisa": 349988
  },
  "processedAt": "2025-01-15T10:30:02.145Z",
  "processingTimeMs": 52
}
```

#### Get Account Balance
```http
GET /api/real-accounts/{bankCode}/{accountNumber}/balance
Content-Type: application/json

Response:
{
  "success": true,
  "bankCode": "HDFC",
  "accountNumber": "50100123456789",
  "accountHolderName": "RAJESH KUMAR",
  "balancePaisa": 349988,
  "availableBalancePaisa": 349988,
  "accountType": "SAVINGS",
  "status": "ACTIVE",
  "kycStatus": "VERIFIED",
  "lastTransactionAt": "2025-01-15T10:30:02.145Z",
  "dailyLimits": {
    "remainingLimitPaisa": 2349988,
    "usedLimitPaisa": 150012,
    "totalLimitPaisa": 2500000
  }
}
```

### Admin API

#### System Status
```http
GET /api/admin/status
Content-Type: application/json

Response:
{
  "service": "bank-simulator",
  "version": "1.0.0",
  "environment": "development",
  "uptime": "2h 15m 30s",
  "memory": {
    "usedMB": 145.2,
    "freeMB": 1878.8,
    "totalMB": 2024.0
  },
  "database": {
    "status": "connected",
    "connectionPoolSize": 10,
    "activeConnections": 3
  },
  "healthChecks": {
    "database": "UP",
    "redis": "UP",
    "grpc": "UP"
  },
  "metrics": {
    "totalTransactionsProcessed": 15420,
    "successfulTransactions": 15378,
    "failedTransactions": 42,
    "avgProcessingTimeMs": 55.3
  }
}
```

---

## gRPC Service Interface

### Core Service Definition
```protobuf
service BankSimulator {
  // Transaction processing
  rpc ProcessTransaction(TransactionRequest) returns (TransactionResponse);
  rpc GetTransactionStatus(TransactionStatusRequest) returns (TransactionStatusResponse);
  
  // Account management
  rpc CreateAccount(CreateAccountRequest) returns (CreateAccountResponse);
  rpc GetAccountBalance(AccountBalanceRequest) returns (AccountBalanceResponse);
  rpc GetAccountDetails(AccountDetailsRequest) returns (AccountDetailsResponse);
  rpc UpdateAccountStatus(UpdateAccountStatusRequest) returns (UpdateAccountStatusResponse);
  
  // VPA management
  rpc LinkVPA(LinkVPARequest) returns (LinkVPAResponse);
  rpc UnlinkVPA(UnlinkVPARequest) returns (UnlinkVPAResponse);
  rpc ResolveVPA(ResolveVPARequest) returns (ResolveVPAResponse);
  rpc ListAccountVPAs(ListAccountVPAsRequest) returns (ListAccountVPAsResponse);
  
  // Bank operations
  rpc GetBankInfo(BankInfoRequest) returns (BankInfoResponse);
  rpc CheckBankHealth(BankHealthRequest) returns (BankHealthResponse);
  rpc GetBankLimits(BankLimitsRequest) returns (BankLimitsResponse);
  
  // Admin operations
  rpc GetBankStats(BankStatsRequest) returns (BankStatsResponse);
  rpc GetTransactionHistory(TransactionHistoryRequest) returns (TransactionHistoryResponse);
}
```

### Transaction Processing

#### ProcessTransaction
```protobuf
message TransactionRequest {
  string transaction_id = 1;
  string bank_code = 2;
  string account_number = 3;
  int64 amount_paisa = 4;
  TransactionType type = 5;
  string reference = 6;
  string description = 7;
  map<string, string> metadata = 8;
  google.protobuf.Timestamp initiated_at = 9;
}

message TransactionResponse {
  bool success = 1;
  string transaction_id = 2;
  string bank_reference_id = 3;
  TransactionStatus status = 4;
  string error_code = 5;
  string error_message = 6;
  int64 account_balance_paisa = 7;
  int64 available_balance_paisa = 8;
  TransactionFees fees = 9;
  google.protobuf.Timestamp processed_at = 10;
  int32 processing_time_ms = 11;
}

message TransactionFees {
  int64 processing_fee_paisa = 1;
  int64 service_tax_paisa = 2;
  int64 total_fee_paisa = 3;
}
```

### Account Management

#### CreateAccount
```protobuf
message CreateAccountRequest {
  string bank_code = 1;
  string customer_id = 2;
  AccountType account_type = 3;
  string account_holder_name = 4;
  string mobile_number = 5;
  string email = 6;
  CustomerKYC kyc_details = 7;
  int64 initial_deposit_paisa = 8;
}

message CreateAccountResponse {
  bool success = 1;
  string account_id = 2;
  string account_number = 3;
  string ifsc_code = 4;
  string error_code = 5;
  string error_message = 6;
  google.protobuf.Timestamp created_at = 7;
}

message CustomerKYC {
  string pan_number = 1;
  string aadhaar_masked = 2;
  google.protobuf.Timestamp date_of_birth = 3;
  Address address = 4;
  KYCStatus status = 5;
}

message Address {
  string line1 = 1;
  string line2 = 2;
  string city = 3;
  string state = 4;
  string pincode = 5;
  string country = 6;
}
```

#### GetAccountBalance
```protobuf
message AccountBalanceRequest {
  string bank_code = 1;
  string account_number = 2;
}

message AccountBalanceResponse {
  bool success = 1;
  string account_number = 2;
  string account_holder_name = 3;
  int64 balance_paisa = 4;
  int64 available_balance_paisa = 5;
  AccountType account_type = 6;
  AccountStatus status = 7;
  DailyLimitStatus daily_limits = 8;
  string error_code = 9;
  string error_message = 10;
}

message DailyLimitStatus {
  int64 total_limit_paisa = 1;
  int64 used_limit_paisa = 2;
  int64 remaining_limit_paisa = 3;
  int32 transaction_count = 4;
  int32 max_transactions = 5;
}
```

### VPA Management

#### ResolveVPA
```protobuf
message ResolveVPARequest {
  string vpa = 1;
}

message ResolveVPAResponse {
  bool exists = 1;
  string bank_code = 2;
  string account_number = 3;
  string account_holder_name = 4;
  bool is_active = 5;
  bool is_primary = 6;
  string error_code = 7;
  string error_message = 8;
}
```

#### LinkVPA
```protobuf
message LinkVPARequest {
  string vpa = 1;
  string bank_code = 2;
  string account_number = 3;
  bool is_primary = 4;
}

message LinkVPAResponse {
  bool success = 1;
  string vpa_id = 2;
  string error_code = 3;
  string error_message = 4;
  google.protobuf.Timestamp linked_at = 5;
}
```

---

## Enums & Status Codes

### Transaction Types
```protobuf
enum TransactionType {
  TRANSACTION_TYPE_UNSPECIFIED = 0;
  TRANSACTION_TYPE_DEBIT = 1;
  TRANSACTION_TYPE_CREDIT = 2;
}
```

### Transaction Status
```protobuf
enum TransactionStatus {
  TRANSACTION_STATUS_UNSPECIFIED = 0;
  TRANSACTION_STATUS_PENDING = 1;
  TRANSACTION_STATUS_SUCCESS = 2;
  TRANSACTION_STATUS_FAILED = 3;
  TRANSACTION_STATUS_TIMEOUT = 4;
  TRANSACTION_STATUS_INSUFFICIENT_FUNDS = 5;
  TRANSACTION_STATUS_LIMIT_EXCEEDED = 6;
  TRANSACTION_STATUS_ACCOUNT_FROZEN = 7;
  TRANSACTION_STATUS_INVALID_ACCOUNT = 8;
}
```

### Account Status
```protobuf
enum AccountStatus {
  ACCOUNT_STATUS_UNSPECIFIED = 0;
  ACCOUNT_STATUS_ACTIVE = 1;
  ACCOUNT_STATUS_INACTIVE = 2;
  ACCOUNT_STATUS_FROZEN = 3;
  ACCOUNT_STATUS_CLOSED = 4;
  ACCOUNT_STATUS_KYC_PENDING = 5;
}
```

### KYC Status
```protobuf
enum KYCStatus {
  KYC_STATUS_UNSPECIFIED = 0;
  KYC_STATUS_PENDING = 1;
  KYC_STATUS_VERIFIED = 2;
  KYC_STATUS_REJECTED = 3;
  KYC_STATUS_EXPIRED = 4;
}
```

---

## Error Codes & Messages

### Account Errors
- **ACC_001**: Account not found
- **ACC_002**: Account inactive or suspended
- **ACC_003**: Account frozen by bank
- **ACC_004**: Invalid account number format
- **ACC_005**: KYC verification pending

### Transaction Errors
- **TXN_001**: Insufficient account balance
- **TXN_002**: Daily transaction limit exceeded
- **TXN_003**: Transaction amount exceeds per-transaction limit
- **TXN_004**: Duplicate transaction ID
- **TXN_005**: Invalid transaction type
- **TXN_006**: Transaction processing timeout
- **TXN_007**: Invalid amount (negative or zero)

### VPA Errors
- **VPA_001**: VPA not found or inactive
- **VPA_002**: VPA already linked to another account
- **VPA_003**: Invalid VPA format
- **VPA_004**: Maximum VPA limit reached for account

### Bank Errors
- **BNK_001**: Bank code not supported
- **BNK_002**: Bank temporarily unavailable
- **BNK_003**: Bank maintenance mode
- **BNK_004**: Bank service limit exceeded

### System Errors
- **SYS_001**: Internal server error
- **SYS_002**: Database connection failed
- **SYS_003**: Invalid request format
- **SYS_004**: Rate limit exceeded
- **SYS_005**: Service temporarily unavailable

---

## Security Features

### Data Protection
- **Field Encryption**: PAN, Aadhaar, and sensitive data encrypted at rest
- **PII Masking**: Account numbers masked in logs and responses
- **Audit Trail**: Complete transaction and account operation logging
- **Access Control**: Role-based API access with JWT tokens

### Transaction Security
- **Idempotency**: Duplicate transaction prevention
- **Balance Validation**: Real-time balance checks
- **Limit Enforcement**: Daily, monthly, and per-transaction limits
- **Fraud Detection**: Basic velocity and pattern checks

### Compliance
- **Banking Standards**: RBI guidelines compliance
- **Data Residency**: All data stored within India
- **Audit Logging**: Immutable transaction logs
- **Privacy**: GDPR-compliant data handling

---

## Performance Characteristics

### Processing Times (by Bank)
- **HDFC**: 45-55ms average processing time
- **SBI**: 75-85ms average processing time
- **ICICI**: 55-65ms average processing time
- **AXIS**: 65-75ms average processing time
- **KOTAK**: 60-70ms average processing time

### Success Rates (Simulated)
- **HDFC**: 99.5% success rate
- **SBI**: 99.7% success rate
- **ICICI**: 99.6% success rate
- **AXIS**: 99.3% success rate
- **KOTAK**: 99.2% success rate

### Throughput
- **Peak TPS**: 1,000 transactions per second
- **Average TPS**: 500 transactions per second
- **Database Pool**: 10 connections with auto-scaling

---

## Integration Examples

### Node.js REST Client
```javascript
const axios = require('axios');

// Process a transaction
const response = await axios.post('http://localhost:8080/api/real-transactions/process', {
  transactionId: 'TXN20250115103000001',
  bankCode: 'HDFC',
  accountNumber: '50100123456789',
  amountPaisa: 150000,
  type: 'DEBIT',
  reference: 'UPI payment',
  description: 'Payment for groceries'
});

console.log('Transaction result:', response.data);
```

### gRPC Client (Node.js)
```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync('bank_simulator.proto');
const bankSimulator = grpc.loadPackageDefinition(packageDefinition).BankSimulator;

const client = new bankSimulator('localhost:50051', grpc.credentials.createInsecure());

client.ProcessTransaction({
  transactionId: 'TXN20250115103000001',
  bankCode: 'HDFC',
  accountNumber: '50100123456789',
  amountPaisa: 150000,
  type: 'TRANSACTION_TYPE_DEBIT'
}, (error, response) => {
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Response:', response);
  }
});
```

---

## Monitoring & Observability

### Metrics Endpoints
- **Prometheus**: `http://localhost:9090/metrics`
- **Health Check**: `http://localhost:8080/health`
- **Readiness**: `http://localhost:8080/ready`

### Key Metrics
- Transaction processing rates by bank and status
- Account balance operations latency
- VPA resolution success rates
- Database connection pool utilization
- Error rates by error code

### Logging
- Structured JSON logs with correlation IDs
- Transaction audit logs with complete details
- Performance logs for slow operations
- Error logs with stack traces and context

---

## Development & Testing

### Local Setup
```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev

# Seed test data
npm run seed

# Start development server
npm run dev
```

### Test Data
The service includes comprehensive test data:
- 5 pre-configured banks (HDFC, SBI, ICICI, AXIS, KOTAK)
- 50+ test accounts with varying balances
- 100+ VPA mappings for testing
- Sample transaction history

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d bank-simulator

# Check service health
curl http://localhost:8080/health
```

---

*For additional support or integration questions, contact the Bank Simulator service team.*