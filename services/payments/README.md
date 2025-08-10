# Payment Gateway Service

## 💳 Overview

The **Payment Gateway Service** is a high-performance, secure, and scalable payment processing engine built in Go. It handles multiple payment methods (UPI, Cards, Wallets), provides real-time fraud detection, ensures PCI DSS compliance, and offers comprehensive reconciliation capabilities for financial transactions.

## 🎯 Features

### 💰 Payment Processing
- **Multi-Method Support**: UPI, Credit/Debit Cards, Digital Wallets, Net Banking
- **Real-time Processing**: Sub-second payment processing with high throughput
- **3D Secure Authentication**: Complete 3DS 2.0 support for card transactions
- **Tokenization**: PCI-compliant tokenization for secure card storage
- **Refunds & Reversals**: Automated refund processing with settlement tracking

### 🛡️ Security & Fraud Prevention
- **Real-time Fraud Detection**: ML-powered fraud scoring with rule engine
- **Risk Assessment**: Multi-layered risk analysis with configurable thresholds
- **Device Fingerprinting**: Advanced device identification and tracking
- **Velocity Checks**: Transaction frequency and amount monitoring
- **PCI DSS Compliance**: Level 1 PCI DSS compliant architecture

### 🔔 Notifications & Webhooks
- **Reliable Webhooks**: Guaranteed delivery with exponential backoff retry
- **Real-time Events**: Kafka-based event streaming for instant notifications
- **Status Updates**: Real-time payment status updates via WebSocket
- **Email Notifications**: Automated transaction receipts and alerts

### 📊 Analytics & Reconciliation
- **Real-time Dashboards**: Payment metrics and business intelligence
- **Automated Reconciliation**: Daily settlement file processing
- **Dispute Management**: Chargeback and dispute handling workflows
- **Financial Reporting**: Comprehensive transaction and settlement reports

## 🛠 Tech Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Runtime** | Go | 1.21+ | High-performance backend processing |
| **Framework** | Chi Router | 5.0+ | Lightweight HTTP routing and middleware |
| **Database** | PostgreSQL | 15+ | ACID-compliant transaction storage |
| **Cache** | Redis | 7.0+ | Session management and rate limiting |
| **Message Queue** | Apache Kafka | 3.5+ | Event streaming and notifications |
| **Monitoring** | OpenTelemetry | Latest | Distributed tracing and metrics |
| **Security** | Go Crypto | Latest | Encryption, hashing, and tokenization |
| **API Gateway** | Kong/Envoy | Latest | Rate limiting, authentication, and routing |

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │Rate Limiting│ │     Auth    │ │       Load Balancer         │ │
│  │& Throttling │ │ Middleware  │ │                            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   Payment Gateway Service                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │  Payment    │ │   Fraud     │ │        Webhook              │ │
│  │  Handler    │ │  Detection  │ │       Service               │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Payment Providers                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │ UPI Gateway │ │Card Gateway │ │      Wallet Gateway         │ │
│  │(UPI Core)   │ │(Razorpay)   │ │    (PayTM, PhonePe)         │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │ PostgreSQL  │ │   Redis     │ │        Kafka                │ │
│  │  Database   │ │   Cache     │ │      Messaging              │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- PostgreSQL 15+
- Redis 7.0+
- Apache Kafka 3.5+

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/payments
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
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

### Environment Configuration

```env
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_READ_TIMEOUT=30s
SERVER_WRITE_TIMEOUT=30s

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=payments
DB_SSL_MODE=disable
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=payments-service
KAFKA_TOPIC_PAYMENTS=payments.events
KAFKA_TOPIC_WEBHOOKS=webhooks.delivery

# Security Configuration
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-byte-encryption-key
PCI_COMPLIANCE_MODE=true

# Payment Providers
UPI_CORE_ENDPOINT=http://upi-core:50051
CARD_GATEWAY_API_KEY=your-card-gateway-key
WALLET_API_ENDPOINTS={"paytm":"https://api.paytm.com","phonepe":"https://api.phonepe.com"}

# Fraud Detection
FRAUD_ML_API_URL=http://fraud-detection:8080
FRAUD_RULES_CONFIG_PATH=./config/fraud-rules.yaml
MAX_FRAUD_SCORE=100
BLOCK_THRESHOLD=80

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

## 🔌 API Endpoints

### Payment Processing

#### Create Payment
```http
POST /api/v1/payments
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "merchant_id": "123e4567-e89b-12d3-a456-426614174001",
  "amount_paisa": 10000,
  "currency": "INR",
  "payment_method": "UPI",
  "payment_details": {
    "vpa": "user@paytm"
  },
  "description": "Payment for order #12345",
  "callback_url": "https://merchant.com/webhook",
  "metadata": {
    "order_id": "12345",
    "customer_email": "user@example.com"
  }
}
```

**Response:**
```json
{
  "payment_id": "PAY_123456789",
  "status": "PENDING",
  "amount_paisa": 10000,
  "fees_paisa": 0,
  "payment_url": "upi://pay?pa=merchant@bank&pn=Merchant&am=100.00&cu=INR&tn=Payment",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "expires_at": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-15T10:15:00Z"
}
```

#### Get Payment Status
```http
GET /api/v1/payments/{payment_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "payment_id": "PAY_123456789",
  "status": "SUCCESS",
  "amount_paisa": 10000,
  "fees_paisa": 0,
  "external_txn_id": "TXN789456123",
  "gateway_response": {
    "rrn": "123456789012",
    "approval_code": "123456"
  },
  "processed_at": "2024-01-15T10:16:30Z",
  "created_at": "2024-01-15T10:15:00Z"
}
```

#### Process Refund
```http
POST /api/v1/payments/{payment_id}/refund
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount_paisa": 10000,
  "reason": "Customer requested refund",
  "metadata": {
    "refund_request_id": "REF123"
  }
}
```

### Payment Methods Management

#### Tokenize Payment Method
```http
POST /api/v1/payment-methods/tokenize
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "type": "CARD",
  "details": {
    "card_number": "4111111111111111",
    "expiry_month": "12",
    "expiry_year": "25",
    "cvv": "123",
    "holder_name": "John Doe"
  },
  "display_name": "**** **** **** 1111"
}
```

#### List Payment Methods
```http
GET /api/v1/users/{user_id}/payment-methods
Authorization: Bearer <token>
```

### Webhooks Management

#### Create Webhook Endpoint
```http
POST /api/v1/webhooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://merchant.com/webhook",
  "events": ["payment.success", "payment.failed", "refund.processed"],
  "secret": "webhook_secret_key"
}
```

### Admin & Analytics

#### Get Payment Analytics
```http
GET /api/v1/admin/analytics/payments?from=2024-01-01&to=2024-01-31
Authorization: Bearer <admin_token>
```

#### Get Settlement Report
```http
GET /api/v1/admin/settlements?date=2024-01-15&provider=UPI
Authorization: Bearer <admin_token>
```

## 💳 Payment Methods

### UPI Payments
- **Real-time Processing**: Direct integration with UPI Core service
- **VPA Validation**: Real-time VPA existence and status checks
- **QR Code Generation**: Dynamic QR codes for payment collection
- **Deep Links**: UPI app deep linking for seamless user experience

### Card Payments
- **3D Secure**: Complete 3DS 2.0 authentication flow
- **Tokenization**: PCI-compliant card tokenization
- **Multiple Gateways**: Support for Razorpay, PayU, CCAvenue
- **EMI Options**: No-cost and regular EMI processing

### Digital Wallets
- **Major Wallets**: PayTM, PhonePe, Google Pay, Amazon Pay
- **Instant Processing**: Real-time wallet deduction and confirmation
- **Balance Checks**: Pre-transaction balance verification
- **Cashback Support**: Wallet-specific offer and cashback handling

## 🛡️ Security Features

### PCI DSS Compliance
```go
// Example: Secure card data handling
type SecureCardData struct {
    Token        string    `json:"token"`
    Last4Digits  string    `json:"last_4"`
    ExpiryMonth  string    `json:"expiry_month"`
    ExpiryYear   string    `json:"expiry_year"`
    CardType     string    `json:"card_type"`
    IssuerBank   string    `json:"issuer_bank"`
}

func (s *PaymentService) TokenizeCard(ctx context.Context, cardData *CardData) (*SecureCardData, error) {
    // 1. Validate card data
    if err := s.validateCard(cardData); err != nil {
        return nil, err
    }
    
    // 2. Generate secure token
    token, err := s.tokenizer.GenerateToken(cardData.Number)
    if err != nil {
        return nil, err
    }
    
    // 3. Store tokenized data (PAN is never stored)
    secureData := &SecureCardData{
        Token:       token,
        Last4Digits: cardData.Number[len(cardData.Number)-4:],
        ExpiryMonth: cardData.ExpiryMonth,
        ExpiryYear:  cardData.ExpiryYear,
        CardType:    s.detectCardType(cardData.Number),
        IssuerBank:  s.detectIssuer(cardData.Number),
    }
    
    return secureData, s.paymentMethodRepo.Store(ctx, secureData)
}
```

### Fraud Detection
```go
// Example: Real-time fraud scoring
type FraudDetectionEngine struct {
    ruleEngine  *RuleEngine
    mlClient    *MLClient
    velocityChecker *VelocityChecker
}

func (f *FraudDetectionEngine) CheckTransaction(ctx context.Context, payment *Payment) (*FraudResult, error) {
    result := &FraudResult{Score: 0, RiskLevel: "LOW"}
    
    // 1. Velocity checks
    velocityScore := f.velocityChecker.CheckUserVelocity(payment.UserID, payment.AmountPaisa)
    result.Score += velocityScore
    
    // 2. Device fingerprinting
    deviceScore := f.checkDeviceRisk(payment.DeviceFingerprint, payment.UserID)
    result.Score += deviceScore
    
    // 3. ML model scoring
    mlScore, err := f.mlClient.GetFraudScore(ctx, &FraudFeatures{
        Amount:            payment.AmountPaisa,
        PaymentMethod:     payment.PaymentMethod,
        UserHistory:       f.getUserHistory(payment.UserID),
        DeviceFingerprint: payment.DeviceFingerprint,
        IPAddress:         payment.IPAddress,
        TimeOfDay:         time.Now().Hour(),
    })
    
    if err == nil {
        result.Score += mlScore
    }
    
    // 4. Determine risk level
    result.RiskLevel = f.calculateRiskLevel(result.Score)
    
    return result, nil
}
```

### Encryption & Data Protection
```go
// Example: Field-level encryption
type EncryptedPaymentData struct {
    PaymentID       string `json:"payment_id"`
    EncryptedPII    string `json:"encrypted_pii"`    // Encrypted user data
    EncryptedAmount string `json:"encrypted_amount"` // Encrypted amount
    Hash            string `json:"hash"`             // Data integrity hash
}

func (s *SecurityService) EncryptSensitiveData(data *PaymentData) (*EncryptedPaymentData, error) {
    // 1. Encrypt PII data
    piiData := map[string]interface{}{
        "user_email": data.UserEmail,
        "user_phone": data.UserPhone,
        "card_details": data.CardDetails,
    }
    
    encryptedPII, err := s.encryptor.Encrypt(piiData)
    if err != nil {
        return nil, err
    }
    
    // 2. Encrypt amount (for additional security)
    encryptedAmount, err := s.encryptor.Encrypt(data.AmountPaisa)
    if err != nil {
        return nil, err
    }
    
    // 3. Generate integrity hash
    hash := s.generateHash(data)
    
    return &EncryptedPaymentData{
        PaymentID:       data.PaymentID,
        EncryptedPII:    encryptedPII,
        EncryptedAmount: encryptedAmount,
        Hash:            hash,
    }, nil
}
```

## 🔔 Webhook System

### Reliable Delivery
```go
// Example: Webhook delivery with retry logic
type WebhookDelivery struct {
    webhookRepo   WebhookRepository
    httpClient    *http.Client
    retryStrategy *ExponentialBackoff
}

func (w *WebhookDelivery) DeliverWebhook(ctx context.Context, webhook *Webhook) error {
    return w.retryStrategy.Execute(func() error {
        // 1. Prepare payload
        payload, err := json.Marshal(webhook.Payload)
        if err != nil {
            return err
        }
        
        // 2. Sign payload
        signature := w.generateSignature(payload, webhook.Secret)
        
        // 3. Send HTTP request
        req, err := http.NewRequestWithContext(ctx, "POST", webhook.URL, bytes.NewBuffer(payload))
        if err != nil {
            return err
        }
        
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("X-Webhook-Signature", signature)
        req.Header.Set("X-Webhook-Event", webhook.EventType)
        
        resp, err := w.httpClient.Do(req)
        if err != nil {
            return err
        }
        defer resp.Body.Close()
        
        // 4. Check response
        if resp.StatusCode >= 200 && resp.StatusCode < 300 {
            return nil // Success
        }
        
        return fmt.Errorf("webhook delivery failed: status %d", resp.StatusCode)
    })
}
```

## 📊 Monitoring & Observability

### Metrics Collection
```go
// Example: Payment metrics
var (
    paymentCounter = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "payments_total",
            Help: "Total number of payments processed",
        },
        []string{"method", "status", "currency"},
    )
    
    paymentDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "payment_processing_duration_seconds",
            Help: "Payment processing duration",
        },
        []string{"method", "provider"},
    )
    
    fraudScore = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "fraud_score_distribution",
            Help: "Distribution of fraud scores",
        },
        []string{"payment_method", "risk_level"},
    )
)

func (s *PaymentService) recordMetrics(payment *Payment, duration time.Duration, fraudResult *FraudResult) {
    paymentCounter.WithLabelValues(
        string(payment.PaymentMethod),
        string(payment.Status),
        payment.Currency,
    ).Inc()
    
    paymentDuration.WithLabelValues(
        string(payment.PaymentMethod),
        payment.Provider,
    ).Observe(duration.Seconds())
    
    if fraudResult != nil {
        fraudScore.WithLabelValues(
            string(payment.PaymentMethod),
            string(fraudResult.RiskLevel),
        ).Observe(float64(fraudResult.Score))
    }
}
```

### Health Checks
```go
// Example: Comprehensive health checks
type HealthChecker struct {
    db           *sql.DB
    redis        *redis.Client
    kafkaClient  *kafka.Client
    providers    map[string]PaymentProvider
}

func (h *HealthChecker) CheckHealth(ctx context.Context) *HealthStatus {
    status := &HealthStatus{
        Status:    "healthy",
        Timestamp: time.Now(),
        Checks:    make(map[string]CheckResult),
    }
    
    // Database health
    if err := h.db.PingContext(ctx); err != nil {
        status.Checks["database"] = CheckResult{Status: "unhealthy", Error: err.Error()}
        status.Status = "degraded"
    } else {
        status.Checks["database"] = CheckResult{Status: "healthy"}
    }
    
    // Redis health
    if err := h.redis.Ping(ctx).Err(); err != nil {
        status.Checks["redis"] = CheckResult{Status: "unhealthy", Error: err.Error()}
        status.Status = "degraded"
    } else {
        status.Checks["redis"] = CheckResult{Status: "healthy"}
    }
    
    // Payment provider health
    for name, provider := range h.providers {
        if err := provider.HealthCheck(ctx); err != nil {
            status.Checks[name] = CheckResult{Status: "unhealthy", Error: err.Error()}
            status.Status = "degraded"
        } else {
            status.Checks[name] = CheckResult{Status: "healthy"}
        }
    }
    
    return status
}
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
# Run integration tests
make test-integration

# Test with real payment providers (sandbox)
make test-providers
```

### Load Testing
```bash
# Run load tests
make load-test

# Custom load test scenarios
k6 run --vus 100 --duration 5m scripts/payment-load-test.js
```

## 🚀 Deployment

### Docker
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o payments-service cmd/server/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/payments-service .
EXPOSE 8080 9090
CMD ["./payments-service"]
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payments-service
  template:
    metadata:
      labels:
        app: payments-service
    spec:
      containers:
      - name: payments-service
        image: payments-service:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: payments-secrets
              key: db-host
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
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
- Follow security best practices for financial applications

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- **Email**: support@payments-gateway.com
- **Documentation**: [docs.payments-gateway.com](https://docs.payments-gateway.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/payments-service/issues)

---

**Built with 🚀 using Go for high-performance payment processing**
