package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/suuupra/upi-psp/internal/config"
	"github.com/suuupra/upi-psp/internal/models"
)

// UPIService handles UPI-specific operations
type UPIService struct {
	config     config.UPIConfig
	logger     *logrus.Logger
	grpcClient UPICoreClient
}

// UPICoreClient interface for UPI Core gRPC client
type UPICoreClient interface {
	ProcessTransaction(ctx context.Context, req *TransactionRequest) (*TransactionResponse, error)
	GetTransactionStatus(ctx context.Context, req *TransactionStatusRequest) (*TransactionStatusResponse, error)
	ResolveVPA(ctx context.Context, req *ResolveVPARequest) (*ResolveVPAResponse, error)
}

// Mock UPI Core client for now - replace with actual gRPC client
type mockUPICoreClient struct {
	logger *logrus.Logger
}

func (m *mockUPICoreClient) ProcessTransaction(ctx context.Context, req *TransactionRequest) (*TransactionResponse, error) {
	m.logger.WithFields(logrus.Fields{
		"transaction_id": req.TransactionID,
		"amount":         req.Amount,
		"payer_vpa":      req.PayerVPA,
		"payee_vpa":      req.PayeeVPA,
	}).Info("Processing UPI transaction")

	// Simulate processing
	time.Sleep(100 * time.Millisecond)

	// Mock successful response
	return &TransactionResponse{
		TransactionID: req.TransactionID,
		RRN:           fmt.Sprintf("RRN%d", time.Now().Unix()),
		Status:        TransactionStatusSuccess,
		ProcessedAt:   time.Now(),
	}, nil
}

func (m *mockUPICoreClient) GetTransactionStatus(ctx context.Context, req *TransactionStatusRequest) (*TransactionStatusResponse, error) {
	return &TransactionStatusResponse{
		TransactionID: req.TransactionID,
		Status:        TransactionStatusSuccess,
	}, nil
}

func (m *mockUPICoreClient) ResolveVPA(ctx context.Context, req *ResolveVPARequest) (*ResolveVPAResponse, error) {
	return &ResolveVPAResponse{
		VPA:      req.VPA,
		Name:     "John Doe",
		BankCode: "HDFC",
		IsValid:  true,
	}, nil
}

// UPI transaction request/response structures
type TransactionRequest struct {
	TransactionID string          `json:"transaction_id"`
	PayerVPA      string          `json:"payer_vpa"`
	PayeeVPA      string          `json:"payee_vpa"`
	Amount        decimal.Decimal `json:"amount"`
	Currency      string          `json:"currency"`
	Description   string          `json:"description"`
	Reference     string          `json:"reference"`
	Type          string          `json:"type"`
}

type TransactionResponse struct {
	TransactionID string            `json:"transaction_id"`
	RRN           string            `json:"rrn"`
	Status        TransactionStatus `json:"status"`
	ErrorCode     string            `json:"error_code,omitempty"`
	ErrorMessage  string            `json:"error_message,omitempty"`
	ProcessedAt   time.Time         `json:"processed_at"`
}

type TransactionStatusRequest struct {
	TransactionID string `json:"transaction_id"`
	RRN           string `json:"rrn,omitempty"`
}

type TransactionStatusResponse struct {
	TransactionID string            `json:"transaction_id"`
	Status        TransactionStatus `json:"status"`
	RRN           string            `json:"rrn"`
	ErrorCode     string            `json:"error_code,omitempty"`
	ErrorMessage  string            `json:"error_message,omitempty"`
}

type ResolveVPARequest struct {
	VPA string `json:"vpa"`
}

type ResolveVPAResponse struct {
	VPA      string `json:"vpa"`
	Name     string `json:"name"`
	BankCode string `json:"bank_code"`
	IsValid  bool   `json:"is_valid"`
}

type TransactionStatus string

const (
	TransactionStatusPending   TransactionStatus = "pending"
	TransactionStatusSuccess   TransactionStatus = "success"
	TransactionStatusFailed    TransactionStatus = "failed"
	TransactionStatusTimeout   TransactionStatus = "timeout"
	TransactionStatusCancelled TransactionStatus = "cancelled"
)

// NewUPIService creates a new UPI service
func NewUPIService(config config.UPIConfig, logger *logrus.Logger) *UPIService {
	// For now, use mock client. Replace with actual gRPC client later
	grpcClient := &mockUPICoreClient{logger: logger}

	return &UPIService{
		config:     config,
		logger:     logger,
		grpcClient: grpcClient,
	}
}

// ProcessPayment processes a UPI payment
func (s *UPIService) ProcessPayment(transaction *models.Transaction) error {
	s.logger.WithFields(logrus.Fields{
		"transaction_id": transaction.TransactionID,
		"amount":         transaction.Amount,
		"payer_vpa":      transaction.PayerVPA,
		"payee_vpa":      transaction.PayeeVPA,
	}).Info("Processing UPI payment")

	// Create UPI transaction request
	req := &TransactionRequest{
		TransactionID: transaction.TransactionID,
		PayerVPA:      transaction.PayerVPA,
		PayeeVPA:      transaction.PayeeVPA,
		Amount:        transaction.Amount,
		Currency:      transaction.Currency,
		Description:   transaction.Description,
		Reference:     transaction.Reference,
		Type:          string(transaction.Type),
	}

	// Call UPI Core service
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	resp, err := s.grpcClient.ProcessTransaction(ctx, req)
	if err != nil {
		s.logger.WithError(err).Error("UPI transaction failed")
		transaction.MarkAsFailed("UPI_SERVICE_ERROR", err.Error())
		return err
	}

	// Update transaction based on response
	if resp.Status == TransactionStatusSuccess {
		transaction.RRN = resp.RRN
		transaction.MarkAsCompleted()
		s.logger.WithField("rrn", resp.RRN).Info("UPI transaction completed successfully")
	} else {
		transaction.MarkAsFailed(resp.ErrorCode, resp.ErrorMessage)
		s.logger.WithFields(logrus.Fields{
			"error_code":    resp.ErrorCode,
			"error_message": resp.ErrorMessage,
		}).Error("UPI transaction failed")
	}

	return nil
}

// GetTransactionStatus gets the status of a UPI transaction
func (s *UPIService) GetTransactionStatus(transactionID, rrn string) (*TransactionStatusResponse, error) {
	req := &TransactionStatusRequest{
		TransactionID: transactionID,
		RRN:           rrn,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return s.grpcClient.GetTransactionStatus(ctx, req)
}

// ResolveVPA resolves a VPA to get account holder information
func (s *UPIService) ResolveVPA(vpa string) (*ResolveVPAResponse, error) {
	req := &ResolveVPARequest{
		VPA: vpa,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return s.grpcClient.ResolveVPA(ctx, req)
}

// ValidateVPA validates a VPA format and existence
func (s *UPIService) ValidateVPA(vpa string) (bool, error) {
	// Basic format validation
	if len(vpa) < 3 || !contains(vpa, "@") {
		return false, fmt.Errorf("invalid VPA format")
	}

	// Resolve VPA to check if it exists
	resp, err := s.ResolveVPA(vpa)
	if err != nil {
		return false, err
	}

	return resp.IsValid, nil
}

// GenerateTransactionID generates a unique transaction ID
func (s *UPIService) GenerateTransactionID() string {
	return fmt.Sprintf("%s%s%d",
		s.config.PSPID,
		uuid.New().String()[:8],
		time.Now().Unix(),
	)
}

// CreateUPIString creates a UPI payment string for QR codes
func (s *UPIService) CreateUPIString(vpa string, amount decimal.Decimal, description, reference string) string {
	upiString := fmt.Sprintf("upi://pay?pa=%s", vpa)

	if !amount.IsZero() {
		upiString += fmt.Sprintf("&am=%s", amount.String())
	}

	if description != "" {
		upiString += fmt.Sprintf("&tn=%s", description)
	}

	if reference != "" {
		upiString += fmt.Sprintf("&tr=%s", reference)
	}

	upiString += fmt.Sprintf("&cu=INR&mc=%s", s.config.MerchantID)

	return upiString
}

// ParseUPIString parses a UPI payment string
type UPIPaymentInfo struct {
	VPA         string          `json:"vpa"`
	Amount      decimal.Decimal `json:"amount"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`
	Currency    string          `json:"currency"`
	MerchantID  string          `json:"merchant_id"`
}

func (s *UPIService) ParseUPIString(upiString string) (*UPIPaymentInfo, error) {
	// This is a simplified parser. In production, use a proper URL parser
	info := &UPIPaymentInfo{
		Currency: "INR",
	}

	// Extract VPA (pa parameter)
	if start := findParam(upiString, "pa="); start != -1 {
		end := findNextParam(upiString, start)
		info.VPA = upiString[start:end]
	}

	// Extract amount (am parameter)
	if start := findParam(upiString, "am="); start != -1 {
		end := findNextParam(upiString, start)
		if amount, err := decimal.NewFromString(upiString[start:end]); err == nil {
			info.Amount = amount
		}
	}

	// Extract description (tn parameter)
	if start := findParam(upiString, "tn="); start != -1 {
		end := findNextParam(upiString, start)
		info.Description = upiString[start:end]
	}

	// Extract reference (tr parameter)
	if start := findParam(upiString, "tr="); start != -1 {
		end := findNextParam(upiString, start)
		info.Reference = upiString[start:end]
	}

	return info, nil
}

// Helper functions
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func findParam(s, param string) int {
	if idx := findString(s, param); idx != -1 {
		return idx + len(param)
	}
	return -1
}

func findNextParam(s string, start int) int {
	for i := start; i < len(s); i++ {
		if s[i] == '&' {
			return i
		}
	}
	return len(s)
}

func findString(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// connectToUPICore establishes gRPC connection to UPI Core service
func (s *UPIService) connectToUPICore(address string) (*grpc.ClientConn, error) {
	conn, err := grpc.Dial(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to UPI Core: %w", err)
	}
	return conn, nil
}
