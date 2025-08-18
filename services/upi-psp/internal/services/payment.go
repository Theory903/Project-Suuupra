package services

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/suuupra/upi-psp/internal/models"
	"github.com/suuupra/upi-psp/internal/repository"
)

// PaymentService handles payment operations
type PaymentService struct {
	transactionRepo *repository.TransactionRepository
	upiService      *UPIService
	logger          *logrus.Logger
}

// NewPaymentService creates a new payment service
func NewPaymentService(
	transactionRepo *repository.TransactionRepository,
	upiService *UPIService,
	logger *logrus.Logger,
) *PaymentService {
	return &PaymentService{
		transactionRepo: transactionRepo,
		upiService:      upiService,
		logger:          logger,
	}
}

// SendMoneyRequest represents a send money request
type SendMoneyRequest struct {
	PayerVPA    string          `json:"payer_vpa" binding:"required"`
	PayeeVPA    string          `json:"payee_vpa" binding:"required"`
	Amount      decimal.Decimal `json:"amount" binding:"required,gt=0"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`
	PIN         string          `json:"pin" binding:"required"`
	DeviceID    string          `json:"device_id" binding:"required"`
	IPAddress   string          `json:"ip_address"`
}

// RequestMoneyRequest represents a request money request
type RequestMoneyRequest struct {
	RequesterVPA string          `json:"requester_vpa" binding:"required"`
	PayerVPA     string          `json:"payer_vpa" binding:"required"`
	Amount       decimal.Decimal `json:"amount" binding:"required,gt=0"`
	Description  string          `json:"description"`
	Reference    string          `json:"reference"`
	ExpiresIn    int             `json:"expires_in"` // Hours
}

// PaymentResponse represents a payment response
type PaymentResponse struct {
	TransactionID string                   `json:"transaction_id"`
	Status        models.TransactionStatus `json:"status"`
	Message       string                   `json:"message"`
	RRN           string                   `json:"rrn,omitempty"`
	ProcessedAt   *time.Time               `json:"processed_at,omitempty"`
	Transaction   *models.Transaction      `json:"transaction,omitempty"`
}

// SendMoney processes a send money transaction
func (s *PaymentService) SendMoney(userID uuid.UUID, req SendMoneyRequest) (*PaymentResponse, error) {
	s.logger.WithFields(logrus.Fields{
		"user_id":   userID,
		"payer_vpa": req.PayerVPA,
		"payee_vpa": req.PayeeVPA,
		"amount":    req.Amount,
	}).Info("Processing send money request")

	// Validate VPAs
	if valid, err := s.upiService.ValidateVPA(req.PayerVPA); !valid {
		return nil, fmt.Errorf("invalid payer VPA: %w", err)
	}

	if valid, err := s.upiService.ValidateVPA(req.PayeeVPA); !valid {
		return nil, fmt.Errorf("invalid payee VPA: %w", err)
	}

	// Resolve payee VPA to get name
	payeeInfo, err := s.upiService.ResolveVPA(req.PayeeVPA)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve payee VPA: %w", err)
	}

	// Generate transaction ID
	transactionID := s.upiService.GenerateTransactionID()

	// Create transaction record
	transaction := &models.Transaction{
		UserID:        userID,
		TransactionID: transactionID,
		Type:          models.TransactionTypeP2P,
		Amount:        req.Amount,
		Currency:      "INR",
		Description:   req.Description,
		Reference:     req.Reference,
		PayerVPA:      req.PayerVPA,
		PayeeVPA:      req.PayeeVPA,
		PayeeName:     payeeInfo.Name,
		PayeeBankCode: payeeInfo.BankCode,
		Status:        models.TransactionStatusPending,
		InitiatedAt:   time.Now(),
		DeviceID:      req.DeviceID,
		IPAddress:     req.IPAddress,
		AuthMethod:    "pin",
		RiskScore:     s.calculateRiskScore(userID, req.Amount, req.PayeeVPA),
	}

	// Save transaction to database
	if err := s.transactionRepo.Create(transaction); err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Process payment through UPI
	if err := s.upiService.ProcessPayment(transaction); err != nil {
		// Update transaction status in database
		s.transactionRepo.Update(transaction)
		return &PaymentResponse{
			TransactionID: transactionID,
			Status:        transaction.Status,
			Message:       "Payment processing failed",
			Transaction:   transaction,
		}, nil
	}

	// Update transaction in database
	if err := s.transactionRepo.Update(transaction); err != nil {
		s.logger.WithError(err).Error("Failed to update transaction after processing")
	}

	s.logger.WithFields(logrus.Fields{
		"transaction_id": transactionID,
		"status":         transaction.Status,
		"rrn":            transaction.RRN,
	}).Info("Send money transaction completed")

	return &PaymentResponse{
		TransactionID: transactionID,
		Status:        transaction.Status,
		Message:       "Payment processed successfully",
		RRN:           transaction.RRN,
		ProcessedAt:   transaction.ProcessedAt,
		Transaction:   transaction,
	}, nil
}

// RequestMoney creates a payment request
func (s *PaymentService) RequestMoney(userID uuid.UUID, req RequestMoneyRequest) (*models.PaymentRequest, error) {
	s.logger.WithFields(logrus.Fields{
		"user_id":       userID,
		"requester_vpa": req.RequesterVPA,
		"payer_vpa":     req.PayerVPA,
		"amount":        req.Amount,
	}).Info("Creating payment request")

	// Validate VPAs
	if valid, err := s.upiService.ValidateVPA(req.RequesterVPA); !valid {
		return nil, fmt.Errorf("invalid requester VPA: %w", err)
	}

	if valid, err := s.upiService.ValidateVPA(req.PayerVPA); !valid {
		return nil, fmt.Errorf("invalid payer VPA: %w", err)
	}

	// Set default expiry if not provided
	expiresIn := req.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 24 // Default 24 hours
	}

	// Generate request ID
	requestID := fmt.Sprintf("REQ%s%d", uuid.New().String()[:8], time.Now().Unix())

	// Create payment request
	paymentRequest := &models.PaymentRequest{
		UserID:       userID,
		RequestID:    requestID,
		Amount:       req.Amount,
		Currency:     "INR",
		Description:  req.Description,
		Reference:    req.Reference,
		RequesterVPA: req.RequesterVPA,
		PayerVPA:     req.PayerVPA,
		Status:       models.PaymentRequestStatusPending,
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Hour),
	}

	// Save to database (assuming we have a payment request repository)
	// For now, we'll just return the created request

	s.logger.WithField("request_id", requestID).Info("Payment request created")

	return paymentRequest, nil
}

// GetTransactionHistory gets transaction history for a user
func (s *PaymentService) GetTransactionHistory(userID uuid.UUID, limit, offset int) ([]models.Transaction, error) {
	return s.transactionRepo.GetByUserID(userID, limit, offset)
}

// GetTransaction gets a specific transaction
func (s *PaymentService) GetTransaction(userID uuid.UUID, transactionID string) (*models.Transaction, error) {
	transaction, err := s.transactionRepo.GetByTransactionID(transactionID)
	if err != nil {
		return nil, err
	}

	// Verify transaction belongs to user
	if transaction.UserID != userID {
		return nil, fmt.Errorf("transaction not found")
	}

	return transaction, nil
}

// CancelTransaction cancels a pending transaction
func (s *PaymentService) CancelTransaction(userID uuid.UUID, transactionID string) error {
	transaction, err := s.transactionRepo.GetByTransactionID(transactionID)
	if err != nil {
		return fmt.Errorf("transaction not found")
	}

	// Verify transaction belongs to user
	if transaction.UserID != userID {
		return fmt.Errorf("transaction not found")
	}

	// Check if transaction can be cancelled
	if !transaction.IsPending() {
		return fmt.Errorf("transaction cannot be cancelled")
	}

	// Update status
	transaction.Status = models.TransactionStatusCancelled
	now := time.Now()
	transaction.CompletedAt = &now

	if err := s.transactionRepo.Update(transaction); err != nil {
		return fmt.Errorf("failed to cancel transaction: %w", err)
	}

	s.logger.WithField("transaction_id", transactionID).Info("Transaction cancelled")

	return nil
}

// GetTransactionStatus gets the current status of a transaction
func (s *PaymentService) GetTransactionStatus(userID uuid.UUID, transactionID string) (*models.Transaction, error) {
	transaction, err := s.transactionRepo.GetByTransactionID(transactionID)
	if err != nil {
		return nil, err
	}

	// Verify transaction belongs to user
	if transaction.UserID != userID {
		return nil, fmt.Errorf("transaction not found")
	}

	// If transaction is pending, check with UPI service for updates
	if transaction.IsPending() {
		status, err := s.upiService.GetTransactionStatus(transactionID, transaction.RRN)
		if err != nil {
			s.logger.WithError(err).Error("Failed to get transaction status from UPI service")
			return transaction, nil
		}

		// Update transaction status if changed
		if string(status.Status) != string(transaction.Status) {
			switch status.Status {
			case TransactionStatusSuccess:
				transaction.MarkAsCompleted()
			case TransactionStatusFailed:
				transaction.MarkAsFailed(status.ErrorCode, status.ErrorMessage)
			case TransactionStatusTimeout:
				transaction.Status = models.TransactionStatusTimeout
			case TransactionStatusCancelled:
				transaction.Status = models.TransactionStatusCancelled
			}

			s.transactionRepo.Update(transaction)
		}
	}

	return transaction, nil
}

// calculateRiskScore calculates risk score for a transaction
func (s *PaymentService) calculateRiskScore(userID uuid.UUID, amount decimal.Decimal, payeeVPA string) int {
	score := 0

	// Amount-based risk
	if amount.GreaterThan(decimal.NewFromInt(10000)) {
		score += 20
	} else if amount.GreaterThan(decimal.NewFromInt(5000)) {
		score += 10
	}

	// Time-based risk (late night transactions)
	hour := time.Now().Hour()
	if hour < 6 || hour > 22 {
		score += 15
	}

	// Frequency-based risk (multiple transactions in short time)
	// This would require checking recent transactions - simplified for now
	score += 5

	// VPA pattern risk (suspicious patterns)
	if len(payeeVPA) < 5 {
		score += 10
	}

	// Cap the score at 100
	if score > 100 {
		score = 100
	}

	return score
}

// ProcessPendingTransactions processes pending transactions (background job)
func (s *PaymentService) ProcessPendingTransactions() error {
	transactions, err := s.transactionRepo.GetPendingTransactions()
	if err != nil {
		return fmt.Errorf("failed to get pending transactions: %w", err)
	}

	for _, transaction := range transactions {
		// Check transaction age - timeout old transactions
		if time.Since(transaction.InitiatedAt) > 5*time.Minute {
			transaction.Status = models.TransactionStatusTimeout
			transaction.ErrorMessage = "Transaction timed out"
			now := time.Now()
			transaction.CompletedAt = &now

			if err := s.transactionRepo.Update(&transaction); err != nil {
				s.logger.WithError(err).Error("Failed to timeout transaction")
			}
			continue
		}

		// Check status with UPI service
		status, err := s.upiService.GetTransactionStatus(transaction.TransactionID, transaction.RRN)
		if err != nil {
			s.logger.WithError(err).Error("Failed to get transaction status")
			continue
		}

		// Update transaction based on status
		updated := false
		switch status.Status {
		case TransactionStatusSuccess:
			transaction.MarkAsCompleted()
			updated = true
		case TransactionStatusFailed:
			transaction.MarkAsFailed(status.ErrorCode, status.ErrorMessage)
			updated = true
		case TransactionStatusTimeout:
			transaction.Status = models.TransactionStatusTimeout
			updated = true
		case TransactionStatusCancelled:
			transaction.Status = models.TransactionStatusCancelled
			updated = true
		}

		if updated {
			if err := s.transactionRepo.Update(&transaction); err != nil {
				s.logger.WithError(err).Error("Failed to update transaction status")
			}
		}
	}

	return nil
}
