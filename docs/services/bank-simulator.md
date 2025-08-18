# Bank Simulator Service

## Overview

Production-ready mock banking backend providing comprehensive banking operations simulation with ACID-compliant transactions, supporting both REST APIs and gRPC services for UPI ecosystem testing.

## Quick Start

```bash
cd services/bank-simulator
npm install
npx prisma migrate dev
npm run dev

# Health check
curl localhost:8080/health
```

## Core Features

### Banking Operations
- Account creation and management
- Balance inquiries and updates
- Transaction processing (DEBIT/CREDIT)
- VPA mapping and resolution

### Multi-Bank Support
- 5 major Indian banks simulation (HDFC, SBI, ICICI, AXIS, KOTAK)
- Realistic processing characteristics per bank
- Bank-specific limits and features
- Configurable failure rates and latencies

### Compliance & Security
- ACID transaction guarantees
- Audit logging for all operations
- Data encryption and PII masking
- RBI guidelines compliance

## Supported Banks

| Bank | Code | IFSC Prefix | Daily Limit | Processing Delay | Failure Rate |
|------|------|-------------|-------------|------------------|--------------|
| HDFC Bank | HDFC | HDFC | ₹1 Crore | 50ms | 0.5% |
| State Bank of India | SBI | SBIN | ₹75 Lakhs | 80ms | 0.3% |
| ICICI Bank | ICICI | ICIC | ₹1 Crore | 60ms | 0.4% |
| Axis Bank | AXIS | UTIB | ₹50 Lakhs | 70ms | 0.7% |
| Kotak Mahindra Bank | KOTAK | KKBK | ₹25 Lakhs | 65ms | 0.8% |

## REST API Endpoints

### Health & Status
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health check |
| GET | `/ready` | Readiness check |
| GET | `/live` | Liveness check |

### Banks API
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/banks` | List all banks |
| GET | `/api/banks/{bankCode}` | Get bank details |
| GET | `/api/banks/{bankCode}/health` | Get bank health status |

### Account Management
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/accounts` | Create new account |
| GET | `/api/accounts/{bankCode}/{accountNumber}` | Get account details |
| GET | `/api/accounts/{bankCode}/{accountNumber}/balance` | Get account balance |
| PUT | `/api/accounts/{bankCode}/{accountNumber}/status` | Update account status |

### Transaction Processing
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/real-transactions/process` | Process transaction |
| GET | `/api/real-transactions/{transactionId}` | Get transaction status |
| POST | `/api/real-transactions/{transactionId}/reverse` | Reverse transaction |

### VPA Management
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/vpa/link` | Link VPA to account |
| POST | `/api/vpa/resolve` | Resolve VPA to account |
| DELETE | `/api/vpa/{vpa}` | Unlink VPA |
| GET | `/api/accounts/{bankCode}/{accountNumber}/vpas` | List account VPAs |

### Admin Operations
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/status` | System status |
| GET | `/api/admin/stats` | Transaction statistics |
| POST | `/api/admin/reset` | Reset test data |

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
  
  // VPA management
  rpc LinkVPA(LinkVPARequest) returns (LinkVPAResponse);
  rpc ResolveVPA(ResolveVPARequest) returns (ResolveVPAResponse);
  rpc ListAccountVPAs(ListAccountVPAsRequest) returns (ListAccountVPAsResponse);
  
  // Bank operations
  rpc GetBankInfo(BankInfoRequest) returns (BankInfoResponse);
  rpc CheckBankHealth(BankHealthRequest) returns (BankHealthResponse);
}
```

## Data Models

### Account
```typescript
interface Account {
  id: string;
  accountNumber: string;
  bankId: string;
  ifscCode: string;
  customerId: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'FIXED_DEPOSIT';
  accountHolderName: string;
  mobileNumber: string;
  email: string;
  balancePaisa: number;
  availableBalancePaisa: number;
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'CLOSED';
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  dailyLimitPaisa: number;
  panNumber: string;
  aadhaarMasked: string;
  createdAt: Date;
}
```

### Transaction
```typescript
interface Transaction {
  id: string;
  transactionId: string;
  bankReferenceId: string;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amountPaisa: number;
  balanceBeforePaisa: number;
  balanceAfterPaisa: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  reference: string;
  description: string;
  metadata: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
}
```

### VPA Mapping
```typescript
interface VPAMapping {
  id: string;
  vpa: string;
  accountId: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Database Schema

```sql
-- Banks
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_code VARCHAR(10) UNIQUE NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    ifsc_prefix VARCHAR(4) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    daily_limit_paisa BIGINT DEFAULT 10000000000,
    min_balance_paisa BIGINT DEFAULT 1000000,
    features TEXT[] DEFAULT ARRAY['UPI', 'IMPS', 'NEFT', 'RTGS'],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts
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
    daily_limit_paisa BIGINT DEFAULT 2500000,
    pan_number VARCHAR(10),
    aadhaar_masked VARCHAR(12),
    date_of_birth DATE,
    address JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    bank_reference_id VARCHAR(50) UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts(id),
    type VARCHAR(10) NOT NULL,
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

-- VPA Mappings
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

## Transaction Processing

### Process Transaction Flow
```typescript
async function processTransaction(request: TransactionRequest): Promise<TransactionResponse> {
  const account = await getAccount(request.bankCode, request.accountNumber);
  
  // Validate account status
  if (account.status !== 'ACTIVE') {
    throw new Error('Account inactive');
  }
  
  // Check daily limits
  const dailyUsage = await getDailyUsage(account.id);
  if (dailyUsage + request.amountPaisa > account.dailyLimitPaisa) {
    throw new Error('Daily limit exceeded');
  }
  
  // Simulate bank processing delay
  await simulateProcessingDelay(request.bankCode);
  
  // Simulate failure rate
  if (shouldSimulateFailure(request.bankCode)) {
    throw new Error('Bank processing failed');
  }
  
  // Process transaction atomically
  return await db.transaction(async (tx) => {
    const newBalance = account.balancePaisa + 
      (request.type === 'CREDIT' ? request.amountPaisa : -request.amountPaisa);
    
    // Update account balance
    await tx.account.update({
      where: { id: account.id },
      data: { 
        balancePaisa: newBalance,
        availableBalancePaisa: newBalance,
        updatedAt: new Date()
      }
    });
    
    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        transactionId: request.transactionId,
        bankReferenceId: generateBankReferenceId(),
        accountId: account.id,
        type: request.type,
        amountPaisa: request.amountPaisa,
        balanceBeforePaisa: account.balancePaisa,
        balanceAfterPaisa: newBalance,
        status: 'SUCCESS',
        reference: request.reference,
        description: request.description,
        processedAt: new Date()
      }
    });
    
    return {
      success: true,
      transactionId: transaction.transactionId,
      bankReferenceId: transaction.bankReferenceId,
      status: 'SUCCESS',
      processedAt: transaction.processedAt
    };
  });
}
```

### Bank Simulation Logic
```typescript
class BankSimulator {
  private bankConfigs: Map<string, BankConfig> = new Map();
  
  constructor() {
    this.initializeBankConfigs();
  }
  
  async simulateProcessingDelay(bankCode: string): Promise<void> {
    const config = this.bankConfigs.get(bankCode);
    if (!config) return;
    
    // Add jitter to make it more realistic
    const delay = config.avgDelayMs + (Math.random() - 0.5) * 20;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  shouldSimulateFailure(bankCode: string): boolean {
    const config = this.bankConfigs.get(bankCode);
    if (!config) return false;
    
    return Math.random() < (config.failureRatePercent / 100);
  }
  
  private initializeBankConfigs(): void {
    this.bankConfigs.set('HDFC', {
      avgDelayMs: 50,
      failureRatePercent: 0.5,
      dailyLimitPaisa: 10000000000,
      features: ['UPI', 'IMPS', 'NEFT', 'RTGS']
    });
    
    this.bankConfigs.set('SBI', {
      avgDelayMs: 80,
      failureRatePercent: 0.3,
      dailyLimitPaisa: 7500000000,
      features: ['UPI', 'IMPS', 'NEFT', 'RTGS']
    });
    
    // ... other banks
  }
}
```

## VPA Management

### VPA Resolution
```typescript
async function resolveVPA(vpa: string): Promise<VPAResolutionResponse> {
  const mapping = await db.vpaMapping.findFirst({
    where: { 
      vpa: vpa,
      isActive: true
    },
    include: {
      account: {
        include: {
          bank: true
        }
      }
    }
  });
  
  if (!mapping) {
    return {
      exists: false,
      errorCode: 'VPA_001',
      errorMessage: 'VPA not found'
    };
  }
  
  if (mapping.account.status !== 'ACTIVE') {
    return {
      exists: false,
      errorCode: 'ACC_002',
      errorMessage: 'Account inactive'
    };
  }
  
  return {
    exists: true,
    bankCode: mapping.account.bank.bankCode,
    accountNumber: maskAccountNumber(mapping.account.accountNumber),
    accountHolderName: mapping.account.accountHolderName,
    isActive: mapping.isActive,
    isPrimary: mapping.isPrimary
  };
}
```

### VPA Linking
```typescript
async function linkVPA(request: LinkVPARequest): Promise<LinkVPAResponse> {
  // Validate VPA format
  if (!isValidVPAFormat(request.vpa)) {
    throw new Error('Invalid VPA format');
  }
  
  // Check if VPA already exists
  const existing = await db.vpaMapping.findUnique({
    where: { vpa: request.vpa }
  });
  
  if (existing) {
    throw new Error('VPA already linked');
  }
  
  // Verify account exists and is active
  const account = await db.account.findFirst({
    where: {
      accountNumber: request.accountNumber,
      bank: { bankCode: request.bankCode },
      status: 'ACTIVE'
    }
  });
  
  if (!account) {
    throw new Error('Account not found or inactive');
  }
  
  // Create VPA mapping
  const mapping = await db.vpaMapping.create({
    data: {
      vpa: request.vpa,
      accountId: account.id,
      isPrimary: request.isPrimary,
      isActive: true
    }
  });
  
  return {
    success: true,
    vpaId: mapping.id,
    linkedAt: mapping.createdAt
  };
}
```

## Configuration

### Service Configuration
```yaml
server:
  http_port: 8080
  grpc_port: 50051
  timeout: 30s

database:
  postgresql:
    url: "postgresql://banksim:password@localhost:5432/banksim"
    max_connections: 10

simulation:
  enable_failures: true
  enable_delays: true
  realistic_mode: true

banks:
  hdfc:
    avg_delay_ms: 50
    failure_rate_percent: 0.5
    daily_limit_paisa: 10000000000
  
  sbi:
    avg_delay_ms: 80
    failure_rate_percent: 0.3
    daily_limit_paisa: 7500000000
```

### Test Data Configuration
```yaml
test_data:
  accounts_per_bank: 10
  initial_balance_paisa: 100000000  # ₹10 lakh
  vpa_mappings_per_account: 2
  
seed_accounts:
  - bank_code: "HDFC"
    account_number: "50100123456789"
    account_holder_name: "Test User 1"
    mobile_number: "+919876543210"
    balance_paisa: 500000000
    
  - bank_code: "SBI"
    account_number: "30001234567890"
    account_holder_name: "Test User 2"
    mobile_number: "+919876543211"
    balance_paisa: 1000000000
```

## Monitoring

### Key Metrics
- `banksim_transactions_total` - Transaction counter by bank/status
- `banksim_transaction_duration_seconds` - Processing latency
- `banksim_account_operations_total` - Account operation counter
- `banksim_vpa_resolutions_total` - VPA resolution attempts
- `banksim_bank_health_score` - Simulated bank health

### Health Endpoints
```typescript
// Health check with database connectivity
app.get('/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: { status: 'connected' }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: { status: 'disconnected', error: error.message }
    });
  }
});
```

## Error Codes

### Account Errors
- **ACC_001**: Account not found
- **ACC_002**: Account inactive or suspended
- **ACC_003**: Account frozen by bank
- **ACC_004**: Invalid account number format
- **ACC_005**: KYC verification pending

### Transaction Errors
- **TXN_001**: Insufficient account balance
- **TXN_002**: Daily transaction limit exceeded
- **TXN_003**: Transaction amount exceeds limit
- **TXN_004**: Duplicate transaction ID
- **TXN_005**: Invalid transaction type

### VPA Errors
- **VPA_001**: VPA not found or inactive
- **VPA_002**: VPA already linked to another account
- **VPA_003**: Invalid VPA format
- **VPA_004**: Maximum VPA limit reached

## Development

### Local Setup
```bash
# Prerequisites
node >= 18
postgresql >= 15

# Install dependencies
npm install

# Setup database
npx prisma migrate dev
npx prisma generate

# Seed test data
npm run seed

# Start service
npm run dev
```

### Testing
```bash
npm test                     # Unit tests
npm run test:integration     # Integration tests
npm run test:load           # Load tests
npm run test:banks          # Bank simulation tests
```

### Docker Deployment
```bash
# Build and run
docker-compose up -d bank-simulator

# Health check
curl http://localhost:8080/health
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Database connection failed | PostgreSQL not running | Start PostgreSQL service |
| Transaction timeout | Simulated bank delay | Check bank simulation config |
| VPA resolution failed | Invalid VPA or mapping | Verify VPA exists and is active |
| Account creation failed | Duplicate account number | Use unique account numbers |
