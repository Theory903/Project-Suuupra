package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/suuupra/payments/internal/models"
)

// AccountType represents different types of accounts in the ledger
type AccountType string

const (
	AccountTypeAsset     AccountType = "ASSET"
	AccountTypeLiability AccountType = "LIABILITY"
	AccountTypeRevenue   AccountType = "REVENUE"
	AccountTypeExpense   AccountType = "EXPENSE"
	AccountTypeEquity    AccountType = "EQUITY"
)

// LedgerService handles double-entry accounting
type LedgerService struct {
	db     *gorm.DB
	logger *logrus.Logger
}

// NewLedgerService creates a new ledger service
func NewLedgerService(db *gorm.DB, logger *logrus.Logger) *LedgerService {
	return &LedgerService{
		db:     db,
		logger: logger,
	}
}

// LedgerTransaction represents a complete double-entry transaction
type LedgerTransaction struct {
	ID          uuid.UUID
	Description string
	Entries     []LedgerEntryInput
}

// LedgerEntryInput represents input for creating a ledger entry
type LedgerEntryInput struct {
	AccountID     uuid.UUID
	AccountType   AccountType
	DebitAmount   decimal.Decimal
	CreditAmount  decimal.Decimal
	Currency      string
	ReferenceType string
	ReferenceID   uuid.UUID
}

// PostTransaction posts a double-entry transaction to the ledger
func (s *LedgerService) PostTransaction(ctx context.Context, transaction LedgerTransaction) error {
	log := s.logger.WithFields(logrus.Fields{
		"transaction_id": transaction.ID,
		"description":    transaction.Description,
		"entries_count":  len(transaction.Entries),
	})

	// Validate transaction
	if err := s.validateTransaction(transaction); err != nil {
		log.WithError(err).Error("Transaction validation failed")
		return fmt.Errorf("transaction validation failed: %w", err)
	}

	// Start database transaction
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create ledger entries
		for _, entryInput := range transaction.Entries {
			entry := &models.LedgerEntry{
				ID:            uuid.New(),
				TransactionID: transaction.ID,
				AccountID:     entryInput.AccountID,
				AccountType:   string(entryInput.AccountType),
				DebitAmount:   entryInput.DebitAmount,
				CreditAmount:  entryInput.CreditAmount,
				Currency:      entryInput.Currency,
				Description:   transaction.Description,
				ReferenceType: entryInput.ReferenceType,
				ReferenceID:   entryInput.ReferenceID,
				CreatedAt:     time.Now(),
			}

			if err := tx.Create(entry).Error; err != nil {
				log.WithError(err).Error("Failed to create ledger entry")
				return fmt.Errorf("failed to create ledger entry: %w", err)
			}
		}

		log.Info("Double-entry transaction posted successfully")
		return nil
	})
}

// validateTransaction validates that the transaction follows double-entry rules
func (s *LedgerService) validateTransaction(transaction LedgerTransaction) error {
	if len(transaction.Entries) < 2 {
		return fmt.Errorf("transaction must have at least 2 entries")
	}

	// Group by currency and validate balance
	currencyTotals := make(map[string]decimal.Decimal)

	for _, entry := range transaction.Entries {
		// Validate that entry has either debit OR credit, not both
		if (entry.DebitAmount.IsZero() && entry.CreditAmount.IsZero()) ||
			(!entry.DebitAmount.IsZero() && !entry.CreditAmount.IsZero()) {
			return fmt.Errorf("entry must have either debit or credit amount, not both or neither")
		}

		// Validate amounts are positive
		if entry.DebitAmount.IsNegative() || entry.CreditAmount.IsNegative() {
			return fmt.Errorf("debit and credit amounts must be positive")
		}

		// Calculate running totals by currency
		if _, exists := currencyTotals[entry.Currency]; !exists {
			currencyTotals[entry.Currency] = decimal.Zero
		}

		// Add debits and subtract credits (in double-entry, debits = credits)
		currencyTotals[entry.Currency] = currencyTotals[entry.Currency].
			Add(entry.DebitAmount).
			Sub(entry.CreditAmount)
	}

	// Verify that totals balance to zero for each currency
	for currency, total := range currencyTotals {
		if !total.IsZero() {
			return fmt.Errorf("transaction does not balance for currency %s: total=%s", currency, total.String())
		}
	}

	return nil
}

// PostPaymentTransaction posts ledger entries for a successful payment
func (s *LedgerService) PostPaymentTransaction(ctx context.Context, payment *models.Payment) error {
	customerAccountID := uuid.New() // In practice, this would be retrieved
	merchantAccountID := uuid.New() // In practice, this would be retrieved
	platformAccountID := uuid.New() // Platform's revenue account

	// Calculate platform fee (example: 2%)
	feeRate := decimal.NewFromFloat(0.02)
	feeAmount := payment.Amount.Mul(feeRate)
	merchantAmount := payment.Amount.Sub(feeAmount)

	transaction := LedgerTransaction{
		ID:          uuid.New(),
		Description: fmt.Sprintf("Payment for %s", payment.ID),
		Entries: []LedgerEntryInput{
			// Debit customer's account (asset decrease)
			{
				AccountID:     customerAccountID,
				AccountType:   AccountTypeAsset,
				DebitAmount:   payment.Amount,
				CreditAmount:  decimal.Zero,
				Currency:      payment.Currency,
				ReferenceType: "payment",
				ReferenceID:   payment.ID,
			},
			// Credit merchant's account (asset increase)
			{
				AccountID:     merchantAccountID,
				AccountType:   AccountTypeAsset,
				DebitAmount:   decimal.Zero,
				CreditAmount:  merchantAmount,
				Currency:      payment.Currency,
				ReferenceType: "payment",
				ReferenceID:   payment.ID,
			},
			// Credit platform revenue (revenue increase)
			{
				AccountID:     platformAccountID,
				AccountType:   AccountTypeRevenue,
				DebitAmount:   decimal.Zero,
				CreditAmount:  feeAmount,
				Currency:      payment.Currency,
				ReferenceType: "payment_fee",
				ReferenceID:   payment.ID,
			},
		},
	}

	return s.PostTransaction(ctx, transaction)
}

// PostRefundTransaction posts ledger entries for a refund
func (s *LedgerService) PostRefundTransaction(ctx context.Context, refund *models.Refund, payment *models.Payment) error {
	customerAccountID := uuid.New() // In practice, this would be retrieved
	merchantAccountID := uuid.New() // In practice, this would be retrieved

	transaction := LedgerTransaction{
		ID:          uuid.New(),
		Description: fmt.Sprintf("Refund for payment %s", payment.ID),
		Entries: []LedgerEntryInput{
			// Credit customer's account (asset increase)
			{
				AccountID:     customerAccountID,
				AccountType:   AccountTypeAsset,
				DebitAmount:   decimal.Zero,
				CreditAmount:  refund.Amount,
				Currency:      refund.Currency,
				ReferenceType: "refund",
				ReferenceID:   refund.ID,
			},
			// Debit merchant's account (asset decrease)
			{
				AccountID:     merchantAccountID,
				AccountType:   AccountTypeAsset,
				DebitAmount:   refund.Amount,
				CreditAmount:  decimal.Zero,
				Currency:      refund.Currency,
				ReferenceType: "refund",
				ReferenceID:   refund.ID,
			},
		},
	}

	return s.PostTransaction(ctx, transaction)
}

// GetAccountBalance calculates the balance for an account
func (s *LedgerService) GetAccountBalance(ctx context.Context, accountID uuid.UUID, currency string) (decimal.Decimal, error) {
	var entries []models.LedgerEntry
	
	err := s.db.WithContext(ctx).
		Where("account_id = ? AND currency = ?", accountID, currency).
		Find(&entries).Error
	
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to fetch ledger entries: %w", err)
	}

	balance := decimal.Zero
	for _, entry := range entries {
		// For asset and expense accounts: debit increases balance
		// For liability, equity, and revenue accounts: credit increases balance
		switch entry.AccountType {
		case string(AccountTypeAsset), string(AccountTypeExpense):
			balance = balance.Add(entry.DebitAmount).Sub(entry.CreditAmount)
		case string(AccountTypeLiability), string(AccountTypeEquity), string(AccountTypeRevenue):
			balance = balance.Add(entry.CreditAmount).Sub(entry.DebitAmount)
		}
	}

	return balance, nil
}

// GetTransactionEntries retrieves all entries for a transaction
func (s *LedgerService) GetTransactionEntries(ctx context.Context, transactionID uuid.UUID) ([]models.LedgerEntry, error) {
	var entries []models.LedgerEntry
	
	err := s.db.WithContext(ctx).
		Where("transaction_id = ?", transactionID).
		Order("created_at ASC").
		Find(&entries).Error
	
	if err != nil {
		return nil, fmt.Errorf("failed to fetch transaction entries: %w", err)
	}

	return entries, nil
}

// ValidateLedgerIntegrity validates that all transactions in the ledger are balanced
func (s *LedgerService) ValidateLedgerIntegrity(ctx context.Context) error {
	// Get all unique transaction IDs
	var transactionIDs []uuid.UUID
	err := s.db.WithContext(ctx).
		Model(&models.LedgerEntry{}).
		Distinct("transaction_id").
		Pluck("transaction_id", &transactionIDs).Error
	
	if err != nil {
		return fmt.Errorf("failed to fetch transaction IDs: %w", err)
	}

	s.logger.WithField("transaction_count", len(transactionIDs)).Info("Validating ledger integrity")

	// Validate each transaction
	for _, txnID := range transactionIDs {
		if err := s.validateTransactionIntegrity(ctx, txnID); err != nil {
			return fmt.Errorf("transaction %s failed integrity check: %w", txnID, err)
		}
	}

	s.logger.Info("Ledger integrity validation completed successfully")
	return nil
}

// validateTransactionIntegrity validates that a specific transaction is balanced
func (s *LedgerService) validateTransactionIntegrity(ctx context.Context, transactionID uuid.UUID) error {
	entries, err := s.GetTransactionEntries(ctx, transactionID)
	if err != nil {
		return err
	}

	// Group by currency and check balance
	currencyTotals := make(map[string]decimal.Decimal)
	
	for _, entry := range entries {
		if _, exists := currencyTotals[entry.Currency]; !exists {
			currencyTotals[entry.Currency] = decimal.Zero
		}
		
		currencyTotals[entry.Currency] = currencyTotals[entry.Currency].
			Add(entry.DebitAmount).
			Sub(entry.CreditAmount)
	}

	// Check that all currencies balance to zero
	for currency, total := range currencyTotals {
		if !total.IsZero() {
			return fmt.Errorf("transaction does not balance for currency %s: total=%s", currency, total.String())
		}
	}

	return nil
}