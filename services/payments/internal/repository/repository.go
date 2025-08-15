package repository

import (
	"gorm.io/gorm"
)

// Repositories contains all repository interfaces
type Repositories struct {
	DB *gorm.DB
	// Add specific repositories here as needed
	// Payment     PaymentRepository
	// Refund      RefundRepository
	// Webhook     WebhookRepository
}

// NewRepositories creates a new repositories container
func NewRepositories(db *gorm.DB) *Repositories {
	return &Repositories{
		DB: db,
		// Initialize specific repositories here
		// Payment: NewPaymentRepository(db),
		// Refund:  NewRefundRepository(db),
		// Webhook: NewWebhookRepository(db),
	}
}