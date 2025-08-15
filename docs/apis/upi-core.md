# UPI Core Service API Documentation

## Overview

The UPI Core service is a **production-ready Go-based UPI switch** that handles transaction routing, VPA management, bank operations, and settlement processing. It provides both gRPC and REST APIs for high-performance inter-service communication and external integrations.

**Service Endpoints:**
- **gRPC Server**: `localhost:50051`
- **HTTP Server**: `localhost:8081`
- **Metrics**: `localhost:9090`

---

## gRPC Service Interface

### Transaction Processing APIs

#### ProcessTransaction
Process a new UPI transaction (P2P, P2M, M2P, Refund).

```protobuf
rpc ProcessTransaction(TransactionRequest) returns (TransactionResponse);

message TransactionRequest {
  string transaction_id = 1;           // Unique transaction identifier
  string payer_vpa = 2;               // Payer's Virtual Payment Address
  string payee_vpa = 3;               // Payee's Virtual Payment Address
  int64 amount_paisa = 4;             // Amount in paisa (1 rupee = 100 paisa)
  TransactionType type = 5;           // P2P, P2M, M2P, REFUND
  string reference = 6;               // Transaction reference/description
  string payer_bank_code = 7;         // Payer's bank code
  string payee_bank_code = 8;         // Payee's bank code
  string digital_signature = 9;       // Transaction signature
  google.protobuf.Timestamp initiated_at = 10;
}

message TransactionResponse {
  string transaction_id = 1;
  string rrn = 2;                     // Retrieval Reference Number
  TransactionStatus status = 3;
  string payer_bank_code = 4;
  string payee_bank_code = 5;
  TransactionFees fees = 6;
  string settlement_id = 7;
  string error_code = 8;
  string error_message = 9;
  google.protobuf.Timestamp processed_at = 10;
}
```

#### GetTransactionStatus
Query the status and history of a transaction.

```protobuf
rpc GetTransactionStatus(TransactionStatusRequest) returns (TransactionStatusResponse);

message TransactionStatusRequest {
  string transaction_id = 1;          // Transaction ID or RRN
  string bank_code = 2;               // Requesting bank code
}

message TransactionStatusResponse {
  string transaction_id = 1;
  string rrn = 2;
  TransactionStatus status = 3;
  repeated TransactionEvent events = 4; // Transaction timeline
  int64 amount_paisa = 5;
  string payer_vpa = 6;
  string payee_vpa = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
}
```

#### CancelTransaction
Cancel a pending transaction.

```protobuf
rpc CancelTransaction(CancelTransactionRequest) returns (CancelTransactionResponse);

message CancelTransactionRequest {
  string transaction_id = 1;
  string bank_code = 2;
  string reason = 3;
  string digital_signature = 4;
}

message CancelTransactionResponse {
  bool success = 1;
  string error_code = 2;
  string error_message = 3;
  google.protobuf.Timestamp cancelled_at = 4;
}
```

#### ReverseTransaction
Reverse a completed transaction.

```protobuf
rpc ReverseTransaction(ReverseTransactionRequest) returns (ReverseTransactionResponse);

message ReverseTransactionRequest {
  string original_transaction_id = 1;
  string reversal_transaction_id = 2;
  string bank_code = 3;
  string reason = 4;
  string digital_signature = 5;
}

message ReverseTransactionResponse {
  bool success = 1;
  string reversal_rrn = 2;
  string error_code = 3;
  string error_message = 4;
  google.protobuf.Timestamp reversed_at = 5;
}
```

### VPA Management APIs

#### ResolveVPA
Resolve VPA to bank account information.

```protobuf
rpc ResolveVPA(ResolveVPARequest) returns (ResolveVPAResponse);

message ResolveVPARequest {
  string vpa = 1;                     // Virtual Payment Address
  string requesting_bank_code = 2;
}

message ResolveVPAResponse {
  bool exists = 1;
  string bank_code = 2;
  string account_number = 3;          // Masked account number
  string account_holder_name = 4;
  bool is_active = 5;
  string error_code = 6;
  string error_message = 7;
}
```

#### RegisterVPA
Register a new VPA mapping.

```protobuf
rpc RegisterVPA(RegisterVPARequest) returns (RegisterVPAResponse);

message RegisterVPARequest {
  string vpa = 1;
  string bank_code = 2;
  string account_number = 3;
  string account_holder_name = 4;
  string mobile_number = 5;
  string digital_signature = 6;
}

message RegisterVPAResponse {
  bool success = 1;
  string vpa_id = 2;
  string error_code = 3;
  string error_message = 4;
  google.protobuf.Timestamp registered_at = 5;
}
```

#### UpdateVPA & DeactivateVPA
Update or deactivate existing VPA mappings.

```protobuf
rpc UpdateVPA(UpdateVPARequest) returns (UpdateVPAResponse);
rpc DeactivateVPA(DeactivateVPARequest) returns (DeactivateVPAResponse);
```

### Bank Operations APIs

#### RegisterBank
Register a new bank in the UPI network.

```protobuf
rpc RegisterBank(RegisterBankRequest) returns (RegisterBankResponse);

message RegisterBankRequest {
  string bank_code = 1;               // Unique bank identifier
  string bank_name = 2;
  string ifsc_prefix = 3;
  string endpoint_url = 4;            // Bank's API endpoint
  string public_key = 5;              // Bank's public key for signature verification
  repeated string supported_features = 6; // UPI, IMPS, NEFT, RTGS
  BankConfiguration config = 7;
}

message RegisterBankResponse {
  string bank_id = 1;
  bool success = 2;
  string error_code = 3;
  string error_message = 4;
  google.protobuf.Timestamp registered_at = 5;
}
```

#### GetBankStatus & ListBanks
Monitor bank health and list all registered banks.

```protobuf
rpc GetBankStatus(BankStatusRequest) returns (BankStatusResponse);
rpc ListBanks(ListBanksRequest) returns (ListBanksResponse);

message BankStatusResponse {
  string bank_code = 1;
  BankStatus status = 2;              // ACTIVE, INACTIVE, MAINTENANCE, SUSPENDED
  double success_rate_percent = 3;
  int64 avg_response_time_ms = 4;
  int64 total_transactions_today = 5;
  int64 failed_transactions_today = 6;
  google.protobuf.Timestamp last_health_check = 7;
}
```

### Settlement APIs

#### InitiateSettlement
Start settlement process for a batch of transactions.

```protobuf
rpc InitiateSettlement(InitiateSettlementRequest) returns (InitiateSettlementResponse);

message InitiateSettlementRequest {
  string batch_id = 1;
  repeated string bank_codes = 2;
  google.protobuf.Timestamp settlement_date = 3;
  SettlementType type = 4;            // NEFT, RTGS, IMPS
}

message InitiateSettlementResponse {
  string settlement_id = 1;
  bool success = 2;
  int64 total_amount_paisa = 3;
  int32 transaction_count = 4;
  google.protobuf.Timestamp initiated_at = 5;
}
```

#### GetSettlementStatus & GetSettlementReport
Monitor settlement progress and generate reports.

```protobuf
rpc GetSettlementStatus(SettlementStatusRequest) returns (SettlementStatusResponse);
rpc GetSettlementReport(SettlementReportRequest) returns (SettlementReportResponse);

message SettlementStatusResponse {
  string settlement_id = 1;
  SettlementStatus status = 2;        // PENDING, PROCESSING, COMPLETED, FAILED
  int64 settled_amount_paisa = 3;
  int64 pending_amount_paisa = 4;
  int32 processed_transactions = 5;
  int32 failed_transactions = 6;
  google.protobuf.Timestamp completed_at = 7;
}
```

---

## REST API Endpoints

### Health & Monitoring

#### Health Check
```http
GET /health
Content-Type: application/json

Response:
{
  "status": "UP",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": "2h 15m 30s",
  "database": {
    "status": "UP",
    "connection_pool": {
      "active": 5,
      "idle": 15,
      "max": 20
    }
  },
  "cache": {
    "status": "UP",
    "redis_connected": true
  }
}
```

#### Metrics
```http
GET /metrics
Content-Type: text/plain

# Prometheus metrics
upi_core_transactions_total{status="success"} 12456
upi_core_transactions_total{status="failed"} 23
upi_core_transaction_duration_seconds{quantile="0.5"} 0.145
upi_core_transaction_duration_seconds{quantile="0.95"} 0.289
upi_core_bank_health{bank_code="HDFC"} 1
```

### Transaction Processing

#### Process Transaction
```http
POST /upi/transactions
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "transactionId": "TXN123456789",
  "payerVpa": "user@paytm",
  "payeeVpa": "merchant@phonepe",
  "amountPaisa": 50000,
  "type": "P2M",
  "reference": "Payment for groceries",
  "payerBankCode": "HDFC",
  "payeeBankCode": "ICICI",
  "digitalSignature": "SHA256:abc123...",
  "initiatedAt": "2025-01-15T10:30:00Z"
}

Response:
{
  "transactionId": "TXN123456789",
  "rrn": "123456789012",
  "status": "SUCCESS",
  "payerBankCode": "HDFC",
  "payeeBankCode": "ICICI",
  "fees": {
    "processingFeePaisa": 100,
    "gstPaisa": 18,
    "totalFeePaisa": 118
  },
  "settlementId": "STL789123456",
  "processedAt": "2025-01-15T10:30:02Z"
}
```

#### Get Transaction Status
```http
GET /upi/transactions/{transactionId}
Authorization: Bearer <jwt_token>

Response:
{
  "transactionId": "TXN123456789",
  "rrn": "123456789012",
  "status": "SUCCESS",
  "amountPaisa": 50000,
  "payerVpa": "user@paytm",
  "payeeVpa": "merchant@phonepe",
  "events": [
    {
      "timestamp": "2025-01-15T10:30:00Z",
      "status": "INITIATED",
      "description": "Transaction initiated"
    },
    {
      "timestamp": "2025-01-15T10:30:01Z",
      "status": "VALIDATED",
      "description": "VPA validation successful"
    },
    {
      "timestamp": "2025-01-15T10:30:02Z",
      "status": "SUCCESS",
      "description": "Transaction completed successfully"
    }
  ],
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:02Z"
}
```

---

## Data Models & Enums

### Transaction Types
```protobuf
enum TransactionType {
  TRANSACTION_TYPE_UNSPECIFIED = 0;
  TRANSACTION_TYPE_P2P = 1;           // Person to Person
  TRANSACTION_TYPE_P2M = 2;           // Person to Merchant
  TRANSACTION_TYPE_M2P = 3;           // Merchant to Person
  TRANSACTION_TYPE_REFUND = 4;        // Refund transaction
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
  TRANSACTION_STATUS_CANCELLED = 5;
  TRANSACTION_STATUS_REVERSED = 6;
}
```

### Bank Status
```protobuf
enum BankStatus {
  BANK_STATUS_UNSPECIFIED = 0;
  BANK_STATUS_ACTIVE = 1;
  BANK_STATUS_INACTIVE = 2;
  BANK_STATUS_MAINTENANCE = 3;
  BANK_STATUS_SUSPENDED = 4;
}
```

### Settlement Types & Status
```protobuf
enum SettlementType {
  SETTLEMENT_TYPE_UNSPECIFIED = 0;
  SETTLEMENT_TYPE_NEFT = 1;
  SETTLEMENT_TYPE_RTGS = 2;
  SETTLEMENT_TYPE_IMPS = 3;
}

enum SettlementStatus {
  SETTLEMENT_STATUS_UNSPECIFIED = 0;
  SETTLEMENT_STATUS_PENDING = 1;
  SETTLEMENT_STATUS_PROCESSING = 2;
  SETTLEMENT_STATUS_COMPLETED = 3;
  SETTLEMENT_STATUS_FAILED = 4;
}
```

---

## Error Codes

### Transaction Errors
- `TXN_001`: Invalid transaction format
- `TXN_002`: Duplicate transaction ID
- `TXN_003`: Invalid amount (negative or zero)
- `TXN_004`: Transaction timeout
- `TXN_005`: Insufficient funds
- `TXN_006`: Daily limit exceeded

### VPA Errors
- `VPA_001`: VPA not found
- `VPA_002`: VPA inactive or suspended
- `VPA_003`: Invalid VPA format
- `VPA_004`: VPA already registered

### Bank Errors
- `BNK_001`: Bank not found
- `BNK_002`: Bank temporarily unavailable
- `BNK_003`: Bank suspended from network
- `BNK_004`: Invalid bank configuration

### System Errors
- `SYS_001`: Internal server error
- `SYS_002`: Database connection failed
- `SYS_003`: Cache service unavailable
- `SYS_004`: Rate limit exceeded
- `SYS_005`: Authentication failed

---

## Security Features

### Authentication & Authorization
- **mTLS**: Mutual TLS for gRPC communication
- **JWT Tokens**: Bearer token authentication for REST APIs
- **Digital Signatures**: Transaction integrity verification
- **API Keys**: Service-to-service authentication

### Data Protection
- **Field Encryption**: Sensitive data encrypted at rest
- **PII Masking**: Account numbers and personal data masked in logs
- **Audit Logging**: All operations logged with integrity checks
- **Token Bucket**: Rate limiting per bank/client

### Compliance
- **PCI DSS**: Level 1 compliance for payment data
- **RBI Guidelines**: UPI transaction guidelines compliance
- **Data Residency**: All data stored within India

---

## Performance & Reliability

### Service Level Objectives (SLOs)
- **Availability**: 99.99% uptime
- **Latency**: 
  - p50: ≤ 150ms
  - p95: ≤ 300ms
  - p99: ≤ 500ms
- **Throughput**: 10,000 transactions per second
- **Success Rate**: ≥ 99.95%

### Caching Strategy
- **VPA Resolution**: 5-minute cache with Redis
- **Bank Status**: 1-minute cache for health checks
- **Transaction Status**: 30-second cache for completed transactions

### Circuit Breaker
- **Per-Bank Breakers**: Individual failure thresholds
- **Auto-Recovery**: Automatic service restoration
- **Fallback Routes**: Alternative bank routing

---

## Integration Guide

### gRPC Client Setup
```go
// Go client example
conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
if err != nil {
    log.Fatal(err)
}
defer conn.Close()

client := pb.NewUpiCoreClient(conn)
```

### REST Client Setup
```bash
# cURL example
curl -X POST "http://localhost:8081/upi/transactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "transactionId": "TXN123",
    "payerVpa": "user@paytm",
    "payeeVpa": "merchant@phonepe",
    "amountPaisa": 50000,
    "type": "P2M"
  }'
```

### Event Streaming
The service publishes events to Kafka topics:
- `upi.transactions.created`
- `upi.transactions.completed`
- `upi.transactions.failed`
- `upi.settlements.initiated`
- `upi.settlements.completed`

---

## Monitoring & Observability

### Prometheus Metrics
- Transaction counters by status and bank
- Latency histograms for all operations
- Bank health gauges
- Settlement processing metrics

### Distributed Tracing
- Jaeger integration for request tracing
- Span creation for all major operations
- Error and latency tracking

### Logging
- Structured JSON logging with correlation IDs
- Error logs with stack traces
- Performance logs for slow operations
- Audit logs for all financial transactions

---

*For additional support or integration questions, contact the UPI Core service team.*