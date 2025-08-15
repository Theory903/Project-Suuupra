package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// PaymentIntent represents a payment intention before processing
type PaymentIntent struct {
	ID                uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	MerchantID        uuid.UUID       `json:"merchant_id" gorm:"type:uuid;not null;index"`
	Amount            decimal.Decimal `json:"amount" gorm:"type:decimal(20,2);not null"`
	Currency          string          `json:"currency" gorm:"type:varchar(3);not null;default:'INR'"`
	Description       string          `json:"description" gorm:"type:text"`
	Status            string          `json:"status" gorm:"type:varchar(50);not null;default:'created';index"`
	PaymentMethod     string          `json:"payment_method" gorm:"type:varchar(50);not null"`
	CustomerID        *uuid.UUID      `json:"customer_id" gorm:"type:uuid;index"`
	Metadata          map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	ExpiresAt         *time.Time      `json:"expires_at"`
	CreatedAt         time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
}

// Payment represents a completed or attempted payment
type Payment struct {
	ID                uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PaymentIntentID   uuid.UUID       `json:"payment_intent_id" gorm:"type:uuid;not null;index"`
	PaymentIntent     *PaymentIntent  `json:"payment_intent,omitempty" gorm:"foreignKey:PaymentIntentID"`
	Amount            decimal.Decimal `json:"amount" gorm:"type:decimal(20,2);not null"`
	Currency          string          `json:"currency" gorm:"type:varchar(3);not null;default:'INR'"`
	Status            string          `json:"status" gorm:"type:varchar(50);not null;index"`
	PaymentMethod     string          `json:"payment_method" gorm:"type:varchar(50);not null"`
	RailTransactionID string          `json:"rail_transaction_id" gorm:"type:varchar(255);index"`
	FailureCode       *string         `json:"failure_code"`
	FailureMessage    *string         `json:"failure_message"`
	ProcessedAt       *time.Time      `json:"processed_at"`
	SettledAt         *time.Time      `json:"settled_at"`
	Metadata          map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	CreatedAt         time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
}

// Refund represents a refund transaction
type Refund struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PaymentID       uuid.UUID       `json:"payment_id" gorm:"type:uuid;not null;index"`
	Payment         *Payment        `json:"payment,omitempty" gorm:"foreignKey:PaymentID"`
	Amount          decimal.Decimal `json:"amount" gorm:"type:decimal(20,2);not null"`
	Currency        string          `json:"currency" gorm:"type:varchar(3);not null;default:'INR'"`
	Reason          string          `json:"reason" gorm:"type:varchar(255)"`
	Status          string          `json:"status" gorm:"type:varchar(50);not null;default:'pending';index"`
	RefundReference string          `json:"refund_reference" gorm:"type:varchar(255);unique;index"`
	FailureCode     *string         `json:"failure_code"`
	FailureMessage  *string         `json:"failure_message"`
	ProcessedAt     *time.Time      `json:"processed_at"`
	Metadata        map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	CreatedAt       time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
}

// LedgerEntry represents an entry in the double-entry ledger
type LedgerEntry struct {
	ID            uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	TransactionID uuid.UUID       `json:"transaction_id" gorm:"type:uuid;not null;index"`
	AccountID     uuid.UUID       `json:"account_id" gorm:"type:uuid;not null;index"`
	AccountType   string          `json:"account_type" gorm:"type:varchar(50);not null"`
	DebitAmount   decimal.Decimal `json:"debit_amount" gorm:"type:decimal(20,2);default:0"`
	CreditAmount  decimal.Decimal `json:"credit_amount" gorm:"type:decimal(20,2);default:0"`
	Currency      string          `json:"currency" gorm:"type:varchar(3);not null;default:'INR'"`
	Description   string          `json:"description" gorm:"type:text"`
	ReferenceType string          `json:"reference_type" gorm:"type:varchar(50);not null"` // payment, refund, fee, etc.
	ReferenceID   uuid.UUID       `json:"reference_id" gorm:"type:uuid;not null;index"`
	CreatedAt     time.Time       `json:"created_at" gorm:"autoCreateTime"`
}

// IdempotencyKey represents stored idempotency keys with TTL
type IdempotencyKey struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Key          string    `json:"key" gorm:"type:varchar(255);unique;not null;index"`
	RequestHash  string    `json:"request_hash" gorm:"type:varchar(64);not null"`
	ResponseData []byte    `json:"response_data"`
	StatusCode   int       `json:"status_code"`
	ExpiresAt    time.Time `json:"expires_at" gorm:"index"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// WebhookEndpoint represents a webhook endpoint configuration
type WebhookEndpoint struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	MerchantID  uuid.UUID `json:"merchant_id" gorm:"type:uuid;not null;index"`
	URL         string    `json:"url" gorm:"type:varchar(255);not null"`
	Secret      string    `json:"secret" gorm:"type:varchar(255);not null"`
	Events      []string  `json:"events" gorm:"type:text[]"`
	Active      bool      `json:"active" gorm:"default:true"`
	Version     string    `json:"version" gorm:"type:varchar(10);default:'v1'"`
	Description string    `json:"description" gorm:"type:text"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// WebhookDelivery represents a webhook delivery attempt
type WebhookDelivery struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	EndpointID      uuid.UUID `json:"endpoint_id" gorm:"type:uuid;not null;index"`
	Endpoint        *WebhookEndpoint `json:"endpoint,omitempty" gorm:"foreignKey:EndpointID"`
	EventType       string    `json:"event_type" gorm:"type:varchar(100);not null"`
	EventID         uuid.UUID `json:"event_id" gorm:"type:uuid;not null;index"`
	Payload         []byte    `json:"payload" gorm:"type:jsonb"`
	Signature       string    `json:"signature" gorm:"type:varchar(255)"`
	Status          string    `json:"status" gorm:"type:varchar(50);not null;default:'pending'"`
	AttemptCount    int       `json:"attempt_count" gorm:"default:0"`
	MaxAttempts     int       `json:"max_attempts" gorm:"default:5"`
	NextAttemptAt   *time.Time `json:"next_attempt_at"`
	ResponseStatus  *int      `json:"response_status"`
	ResponseBody    *string   `json:"response_body"`
	FailureReason   *string   `json:"failure_reason"`
	DeliveredAt     *time.Time `json:"delivered_at"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// RiskAssessment represents a risk assessment result
type RiskAssessment struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PaymentIntentID uuid.UUID `json:"payment_intent_id" gorm:"type:uuid;not null;index"`
	PaymentIntent   *PaymentIntent `json:"payment_intent,omitempty" gorm:"foreignKey:PaymentIntentID"`
	RiskScore       float64   `json:"risk_score" gorm:"type:decimal(5,4);not null"`
	RiskLevel       string    `json:"risk_level" gorm:"type:varchar(20);not null"` // LOW, MEDIUM, HIGH
	Decision        string    `json:"decision" gorm:"type:varchar(20);not null"`   // PASS, CHALLENGE, BLOCK
	Factors         map[string]interface{} `json:"factors" gorm:"type:jsonb"`
	Rules           []string  `json:"rules" gorm:"type:text[]"`
	DeviceID        *string   `json:"device_id"`
	IPAddress       string    `json:"ip_address" gorm:"type:varchar(45)"`
	UserAgent       string    `json:"user_agent" gorm:"type:text"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// OutboxEvent represents events to be published for exactly-once semantics
type OutboxEvent struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	EventType   string    `json:"event_type" gorm:"type:varchar(100);not null;index"`
	EventData   []byte    `json:"event_data" gorm:"type:jsonb"`
	AggregateID uuid.UUID `json:"aggregate_id" gorm:"type:uuid;not null;index"`
	Version     int64     `json:"version" gorm:"not null"`
	Published   bool      `json:"published" gorm:"default:false;index"`
	PublishedAt *time.Time `json:"published_at"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// PaymentStatus constants
const (
	PaymentIntentStatusCreated   = "created"
	PaymentIntentStatusExpired   = "expired"
	PaymentIntentStatusCanceled  = "canceled"
	PaymentIntentStatusSucceeded = "succeeded"

	PaymentStatusPending   = "pending"
	PaymentStatusProcessing = "processing"
	PaymentStatusSucceeded = "succeeded"
	PaymentStatusFailed    = "failed"
	PaymentStatusCanceled  = "canceled"

	RefundStatusPending   = "pending"
	RefundStatusProcessing = "processing"
	RefundStatusSucceeded = "succeeded"
	RefundStatusFailed    = "failed"
	RefundStatusCanceled  = "canceled"

	RiskDecisionPass      = "PASS"
	RiskDecisionChallenge = "CHALLENGE"
	RiskDecisionBlock     = "BLOCK"

	RiskLevelLow    = "LOW"
	RiskLevelMedium = "MEDIUM"
	RiskLevelHigh   = "HIGH"
)