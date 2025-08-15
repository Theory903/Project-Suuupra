package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/suuupra/payments/internal/models"
)

// Connect establishes a connection to PostgreSQL database
func Connect(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto-migrate schemas
	err = db.AutoMigrate(
		&models.PaymentIntent{},
		&models.Payment{},
		&models.Refund{},
		&models.LedgerEntry{},
		&models.IdempotencyKey{},
		&models.WebhookEndpoint{},
		&models.WebhookDelivery{},
		&models.RiskAssessment{},
		&models.OutboxEvent{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to run auto-migration: %w", err)
	}

	return db, nil
}