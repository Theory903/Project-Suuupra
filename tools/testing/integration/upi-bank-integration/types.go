package main

import (
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Bank Simulator Types
type TransactionType int32

const (
	TransactionType_TRANSACTION_TYPE_UNSPECIFIED TransactionType = 0
	TransactionType_TRANSACTION_TYPE_DEBIT       TransactionType = 1
	TransactionType_TRANSACTION_TYPE_CREDIT      TransactionType = 2
)

type TransactionStatus int32

const (
	TransactionStatus_TRANSACTION_STATUS_UNSPECIFIED        TransactionStatus = 0
	TransactionStatus_TRANSACTION_STATUS_PENDING            TransactionStatus = 1
	TransactionStatus_TRANSACTION_STATUS_SUCCESS            TransactionStatus = 2
	TransactionStatus_TRANSACTION_STATUS_FAILED             TransactionStatus = 3
	TransactionStatus_TRANSACTION_STATUS_TIMEOUT            TransactionStatus = 4
	TransactionStatus_TRANSACTION_STATUS_INSUFFICIENT_FUNDS TransactionStatus = 5
	TransactionStatus_TRANSACTION_STATUS_LIMIT_EXCEEDED     TransactionStatus = 6
	TransactionStatus_TRANSACTION_STATUS_ACCOUNT_FROZEN     TransactionStatus = 7
	TransactionStatus_TRANSACTION_STATUS_INVALID_ACCOUNT    TransactionStatus = 8
	TransactionStatus_TRANSACTION_STATUS_CANCELLED          TransactionStatus = 9
	TransactionStatus_TRANSACTION_STATUS_REVERSED           TransactionStatus = 10
)

type AccountType int32

const (
	AccountType_ACCOUNT_TYPE_UNSPECIFIED AccountType = 0
	AccountType_ACCOUNT_TYPE_SAVINGS     AccountType = 1
	AccountType_ACCOUNT_TYPE_CURRENT     AccountType = 2
	AccountType_ACCOUNT_TYPE_OVERDRAFT   AccountType = 3
)

type AccountStatus int32

const (
	AccountStatus_ACCOUNT_STATUS_UNSPECIFIED AccountStatus = 0
	AccountStatus_ACCOUNT_STATUS_ACTIVE      AccountStatus = 1
	AccountStatus_ACCOUNT_STATUS_INACTIVE    AccountStatus = 2
	AccountStatus_ACCOUNT_STATUS_FROZEN      AccountStatus = 3
	AccountStatus_ACCOUNT_STATUS_CLOSED      AccountStatus = 4
	AccountStatus_ACCOUNT_STATUS_KYC_PENDING AccountStatus = 5
)

type HealthStatus int32

const (
	HealthStatus_HEALTH_STATUS_UNSPECIFIED  HealthStatus = 0
	HealthStatus_HEALTH_STATUS_HEALTHY      HealthStatus = 1
	HealthStatus_HEALTH_STATUS_DEGRADED     HealthStatus = 2
	HealthStatus_HEALTH_STATUS_UNHEALTHY    HealthStatus = 3
	HealthStatus_HEALTH_STATUS_MAINTENANCE  HealthStatus = 4
	HealthStatus_HEALTH_STATUS_SERVING      HealthStatus = 5
	HealthStatus_HEALTH_STATUS_NOT_SERVING  HealthStatus = 6
	HealthStatus_HEALTH_STATUS_UNKNOWN      HealthStatus = 7
)

type BankStatus int32

const (
	BankStatus_BANK_STATUS_UNSPECIFIED BankStatus = 0
	BankStatus_BANK_STATUS_ACTIVE      BankStatus = 1
	BankStatus_BANK_STATUS_INACTIVE    BankStatus = 2
	BankStatus_BANK_STATUS_MAINTENANCE BankStatus = 3
	BankStatus_BANK_STATUS_SUSPENDED   BankStatus = 4
)

type SettlementStatus int32

const (
	SettlementStatus_SETTLEMENT_STATUS_UNSPECIFIED SettlementStatus = 0
	SettlementStatus_SETTLEMENT_STATUS_PENDING     SettlementStatus = 1
	SettlementStatus_SETTLEMENT_STATUS_PROCESSING  SettlementStatus = 2
	SettlementStatus_SETTLEMENT_STATUS_COMPLETED   SettlementStatus = 3
	SettlementStatus_SETTLEMENT_STATUS_FAILED      SettlementStatus = 4
)

// Message types for Bank Simulator
type TransactionRequest struct {
	TransactionId   string                 `protobuf:"bytes,1,opt,name=transaction_id,json=transactionId,proto3" json:"transaction_id,omitempty"`
	BankCode        string                 `protobuf:"bytes,2,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	AccountNumber   string                 `protobuf:"bytes,3,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
	AmountPaisa     int64                  `protobuf:"varint,4,opt,name=amount_paisa,json=amountPaisa,proto3" json:"amount_paisa,omitempty"`
	Type            TransactionType        `protobuf:"varint,5,opt,name=type,proto3,enum=TransactionType" json:"type,omitempty"`
	Reference       string                 `protobuf:"bytes,6,opt,name=reference,proto3" json:"reference,omitempty"`
	Description     string                 `protobuf:"bytes,7,opt,name=description,proto3" json:"description,omitempty"`
	Metadata        map[string]string      `protobuf:"bytes,8,rep,name=metadata,proto3" json:"metadata,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	InitiatedAt     *timestamppb.Timestamp `protobuf:"bytes,9,opt,name=initiated_at,json=initiatedAt,proto3" json:"initiated_at,omitempty"`
	// UPI Core specific fields
	Rrn         string `protobuf:"bytes,10,opt,name=rrn,proto3" json:"rrn,omitempty"`
	PayerVpa    string `protobuf:"bytes,11,opt,name=payer_vpa,json=payerVpa,proto3" json:"payer_vpa,omitempty"`
	PayeeVpa    string `protobuf:"bytes,12,opt,name=payee_vpa,json=payeeVpa,proto3" json:"payee_vpa,omitempty"`
	Currency    string `protobuf:"bytes,13,opt,name=currency,proto3" json:"currency,omitempty"`
	Signature   string `protobuf:"bytes,14,opt,name=signature,proto3" json:"signature,omitempty"`
}

type TransactionResponse struct {
	TransactionId       string                 `protobuf:"bytes,1,opt,name=transaction_id,json=transactionId,proto3" json:"transaction_id,omitempty"`
	Status              TransactionStatus      `protobuf:"varint,2,opt,name=status,proto3,enum=TransactionStatus" json:"status,omitempty"`
	BankReferenceId     string                 `protobuf:"bytes,3,opt,name=bank_reference_id,json=bankReferenceId,proto3" json:"bank_reference_id,omitempty"`
	ErrorCode           string                 `protobuf:"bytes,4,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage        string                 `protobuf:"bytes,5,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	AccountBalancePaisa int64                  `protobuf:"varint,6,opt,name=account_balance_paisa,json=accountBalancePaisa,proto3" json:"account_balance_paisa,omitempty"`
	ProcessedAt         *timestamppb.Timestamp `protobuf:"bytes,7,opt,name=processed_at,json=processedAt,proto3" json:"processed_at,omitempty"`
	Fees                *TransactionFees       `protobuf:"bytes,8,opt,name=fees,proto3" json:"fees,omitempty"`
	// UPI Core specific fields
	Rrn           string `protobuf:"bytes,9,opt,name=rrn,proto3" json:"rrn,omitempty"`
	PayerBankCode string `protobuf:"bytes,10,opt,name=payer_bank_code,json=payerBankCode,proto3" json:"payer_bank_code,omitempty"`
	PayeeBankCode string `protobuf:"bytes,11,opt,name=payee_bank_code,json=payeeBankCode,proto3" json:"payee_bank_code,omitempty"`
	SettlementId  string `protobuf:"bytes,12,opt,name=settlement_id,json=settlementId,proto3" json:"settlement_id,omitempty"`
}

type TransactionStatusRequest struct {
	TransactionId string `protobuf:"bytes,1,opt,name=transaction_id,json=transactionId,proto3" json:"transaction_id,omitempty"`
	BankCode      string `protobuf:"bytes,2,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	Rrn           string `protobuf:"bytes,3,opt,name=rrn,proto3" json:"rrn,omitempty"`
}

type TransactionStatusResponse struct {
	TransactionId   string                  `protobuf:"bytes,1,opt,name=transaction_id,json=transactionId,proto3" json:"transaction_id,omitempty"`
	Status          TransactionStatus       `protobuf:"varint,2,opt,name=status,proto3,enum=TransactionStatus" json:"status,omitempty"`
	BankReferenceId string                  `protobuf:"bytes,3,opt,name=bank_reference_id,json=bankReferenceId,proto3" json:"bank_reference_id,omitempty"`
	AmountPaisa     int64                   `protobuf:"varint,4,opt,name=amount_paisa,json=amountPaisa,proto3" json:"amount_paisa,omitempty"`
	InitiatedAt     *timestamppb.Timestamp  `protobuf:"bytes,5,opt,name=initiated_at,json=initiatedAt,proto3" json:"initiated_at,omitempty"`
	ProcessedAt     *timestamppb.Timestamp  `protobuf:"bytes,6,opt,name=processed_at,json=processedAt,proto3" json:"processed_at,omitempty"`
	ErrorCode       string                  `protobuf:"bytes,7,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage    string                  `protobuf:"bytes,8,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	// UPI Core specific fields
	Rrn           string              `protobuf:"bytes,9,opt,name=rrn,proto3" json:"rrn,omitempty"`
	PayerVpa      string              `protobuf:"bytes,10,opt,name=payer_vpa,json=payerVpa,proto3" json:"payer_vpa,omitempty"`
	PayeeVpa      string              `protobuf:"bytes,11,opt,name=payee_vpa,json=payeeVpa,proto3" json:"payee_vpa,omitempty"`
	PayerBankCode string              `protobuf:"bytes,12,opt,name=payer_bank_code,json=payerBankCode,proto3" json:"payer_bank_code,omitempty"`
	PayeeBankCode string              `protobuf:"bytes,13,opt,name=payee_bank_code,json=payeeBankCode,proto3" json:"payee_bank_code,omitempty"`
	Events        []*TransactionEvent `protobuf:"bytes,14,rep,name=events,proto3" json:"events,omitempty"`
}

type CreateAccountRequest struct {
	BankCode            string       `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	CustomerId          string       `protobuf:"bytes,2,opt,name=customer_id,json=customerId,proto3" json:"customer_id,omitempty"`
	AccountType         AccountType  `protobuf:"varint,3,opt,name=account_type,json=accountType,proto3,enum=AccountType" json:"account_type,omitempty"`
	MobileNumber        string       `protobuf:"bytes,4,opt,name=mobile_number,json=mobileNumber,proto3" json:"mobile_number,omitempty"`
	Email               string       `protobuf:"bytes,5,opt,name=email,proto3" json:"email,omitempty"`
	KycDetails          *CustomerKYC `protobuf:"bytes,6,opt,name=kyc_details,json=kycDetails,proto3" json:"kyc_details,omitempty"`
	InitialDepositPaisa int64        `protobuf:"varint,7,opt,name=initial_deposit_paisa,json=initialDepositPaisa,proto3" json:"initial_deposit_paisa,omitempty"`
}

type CreateAccountResponse struct {
	AccountNumber string        `protobuf:"bytes,1,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
	IfscCode      string        `protobuf:"bytes,2,opt,name=ifsc_code,json=ifscCode,proto3" json:"ifsc_code,omitempty"`
	Status        AccountStatus `protobuf:"varint,3,opt,name=status,proto3,enum=AccountStatus" json:"status,omitempty"`
	ErrorCode     string        `protobuf:"bytes,4,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage  string        `protobuf:"bytes,5,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
}

type AccountBalanceRequest struct {
	BankCode      string `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	AccountNumber string `protobuf:"bytes,2,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
}

type AccountBalanceResponse struct {
	AccountNumber            string                 `protobuf:"bytes,1,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
	AvailableBalancePaisa    int64                  `protobuf:"varint,2,opt,name=available_balance_paisa,json=availableBalancePaisa,proto3" json:"available_balance_paisa,omitempty"`
	LedgerBalancePaisa       int64                  `protobuf:"varint,3,opt,name=ledger_balance_paisa,json=ledgerBalancePaisa,proto3" json:"ledger_balance_paisa,omitempty"`
	DailyLimitRemainingPaisa int64                  `protobuf:"varint,4,opt,name=daily_limit_remaining_paisa,json=dailyLimitRemainingPaisa,proto3" json:"daily_limit_remaining_paisa,omitempty"`
	LastUpdated              *timestamppb.Timestamp `protobuf:"bytes,5,opt,name=last_updated,json=lastUpdated,proto3" json:"last_updated,omitempty"`
}

type AccountDetailsRequest struct {
	BankCode      string `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	AccountNumber string `protobuf:"bytes,2,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
}

type AccountDetailsResponse struct {
	AccountNumber         string                 `protobuf:"bytes,1,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
	IfscCode              string                 `protobuf:"bytes,2,opt,name=ifsc_code,json=ifscCode,proto3" json:"ifsc_code,omitempty"`
	AccountHolderName     string                 `protobuf:"bytes,3,opt,name=account_holder_name,json=accountHolderName,proto3" json:"account_holder_name,omitempty"`
	AccountType           AccountType            `protobuf:"varint,4,opt,name=account_type,json=accountType,proto3,enum=AccountType" json:"account_type,omitempty"`
	Status                AccountStatus          `protobuf:"varint,5,opt,name=status,proto3,enum=AccountStatus" json:"status,omitempty"`
	MobileNumber          string                 `protobuf:"bytes,6,opt,name=mobile_number,json=mobileNumber,proto3" json:"mobile_number,omitempty"`
	Email                 string                 `protobuf:"bytes,7,opt,name=email,proto3" json:"email,omitempty"`
	AvailableBalancePaisa int64                  `protobuf:"varint,8,opt,name=available_balance_paisa,json=availableBalancePaisa,proto3" json:"available_balance_paisa,omitempty"`
	DailyLimitPaisa       int64                  `protobuf:"varint,9,opt,name=daily_limit_paisa,json=dailyLimitPaisa,proto3" json:"daily_limit_paisa,omitempty"`
	CreatedAt             *timestamppb.Timestamp `protobuf:"bytes,10,opt,name=created_at,json=createdAt,proto3" json:"created_at,omitempty"`
	ErrorCode             string                 `protobuf:"bytes,11,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage          string                 `protobuf:"bytes,12,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
}

type LinkVPARequest struct {
	Vpa           string `protobuf:"bytes,1,opt,name=vpa,proto3" json:"vpa,omitempty"`
	BankCode      string `protobuf:"bytes,2,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	AccountNumber string `protobuf:"bytes,3,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
	IsPrimary     bool   `protobuf:"varint,4,opt,name=is_primary,json=isPrimary,proto3" json:"is_primary,omitempty"`
}

type LinkVPAResponse struct {
	Success      bool   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ErrorCode    string `protobuf:"bytes,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string `protobuf:"bytes,3,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
}

type UnlinkVPARequest struct {
	Vpa      string `protobuf:"bytes,1,opt,name=vpa,proto3" json:"vpa,omitempty"`
	BankCode string `protobuf:"bytes,2,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
}

type UnlinkVPAResponse struct {
	Success      bool   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ErrorCode    string `protobuf:"bytes,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string `protobuf:"bytes,3,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
}

type ResolveVPARequest struct {
	Vpa string `protobuf:"bytes,1,opt,name=vpa,proto3" json:"vpa,omitempty"`
}

type ResolveVPAResponse struct {
	Exists            bool   `protobuf:"varint,1,opt,name=exists,proto3" json:"exists,omitempty"`
	BankCode          string `protobuf:"bytes,2,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	AccountNumber     string `protobuf:"bytes,3,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
	AccountHolderName string `protobuf:"bytes,4,opt,name=account_holder_name,json=accountHolderName,proto3" json:"account_holder_name,omitempty"`
	IsActive          bool   `protobuf:"varint,5,opt,name=is_active,json=isActive,proto3" json:"is_active,omitempty"`
	ErrorCode         string `protobuf:"bytes,6,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage      string `protobuf:"bytes,7,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
}

type BankInfoRequest struct {
	BankCode string `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
}

type BankInfoResponse struct {
	BankCode        string   `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	BankName        string   `protobuf:"bytes,2,opt,name=bank_name,json=bankName,proto3" json:"bank_name,omitempty"`
	IfscPrefix      string   `protobuf:"bytes,3,opt,name=ifsc_prefix,json=ifscPrefix,proto3" json:"ifsc_prefix,omitempty"`
	IsActive        bool     `protobuf:"varint,4,opt,name=is_active,json=isActive,proto3" json:"is_active,omitempty"`
	Features        []string `protobuf:"bytes,5,rep,name=features,proto3" json:"features,omitempty"`
	DailyLimitPaisa int64    `protobuf:"varint,6,opt,name=daily_limit_paisa,json=dailyLimitPaisa,proto3" json:"daily_limit_paisa,omitempty"`
	MinBalancePaisa int64    `protobuf:"varint,7,opt,name=min_balance_paisa,json=minBalancePaisa,proto3" json:"min_balance_paisa,omitempty"`
}

type BankHealthRequest struct {
	BankCode string `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
}

type BankHealthResponse struct {
	BankCode            string                 `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	HealthStatus        HealthStatus           `protobuf:"varint,2,opt,name=health_status,json=healthStatus,proto3,enum=HealthStatus" json:"health_status,omitempty"`
	SuccessRatePercent  int32                  `protobuf:"varint,3,opt,name=success_rate_percent,json=successRatePercent,proto3" json:"success_rate_percent,omitempty"`
	AvgResponseTimeMs   int32                  `protobuf:"varint,4,opt,name=avg_response_time_ms,json=avgResponseTimeMs,proto3" json:"avg_response_time_ms,omitempty"`
	TotalAccounts       int64                  `protobuf:"varint,5,opt,name=total_accounts,json=totalAccounts,proto3" json:"total_accounts,omitempty"`
	ActiveAccounts      int64                  `protobuf:"varint,6,opt,name=active_accounts,json=activeAccounts,proto3" json:"active_accounts,omitempty"`
	LastChecked         *timestamppb.Timestamp `protobuf:"bytes,7,opt,name=last_checked,json=lastChecked,proto3" json:"last_checked,omitempty"`
}

type BankStatsRequest struct {
	BankCode string                 `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	FromDate *timestamppb.Timestamp `protobuf:"bytes,2,opt,name=from_date,json=fromDate,proto3" json:"from_date,omitempty"`
	ToDate   *timestamppb.Timestamp `protobuf:"bytes,3,opt,name=to_date,json=toDate,proto3" json:"to_date,omitempty"`
}

type BankStatsResponse struct {
	BankCode               string        `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	TotalTransactions      int64         `protobuf:"varint,2,opt,name=total_transactions,json=totalTransactions,proto3" json:"total_transactions,omitempty"`
	SuccessfulTransactions int64         `protobuf:"varint,3,opt,name=successful_transactions,json=successfulTransactions,proto3" json:"successful_transactions,omitempty"`
	FailedTransactions     int64         `protobuf:"varint,4,opt,name=failed_transactions,json=failedTransactions,proto3" json:"failed_transactions,omitempty"`
	TotalVolumePaisa       int64         `protobuf:"varint,5,opt,name=total_volume_paisa,json=totalVolumePaisa,proto3" json:"total_volume_paisa,omitempty"`
	SuccessRatePercent     int32         `protobuf:"varint,6,opt,name=success_rate_percent,json=successRatePercent,proto3" json:"success_rate_percent,omitempty"`
	AvgResponseTimeMs      int32         `protobuf:"varint,7,opt,name=avg_response_time_ms,json=avgResponseTimeMs,proto3" json:"avg_response_time_ms,omitempty"`
	DailyStats             []*DailyStats `protobuf:"bytes,8,rep,name=daily_stats,json=dailyStats,proto3" json:"daily_stats,omitempty"`
}

// UPI Core specific types
type CancelTransactionRequest struct {
	TransactionId string `protobuf:"bytes,1,opt,name=transaction_id,json=transactionId,proto3" json:"transaction_id,omitempty"`
	Reason        string `protobuf:"bytes,2,opt,name=reason,proto3" json:"reason,omitempty"`
	Signature     string `protobuf:"bytes,3,opt,name=signature,proto3" json:"signature,omitempty"`
}

type CancelTransactionResponse struct {
	Success      bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ErrorCode    string                 `protobuf:"bytes,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string                 `protobuf:"bytes,3,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	CancelledAt  *timestamppb.Timestamp `protobuf:"bytes,4,opt,name=cancelled_at,json=cancelledAt,proto3" json:"cancelled_at,omitempty"`
}

type ReverseTransactionRequest struct {
	OriginalTransactionId string `protobuf:"bytes,1,opt,name=original_transaction_id,json=originalTransactionId,proto3" json:"original_transaction_id,omitempty"`
	ReversalTransactionId string `protobuf:"bytes,2,opt,name=reversal_transaction_id,json=reversalTransactionId,proto3" json:"reversal_transaction_id,omitempty"`
	Reason                string `protobuf:"bytes,3,opt,name=reason,proto3" json:"reason,omitempty"`
	Signature             string `protobuf:"bytes,4,opt,name=signature,proto3" json:"signature,omitempty"`
}

type ReverseTransactionResponse struct {
	Success               bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ReversalTransactionId string                 `protobuf:"bytes,2,opt,name=reversal_transaction_id,json=reversalTransactionId,proto3" json:"reversal_transaction_id,omitempty"`
	ErrorCode             string                 `protobuf:"bytes,3,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage          string                 `protobuf:"bytes,4,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	ReversedAt            *timestamppb.Timestamp `protobuf:"bytes,5,opt,name=reversed_at,json=reversedAt,proto3" json:"reversed_at,omitempty"`
}

type RegisterVPARequest struct {
	Vpa               string `protobuf:"bytes,1,opt,name=vpa,proto3" json:"vpa,omitempty"`
	BankCode          string `protobuf:"bytes,2,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	AccountNumber     string `protobuf:"bytes,3,opt,name=account_number,json=accountNumber,proto3" json:"account_number,omitempty"`
	AccountHolderName string `protobuf:"bytes,4,opt,name=account_holder_name,json=accountHolderName,proto3" json:"account_holder_name,omitempty"`
	MobileNumber      string `protobuf:"bytes,5,opt,name=mobile_number,json=mobileNumber,proto3" json:"mobile_number,omitempty"`
	Signature         string `protobuf:"bytes,6,opt,name=signature,proto3" json:"signature,omitempty"`
}

type RegisterVPAResponse struct {
	Success      bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ErrorCode    string                 `protobuf:"bytes,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string                 `protobuf:"bytes,3,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	RegisteredAt *timestamppb.Timestamp `protobuf:"bytes,4,opt,name=registered_at,json=registeredAt,proto3" json:"registered_at,omitempty"`
}

type UpdateVPARequest struct {
	Vpa              string `protobuf:"bytes,1,opt,name=vpa,proto3" json:"vpa,omitempty"`
	NewAccountNumber string `protobuf:"bytes,2,opt,name=new_account_number,json=newAccountNumber,proto3" json:"new_account_number,omitempty"`
	Signature        string `protobuf:"bytes,3,opt,name=signature,proto3" json:"signature,omitempty"`
}

type UpdateVPAResponse struct {
	Success      bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ErrorCode    string                 `protobuf:"bytes,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string                 `protobuf:"bytes,3,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	UpdatedAt    *timestamppb.Timestamp `protobuf:"bytes,4,opt,name=updated_at,json=updatedAt,proto3" json:"updated_at,omitempty"`
}

type DeactivateVPARequest struct {
	Vpa       string `protobuf:"bytes,1,opt,name=vpa,proto3" json:"vpa,omitempty"`
	Reason    string `protobuf:"bytes,2,opt,name=reason,proto3" json:"reason,omitempty"`
	Signature string `protobuf:"bytes,3,opt,name=signature,proto3" json:"signature,omitempty"`
}

type DeactivateVPAResponse struct {
	Success       bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ErrorCode     string                 `protobuf:"bytes,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage  string                 `protobuf:"bytes,3,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	DeactivatedAt *timestamppb.Timestamp `protobuf:"bytes,4,opt,name=deactivated_at,json=deactivatedAt,proto3" json:"deactivated_at,omitempty"`
}

type RegisterBankRequest struct {
	BankCode           string   `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	BankName           string   `protobuf:"bytes,2,opt,name=bank_name,json=bankName,proto3" json:"bank_name,omitempty"`
	IfscPrefix         string   `protobuf:"bytes,3,opt,name=ifsc_prefix,json=ifscPrefix,proto3" json:"ifsc_prefix,omitempty"`
	EndpointUrl        string   `protobuf:"bytes,4,opt,name=endpoint_url,json=endpointUrl,proto3" json:"endpoint_url,omitempty"`
	PublicKey          string   `protobuf:"bytes,5,opt,name=public_key,json=publicKey,proto3" json:"public_key,omitempty"`
	SupportedFeatures  []string `protobuf:"bytes,6,rep,name=supported_features,json=supportedFeatures,proto3" json:"supported_features,omitempty"`
}

type RegisterBankResponse struct {
	Success      bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	BankId       string                 `protobuf:"bytes,2,opt,name=bank_id,json=bankId,proto3" json:"bank_id,omitempty"`
	ErrorCode    string                 `protobuf:"bytes,3,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string                 `protobuf:"bytes,4,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	RegisteredAt *timestamppb.Timestamp `protobuf:"bytes,5,opt,name=registered_at,json=registeredAt,proto3" json:"registered_at,omitempty"`
}

type UpdateBankStatusRequest struct {
	BankCode string     `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	Status   BankStatus `protobuf:"varint,2,opt,name=status,proto3,enum=BankStatus" json:"status,omitempty"`
	Reason   string     `protobuf:"bytes,3,opt,name=reason,proto3" json:"reason,omitempty"`
}

type UpdateBankStatusResponse struct {
	Success      bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	ErrorCode    string                 `protobuf:"bytes,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string                 `protobuf:"bytes,3,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	UpdatedAt    *timestamppb.Timestamp `protobuf:"bytes,4,opt,name=updated_at,json=updatedAt,proto3" json:"updated_at,omitempty"`
}

type BankStatusRequest struct {
	BankCode string `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
}

type BankStatusResponse struct {
	BankCode           string                 `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	BankName           string                 `protobuf:"bytes,2,opt,name=bank_name,json=bankName,proto3" json:"bank_name,omitempty"`
	Status             BankStatus             `protobuf:"varint,3,opt,name=status,proto3,enum=BankStatus" json:"status,omitempty"`
	SuccessRatePercent int32                  `protobuf:"varint,4,opt,name=success_rate_percent,json=successRatePercent,proto3" json:"success_rate_percent,omitempty"`
	AvgResponseTimeMs  int32                  `protobuf:"varint,5,opt,name=avg_response_time_ms,json=avgResponseTimeMs,proto3" json:"avg_response_time_ms,omitempty"`
	LastHeartbeat      *timestamppb.Timestamp `protobuf:"bytes,6,opt,name=last_heartbeat,json=lastHeartbeat,proto3" json:"last_heartbeat,omitempty"`
	SupportedFeatures  []string               `protobuf:"bytes,7,rep,name=supported_features,json=supportedFeatures,proto3" json:"supported_features,omitempty"`
}

type ListBanksRequest struct {
	StatusFilter BankStatus `protobuf:"varint,1,opt,name=status_filter,json=statusFilter,proto3,enum=BankStatus" json:"status_filter,omitempty"`
	PageSize     int32      `protobuf:"varint,2,opt,name=page_size,json=pageSize,proto3" json:"page_size,omitempty"`
	PageToken    string     `protobuf:"bytes,3,opt,name=page_token,json=pageToken,proto3" json:"page_token,omitempty"`
}

type ListBanksResponse struct {
	Banks         []*BankInfo `protobuf:"bytes,1,rep,name=banks,proto3" json:"banks,omitempty"`
	NextPageToken string      `protobuf:"bytes,2,opt,name=next_page_token,json=nextPageToken,proto3" json:"next_page_token,omitempty"`
	TotalCount    int32       `protobuf:"varint,3,opt,name=total_count,json=totalCount,proto3" json:"total_count,omitempty"`
}

type InitiateSettlementRequest struct {
	BatchId        string                 `protobuf:"bytes,1,opt,name=batch_id,json=batchId,proto3" json:"batch_id,omitempty"`
	BankCodes      []string               `protobuf:"bytes,2,rep,name=bank_codes,json=bankCodes,proto3" json:"bank_codes,omitempty"`
	SettlementDate *timestamppb.Timestamp `protobuf:"bytes,3,opt,name=settlement_date,json=settlementDate,proto3" json:"settlement_date,omitempty"`
}

type InitiateSettlementResponse struct {
	Success      bool                   `protobuf:"varint,1,opt,name=success,proto3" json:"success,omitempty"`
	SettlementId string                 `protobuf:"bytes,2,opt,name=settlement_id,json=settlementId,proto3" json:"settlement_id,omitempty"`
	ErrorCode    string                 `protobuf:"bytes,3,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	ErrorMessage string                 `protobuf:"bytes,4,opt,name=error_message,json=errorMessage,proto3" json:"error_message,omitempty"`
	InitiatedAt  *timestamppb.Timestamp `protobuf:"bytes,5,opt,name=initiated_at,json=initiatedAt,proto3" json:"initiated_at,omitempty"`
}

type SettlementStatusRequest struct {
	SettlementId string `protobuf:"bytes,1,opt,name=settlement_id,json=settlementId,proto3" json:"settlement_id,omitempty"`
}

type SettlementStatusResponse struct {
	SettlementId     string              `protobuf:"bytes,1,opt,name=settlement_id,json=settlementId,proto3" json:"settlement_id,omitempty"`
	Status           SettlementStatus    `protobuf:"varint,2,opt,name=status,proto3,enum=SettlementStatus" json:"status,omitempty"`
	BankSettlements  []*BankSettlement   `protobuf:"bytes,3,rep,name=bank_settlements,json=bankSettlements,proto3" json:"bank_settlements,omitempty"`
	CreatedAt        *timestamppb.Timestamp `protobuf:"bytes,4,opt,name=created_at,json=createdAt,proto3" json:"created_at,omitempty"`
	CompletedAt      *timestamppb.Timestamp `protobuf:"bytes,5,opt,name=completed_at,json=completedAt,proto3" json:"completed_at,omitempty"`
}

type SettlementReportRequest struct {
	BankCode string                 `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	FromDate *timestamppb.Timestamp `protobuf:"bytes,2,opt,name=from_date,json=fromDate,proto3" json:"from_date,omitempty"`
	ToDate   *timestamppb.Timestamp `protobuf:"bytes,3,opt,name=to_date,json=toDate,proto3" json:"to_date,omitempty"`
}

type SettlementReportResponse struct {
	BankCode              string             `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	TotalCreditPaisa      int64              `protobuf:"varint,2,opt,name=total_credit_paisa,json=totalCreditPaisa,proto3" json:"total_credit_paisa,omitempty"`
	TotalDebitPaisa       int64              `protobuf:"varint,3,opt,name=total_debit_paisa,json=totalDebitPaisa,proto3" json:"total_debit_paisa,omitempty"`
	NetSettlementPaisa    int64              `protobuf:"varint,4,opt,name=net_settlement_paisa,json=netSettlementPaisa,proto3" json:"net_settlement_paisa,omitempty"`
	TransactionCount      int32              `protobuf:"varint,5,opt,name=transaction_count,json=transactionCount,proto3" json:"transaction_count,omitempty"`
	DailySettlements      []*DailySettlement `protobuf:"bytes,6,rep,name=daily_settlements,json=dailySettlements,proto3" json:"daily_settlements,omitempty"`
}

type HealthCheckRequest struct {
	Service string `protobuf:"bytes,1,opt,name=service,proto3" json:"service,omitempty"`
}

type HealthCheckResponse struct {
	Status    HealthStatus           `protobuf:"varint,1,opt,name=status,proto3,enum=HealthStatus" json:"status,omitempty"`
	Details   map[string]string      `protobuf:"bytes,2,rep,name=details,proto3" json:"details,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	Timestamp *timestamppb.Timestamp `protobuf:"bytes,3,opt,name=timestamp,proto3" json:"timestamp,omitempty"`
}

type MetricsRequest struct {
	MetricNames []string               `protobuf:"bytes,1,rep,name=metric_names,json=metricNames,proto3" json:"metric_names,omitempty"`
	FromTime    *timestamppb.Timestamp `protobuf:"bytes,2,opt,name=from_time,json=fromTime,proto3" json:"from_time,omitempty"`
	ToTime      *timestamppb.Timestamp `protobuf:"bytes,3,opt,name=to_time,json=toTime,proto3" json:"to_time,omitempty"`
}

type MetricsResponse struct {
	Metrics     []*Metric              `protobuf:"bytes,1,rep,name=metrics,proto3" json:"metrics,omitempty"`
	GeneratedAt *timestamppb.Timestamp `protobuf:"bytes,2,opt,name=generated_at,json=generatedAt,proto3" json:"generated_at,omitempty"`
}

// Supporting message types
type CustomerKYC struct {
	Pan           string `protobuf:"bytes,1,opt,name=pan,proto3" json:"pan,omitempty"`
	AadhaarMasked string `protobuf:"bytes,2,opt,name=aadhaar_masked,json=aadhaarMasked,proto3" json:"aadhaar_masked,omitempty"`
	FullName      string `protobuf:"bytes,3,opt,name=full_name,json=fullName,proto3" json:"full_name,omitempty"`
	DateOfBirth   string `protobuf:"bytes,4,opt,name=date_of_birth,json=dateOfBirth,proto3" json:"date_of_birth,omitempty"`
	Address       string `protobuf:"bytes,5,opt,name=address,proto3" json:"address,omitempty"`
}

type TransactionFees struct {
	ProcessingFeePaisa int64 `protobuf:"varint,1,opt,name=processing_fee_paisa,json=processingFeePaisa,proto3" json:"processing_fee_paisa,omitempty"`
	ServiceTaxPaisa    int64 `protobuf:"varint,2,opt,name=service_tax_paisa,json=serviceTaxPaisa,proto3" json:"service_tax_paisa,omitempty"`
	TotalFeePaisa      int64 `protobuf:"varint,3,opt,name=total_fee_paisa,json=totalFeePaisa,proto3" json:"total_fee_paisa,omitempty"`
	// UPI Core specific fields
	SwitchFeePaisa int64 `protobuf:"varint,4,opt,name=switch_fee_paisa,json=switchFeePaisa,proto3" json:"switch_fee_paisa,omitempty"`
	BankFeePaisa   int64 `protobuf:"varint,5,opt,name=bank_fee_paisa,json=bankFeePaisa,proto3" json:"bank_fee_paisa,omitempty"`
}

type DailyStats struct {
	Date                string `protobuf:"bytes,1,opt,name=date,proto3" json:"date,omitempty"`
	TransactionCount    int64  `protobuf:"varint,2,opt,name=transaction_count,json=transactionCount,proto3" json:"transaction_count,omitempty"`
	SuccessCount        int64  `protobuf:"varint,3,opt,name=success_count,json=successCount,proto3" json:"success_count,omitempty"`
	FailureCount        int64  `protobuf:"varint,4,opt,name=failure_count,json=failureCount,proto3" json:"failure_count,omitempty"`
	TotalVolumePaisa    int64  `protobuf:"varint,5,opt,name=total_volume_paisa,json=totalVolumePaisa,proto3" json:"total_volume_paisa,omitempty"`
	SuccessRatePercent  int32  `protobuf:"varint,6,opt,name=success_rate_percent,json=successRatePercent,proto3" json:"success_rate_percent,omitempty"`
}

type TransactionEvent struct {
	EventType   string                 `protobuf:"bytes,1,opt,name=event_type,json=eventType,proto3" json:"event_type,omitempty"`
	Description string                 `protobuf:"bytes,2,opt,name=description,proto3" json:"description,omitempty"`
	Timestamp   *timestamppb.Timestamp `protobuf:"bytes,3,opt,name=timestamp,proto3" json:"timestamp,omitempty"`
	Details     map[string]string      `protobuf:"bytes,4,rep,name=details,proto3" json:"details,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
}

type BankInfo struct {
	BankCode          string                 `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	BankName          string                 `protobuf:"bytes,2,opt,name=bank_name,json=bankName,proto3" json:"bank_name,omitempty"`
	IfscPrefix        string                 `protobuf:"bytes,3,opt,name=ifsc_prefix,json=ifscPrefix,proto3" json:"ifsc_prefix,omitempty"`
	Status            BankStatus             `protobuf:"varint,4,opt,name=status,proto3,enum=BankStatus" json:"status,omitempty"`
	EndpointUrl       string                 `protobuf:"bytes,5,opt,name=endpoint_url,json=endpointUrl,proto3" json:"endpoint_url,omitempty"`
	SupportedFeatures []string               `protobuf:"bytes,6,rep,name=supported_features,json=supportedFeatures,proto3" json:"supported_features,omitempty"`
	RegisteredAt      *timestamppb.Timestamp `protobuf:"bytes,7,opt,name=registered_at,json=registeredAt,proto3" json:"registered_at,omitempty"`
}

type BankSettlement struct {
	BankCode          string           `protobuf:"bytes,1,opt,name=bank_code,json=bankCode,proto3" json:"bank_code,omitempty"`
	CreditAmountPaisa int64            `protobuf:"varint,2,opt,name=credit_amount_paisa,json=creditAmountPaisa,proto3" json:"credit_amount_paisa,omitempty"`
	DebitAmountPaisa  int64            `protobuf:"varint,3,opt,name=debit_amount_paisa,json=debitAmountPaisa,proto3" json:"debit_amount_paisa,omitempty"`
	NetAmountPaisa    int64            `protobuf:"varint,4,opt,name=net_amount_paisa,json=netAmountPaisa,proto3" json:"net_amount_paisa,omitempty"`
	TransactionCount  int32            `protobuf:"varint,5,opt,name=transaction_count,json=transactionCount,proto3" json:"transaction_count,omitempty"`
	Status            SettlementStatus `protobuf:"varint,6,opt,name=status,proto3,enum=SettlementStatus" json:"status,omitempty"`
}

type DailySettlement struct {
	Date              string `protobuf:"bytes,1,opt,name=date,proto3" json:"date,omitempty"`
	CreditAmountPaisa int64  `protobuf:"varint,2,opt,name=credit_amount_paisa,json=creditAmountPaisa,proto3" json:"credit_amount_paisa,omitempty"`
	DebitAmountPaisa  int64  `protobuf:"varint,3,opt,name=debit_amount_paisa,json=debitAmountPaisa,proto3" json:"debit_amount_paisa,omitempty"`
	NetAmountPaisa    int64  `protobuf:"varint,4,opt,name=net_amount_paisa,json=netAmountPaisa,proto3" json:"net_amount_paisa,omitempty"`
	TransactionCount  int32  `protobuf:"varint,5,opt,name=transaction_count,json=transactionCount,proto3" json:"transaction_count,omitempty"`
}

type Metric struct {
	Name      string                 `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
	Value     string                 `protobuf:"bytes,2,opt,name=value,proto3" json:"value,omitempty"`
	Unit      string                 `protobuf:"bytes,3,opt,name=unit,proto3" json:"unit,omitempty"`
	Labels    map[string]string      `protobuf:"bytes,4,rep,name=labels,proto3" json:"labels,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	Timestamp *timestamppb.Timestamp `protobuf:"bytes,5,opt,name=timestamp,proto3" json:"timestamp,omitempty"`
}