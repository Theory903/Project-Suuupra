package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/suuupra/upi-psp/internal/models"
	"gorm.io/gorm"
)

// TransactionRepository handles transaction data operations
type TransactionRepository struct {
	db *gorm.DB
}

// NewTransactionRepository creates a new transaction repository
func NewTransactionRepository(db *gorm.DB) *TransactionRepository {
	return &TransactionRepository{db: db}
}

// Create creates a new transaction
func (r *TransactionRepository) Create(transaction *models.Transaction) error {
	return r.db.Create(transaction).Error
}

// GetByID gets a transaction by ID
func (r *TransactionRepository) GetByID(id uuid.UUID) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.db.Where("id = ?", id).First(&transaction).Error
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

// GetByTransactionID gets a transaction by transaction ID
func (r *TransactionRepository) GetByTransactionID(transactionID string) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.db.Where("transaction_id = ?", transactionID).First(&transaction).Error
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

// GetByRRN gets a transaction by RRN
func (r *TransactionRepository) GetByRRN(rrn string) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.db.Where("rrn = ?", rrn).First(&transaction).Error
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

// GetByUserID gets transactions for a user with pagination
func (r *TransactionRepository) GetByUserID(userID uuid.UUID, limit, offset int) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&transactions).Error
	return transactions, err
}

// GetByUserIDAndDateRange gets transactions for a user within a date range
func (r *TransactionRepository) GetByUserIDAndDateRange(userID uuid.UUID, startDate, endDate time.Time) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.Where("user_id = ? AND created_at BETWEEN ? AND ?", userID, startDate, endDate).
		Order("created_at DESC").
		Find(&transactions).Error
	return transactions, err
}

// GetByUserIDAndStatus gets transactions for a user by status
func (r *TransactionRepository) GetByUserIDAndStatus(userID uuid.UUID, status models.TransactionStatus) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.Where("user_id = ? AND status = ?", userID, status).
		Order("created_at DESC").
		Find(&transactions).Error
	return transactions, err
}

// GetPendingTransactions gets all pending transactions
func (r *TransactionRepository) GetPendingTransactions() ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.Where("status IN ?", []models.TransactionStatus{
		models.TransactionStatusPending,
		models.TransactionStatusProcessing,
	}).Find(&transactions).Error
	return transactions, err
}

// Update updates a transaction
func (r *TransactionRepository) Update(transaction *models.Transaction) error {
	return r.db.Save(transaction).Error
}

// UpdateStatus updates transaction status
func (r *TransactionRepository) UpdateStatus(id uuid.UUID, status models.TransactionStatus) error {
	return r.db.Model(&models.Transaction{}).Where("id = ?", id).Update("status", status).Error
}

// Delete deletes a transaction
func (r *TransactionRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Transaction{}, id).Error
}

// GetTransactionHistory gets transaction history with filters
type TransactionFilter struct {
	UserID    uuid.UUID
	VPA       string
	Type      models.TransactionType
	Status    models.TransactionStatus
	StartDate *time.Time
	EndDate   *time.Time
	MinAmount *float64
	MaxAmount *float64
	Limit     int
	Offset    int
}

func (r *TransactionRepository) GetTransactionHistory(filter TransactionFilter) ([]models.Transaction, int64, error) {
	query := r.db.Model(&models.Transaction{})

	// Apply filters
	if filter.UserID != uuid.Nil {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.VPA != "" {
		query = query.Where("payer_vpa = ? OR payee_vpa = ?", filter.VPA, filter.VPA)
	}
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.StartDate != nil {
		query = query.Where("created_at >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("created_at <= ?", *filter.EndDate)
	}
	if filter.MinAmount != nil {
		query = query.Where("amount >= ?", *filter.MinAmount)
	}
	if filter.MaxAmount != nil {
		query = query.Where("amount <= ?", *filter.MaxAmount)
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Get paginated results
	var transactions []models.Transaction
	err := query.Order("created_at DESC").
		Limit(filter.Limit).
		Offset(filter.Offset).
		Find(&transactions).Error

	return transactions, total, err
}

// GetTransactionStats gets transaction statistics for a user
type TransactionStats struct {
	TotalTransactions int64   `json:"total_transactions"`
	SuccessfulCount   int64   `json:"successful_count"`
	FailedCount       int64   `json:"failed_count"`
	TotalAmount       float64 `json:"total_amount"`
	TotalSent         float64 `json:"total_sent"`
	TotalReceived     float64 `json:"total_received"`
}

func (r *TransactionRepository) GetTransactionStats(userID uuid.UUID, startDate, endDate time.Time) (*TransactionStats, error) {
	var stats TransactionStats

	query := r.db.Model(&models.Transaction{}).Where("user_id = ?", userID)
	if !startDate.IsZero() {
		query = query.Where("created_at >= ?", startDate)
	}
	if !endDate.IsZero() {
		query = query.Where("created_at <= ?", endDate)
	}

	// Total transactions
	query.Count(&stats.TotalTransactions)

	// Successful transactions
	query.Where("status = ?", models.TransactionStatusSuccess).Count(&stats.SuccessfulCount)

	// Failed transactions
	query.Where("status IN ?", []models.TransactionStatus{
		models.TransactionStatusFailed,
		models.TransactionStatusTimeout,
		models.TransactionStatusCancelled,
	}).Count(&stats.FailedCount)

	// Amount statistics would require more complex queries
	// This is a simplified version
	return &stats, nil
}

// TransactionExists checks if a transaction exists by transaction ID
func (r *TransactionRepository) TransactionExists(transactionID string) bool {
	var count int64
	r.db.Model(&models.Transaction{}).Where("transaction_id = ?", transactionID).Count(&count)
	return count > 0
}
