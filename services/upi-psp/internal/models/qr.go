package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// QRCode represents a generated QR code for payments
type QRCode struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// User relationship
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	User   User      `json:"user,omitempty" gorm:"foreignKey:UserID"`

	// QR Code Information
	Code     string `json:"code" gorm:"uniqueIndex;not null"` // Base64 encoded QR code
	QRString string `json:"qr_string" gorm:"not null"`        // The actual UPI string
	ShortURL string `json:"short_url"`                        // Shortened URL for sharing

	// Payment Details
	VPA         string          `json:"vpa" gorm:"not null"`
	MerchantID  string          `json:"merchant_id"`
	Amount      decimal.Decimal `json:"amount" gorm:"type:decimal(15,2)"`
	Currency    string          `json:"currency" gorm:"default:INR"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`

	// QR Code Settings
	Type       QRType     `json:"type" gorm:"not null"`
	IsReusable bool       `json:"is_reusable" gorm:"default:false"`
	IsActive   bool       `json:"is_active" gorm:"default:true"`
	ExpiresAt  *time.Time `json:"expires_at"`

	// Usage Statistics
	ScanCount     int       `json:"scan_count" gorm:"default:0"`
	PaymentCount  int       `json:"payment_count" gorm:"default:0"`
	LastScannedAt time.Time `json:"last_scanned_at"`
	LastUsedAt    time.Time `json:"last_used_at"`

	// Security
	MaxUsage      int      `json:"max_usage" gorm:"default:0"` // 0 means unlimited
	DeviceBinding bool     `json:"device_binding" gorm:"default:false"`
	IPWhitelist   []string `json:"ip_whitelist" gorm:"type:text[]"`

	// Metadata
	Metadata map[string]interface{} `json:"metadata" gorm:"type:jsonb"`

	// Relationships
	Transactions []Transaction `json:"transactions,omitempty" gorm:"foreignKey:QRCodeID"`
}

// QRType represents the type of QR code
type QRType string

const (
	QRTypeStatic   QRType = "static"   // Reusable QR code
	QRTypeDynamic  QRType = "dynamic"  // One-time use QR code
	QRTypeMerchant QRType = "merchant" // Merchant QR code
	QRTypeIntent   QRType = "intent"   // Intent-based QR code
)

// BeforeCreate sets the ID if not already set
func (q *QRCode) BeforeCreate(tx *gorm.DB) error {
	if q.ID == uuid.Nil {
		q.ID = uuid.New()
	}
	return nil
}

// IsExpired checks if the QR code is expired
func (q *QRCode) IsExpired() bool {
	if q.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*q.ExpiresAt)
}

// IsUsable checks if the QR code can be used
func (q *QRCode) IsUsable() bool {
	if !q.IsActive || q.IsExpired() {
		return false
	}

	// Check max usage limit
	if q.MaxUsage > 0 && q.PaymentCount >= q.MaxUsage {
		return false
	}

	return true
}

// IncrementScanCount increments the scan count
func (q *QRCode) IncrementScanCount() {
	q.ScanCount++
	q.LastScannedAt = time.Now()
}

// IncrementPaymentCount increments the payment count
func (q *QRCode) IncrementPaymentCount() {
	q.PaymentCount++
	q.LastUsedAt = time.Now()
}

// Deactivate deactivates the QR code
func (q *QRCode) Deactivate() {
	q.IsActive = false
}
