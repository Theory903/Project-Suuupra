package service

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"

	"upi-core/internal/domain/repository"
	"upi-core/internal/infrastructure/kafka"
	"upi-core/internal/infrastructure/redis"
	pb "upi-core/pkg/pb"
)

// TransactionService handles all transaction-related business logic with ACID guarantees
type TransactionService struct {
	repo        repository.TransactionRepository
	redis       *redis.Client
	kafka       *kafka.Producer
	logger      *logrus.Logger
	bankClients map[string]BankClient // gRPC clients for each bank
}

// BankClient interface for communicating with banks
type BankClient interface {
	ProcessTransaction(ctx context.Context, req *BankTransactionRequest) (*BankTransactionResponse, error)
	GetAccountBalance(ctx context.Context, bankCode, accountNumber string) (int64, error)
	CheckAccountStatus(ctx context.Context, bankCode, accountNumber string) (string, error)
}

// BankTransactionRequest represents a request to a bank
type BankTransactionRequest struct {
	TransactionID string
	BankCode      string
	AccountNumber string
	AmountPaisa   int64
	Type          string // DEBIT or CREDIT
	Reference     string
	Description   string
	Signature     string
	InitiatedAt   time.Time
}

// BankTransactionResponse represents a response from a bank
type BankTransactionResponse struct {
	TransactionID       string
	BankReferenceID     string
	Status              string
	AccountBalancePaisa int64
	ErrorCode           string
	ErrorMessage        string
	ProcessedAt         time.Time
	Fees                *pb.TransactionFees
}

// TransactionResult represents the result of transaction processing
type TransactionResult struct {
	Transaction   *repository.Transaction
	PayerResponse *BankTransactionResponse
	PayeeResponse *BankTransactionResponse
	Events        []TransactionEvent
}

// TransactionEvent represents an event that occurred during transaction processing
type TransactionEvent struct {
	Type        string
	Description string
	Timestamp   time.Time
	Details     map[string]interface{}
}

// NewTransactionService creates a new transaction service
func NewTransactionService(
	repo repository.TransactionRepository,
	redis *redis.Client,
	kafka *kafka.Producer,
	logger *logrus.Logger,
) *TransactionService {
	return &TransactionService{
		repo:        repo,
		redis:       redis,
		kafka:       kafka,
		logger:      logger,
		bankClients: make(map[string]BankClient),
	}
}

// ProcessTransaction handles the complete transaction processing with ACID guarantees
func (s *TransactionService) ProcessTransaction(ctx context.Context, req *pb.TransactionRequest) (*pb.TransactionResponse, error) {
	// Generate correlation ID for tracing
	correlationID := s.generateCorrelationID()

	logger := s.logger.WithFields(logrus.Fields{
		"transaction_id": req.TransactionId,
		"correlation_id": correlationID,
		"payer_vpa":      req.PayerVpa,
		"payee_vpa":      req.PayeeVpa,
		"amount_paisa":   req.AmountPaisa,
	})

	logger.Info("Starting transaction processing")

	// Step 1: Check idempotency
	idempotencyKey := s.generateIdempotencyKey(req)
	exists, cachedResponse, err := s.repo.CheckIdempotencyKey(ctx, idempotencyKey)
	if err != nil {
		logger.WithError(err).Error("Failed to check idempotency key")
		return s.createErrorResponse(req.TransactionId, "SYSTEM_ERROR", "Internal system error"), nil
	}

	if exists {
		logger.Info("Returning cached response for idempotent request")
		var response pb.TransactionResponse
		json.Unmarshal([]byte(cachedResponse), &response)
		return &response, nil
	}

	// Step 2: Validate request
	if err := s.validateTransactionRequest(req); err != nil {
		logger.WithError(err).Error("Transaction validation failed")
		return s.createErrorResponse(req.TransactionId, "VALIDATION_ERROR", err.Error()), nil
	}

	// Step 3: Resolve VPAs to bank accounts
	payerMapping, payeeMapping, err := s.resolveVPAs(ctx, req.PayerVpa, req.PayeeVpa)
	if err != nil {
		logger.WithError(err).Error("VPA resolution failed")
		return s.createErrorResponse(req.TransactionId, "VPA_RESOLUTION_ERROR", err.Error()), nil
	}

	// Step 4: Check bank availability
	if err := s.checkBankAvailability(ctx, payerMapping.BankCode, payeeMapping.BankCode); err != nil {
		logger.WithError(err).Error("Bank availability check failed")
		return s.createErrorResponse(req.TransactionId, "BANK_UNAVAILABLE", err.Error()), nil
	}

	// Step 5: Process transaction with ACID guarantees
	result, err := s.processTransactionWithACID(ctx, req, payerMapping, payeeMapping, correlationID)
	if err != nil {
		logger.WithError(err).Error("Transaction processing failed")
		return s.createErrorResponse(req.TransactionId, "PROCESSING_ERROR", err.Error()), nil
	}

	// Step 6: Create response
	response := s.createSuccessResponse(result)

	// Step 7: Cache response for idempotency
	responseData, _ := json.Marshal(response)
	s.repo.StoreIdempotencyKey(ctx, nil, idempotencyKey, "transaction", req.TransactionId, responseData, time.Now().Add(24*time.Hour))

	// Step 8: Publish events asynchronously
	go s.publishTransactionEvents(ctx, result)

	logger.Info("Transaction processing completed successfully")
	return response, nil
}

// processTransactionWithACID handles the core transaction processing with full ACID guarantees
func (s *TransactionService) processTransactionWithACID(
	ctx context.Context,
	req *pb.TransactionRequest,
	payerMapping *repository.VPAMapping,
	payeeMapping *repository.VPAMapping,
	correlationID string,
) (*TransactionResult, error) {
	// Start database transaction for ACID guarantees
	tx, err := s.repo.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Ensure transaction is rolled back if anything fails
	defer func() {
		if err != nil {
			s.repo.RollbackTransaction(tx)
		}
	}()

	// Create transaction record
	transaction := &repository.Transaction{
		TransactionID:  req.TransactionId,
		RRN:            s.generateRRN(),
		PayerVPA:       req.PayerVpa,
		PayeeVPA:       req.PayeeVpa,
		AmountPaisa:    req.AmountPaisa,
		Currency:       "INR",
		Type:           repository.TransactionType(req.Type.String()),
		Status:         repository.StatusPending,
		Description:    req.Description,
		Reference:      req.Reference,
		PayerBankCode:  payerMapping.BankCode,
		PayeeBankCode:  payeeMapping.BankCode,
		SwitchFeePaisa: s.calculateSwitchFee(req.AmountPaisa),
		BankFeePaisa:   s.calculateBankFee(req.AmountPaisa),
		Signature:      req.Signature,
		Metadata:       req.Metadata,
		InitiatedAt:    req.InitiatedAt.AsTime(),
		ExpiresAt:      &[]time.Time{time.Now().Add(5 * time.Minute)}[0], // 5-minute timeout
	}

	// Calculate total fees
	transaction.TotalFeePaisa = transaction.SwitchFeePaisa + transaction.BankFeePaisa

	// Insert transaction record
	if err = s.repo.CreateTransaction(ctx, tx, transaction); err != nil {
		return nil, fmt.Errorf("failed to create transaction record: %w", err)
	}

	// Log audit trail
	s.repo.LogAudit(ctx, tx, "transaction", req.TransactionId, "CREATE", "SYSTEM", nil, map[string]interface{}{
		"status":       string(transaction.Status),
		"amount_paisa": transaction.AmountPaisa,
		"payer_vpa":    transaction.PayerVPA,
		"payee_vpa":    transaction.PayeeVPA,
		"payer_bank":   transaction.PayerBankCode,
		"payee_bank":   transaction.PayeeBankCode,
	}, correlationID)

	result := &TransactionResult{
		Transaction: transaction,
		Events:      []TransactionEvent{},
	}

	// Step 1: Process debit at payer's bank
	s.addEvent(result, "DEBIT_INITIATED", "Initiating debit from payer account", map[string]interface{}{
		"bank_code": payerMapping.BankCode,
		"account":   payerMapping.AccountNumber,
		"amount":    req.AmountPaisa,
	})

	payerResponse, err := s.processDebit(ctx, transaction, payerMapping)
	if err != nil {
		// Update transaction status to failed
		s.repo.UpdateTransactionStatus(ctx, tx, req.TransactionId, repository.StatusFailed, "Debit failed", "DEBIT_FAILED", err.Error())
		s.addEvent(result, "DEBIT_FAILED", "Debit processing failed", map[string]interface{}{
			"error": err.Error(),
		})
		return result, fmt.Errorf("debit processing failed: %w", err)
	}

	result.PayerResponse = payerResponse
	s.addEvent(result, "DEBIT_SUCCESS", "Debit processed successfully", map[string]interface{}{
		"bank_reference_id": payerResponse.BankReferenceID,
		"new_balance":       payerResponse.AccountBalancePaisa,
	})

	// Step 2: Process credit at payee's bank
	s.addEvent(result, "CREDIT_INITIATED", "Initiating credit to payee account", map[string]interface{}{
		"bank_code": payeeMapping.BankCode,
		"account":   payeeMapping.AccountNumber,
		"amount":    req.AmountPaisa,
	})

	payeeResponse, err := s.processCredit(ctx, transaction, payeeMapping)
	if err != nil {
		// Credit failed - need to reverse the debit (compensating transaction)
		s.addEvent(result, "CREDIT_FAILED", "Credit processing failed, initiating reversal", map[string]interface{}{
			"error": err.Error(),
		})

		// Attempt to reverse the debit
		if reverseErr := s.reverseDebit(ctx, transaction, payerMapping, payerResponse.BankReferenceID); reverseErr != nil {
			// Critical error - both debit and reversal failed
			s.repo.UpdateTransactionStatus(ctx, tx, req.TransactionId, repository.StatusFailed, "Credit failed and reversal failed", "CRITICAL_ERROR", fmt.Sprintf("Credit error: %s, Reversal error: %s", err.Error(), reverseErr.Error()))
			s.addEvent(result, "REVERSAL_FAILED", "Failed to reverse debit", map[string]interface{}{
				"reversal_error": reverseErr.Error(),
			})
			return result, fmt.Errorf("critical error: credit failed and reversal failed: %w", reverseErr)
		}

		// Reversal successful
		s.repo.UpdateTransactionStatus(ctx, tx, req.TransactionId, repository.StatusReversed, "Credit failed, debit reversed", "CREDIT_FAILED", err.Error())
		s.addEvent(result, "REVERSAL_SUCCESS", "Debit successfully reversed", nil)
		return result, fmt.Errorf("credit processing failed, transaction reversed: %w", err)
	}

	result.PayeeResponse = payeeResponse
	s.addEvent(result, "CREDIT_SUCCESS", "Credit processed successfully", map[string]interface{}{
		"bank_reference_id": payeeResponse.BankReferenceID,
		"new_balance":       payeeResponse.AccountBalancePaisa,
	})

	// Step 3: Update transaction to success
	if err = s.repo.UpdateTransactionStatus(ctx, tx, req.TransactionId, repository.StatusSuccess, "Transaction completed successfully", "", ""); err != nil {
		return result, fmt.Errorf("failed to update transaction status: %w", err)
	}

	// Step 4: Commit the database transaction
	if err = s.repo.CommitTransaction(tx); err != nil {
		return result, fmt.Errorf("failed to commit transaction: %w", err)
	}

	s.addEvent(result, "TRANSACTION_SUCCESS", "Transaction completed successfully", map[string]interface{}{
		"final_status": "SUCCESS",
	})

	// Update transaction status in result
	transaction.Status = repository.StatusSuccess
	transaction.ProcessedAt = &[]time.Time{time.Now()}[0]

	return result, nil
}

// resolveVPAs resolves both payer and payee VPAs to bank account information
func (s *TransactionService) resolveVPAs(ctx context.Context, payerVPA, payeeVPA string) (*repository.VPAMapping, *repository.VPAMapping, error) {
	// Try Redis cache first
	payerMapping, err := s.getVPAFromCache(ctx, payerVPA)
	if err != nil {
		// Cache miss - get from database
		payerMapping, err = s.repo.GetVPAMapping(ctx, payerVPA)
		if err != nil {
			return nil, nil, fmt.Errorf("payer VPA not found: %s", payerVPA)
		}
		// Cache for future use
		s.cacheVPAMapping(ctx, payerMapping)
	}

	payeeMapping, err := s.getVPAFromCache(ctx, payeeVPA)
	if err != nil {
		// Cache miss - get from database
		payeeMapping, err = s.repo.GetVPAMapping(ctx, payeeVPA)
		if err != nil {
			return nil, nil, fmt.Errorf("payee VPA not found: %s", payeeVPA)
		}
		// Cache for future use
		s.cacheVPAMapping(ctx, payeeMapping)
	}

	return payerMapping, payeeMapping, nil
}

// processDebit processes debit transaction at payer's bank
func (s *TransactionService) processDebit(ctx context.Context, transaction *repository.Transaction, payerMapping *repository.VPAMapping) (*BankTransactionResponse, error) {
	bankClient, exists := s.bankClients[payerMapping.BankCode]
	if !exists {
		return nil, fmt.Errorf("bank client not found for bank: %s", payerMapping.BankCode)
	}

	debitRequest := &BankTransactionRequest{
		TransactionID: transaction.TransactionID,
		BankCode:      payerMapping.BankCode,
		AccountNumber: payerMapping.AccountNumber,
		AmountPaisa:   transaction.AmountPaisa,
		Type:          "DEBIT",
		Reference:     transaction.Reference,
		Description:   transaction.Description,
		Signature:     transaction.Signature,
		InitiatedAt:   transaction.InitiatedAt,
	}

	response, err := bankClient.ProcessTransaction(ctx, debitRequest)
	if err != nil {
		return nil, fmt.Errorf("debit request failed: %w", err)
	}

	if response.Status != "SUCCESS" {
		return nil, fmt.Errorf("debit rejected by bank: %s - %s", response.ErrorCode, response.ErrorMessage)
	}

	return response, nil
}

// processCredit processes credit transaction at payee's bank
func (s *TransactionService) processCredit(ctx context.Context, transaction *repository.Transaction, payeeMapping *repository.VPAMapping) (*BankTransactionResponse, error) {
	bankClient, exists := s.bankClients[payeeMapping.BankCode]
	if !exists {
		return nil, fmt.Errorf("bank client not found for bank: %s", payeeMapping.BankCode)
	}

	creditRequest := &BankTransactionRequest{
		TransactionID: transaction.TransactionID,
		BankCode:      payeeMapping.BankCode,
		AccountNumber: payeeMapping.AccountNumber,
		AmountPaisa:   transaction.AmountPaisa,
		Type:          "CREDIT",
		Reference:     transaction.Reference,
		Description:   transaction.Description,
		Signature:     transaction.Signature,
		InitiatedAt:   transaction.InitiatedAt,
	}

	response, err := bankClient.ProcessTransaction(ctx, creditRequest)
	if err != nil {
		return nil, fmt.Errorf("credit request failed: %w", err)
	}

	if response.Status != "SUCCESS" {
		return nil, fmt.Errorf("credit rejected by bank: %s - %s", response.ErrorCode, response.ErrorMessage)
	}

	return response, nil
}

// reverseDebit reverses a debit transaction (compensating transaction)
func (s *TransactionService) reverseDebit(ctx context.Context, transaction *repository.Transaction, payerMapping *repository.VPAMapping, bankReferenceID string) error {
	bankClient, exists := s.bankClients[payerMapping.BankCode]
	if !exists {
		return fmt.Errorf("bank client not found for bank: %s", payerMapping.BankCode)
	}

	reverseRequest := &BankTransactionRequest{
		TransactionID: transaction.TransactionID + "_REVERSE",
		BankCode:      payerMapping.BankCode,
		AccountNumber: payerMapping.AccountNumber,
		AmountPaisa:   transaction.AmountPaisa,
		Type:          "CREDIT", // Reverse debit = credit
		Reference:     "REVERSAL_" + bankReferenceID,
		Description:   "Reversal: " + transaction.Description,
		InitiatedAt:   time.Now(),
	}

	response, err := bankClient.ProcessTransaction(ctx, reverseRequest)
	if err != nil {
		return fmt.Errorf("reversal request failed: %w", err)
	}

	if response.Status != "SUCCESS" {
		return fmt.Errorf("reversal rejected by bank: %s - %s", response.ErrorCode, response.ErrorMessage)
	}

	return nil
}

// Helper methods
func (s *TransactionService) validateTransactionRequest(req *pb.TransactionRequest) error {
	if req.TransactionId == "" {
		return fmt.Errorf("transaction ID is required")
	}
	if req.PayerVpa == "" {
		return fmt.Errorf("payer VPA is required")
	}
	if req.PayeeVpa == "" {
		return fmt.Errorf("payee VPA is required")
	}
	if req.AmountPaisa <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	if req.PayerVpa == req.PayeeVpa {
		return fmt.Errorf("payer and payee VPA cannot be the same")
	}
	return nil
}

func (s *TransactionService) generateCorrelationID() string {
	return fmt.Sprintf("CORR_%d", time.Now().UnixNano())
}

func (s *TransactionService) generateIdempotencyKey(req *pb.TransactionRequest) string {
	data := fmt.Sprintf("%s_%s_%s_%d_%s", req.TransactionId, req.PayerVpa, req.PayeeVpa, req.AmountPaisa, req.InitiatedAt.String())
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash)
}

func (s *TransactionService) generateRRN() string {
	return fmt.Sprintf("RRN%d", time.Now().UnixNano())
}

func (s *TransactionService) calculateSwitchFee(amountPaisa int64) int64 {
	// Simple fee calculation - 0.1% with minimum of 1 paisa
	fee := amountPaisa / 1000
	if fee < 1 {
		fee = 1
	}
	return fee
}

func (s *TransactionService) calculateBankFee(amountPaisa int64) int64 {
	// Simple bank fee calculation - 0.05% with minimum of 1 paisa
	fee := amountPaisa / 2000
	if fee < 1 {
		fee = 1
	}
	return fee
}

func (s *TransactionService) checkBankAvailability(ctx context.Context, payerBankCode, payeeBankCode string) error {
	// Check if banks are available and healthy
	payerBank, err := s.repo.GetBankByCode(ctx, payerBankCode)
	if err != nil {
		return fmt.Errorf("payer bank not found: %s", payerBankCode)
	}
	if payerBank.Status != "ACTIVE" {
		return fmt.Errorf("payer bank is not active: %s", payerBankCode)
	}

	payeeBank, err := s.repo.GetBankByCode(ctx, payeeBankCode)
	if err != nil {
		return fmt.Errorf("payee bank not found: %s", payeeBankCode)
	}
	if payeeBank.Status != "ACTIVE" {
		return fmt.Errorf("payee bank is not active: %s", payeeBankCode)
	}

	return nil
}

func (s *TransactionService) getVPAFromCache(ctx context.Context, vpa string) (*repository.VPAMapping, error) {
	_, _, err := s.redis.GetVPAMapping(ctx, vpa)
	if err != nil {
		return nil, err
	}

	// Get additional details from database (this could be cached too)
	return s.repo.GetVPAMapping(ctx, vpa)
}

func (s *TransactionService) cacheVPAMapping(ctx context.Context, mapping *repository.VPAMapping) {
	s.redis.SetVPAMapping(ctx, mapping.VPA, mapping.BankCode, mapping.AccountNumber, 24*time.Hour)
}

func (s *TransactionService) addEvent(result *TransactionResult, eventType, description string, details map[string]interface{}) {
	result.Events = append(result.Events, TransactionEvent{
		Type:        eventType,
		Description: description,
		Timestamp:   time.Now(),
		Details:     details,
	})
}

func (s *TransactionService) createErrorResponse(transactionID, errorCode, errorMessage string) *pb.TransactionResponse {
	return &pb.TransactionResponse{
		TransactionId: transactionID,
		Status:        pb.TransactionStatus_TRANSACTION_STATUS_FAILED,
		ErrorCode:     errorCode,
		ErrorMessage:  errorMessage,
		ProcessedAt:   timestamppb.Now(),
	}
}

func (s *TransactionService) createSuccessResponse(result *TransactionResult) *pb.TransactionResponse {
	return &pb.TransactionResponse{
		TransactionId: result.Transaction.TransactionID,
		Rrn:           result.Transaction.RRN,
		Status:        pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		PayerBankCode: result.Transaction.PayerBankCode,
		PayeeBankCode: result.Transaction.PayeeBankCode,
		ProcessedAt:   timestamppb.New(*result.Transaction.ProcessedAt),
		Fees: &pb.TransactionFees{
			SwitchFeePaisa: result.Transaction.SwitchFeePaisa,
			BankFeePaisa:   result.Transaction.BankFeePaisa,
			TotalFeePaisa:  result.Transaction.TotalFeePaisa,
		},
		SettlementId: result.Transaction.SettlementID,
	}
}

func (s *TransactionService) publishTransactionEvents(ctx context.Context, result *TransactionResult) {
	for _, event := range result.Events {
		eventData := map[string]interface{}{
			"transaction_id": result.Transaction.TransactionID,
			"event_type":     event.Type,
			"description":    event.Description,
			"timestamp":      event.Timestamp,
			"details":        event.Details,
		}

		eventBytes, _ := json.Marshal(eventData)
		s.kafka.PublishTransactionEvent(ctx, result.Transaction.TransactionID, eventBytes)
	}
}
