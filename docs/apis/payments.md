# Payment Gateway Service API Documentation

## Overview

The Payment Gateway Service is a **production-grade payment orchestration platform** that provides comprehensive payment processing capabilities including UPI transactions, card payments, fraud detection, and financial reconciliation. Built with Go and designed for billion-user scale with 99.99% reliability.

**Service Endpoints:**
- **HTTP Server**: `localhost:8080`
- **gRPC Server**: `localhost:50051`
- **Metrics**: `localhost:9090`
- **Admin Dashboard**: `localhost:8080/admin`

**Target Performance:**
- **Success Rate**: ≥99.9% p50, ≥99.5% p95 daily
- **Latency**: p50 ≤300ms, p95 ≤800ms
- **Duplicate Rate**: ≤1 in 10M transactions
- **Throughput**: 10,000+ TPS peak capacity

---

## Core Architecture

### Event-Sourced Ledger
All financial operations are recorded in an immutable, append-only event stream with double-entry accounting principles:

```json
{
  "eventId": "evt_01HKTM5X8Y9Z...",
  "aggregateId": "payment_01HKTM5X8Y9Z...",
  "eventType": "PaymentIntentCreated",
  "version": 1,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "amount": 50000,
    "currency": "INR",
    "paymentMethod": "upi",
    "merchantId": "merchant_01HKTM5X8Y9Z..."
  },
  "metadata": {
    "causationId": "cmd_01HKTM5X8Y9Z...",
    "correlationId": "req_01HKTM5X8Y9Z..."
  }
}
```

### Idempotency & Deduplication
All unsafe operations support idempotency keys:

```http
POST /api/v1/payments
Idempotency-Key: idem_01HKTM5X8Y9Z123456789
Content-Type: application/json

{
  "amount": 50000,
  "currency": "INR",
  "paymentMethod": "upi",
  "customer": {
    "vpa": "customer@paytm"
  },
  "merchant": {
    "vpa": "merchant@phonepe"
  }
}
```

---

## Payment Processing APIs

### Payment Intents

#### Create Payment Intent
```http
POST /api/v1/intents
Content-Type: application/json
Authorization: Bearer <jwt_token>
Idempotency-Key: idem_01HKTM5X8Y9Z123456789

Request:
{
  "amount": 50000,
  "currency": "INR",
  "paymentMethods": ["upi", "card", "netbanking"],
  "customer": {
    "id": "cust_01HKTM5X8Y9Z...",
    "vpa": "customer@paytm",
    "mobile": "+919876543210"
  },
  "merchant": {
    "id": "merch_01HKTM5X8Y9Z...",
    "vpa": "merchant@phonepe",
    "businessName": "SuperMart"
  },
  "description": "Payment for groceries",
  "metadata": {
    "orderId": "order_12345",
    "cartItems": 3
  },
  "webhook": {
    "url": "https://merchant.com/webhooks/payment",
    "events": ["payment.completed", "payment.failed"]
  }
}

Response:
{
  "id": "pi_01HKTM5X8Y9Z...",
  "status": "requires_payment_method",
  "amount": 50000,
  "currency": "INR",
  "paymentMethods": ["upi", "card", "netbanking"],
  "customer": {
    "id": "cust_01HKTM5X8Y9Z...",
    "vpa": "customer@paytm"
  },
  "merchant": {
    "id": "merch_01HKTM5X8Y9Z...",
    "vpa": "merchant@phonepe",
    "businessName": "SuperMart"
  },
  "clientSecret": "pi_01HKTM5X8Y9Z..._secret_xyz",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "expiresAt": "2025-01-15T10:45:00.000Z"
}
```

#### Get Payment Intent
```http
GET /api/v1/intents/{intentId}
Authorization: Bearer <jwt_token>

Response:
{
  "id": "pi_01HKTM5X8Y9Z...",
  "status": "succeeded",
  "amount": 50000,
  "currency": "INR",
  "paymentMethod": "upi",
  "charges": [
    {
      "id": "ch_01HKTM5X8Y9Z...",
      "amount": 50000,
      "status": "succeeded",
      "paymentMethod": "upi",
      "fees": {
        "platform": 100,
        "processing": 50,
        "total": 150
      }
    }
  ],
  "timeline": [
    {
      "timestamp": "2025-01-15T10:30:00.000Z",
      "event": "payment_intent.created"
    },
    {
      "timestamp": "2025-01-15T10:30:15.000Z",
      "event": "payment_method.attached"
    },
    {
      "timestamp": "2025-01-15T10:30:45.000Z",
      "event": "payment_intent.succeeded"
    }
  ]
}
```

### Payment Processing

#### Process Payment
```http
POST /api/v1/payments
Content-Type: application/json
Authorization: Bearer <jwt_token>
Idempotency-Key: idem_01HKTM5X8Y9Z123456789

Request:
{
  "paymentIntentId": "pi_01HKTM5X8Y9Z...",
  "paymentMethod": {
    "type": "upi",
    "upi": {
      "vpa": "customer@paytm"
    }
  },
  "riskAssessment": {
    "deviceFingerprint": "fp_01HKTM5X8Y9Z...",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "geolocation": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "authentication": {
    "type": "pin",
    "pin": "encrypted_pin_hash"
  }
}

Response:
{
  "id": "pay_01HKTM5X8Y9Z...",
  "status": "processing",
  "amount": 50000,
  "currency": "INR",
  "paymentMethod": {
    "type": "upi",
    "last4": "1234",
    "bank": "HDFC"
  },
  "riskScore": 15,
  "riskDecision": "approve",
  "estimatedSettlement": "2025-01-15T18:00:00.000Z",
  "fees": {
    "platform": 100,
    "processing": 50,
    "gst": 27,
    "total": 177
  },
  "receipt": {
    "id": "rcpt_01HKTM5X8Y9Z...",
    "url": "https://payments.suuupra.com/receipts/rcpt_01HKTM5X8Y9Z..."
  }
}
```

#### Get Payment Status
```http
GET /api/v1/payments/{paymentId}
Authorization: Bearer <jwt_token>

Response:
{
  "id": "pay_01HKTM5X8Y9Z...",
  "status": "succeeded",
  "amount": 50000,
  "currency": "INR",
  "paymentIntentId": "pi_01HKTM5X8Y9Z...",
  "paymentMethod": {
    "type": "upi",
    "upi": {
      "transactionId": "TXN123456789012",
      "rrn": "123456789012",
      "bank": "HDFC"
    }
  },
  "timeline": [
    {
      "timestamp": "2025-01-15T10:30:45.000Z",
      "status": "processing",
      "description": "Payment initiated"
    },
    {
      "timestamp": "2025-01-15T10:30:47.000Z",
      "status": "succeeded",
      "description": "Payment completed successfully"
    }
  ],
  "settlementDetails": {
    "settlementId": "stl_01HKTM5X8Y9Z...",
    "expectedAt": "2025-01-15T18:00:00.000Z",
    "actualAt": "2025-01-15T18:00:15.000Z",
    "netAmount": 49823
  }
}
```

---

## Refunds & Reversals

### Create Refund
```http
POST /api/v1/refunds
Content-Type: application/json
Authorization: Bearer <jwt_token>
Idempotency-Key: idem_refund_01HKTM5X8Y9Z

Request:
{
  "paymentId": "pay_01HKTM5X8Y9Z...",
  "amount": 25000,
  "reason": "partial_refund",
  "description": "Customer requested partial refund",
  "metadata": {
    "supportTicket": "TICKET-12345",
    "refundType": "customer_request"
  }
}

Response:
{
  "id": "ref_01HKTM5X8Y9Z...",
  "status": "processing",
  "amount": 25000,
  "currency": "INR",
  "paymentId": "pay_01HKTM5X8Y9Z...",
  "reason": "partial_refund",
  "estimatedCompletion": "2025-01-15T10:45:00.000Z",
  "fees": {
    "refundProcessing": 25,
    "total": 25
  },
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

### Get Refund Status
```http
GET /api/v1/refunds/{refundId}
Authorization: Bearer <jwt_token>

Response:
{
  "id": "ref_01HKTM5X8Y9Z...",
  "status": "succeeded",
  "amount": 25000,
  "currency": "INR",
  "paymentId": "pay_01HKTM5X8Y9Z...",
  "completedAt": "2025-01-15T10:32:15.000Z",
  "refundDetails": {
    "method": "original_payment_method",
    "transactionId": "REF123456789012",
    "rrn": "REF123456789012"
  }
}
```

---

## Advanced Features

### Risk Assessment

#### Assess Transaction Risk
```http
POST /api/v1/risk/assess
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "amount": 50000,
  "currency": "INR",
  "paymentMethod": "upi",
  "customer": {
    "id": "cust_01HKTM5X8Y9Z...",
    "vpa": "customer@paytm"
  },
  "merchant": {
    "id": "merch_01HKTM5X8Y9Z...",
    "category": "grocery"
  },
  "context": {
    "deviceFingerprint": "fp_01HKTM5X8Y9Z...",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "geolocation": {
      "latitude": 28.6139,
      "longitude": 77.2090
    },
    "sessionAge": 1800,
    "isNewDevice": false
  }
}

Response:
{
  "riskScore": 15,
  "riskLevel": "low",
  "decision": "approve",
  "factors": [
    {
      "factor": "amount_velocity",
      "score": 5,
      "description": "Normal spending pattern"
    },
    {
      "factor": "device_trust",
      "score": 2,
      "description": "Known device"
    },
    {
      "factor": "merchant_trust",
      "score": 1,
      "description": "Trusted merchant category"
    }
  ],
  "recommendations": [
    {
      "action": "proceed",
      "confidence": 0.95
    }
  ]
}
```

### Device Linking

#### Link Device
```http
POST /api/v1/devices/link
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "customerId": "cust_01HKTM5X8Y9Z...",
  "deviceFingerprint": "fp_01HKTM5X8Y9Z...",
  "deviceInfo": {
    "platform": "android",
    "version": "12",
    "manufacturer": "Samsung",
    "model": "Galaxy S21"
  },
  "verification": {
    "method": "sms_otp",
    "otp": "123456",
    "mobile": "+919876543210"
  }
}

Response:
{
  "deviceId": "dev_01HKTM5X8Y9Z...",
  "status": "linked",
  "trustLevel": "medium",
  "linkedAt": "2025-01-15T10:30:00.000Z",
  "expiresAt": "2025-07-15T10:30:00.000Z"
}
```

### Tokenized Handles (Aliases)

#### Create Payment Alias
```http
POST /api/v1/aliases
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "customerId": "cust_01HKTM5X8Y9Z...",
  "actualVpa": "customer@paytm",
  "scope": "merchant_specific",
  "merchantId": "merch_01HKTM5X8Y9Z...",
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "metadata": {
    "purpose": "subscription_payment"
  }
}

Response:
{
  "aliasId": "alias_01HKTM5X8Y9Z...",
  "tokenizedVpa": "token.customer.01HKTM5X8Y9Z@suuupra",
  "status": "active",
  "scope": "merchant_specific",
  "merchantId": "merch_01HKTM5X8Y9Z...",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

### Escrow & Holds

#### Create Payment Hold
```http
POST /api/v1/holds
Content-Type: application/json
Authorization: Bearer <jwt_token>
Idempotency-Key: idem_hold_01HKTM5X8Y9Z

Request:
{
  "amount": 100000,
  "currency": "INR",
  "customer": {
    "vpa": "customer@paytm"
  },
  "merchant": {
    "vpa": "merchant@phonepe"
  },
  "purpose": "escrow",
  "holdDuration": "7d",
  "milestones": [
    {
      "id": "milestone_1",
      "amount": 50000,
      "description": "Delivery confirmation",
      "autoRelease": false
    },
    {
      "id": "milestone_2",
      "amount": 50000,
      "description": "Quality confirmation",
      "autoRelease": true,
      "autoReleaseAfter": "24h"
    }
  ]
}

Response:
{
  "holdId": "hold_01HKTM5X8Y9Z...",
  "status": "active",
  "amount": 100000,
  "currency": "INR",
  "heldAmount": 100000,
  "availableForRelease": 0,
  "milestones": [
    {
      "id": "milestone_1",
      "status": "pending",
      "amount": 50000
    },
    {
      "id": "milestone_2",
      "status": "pending",
      "amount": 50000
    }
  ],
  "createdAt": "2025-01-15T10:30:00.000Z",
  "expiresAt": "2025-01-22T10:30:00.000Z"
}
```

#### Release Hold
```http
POST /api/v1/holds/{holdId}/release
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "milestoneId": "milestone_1",
  "amount": 50000,
  "reason": "milestone_completed",
  "evidence": {
    "deliveryConfirmation": "DEL123456789",
    "customerSignature": "sign_01HKTM5X8Y9Z..."
  }
}

Response:
{
  "releaseId": "rel_01HKTM5X8Y9Z...",
  "status": "released",
  "amount": 50000,
  "holdId": "hold_01HKTM5X8Y9Z...",
  "milestoneId": "milestone_1",
  "releasedAt": "2025-01-15T10:30:00.000Z"
}
```

---

## Multi-User Types & Features

### UPI MAX (Business Tier)

#### Create Business Invoice
```http
POST /api/v1/invoices
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "merchantId": "merch_01HKTM5X8Y9Z...",
  "customerId": "cust_01HKTM5X8Y9Z...",
  "invoice": {
    "number": "INV-2025-001",
    "dueDate": "2025-01-30T23:59:59.000Z",
    "items": [
      {
        "description": "Premium Subscription",
        "quantity": 1,
        "unitPrice": 42372,
        "gst": {
          "rate": 18,
          "amount": 7627
        }
      }
    ],
    "subtotal": 42372,
    "gstTotal": 7627,
    "total": 49999
  },
  "settlement": {
    "window": "T+1",
    "bankAccount": {
      "accountNumber": "1234567890",
      "ifsc": "HDFC0001234"
    }
  }
}

Response:
{
  "invoiceId": "inv_01HKTM5X8Y9Z...",
  "number": "INV-2025-001",
  "status": "pending",
  "paymentUrl": "https://pay.suuupra.com/inv_01HKTM5X8Y9Z...",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "dueDate": "2025-01-30T23:59:59.000Z",
  "total": 49999,
  "gstDetails": {
    "gstin": "29AABCU9603R1ZM",
    "cgst": 3814,
    "sgst": 3814,
    "igst": 0
  }
}
```

### UPI MINI (Minors)

#### Create Guardian Link
```http
POST /api/v1/guardians/link
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "minorCustomerId": "cust_minor_01HKTM5X8Y9Z...",
  "guardianCustomerId": "cust_guardian_01HKTM5X8Y9Z...",
  "permissions": {
    "dailyLimit": 50000,
    "perTransactionLimit": 10000,
    "allowedCategories": ["grocery", "food", "education"],
    "blockedCategories": ["gaming", "adult_content"],
    "geofencing": {
      "enabled": true,
      "radius": 5000,
      "center": {
        "latitude": 28.6139,
        "longitude": 77.2090
      }
    },
    "timeRestrictions": {
      "allowedHours": "06:00-22:00",
      "weekendsOnly": false
    }
  }
}

Response:
{
  "linkId": "link_01HKTM5X8Y9Z...",
  "status": "active",
  "minorCustomer": {
    "id": "cust_minor_01HKTM5X8Y9Z...",
    "name": "Rahul Kumar"
  },
  "guardian": {
    "id": "cust_guardian_01HKTM5X8Y9Z...",
    "name": "Rajesh Kumar"
  },
  "permissions": {
    "dailyLimit": 50000,
    "perTransactionLimit": 10000
  },
  "linkedAt": "2025-01-15T10:30:00.000Z"
}
```

### Delegated Pay

#### Create Delegation
```http
POST /api/v1/delegations
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "delegatorId": "cust_01HKTM5X8Y9Z...",
  "delegateeId": "cust_delegate_01HKTM5X8Y9Z...",
  "type": "partial",
  "limits": {
    "dailyLimit": 100000,
    "perTransactionLimit": 25000,
    "monthlyLimit": 500000
  },
  "restrictions": {
    "allowedMerchants": ["merch_grocery_*", "merch_fuel_*"],
    "allowedCategories": ["grocery", "fuel", "utilities"],
    "geofencing": {
      "enabled": true,
      "radius": 10000
    },
    "requireApproval": {
      "above": 10000,
      "timeout": "5m"
    }
  },
  "expiresAt": "2025-12-31T23:59:59.000Z"
}

Response:
{
  "delegationId": "del_01HKTM5X8Y9Z...",
  "status": "active",
  "type": "partial",
  "delegator": {
    "id": "cust_01HKTM5X8Y9Z...",
    "name": "Company Admin"
  },
  "delegatee": {
    "id": "cust_delegate_01HKTM5X8Y9Z...",
    "name": "Employee"
  },
  "limits": {
    "dailyLimit": 100000,
    "remainingDaily": 100000
  },
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

---

## Routing & Health Management

### Multi-Rail Routing

#### Get Available Routes
```http
GET /api/v1/routing/routes?amount=50000&paymentMethod=upi&priority=cost
Authorization: Bearer <jwt_token>

Response:
{
  "routes": [
    {
      "routeId": "route_upi_hdfc_01",
      "provider": "upi_core",
      "bank": "HDFC",
      "priority": 1,
      "estimatedLatency": "150ms",
      "successRate": 99.8,
      "fees": {
        "processing": 100,
        "platform": 50,
        "total": 150
      },
      "features": ["instant_settlement", "24x7"]
    },
    {
      "routeId": "route_upi_icici_01",
      "provider": "upi_core",
      "bank": "ICICI",
      "priority": 2,
      "estimatedLatency": "180ms",
      "successRate": 99.6,
      "fees": {
        "processing": 120,
        "platform": 50,
        "total": 170
      },
      "features": ["instant_settlement"]
    }
  ],
  "recommendation": "route_upi_hdfc_01",
  "reasoning": "Lowest cost with high success rate"
}
```

### Bank Health Monitoring

#### Get Bank Health
```http
GET /api/v1/health/banks
Authorization: Bearer <jwt_token>

Response:
{
  "banks": [
    {
      "bankCode": "HDFC",
      "status": "healthy",
      "successRate": 99.8,
      "avgLatency": "145ms",
      "lastIncident": null,
      "circuitBreaker": "closed",
      "features": {
        "upi": "available",
        "imps": "available",
        "neft": "available",
        "rtgs": "maintenance"
      }
    },
    {
      "bankCode": "SBI",
      "status": "degraded",
      "successRate": 95.2,
      "avgLatency": "450ms",
      "lastIncident": "2025-01-15T09:15:00.000Z",
      "circuitBreaker": "half_open",
      "features": {
        "upi": "degraded",
        "imps": "unavailable",
        "neft": "available",
        "rtgs": "available"
      }
    }
  ],
  "overall": {
    "status": "healthy",
    "availableRoutes": 8,
    "degradedRoutes": 2
  }
}
```

---

## Settlement & Reconciliation

### Settlement Windows

#### Get Settlement Schedule
```http
GET /api/v1/settlements/schedule?date=2025-01-15
Authorization: Bearer <jwt_token>

Response:
{
  "date": "2025-01-15",
  "windows": [
    {
      "windowId": "stl_window_t0_01",
      "type": "T+0",
      "startTime": "09:00:00",
      "endTime": "17:00:00",
      "status": "active",
      "merchants": 156,
      "totalAmount": 25000000,
      "processedAmount": 18500000,
      "pendingAmount": 6500000,
      "cutoffTime": "16:45:00"
    },
    {
      "windowId": "stl_window_t1_01",
      "type": "T+1",
      "startTime": "18:00:00",
      "endTime": "23:59:59",
      "status": "scheduled",
      "merchants": 89,
      "totalAmount": 12000000,
      "processedAmount": 0,
      "pendingAmount": 12000000,
      "cutoffTime": "23:30:00"
    }
  ]
}
```

### Statement Generation

#### Generate Unified Statement
```http
POST /api/v1/statements/generate
Content-Type: application/json
Authorization: Bearer <jwt_token>

Request:
{
  "merchantId": "merch_01HKTM5X8Y9Z...",
  "startDate": "2025-01-01",
  "endDate": "2025-01-15",
  "format": "pdf",
  "includeGST": true,
  "categories": ["payments", "refunds", "fees", "settlements"]
}

Response:
{
  "statementId": "stmt_01HKTM5X8Y9Z...",
  "status": "generating",
  "estimatedCompletion": "2025-01-15T10:35:00.000Z",
  "downloadUrl": null,
  "format": "pdf",
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-15"
  }
}
```

---

## Webhook Events

### Event Types
- `payment_intent.created`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment.processing`
- `payment.succeeded`
- `payment.failed`
- `refund.created`
- `refund.succeeded`
- `refund.failed`
- `settlement.initiated`
- `settlement.completed`
- `fraud.detected`
- `device.linked`
- `delegation.used`

### Webhook Payload Example
```json
{
  "id": "evt_01HKTM5X8Y9Z...",
  "type": "payment.succeeded",
  "data": {
    "object": {
      "id": "pay_01HKTM5X8Y9Z...",
      "amount": 50000,
      "currency": "INR",
      "status": "succeeded",
      "paymentMethod": "upi",
      "customer": {
        "id": "cust_01HKTM5X8Y9Z..."
      },
      "merchant": {
        "id": "merch_01HKTM5X8Y9Z..."
      }
    }
  },
  "created": 1705320600,
  "livemode": true
}
```

---

## Error Codes & Handling

### Payment Errors
- **PAY_001**: Invalid payment method
- **PAY_002**: Insufficient funds
- **PAY_003**: Payment declined by bank
- **PAY_004**: Transaction limit exceeded
- **PAY_005**: Invalid authentication
- **PAY_006**: Fraud detected
- **PAY_007**: Merchant not found
- **PAY_008**: Currency not supported

### Risk & Security Errors
- **RSK_001**: High risk transaction blocked
- **RSK_002**: Device not trusted
- **RSK_003**: Suspicious activity detected
- **RSK_004**: Geographic restriction
- **RSK_005**: Velocity limit exceeded

### System Errors
- **SYS_001**: Internal server error
- **SYS_002**: Service temporarily unavailable
- **SYS_003**: Rate limit exceeded
- **SYS_004**: Invalid API key
- **SYS_005**: Webhook delivery failed

---

## Security & Compliance

### Encryption & Tokenization
- **Field-level encryption** for sensitive data
- **Tokenization** of payment methods and VPAs
- **HSM integration** for key management
- **PCI DSS Level 1** compliance

### Fraud Detection
- **Real-time risk scoring** with ML models
- **Device fingerprinting** and behavioral analysis
- **Velocity checks** and pattern recognition
- **Blacklist/whitelist** management

### Audit & Compliance
- **Immutable audit logs** for all transactions
- **GDPR compliance** with data minimization
- **RBI guidelines** adherence
- **SOX compliance** for financial reporting

---

## Performance & Monitoring

### SLA Targets
- **Availability**: 99.99% uptime
- **Success Rate**: ≥99.9% p50, ≥99.5% p95
- **Latency**: p50 ≤300ms, p95 ≤800ms
- **Throughput**: 10,000+ TPS

### Monitoring Endpoints
```http
GET /metrics              # Prometheus metrics
GET /health               # Health check
GET /admin/dashboard      # Admin monitoring dashboard
```

---

*This API documentation represents a comprehensive, production-grade payment gateway designed for billion-user scale with enterprise reliability and security standards.*