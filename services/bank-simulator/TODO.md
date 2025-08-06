# Bank Simulator Service - Comprehensive TODO

## 1. 🎯 Overview & Learning Objectives

The **Bank Simulator Service** is a mock bank service that simulates the behavior of a real bank in the UPI ecosystem. It is responsible for debiting and crediting user accounts, and for responding to transaction requests from the UPI Core service. This service is a great opportunity to learn about building a simple, stateful, and reliable backend service.

### **Why this stack?**

*   **Node.js/Express**: A simple and lightweight framework that is well-suited for building a mock service.
*   **PostgreSQL**: For its reliability and support for ACID transactions, which are essential for a financial service.

### **Learning Focus**:

*   **Backend Development**: Learn how to build a simple and reliable backend service with Node.js and Express.
*   **Database Transactions**: Understand the importance of database transactions and how to use them to ensure data consistency.
*   **Stateful Systems**: Learn how to build a stateful service that manages user account balances.

---

## 2. 🚀 Implementation Plan (2 Weeks)

### **Week 1: Foundation & Core Banking Logic**

*   **Goal**: Set up the basic infrastructure and implement the core banking logic.

*   **Tasks**:
    *   [ ] **Project Setup**: Initialize a Node.js/Express project and set up a PostgreSQL database.
    *   [ ] **Account Management**: Implement the logic for creating and managing user accounts with balances.
    *   [ ] **Transaction Processing**: Implement the logic for debiting and crediting user accounts.

### **Week 2: API, Testing & Deployment**

*   **Goal**: Expose the service via an API, write comprehensive tests, and prepare for deployment.

*   **Tasks**:
    *   [ ] **API Endpoints**: Implement gRPC endpoints for processing transactions and getting account balances.
    *   [ ] **Testing**: Write unit and integration tests to ensure the reliability of the service.
    *   [ ] **Deployment**: Dockerize the service and prepare it for deployment to Kubernetes.

---

## 3. 🔌 API Design (gRPC)

```protobuf
syntax = "proto3";

package bank_simulator;

service BankSimulator {
  rpc ProcessTransaction (TransactionRequest) returns (TransactionResponse);
  rpc GetAccountBalance (AccountBalanceRequest) returns (AccountBalanceResponse);
}

message TransactionRequest {
  string transaction_id = 1;
  string account_id = 2;
  double amount = 3;
  string type = 4; // "debit" or "credit"
}

message TransactionResponse {
  string transaction_id = 1;
  string status = 2;
  string error_message = 3;
}

message AccountBalanceRequest {
  string account_id = 1;
}

message AccountBalanceResponse {
  string account_id = 1;
  double balance = 2;
}
```
