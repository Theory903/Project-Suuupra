// Bank configuration constants
export interface BankConfig {
  code: string;
  name: string;
  ifscPrefix: string;
  dailyLimitPaisa: number;
  minBalancePaisa: number;
  features: string[];
  processingDelayMs: number;
  failureRate: number;
}

export const SUPPORTED_BANKS: Record<string, BankConfig> = {
  HDFC: {
    code: 'HDFC',
    name: 'HDFC Bank',
    ifscPrefix: 'HDFC',
    dailyLimitPaisa: 10000000, // 1 lakh
    minBalancePaisa: 1000000,  // 10k
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS'],
    processingDelayMs: 50,
    failureRate: 0.005, // 0.5%
  },
  SBI: {
    code: 'SBI',
    name: 'State Bank of India',
    ifscPrefix: 'SBIN',
    dailyLimitPaisa: 10000000,
    minBalancePaisa: 300000,   // 3k
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS'],
    processingDelayMs: 80,
    failureRate: 0.008, // 0.8%
  },
  ICICI: {
    code: 'ICICI',
    name: 'ICICI Bank',
    ifscPrefix: 'ICIC',
    dailyLimitPaisa: 20000000, // 2 lakh
    minBalancePaisa: 1000000,
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS'],
    processingDelayMs: 45,
    failureRate: 0.003, // 0.3%
  },
  AXIS: {
    code: 'AXIS',
    name: 'Axis Bank',
    ifscPrefix: 'UTIB',
    dailyLimitPaisa: 10000000,
    minBalancePaisa: 1000000,
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS'],
    processingDelayMs: 60,
    failureRate: 0.007, // 0.7%
  },
  KOTAK: {
    code: 'KOTAK',
    name: 'Kotak Mahindra Bank',
    ifscPrefix: 'KKBK',
    dailyLimitPaisa: 10000000,
    minBalancePaisa: 1000000,
    features: ['UPI', 'IMPS', 'NEFT', 'RTGS'],
    processingDelayMs: 55,
    failureRate: 0.006, // 0.6%
  }
};

// Error codes for banking operations
export const ERROR_CODES = {
  // Account related
  ACCOUNT_NOT_FOUND: 'ACC_001',
  ACCOUNT_INACTIVE: 'ACC_002',
  ACCOUNT_FROZEN: 'ACC_003',
  ACCOUNT_CLOSED: 'ACC_004',
  INVALID_ACCOUNT_TYPE: 'ACC_005',
  
  // Transaction related
  INSUFFICIENT_FUNDS: 'TXN_001',
  DAILY_LIMIT_EXCEEDED: 'TXN_002',
  INVALID_AMOUNT: 'TXN_003',
  DUPLICATE_TRANSACTION: 'TXN_004',
  TRANSACTION_TIMEOUT: 'TXN_005',
  TRANSACTION_DECLINED: 'TXN_006',
  
  // VPA related
  VPA_NOT_FOUND: 'VPA_001',
  VPA_INACTIVE: 'VPA_002',
  VPA_ALREADY_EXISTS: 'VPA_003',
  INVALID_VPA_FORMAT: 'VPA_004',
  
  // Bank related
  BANK_NOT_FOUND: 'BNK_001',
  BANK_UNAVAILABLE: 'BNK_002',
  BANK_MAINTENANCE: 'BNK_003',
  
  // System related
  SYSTEM_ERROR: 'SYS_001',
  NETWORK_ERROR: 'SYS_002',
  DATABASE_ERROR: 'SYS_003',
  VALIDATION_ERROR: 'SYS_004',
  RATE_LIMIT_EXCEEDED: 'SYS_005',
  
  // Security related
  UNAUTHORIZED: 'SEC_001',
  FORBIDDEN: 'SEC_002',
  FRAUD_DETECTED: 'SEC_003',
  KYC_PENDING: 'SEC_004',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Transaction types
export const TRANSACTION_TYPES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

// Transaction statuses
export const TRANSACTION_STATUSES = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  ACCOUNT_FROZEN: 'ACCOUNT_FROZEN',
  INVALID_ACCOUNT: 'INVALID_ACCOUNT',
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUSES[keyof typeof TRANSACTION_STATUSES];

// Account types
export const ACCOUNT_TYPES = {
  SAVINGS: 'SAVINGS',
  CURRENT: 'CURRENT',
  OVERDRAFT: 'OVERDRAFT',
} as const;

export type AccountType = typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES];

// Account statuses
export const ACCOUNT_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
  KYC_PENDING: 'KYC_PENDING',
} as const;

export type AccountStatus = typeof ACCOUNT_STATUSES[keyof typeof ACCOUNT_STATUSES];
