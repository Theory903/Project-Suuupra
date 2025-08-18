package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Transaction represents a UPI transaction
type Transaction struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// User relationship
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	User   User      `json:"user,omitempty" gorm:"foreignKey:UserID"`

	// Transaction Identifiers
	TransactionID string `json:"transaction_id" gorm:"uniqueIndex;not null"` // Internal ID
	RRN           string `json:"rrn" gorm:"index"`                           // Retrieval Reference Number
	UPITxnID      string `json:"upi_txn_id" gorm:"index"`                    // UPI Transaction ID

	// Transaction Details
	Type        TransactionType `json:"type" gorm:"not null"`
	Amount      decimal.Decimal `json:"amount" gorm:"type:decimal(15,2);not null"`
	Currency    string          `json:"currency" gorm:"default:INR"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`

	// Parties
	PayerVPA      string `json:"payer_vpa" gorm:"not null"`
	PayerName     string `json:"payer_name"`
	PayerBankCode string `json:"payer_bank_code"`

	PayeeVPA      string `json:"payee_vpa" gorm:"not null"`
	PayeeName     string `json:"payee_name"`
	PayeeBankCode string `json:"payee_bank_code"`

	// Status and Timing
	Status      TransactionStatus `json:"status" gorm:"not null"`
	InitiatedAt time.Time         `json:"initiated_at"`
	ProcessedAt *time.Time        `json:"processed_at"`
	CompletedAt *time.Time        `json:"completed_at"`

	// Error Information
	ErrorCode    string `json:"error_code"`
	ErrorMessage string `json:"error_message"`

	// Security
	DeviceID         string `json:"device_id"`
	IPAddress        string `json:"ip_address"`
	Location         string `json:"location"`
	AuthMethod       string `json:"auth_method"` // pin, biometric, etc.
	RiskScore        int    `json:"risk_score"`  // 0-100
	FraudCheckStatus string `json:"fraud_check_status"`

	// Fees and Charges
	Fee         decimal.Decimal `json:"fee" gorm:"type:decimal(10,2);default:0"`
	Tax         decimal.Decimal `json:"tax" gorm:"type:decimal(10,2);default:0"`
	TotalAmount decimal.Decimal `json:"total_amount" gorm:"type:decimal(15,2)"`

	// Metadata
	Metadata map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	Tags     []string               `json:"tags" gorm:"type:text[]"`

	// Relationships
	QRCodeID         *uuid.UUID      `json:"qr_code_id,omitempty" gorm:"type:uuid"`
	QRCode           *QRCode         `json:"qr_code,omitempty" gorm:"foreignKey:QRCodeID"`
	PaymentRequestID *uuid.UUID      `json:"payment_request_id,omitempty" gorm:"type:uuid"`
	PaymentRequest   *PaymentRequest `json:"payment_request,omitempty" gorm:"foreignKey:PaymentRequestID"`
}

// TransactionType represents the type of transaction
type TransactionType string

const (
	TransactionTypeP2P    TransactionType = "p2p"    // Person to Person
	TransactionTypeP2M    TransactionType = "p2m"    // Person to Merchant
	TransactionTypeM2P    TransactionType = "m2p"    // Merchant to Person
	TransactionTypeRefund TransactionType = "refund" // Refund
)

// TransactionStatus represents the status of a transaction
type TransactionStatus string

const (
	TransactionStatusPending    TransactionStatus = "pending"
	TransactionStatusProcessing TransactionStatus = "processing"
	TransactionStatusSuccess    TransactionStatus = "success"
	TransactionStatusFailed     TransactionStatus = "failed"
	TransactionStatusTimeout    TransactionStatus = "timeout"
	TransactionStatusCancelled  TransactionStatus = "cancelled"
	TransactionStatusReversed   TransactionStatus = "reversed"
)

// BeforeCreate sets the ID and calculates total amount
func (t *Transaction) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}

	// Calculate total amount including fees and tax
	t.TotalAmount = t.Amount.Add(t.Fee).Add(t.Tax)

	return nil
}

// IsSuccessful checks if the transaction is successful
func (t *Transaction) IsSuccessful() bool {
	return t.Status == TransactionStatusSuccess
}

// IsFailed checks if the transaction failed
func (t *Transaction) IsFailed() bool {
	return t.Status == TransactionStatusFailed ||
		t.Status == TransactionStatusTimeout ||
		t.Status == TransactionStatusCancelled
}

// IsPending checks if the transaction is pending
func (t *Transaction) IsPending() bool {
	return t.Status == TransactionStatusPending || t.Status == TransactionStatusProcessing
}

// MarkAsProcessed marks the transaction as processed
func (t *Transaction) MarkAsProcessed() {
	now := time.Now()
	t.ProcessedAt = &now
	t.Status = TransactionStatusProcessing
}

// MarkAsCompleted marks the transaction as completed
func (t *Transaction) MarkAsCompleted() {
	now := time.Now()
	t.CompletedAt = &now
	t.Status = TransactionStatusSuccess
}

// MarkAsFailed marks the transaction as failed with error details
func (t *Transaction) MarkAsFailed(errorCode, errorMessage string) {
	t.Status = TransactionStatusFailed
	t.ErrorCode = errorCode
	t.ErrorMessage = errorMessage
	now := time.Now()
	t.CompletedAt = &now
}

// GetDirection returns the transaction direction for the user
func (t *Transaction) GetDirection(userVPA string) string {
	if t.PayerVPA == userVPA {
		return "outgoing"
	}
	return "incoming"
}
