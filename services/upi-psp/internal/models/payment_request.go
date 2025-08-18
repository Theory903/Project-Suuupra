package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PaymentRequest represents a request for payment
type PaymentRequest struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// User relationship (requester)
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	User   User      `json:"user,omitempty" gorm:"foreignKey:UserID"`

	// Request Details
	RequestID   string          `json:"request_id" gorm:"uniqueIndex;not null"`
	Amount      decimal.Decimal `json:"amount" gorm:"type:decimal(15,2);not null"`
	Currency    string          `json:"currency" gorm:"default:INR"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`

	// Parties
	RequesterVPA  string `json:"requester_vpa" gorm:"not null"` // Who is requesting
	RequesterName string `json:"requester_name"`

	PayerVPA  string `json:"payer_vpa" gorm:"not null"` // Who should pay
	PayerName string `json:"payer_name"`

	// Status and Timing
	Status      PaymentRequestStatus `json:"status" gorm:"not null;default:pending"`
	ExpiresAt   time.Time            `json:"expires_at"`
	AcceptedAt  *time.Time           `json:"accepted_at"`
	RejectedAt  *time.Time           `json:"rejected_at"`
	CompletedAt *time.Time           `json:"completed_at"`

	// Rejection/Failure Information
	RejectionReason string `json:"rejection_reason"`
	FailureReason   string `json:"failure_reason"`

	// Settings
	IsRecurring     bool           `json:"is_recurring" gorm:"default:false"`
	RecurrenceType  RecurrenceType `json:"recurrence_type"`
	RecurrenceCount int            `json:"recurrence_count" gorm:"default:0"`
	NextDueDate     *time.Time     `json:"next_due_date"`

	// Notifications
	NotificationsSent int       `json:"notifications_sent" gorm:"default:0"`
	LastNotifiedAt    time.Time `json:"last_notified_at"`
	ReminderCount     int       `json:"reminder_count" gorm:"default:0"`

	// Metadata
	Metadata map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	Tags     []string               `json:"tags" gorm:"type:text[]"`

	// Relationships
	TransactionID *uuid.UUID   `json:"transaction_id,omitempty" gorm:"type:uuid"`
	Transaction   *Transaction `json:"transaction,omitempty" gorm:"foreignKey:TransactionID"`
}

// PaymentRequestStatus represents the status of a payment request
type PaymentRequestStatus string

const (
	PaymentRequestStatusPending   PaymentRequestStatus = "pending"
	PaymentRequestStatusAccepted  PaymentRequestStatus = "accepted"
	PaymentRequestStatusRejected  PaymentRequestStatus = "rejected"
	PaymentRequestStatusCompleted PaymentRequestStatus = "completed"
	PaymentRequestStatusExpired   PaymentRequestStatus = "expired"
	PaymentRequestStatusCancelled PaymentRequestStatus = "cancelled"
)

// RecurrenceType represents the type of recurrence
type RecurrenceType string

const (
	RecurrenceTypeNone    RecurrenceType = "none"
	RecurrenceTypeDaily   RecurrenceType = "daily"
	RecurrenceTypeWeekly  RecurrenceType = "weekly"
	RecurrenceTypeMonthly RecurrenceType = "monthly"
	RecurrenceTypeYearly  RecurrenceType = "yearly"
)

// BeforeCreate sets the ID if not already set
func (pr *PaymentRequest) BeforeCreate(tx *gorm.DB) error {
	if pr.ID == uuid.Nil {
		pr.ID = uuid.New()
	}
	return nil
}

// IsExpired checks if the payment request is expired
func (pr *PaymentRequest) IsExpired() bool {
	return time.Now().After(pr.ExpiresAt)
}

// CanBeAccepted checks if the payment request can be accepted
func (pr *PaymentRequest) CanBeAccepted() bool {
	return pr.Status == PaymentRequestStatusPending && !pr.IsExpired()
}

// Accept marks the payment request as accepted
func (pr *PaymentRequest) Accept() {
	now := time.Now()
	pr.Status = PaymentRequestStatusAccepted
	pr.AcceptedAt = &now
}

// Reject marks the payment request as rejected with a reason
func (pr *PaymentRequest) Reject(reason string) {
	now := time.Now()
	pr.Status = PaymentRequestStatusRejected
	pr.RejectedAt = &now
	pr.RejectionReason = reason
}

// Complete marks the payment request as completed
func (pr *PaymentRequest) Complete(transactionID uuid.UUID) {
	now := time.Now()
	pr.Status = PaymentRequestStatusCompleted
	pr.CompletedAt = &now
	pr.TransactionID = &transactionID
}

// Cancel marks the payment request as cancelled
func (pr *PaymentRequest) Cancel() {
	pr.Status = PaymentRequestStatusCancelled
}

// MarkAsExpired marks the payment request as expired
func (pr *PaymentRequest) MarkAsExpired() {
	pr.Status = PaymentRequestStatusExpired
}

// IncrementNotifications increments the notification count
func (pr *PaymentRequest) IncrementNotifications() {
	pr.NotificationsSent++
	pr.LastNotifiedAt = time.Now()
}

// IncrementReminders increments the reminder count
func (pr *PaymentRequest) IncrementReminders() {
	pr.ReminderCount++
}
