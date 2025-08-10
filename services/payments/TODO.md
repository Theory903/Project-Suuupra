
# **Service PRD: Payment Gateway Service**

## 1. 🎯 The Challenge: Problem Statement & Mission

### **Problem Statement**
> The Suuupra platform needs a highly reliable, secure, and scalable payment gateway to process a massive volume of transactions. Building a payment gateway from scratch is a complex undertaking that involves integrating with multiple payment providers, handling sensitive financial data, and protecting against fraud. The challenge is to build a payment gateway that can provide a seamless and secure payment experience for users, while meeting the stringent requirements of the financial industry.

### **Mission**
> To build a world-class payment gateway that enables seamless and secure payments on the Suuupra platform, providing a frictionless experience for users and a reliable revenue stream for the business.

---

## 2. 🧠 The Gauntlet: Core Requirements & Edge Cases

### **Core Functional Requirements (FRs)**

| FR-ID | Feature | Description |
|---|---|---|
| FR-1  | **Payment Processing** | The system can process payments via UPI, cards, and wallets. |
| FR-2  | **Fraud Detection** | The system can detect and prevent fraudulent transactions in real-time. |
| FR-3  | **Reconciliation** | The system can reconcile internal records with payment provider statements. |
| FR-4  | **Tokenization** | The system can tokenize and securely store card information. |
| FR-5  | **Webhooks** | The system can send webhooks to notify other services of payment events. |

### **Non-Functional Requirements (NFRs)**

| NFR-ID | Requirement | Target | Justification & Key Challenges |
|---|---|---|
| NFR-1 | **Success Rate** | 99.99% | A high success rate is critical for user trust and revenue. Challenge: Implementing a robust and resilient payment processing pipeline. |
| NFR-2 | **Latency** | <500ms p99 | A fast payment experience is essential for a good user experience. Challenge: Optimizing the payment processing pipeline and integrating with multiple payment providers. |
| NFR-3 | **Security** | PCI DSS Level 1 | The system must be compliant with the highest level of payment card industry security standards. Challenge: Implementing a secure and compliant architecture. |

### **Edge Cases & Failure Scenarios**

*   **Payment Provider Downtime:** What happens if a payment provider is down? (e.g., the system should automatically failover to another provider).
*   **Transaction Timeouts:** How do we handle transaction timeouts? (e.g., the system should automatically reverse the transaction and notify the user).
*   **Fraud False Positives:** How do we handle cases where a legitimate transaction is flagged as fraudulent? (e.g., provide a manual review process for flagged transactions).

---

## 3. 🗺️ The Blueprint: Architecture & Design

### **3.1. System Architecture Diagram**

```mermaid
graph TD
    A[Clients] --> B(Payment Gateway);
    B --> C{Go Service};
    C --> D[MySQL Database];
    C --> E[Fraud Detection Engine];
    C --> F[Payment Providers];
```text

### **3.2. Tech Stack Deep Dive**

| Component | Technology | Version | Justification & Key Considerations |
|---|---|---|---|
| **Language/Framework** | `Go`, `Gin/Chi` | `1.21`, `1.9` | High performance, excellent concurrency, and low latency for payment processing. |
| **Database** | `PostgreSQL` | `15+` | ACID compliance, JSON support, excellent performance for financial transactions. |
| **Cache** | `Redis` | `7.0+` | High-speed caching for fraud detection, rate limiting, and session management. |
| **Message Queue** | `Apache Kafka` | `3.5+` | Reliable event streaming for payment notifications and audit trails. |
| **Fraud Detection** | `Go + ML APIs` | `Latest` | Native Go services calling external ML APIs for real-time fraud detection. |
| **Monitoring** | `OpenTelemetry` | `Latest` | Comprehensive observability with metrics, tracing, and logging. |
| **Security** | `Go Crypto` | `Latest` | Built-in cryptography for tokenization, encryption, and secure communications. |

### **3.3. Enhanced Database Schema**

```sql
-- payments table with comprehensive audit fields
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    merchant_id UUID,
    amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    external_txn_id VARCHAR(100) UNIQUE,
    description TEXT,
    metadata JSONB,
    fees_paisa BIGINT DEFAULT 0,
    gateway_response JSONB,
    fraud_score INTEGER DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'LOW',
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    initiated_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- upi_transactions table with enhanced fields
CREATE TABLE upi_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    payer_vpa VARCHAR(100) NOT NULL,
    payee_vpa VARCHAR(100) NOT NULL,
    upi_txn_id VARCHAR(50) UNIQUE,
    npci_txn_id VARCHAR(50) UNIQUE,
    bank_ref_id VARCHAR(50),
    rrn VARCHAR(12),
    approval_code VARCHAR(20),
    response_code VARCHAR(10),
    status_message TEXT,
    payer_bank_code VARCHAR(10),
    payee_bank_code VARCHAR(10),
    settlement_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- card_transactions table
CREATE TABLE card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    card_token VARCHAR(100) NOT NULL, -- Tokenized card number
    card_type VARCHAR(20) NOT NULL, -- VISA, MASTERCARD, RUPAY
    card_category VARCHAR(20), -- DEBIT, CREDIT
    issuer_bank VARCHAR(100),
    acquirer_bank VARCHAR(100),
    authorization_code VARCHAR(20),
    gateway_txn_id VARCHAR(100),
    gateway_response_code VARCHAR(10),
    gateway_response_message TEXT,
    three_ds_status VARCHAR(20),
    three_ds_version VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- wallet_transactions table
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    wallet_provider VARCHAR(50) NOT NULL, -- PAYTM, PHONEPE, GOOGLEPAY
    wallet_txn_id VARCHAR(100),
    wallet_response_code VARCHAR(10),
    wallet_response_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- payment_methods table for tokenization
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL, -- UPI, CARD, WALLET
    token VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- webhooks table for event delivery
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    event_type VARCHAR(50) NOT NULL,
    endpoint_url VARCHAR(500) NOT NULL,
    payload JSONB NOT NULL,
    response_code INTEGER,
    response_body TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- fraud_checks table
CREATE TABLE fraud_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    threshold INTEGER NOT NULL,
    decision VARCHAR(20) NOT NULL, -- ALLOW, BLOCK, REVIEW
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- reconciliation_batches table
CREATE TABLE reconciliation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id VARCHAR(50) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    batch_date DATE NOT NULL,
    total_transactions INTEGER DEFAULT 0,
    total_amount_paisa BIGINT DEFAULT 0,
    matched_transactions INTEGER DEFAULT 0,
    unmatched_transactions INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    file_path VARCHAR(500),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_external_txn_id ON payments(external_txn_id) WHERE external_txn_id IS NOT NULL;
CREATE INDEX idx_upi_transactions_payment_id ON upi_transactions(payment_id);
CREATE INDEX idx_upi_transactions_payer_vpa ON upi_transactions(payer_vpa);
CREATE INDEX idx_upi_transactions_rrn ON upi_transactions(rrn) WHERE rrn IS NOT NULL;
CREATE INDEX idx_card_transactions_payment_id ON card_transactions(payment_id);
CREATE INDEX idx_card_transactions_card_token ON card_transactions(card_token);
CREATE INDEX idx_webhooks_payment_id ON webhooks(payment_id);
CREATE INDEX idx_webhooks_status ON webhooks(status);
CREATE INDEX idx_webhooks_next_retry_at ON webhooks(next_retry_at) WHERE next_retry_at IS NOT NULL;
```

---

## 4. 🚀 The Quest: Implementation Plan & Milestones

### **Phase 1: Foundation & UPI Integration (Weeks 9-10)**

*   **Objective:** Implement the core payment gateway service with UPI integration.
*   **Key Results:**
    *   The service can process UPI payments with proper error handling.
    *   Database schema is implemented with comprehensive audit trails.
    *   Basic fraud detection rules are in place.
*   **Tasks:**
    *   [ ] **Project Setup**: Initialize Go project with proper structure and dependencies.
    *   [ ] **Database Schema**: Implement comprehensive PostgreSQL schema with migrations.
    *   [ ] **UPI Provider**: Implement UPI payment processing with the UPI Core service.
    *   [ ] **Basic Fraud Rules**: Implement velocity checks and amount limits.
    *   [ ] **API Endpoints**: Create RESTful APIs for payment processing.

### **Phase 2: Card Payments & Advanced Fraud Detection (Weeks 10-11)**

*   **Objective:** Implement card payment processing and ML-based fraud detection.
*   **Key Results:**
    *   The service can process card payments with 3DS authentication.
    *   Advanced fraud detection with ML integration is operational.
    *   Tokenization system for secure card storage is implemented.
*   **Tasks:**
    *   [ ] **Card Provider**: Implement card payment processing with major gateways.
    *   [ ] **3DS Authentication**: Add 3D Secure support for card transactions.
    *   [ ] **Tokenization**: Implement PCI-compliant card tokenization.
    *   [ ] **ML Fraud Detection**: Integrate with external ML APIs for fraud scoring.
    *   [ ] **Risk Engine**: Build comprehensive risk assessment engine.

### **Phase 3: Security, Compliance & Production Readiness (Weeks 11-12)**

*   **Objective:** Harden the service for security and compliance, add monitoring and deploy to production.
*   **Key Results:**
    *   The service meets PCI DSS compliance requirements.
    *   Comprehensive monitoring and alerting is in place.
    *   Webhook delivery system is reliable with retries.
    *   Reconciliation system processes settlement files.
*   **Tasks:**
    *   [ ] **PCI Compliance**: Implement encryption, secure logging, and access controls.
    *   [ ] **Webhook System**: Build reliable webhook delivery with exponential backoff.
    *   [ ] **Reconciliation**: Implement automated reconciliation with payment providers.
    *   [ ] **Monitoring**: Add comprehensive metrics, tracing, and alerting.
    *   [ ] **Load Testing**: Performance test the system under high load.
    *   [ ] **Documentation**: Complete API documentation and operational runbooks.

---

## 5. 🧪 Testing & Quality Strategy

| Test Type | Tools | Coverage & Scenarios |
|---|---|---|
| **Unit Tests** | `Go testing` | >90% coverage of all services and components. |
| **Integration Tests** | `Testcontainers` | Test the entire payment processing pipeline, from payment initiation to reconciliation. |
| **Load Tests** | `k6` | Simulate a high volume of transactions to test the performance and scalability of the service. |
| **Security Tests** | `OWASP ZAP` | Automated scanning for common vulnerabilities and manual penetration testing for critical flows. |

---

## 6. 🔭 The Observatory: Monitoring & Alerting

### **Key Performance Indicators (KPIs)**
*   **Technical Metrics:** `Transaction Latency`, `Success Rate`, `Fraud Detection Accuracy`.
*   **Business Metrics:** `Transaction Volume`, `Transaction Value`, `Chargeback Rate`.

### **Dashboards & Alerts**
*   **Grafana Dashboard:** A real-time overview of all KPIs, with drill-downs per payment method and merchant.
*   **Alerting Rules (Prometheus):**
    *   `HighTransactionFailureRate`: Trigger if the transaction failure rate exceeds 0.01%.
    *   `HighFraudRate`: Trigger if the fraud rate exceeds 0.1%.
    *   `PaymentProviderError`: Trigger if a payment provider is returning a high rate of errors.

---

## 7. 📚 Learning & Knowledge Base

*   **Key Concepts:** `Payment Gateway Architecture`, `PCI DSS`, `Fraud Detection`, `Double-Entry Ledger`.
*   **Resources:**
    *   [PCI DSS Documentation](https://www.pcisecuritystandards.org/document_library)
    *   [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---
