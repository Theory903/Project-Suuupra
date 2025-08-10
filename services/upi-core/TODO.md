# UPI Core Service - Comprehensive TODO

## 1. 🎯 Overview & Learning Objectives

The **UPI Core Service** is the central switch and orchestrator of the entire UPI clone ecosystem. It is responsible for routing transactions, ensuring security, and maintaining the integrity of the payment network. This service is a deep dive into building a high-performance, fault-tolerant, and secure financial transaction processing system.

### **Why this stack?**

*   **Go**: Chosen for its high performance, concurrency, and low-latency characteristics, which are essential for a real-time payment switch.
*   **gRPC**: For its high-performance, low-latency, and strongly-typed communication between internal services.
*   **Redis**: Used for caching routing information, transaction state, and for implementing distributed locking.

### **Learning Focus**:

*   **High-Performance Networking**: Learn how to build a high-throughput, low-latency gRPC-based service.
*   **Distributed Systems**: Implement a fault-tolerant and scalable system with service discovery and load balancing.
*   **Financial Transaction Processing**: Understand the intricacies of routing, processing, and securing financial transactions.
*   **Cryptography**: Implement digital signatures and encryption to secure the payment network.

---

## 2. 🚀 Implementation Plan (4 Weeks)

### **Week 1: Foundation & Core Routing**

*   **Goal**: Set up the basic infrastructure and implement the core transaction routing logic.

*   **Tasks**:
    *   [ ] **Project Setup**: Initialize a Go project and set up gRPC, Redis, and a database.
    *   [ ] **Service Discovery**: Implement a service discovery mechanism (e.g., using Consul or etcd) for PSPs and banks.
    *   [ ] **Routing Engine**: Implement a routing engine that can route transactions based on the VPA.
    *   [ ] **Transaction State Machine**: Design and implement a state machine for the lifecycle of a UPI transaction.

### **Week 2: Security & Cryptography**

*   **Goal**: Implement the security layer of the UPI switch.

*   **Tasks**:
    *   [ ] **Digital Signatures**: Implement RSA-SHA256 digital signatures for all gRPC messages to ensure message integrity and non-repudiation.
    *   [ ] **Encryption**: Implement TLS with mutual authentication (mTLS) for all gRPC communication.
    *   [ ] **Key Management**: Implement a secure key management system for signing and encryption keys.

### **Week 3: Transaction Processing & Reconciliation**

*   **Goal**: Implement the core transaction processing and reconciliation logic.

*   **Tasks**:
    *   [ ] **Transaction Processing**: Implement the logic for processing different types of UPI transactions (e.g., P2P, P2M).
    *   [ ] **Reconciliation**: Implement a reconciliation process to ensure that all transactions are settled correctly between the banks.

### **Week 4: Monitoring, Testing & Deployment**

*   **Goal**: Add monitoring, write comprehensive tests, and prepare for deployment.

*   **Tasks**:
    *   [ ] **Monitoring & Alerting**: Implement a monitoring system with Prometheus and Grafana to track the health and performance of the UPI switch.
    *   [ ] **Testing**: Write unit, integration, and end-to-end tests to ensure the reliability of the service.
    *   [ ] **Deployment**: Dockerize the service and prepare it for deployment to Kubernetes.

---

## 3. 🔌 Enhanced API Design (gRPC)

```protobuf
syntax = "proto3";

package upi_core;

import "google/protobuf/timestamp.proto";

service UpiCore {
  // Transaction processing
  rpc ProcessTransaction(TransactionRequest) returns (TransactionResponse);
  rpc GetTransactionStatus(TransactionStatusRequest) returns (TransactionStatusResponse);
  rpc CancelTransaction(CancelTransactionRequest) returns (CancelTransactionResponse);
  
  // VPA management
  rpc ResolveVPA(ResolveVPARequest) returns (ResolveVPAResponse);
  rpc RegisterVPA(RegisterVPARequest) returns (RegisterVPAResponse);
  
  // Bank operations
  rpc RegisterBank(RegisterBankRequest) returns (RegisterBankResponse);
  rpc GetBankStatus(BankStatusRequest) returns (BankStatusResponse);
  
  // Reconciliation
  rpc GetSettlementReport(SettlementReportRequest) returns (SettlementReportResponse);
  rpc ProcessSettlement(ProcessSettlementRequest) returns (ProcessSettlementResponse);
}

// Transaction messages
message TransactionRequest {
  string transaction_id = 1;
  string payer_vpa = 2;
  string payee_vpa = 3;
  int64 amount_paisa = 4; // Amount in paisa to avoid floating point issues
  string currency = 5;
  TransactionType type = 6;
  string description = 7;
  string signature = 8;
  map<string, string> metadata = 9;
  google.protobuf.Timestamp initiated_at = 10;
}

message TransactionResponse {
  string transaction_id = 1;
  TransactionStatus status = 2;
  string rrn = 3; // Retrieval Reference Number
  string error_code = 4;
  string error_message = 5;
  int64 fees_paisa = 6;
  google.protobuf.Timestamp processed_at = 7;
}

// Supporting types
enum TransactionType {
  TRANSACTION_TYPE_UNSPECIFIED = 0;
  TRANSACTION_TYPE_P2P = 1;        // Person to Person
  TRANSACTION_TYPE_P2M = 2;        // Person to Merchant
  TRANSACTION_TYPE_REFUND = 3;     // Refund transaction
  TRANSACTION_TYPE_REVERSAL = 4;   // Technical reversal
}

enum TransactionStatus {
  TRANSACTION_STATUS_UNSPECIFIED = 0;
  TRANSACTION_STATUS_PENDING = 1;
  TRANSACTION_STATUS_SUCCESS = 2;
  TRANSACTION_STATUS_FAILED = 3;
  TRANSACTION_STATUS_TIMEOUT = 4;
  TRANSACTION_STATUS_CANCELLED = 5;
  TRANSACTION_STATUS_REVERSED = 6;
}

// Additional messages for VPA, Bank operations, etc.
message ResolveVPARequest {
  string vpa = 1;
}

message ResolveVPAResponse {
  bool exists = 1;
  string account_holder_name = 2;
  string bank_code = 3;
  bool is_active = 4;
  string error_message = 5;
}
```

---

## 4. 🏗️ Go Implementation Architecture

### **4.1. Project Structure**

```
upi-core/
├── cmd/
│   └── server/
│       └── main.go                 # Application entry point
├── internal/
│   ├── config/                     # Configuration management
│   │   ├── config.go
│   │   └── env.go
│   ├── domain/                     # Domain entities and interfaces
│   │   ├── entities/
│   │   │   ├── transaction.go
│   │   │   ├── vpa.go
│   │   │   └── bank.go
│   │   ├── repositories/
│   │   │   ├── transaction_repo.go
│   │   │   ├── vpa_repo.go
│   │   │   └── bank_repo.go
│   │   └── services/
│   │       ├── transaction_service.go
│   │       ├── routing_service.go
│   │       └── settlement_service.go
│   ├── infrastructure/             # External concerns
│   │   ├── database/
│   │   │   ├── postgres.go
│   │   │   ├── redis.go
│   │   │   └── migrations/
│   │   ├── grpc/
│   │   │   ├── server.go
│   │   │   ├── interceptors/
│   │   │   └── handlers/
│   │   ├── messaging/
│   │   │   ├── kafka.go
│   │   │   └── events/
│   │   └── monitoring/
│   │       ├── metrics.go
│   │       ├── tracing.go
│   │       └── logging.go
│   ├── application/                # Application services
│   │   ├── usecases/
│   │   │   ├── process_transaction.go
│   │   │   ├── resolve_vpa.go
│   │   │   └── settlement.go
│   │   └── handlers/
│   │       ├── transaction_handler.go
│   │       └── vpa_handler.go
│   └── pkg/                        # Shared utilities
│       ├── crypto/
│       │   ├── signature.go
│       │   └── encryption.go
│       ├── utils/
│       │   ├── id_generator.go
│       │   └── validator.go
│       └── errors/
│           └── errors.go
├── api/
│   └── proto/                      # Protocol buffer definitions
│       ├── upi_core.proto
│       └── generated/
├── scripts/
│   ├── build.sh
│   ├── test.sh
│   └── migrate.sh
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── deployments/
│   └── k8s/
├── go.mod
├── go.sum
└── Makefile
```

### **4.2. Core Domain Entities**

```go
// internal/domain/entities/transaction.go
package entities

import (
    "time"
    "github.com/google/uuid"
)

type Transaction struct {
    ID              uuid.UUID         `json:"id" db:"id"`
    TransactionID   string           `json:"transaction_id" db:"transaction_id"`
    RRN             string           `json:"rrn" db:"rrn"`
    PayerVPA        string           `json:"payer_vpa" db:"payer_vpa"`
    PayeeVPA        string           `json:"payee_vpa" db:"payee_vpa"`
    AmountPaisa     int64            `json:"amount_paisa" db:"amount_paisa"`
    Currency        string           `json:"currency" db:"currency"`
    Type            TransactionType  `json:"type" db:"type"`
    Status          TransactionStatus `json:"status" db:"status"`
    Description     string           `json:"description" db:"description"`
    FeesPaisa       int64            `json:"fees_paisa" db:"fees_paisa"`
    PayerBankCode   string           `json:"payer_bank_code" db:"payer_bank_code"`
    PayeeBankCode   string           `json:"payee_bank_code" db:"payee_bank_code"`
    Metadata        map[string]string `json:"metadata" db:"metadata"`
    InitiatedAt     time.Time        `json:"initiated_at" db:"initiated_at"`
    ProcessedAt     *time.Time       `json:"processed_at" db:"processed_at"`
    CreatedAt       time.Time        `json:"created_at" db:"created_at"`
    UpdatedAt       time.Time        `json:"updated_at" db:"updated_at"`
}

type TransactionType string

const (
    TransactionTypeP2P      TransactionType = "P2P"
    TransactionTypeP2M      TransactionType = "P2M"
    TransactionTypeRefund   TransactionType = "REFUND"
    TransactionTypeReversal TransactionType = "REVERSAL"
)

type TransactionStatus string

const (
    TransactionStatusPending   TransactionStatus = "PENDING"
    TransactionStatusSuccess   TransactionStatus = "SUCCESS"
    TransactionStatusFailed    TransactionStatus = "FAILED"
    TransactionStatusTimeout   TransactionStatus = "TIMEOUT"
    TransactionStatusCancelled TransactionStatus = "CANCELLED"
    TransactionStatusReversed  TransactionStatus = "REVERSED"
)

func (t *Transaction) Validate() error {
    if t.PayerVPA == "" {
        return ErrInvalidPayerVPA
    }
    if t.PayeeVPA == "" {
        return ErrInvalidPayeeVPA
    }
    if t.AmountPaisa <= 0 {
        return ErrInvalidAmount
    }
    return nil
}

func (t *Transaction) CanBeProcessed() bool {
    return t.Status == TransactionStatusPending
}

func (t *Transaction) MarkAsProcessed(status TransactionStatus, rrn string) {
    now := time.Now()
    t.Status = status
    t.RRN = rrn
    t.ProcessedAt = &now
    t.UpdatedAt = now
}
```

### **4.3. Transaction Service Implementation**

```go
// internal/domain/services/transaction_service.go
package services

import (
    "context"
    "fmt"
    "time"
    
    "github.com/upi-core/internal/domain/entities"
    "github.com/upi-core/internal/domain/repositories"
    "github.com/upi-core/internal/pkg/crypto"
    "github.com/upi-core/internal/pkg/utils"
)

type TransactionService struct {
    transactionRepo repositories.TransactionRepository
    vpaRepo        repositories.VPARepository
    bankRepo       repositories.BankRepository
    routingService *RoutingService
    cryptoService  *crypto.Service
    eventPublisher EventPublisher
}

func (s *TransactionService) ProcessTransaction(ctx context.Context, req *ProcessTransactionRequest) (*ProcessTransactionResponse, error) {
    // 1. Validate transaction request
    if err := s.validateTransactionRequest(req); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }
    
    // 2. Verify digital signature
    if err := s.cryptoService.VerifySignature(req.Signature, req); err != nil {
        return nil, fmt.Errorf("signature verification failed: %w", err)
    }
    
    // 3. Resolve VPAs to get bank routing information
    payerBank, err := s.resolveVPAToBank(ctx, req.PayerVPA)
    if err != nil {
        return nil, fmt.Errorf("failed to resolve payer VPA: %w", err)
    }
    
    payeeBank, err := s.resolveVPAToBank(ctx, req.PayeeVPA)
    if err != nil {
        return nil, fmt.Errorf("failed to resolve payee VPA: %w", err)
    }
    
    // 4. Create and process transaction
    transaction := s.createTransaction(req, payerBank, payeeBank)
    
    // 5. Store transaction in database
    if err := s.transactionRepo.Create(ctx, transaction); err != nil {
        return nil, fmt.Errorf("failed to store transaction: %w", err)
    }
    
    // 6. Route transaction to appropriate banks
    result, err := s.routingService.RouteTransaction(ctx, transaction, payerBank, payeeBank)
    if err != nil {
        transaction.MarkAsProcessed(entities.TransactionStatusFailed, transaction.RRN)
        s.transactionRepo.Update(ctx, transaction)
        return nil, fmt.Errorf("routing failed: %w", err)
    }
    
    // 7. Update transaction status and publish events
    transaction.MarkAsProcessed(result.Status, result.RRN)
    transaction.FeesPaisa = result.FeesPaisa
    
    if err := s.transactionRepo.Update(ctx, transaction); err != nil {
        return nil, fmt.Errorf("failed to update transaction: %w", err)
    }
    
    return &ProcessTransactionResponse{
        TransactionID: transaction.TransactionID,
        Status:        transaction.Status,
        RRN:           transaction.RRN,
        FeesPaisa:     transaction.FeesPaisa,
        ProcessedAt:   *transaction.ProcessedAt,
    }, nil
}
```
