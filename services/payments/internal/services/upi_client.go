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
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/suuupra/payments/internal/models"
	pb "github.com/suuupra/payments/proto/upi_core"
)

// UPIClient handles communication with UPI Core service
type UPIClient struct {
	conn   *grpc.ClientConn
	client pb.UpiCoreClient
	logger *logrus.Logger
}

// NewUPIClient creates a new UPI client
func NewUPIClient(grpcEndpoint string) (*UPIClient, error) {
	// In production, use proper TLS credentials
	conn, err := grpc.Dial(grpcEndpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to UPI Core service: %w", err)
	}

	return &UPIClient{
		conn:   conn,
		client: pb.NewUpiCoreClient(conn),
		logger: logrus.New(),
	}, nil
}

// Close closes the gRPC connection
func (c *UPIClient) Close() error {
	return c.conn.Close()
}

// UPIPaymentRequest represents a UPI payment request
type UPIPaymentRequest struct {
	PaymentID      uuid.UUID
	PayerVPA       string
	PayeeVPA       string
	Amount         decimal.Decimal
	Currency       string
	Description    string
	MerchantID     string
	TransactionRef string
}

// UPIPaymentResponse represents a UPI payment response
type UPIPaymentResponse struct {
	Success        bool
	TransactionID  string
	Status         string
	FailureCode    *string
	FailureMessage *string
	ProcessedAt    time.Time
}

// ProcessPayment processes a payment through UPI Core
func (c *UPIClient) ProcessPayment(ctx context.Context, req UPIPaymentRequest) (*UPIPaymentResponse, error) {
	log := c.logger.WithFields(logrus.Fields{
		"payment_id":      req.PaymentID,
		"payer_vpa":       req.PayerVPA,
		"payee_vpa":       req.PayeeVPA,
		"amount":          req.Amount.String(),
		"transaction_ref": req.TransactionRef,
	})

	log.Info("Processing UPI payment")

	// Create gRPC request
	grpcReq := &pb.TransactionRequest{
		TransactionId: req.PaymentID.String(),
		PayerVpa:      req.PayerVPA,
		PayeeVpa:      req.PayeeVPA,
		AmountPaisa:   req.Amount.IntPart() * 100, // Convert to paisa
		Type:          pb.TransactionType_TRANSACTION_TYPE_P2M,
		Reference:     req.Description,
		PayerBankCode: "HDFC",  // This should be resolved from VPA
		PayeeBankCode: "ICICI", // This should be resolved from VPA
		InitiatedAt:   timestamppb.Now(),
	}

	// Call UPI Core service
	grpcResp, err := c.client.ProcessTransaction(ctx, grpcReq)
	if err != nil {
		log.WithError(err).Error("Failed to call UPI Core service")
		return &UPIPaymentResponse{
			Success:        false,
			Status:         models.PaymentStatusFailed,
			FailureCode:    func() *string { s := "UPI_SERVICE_ERROR"; return &s }(),
			FailureMessage: func() *string { s := err.Error(); return &s }(),
		}, nil
	}

	// Convert gRPC response to our response format
	response := &UPIPaymentResponse{
		Success:       grpcResp.Status == pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		TransactionID: grpcResp.Rrn,
		ProcessedAt:   time.Now(),
	}

	if response.Success {
		response.Status = models.PaymentStatusSucceeded
	} else {
		response.Status = models.PaymentStatusFailed
		if grpcResp.ErrorCode != "" {
			response.FailureCode = &grpcResp.ErrorCode
			response.FailureMessage = &grpcResp.ErrorMessage
		}
	}

	if response.Success {
		log.WithField("transaction_id", response.TransactionID).Info("UPI payment processed successfully")
	} else {
		log.WithFields(logrus.Fields{
			"failure_code":    response.FailureCode,
			"failure_message": response.FailureMessage,
		}).Error("UPI payment failed")
	}

	return response, nil
}

// UPIRefundRequest represents a UPI refund request
type UPIRefundRequest struct {
	RefundID          uuid.UUID
	OriginalPaymentID uuid.UUID
	TransactionID     string
	Amount            decimal.Decimal
	Currency          string
	Reason            string
}

// UPIRefundResponse represents a UPI refund response
type UPIRefundResponse struct {
	Success         bool
	RefundReference string
	Status          string
	FailureCode     *string
	FailureMessage  *string
	ProcessedAt     time.Time
}

// UPIRefundStatusRequest represents a refund status check request
type UPIRefundStatusRequest struct {
	RefundReference string
	RefundID        uuid.UUID
}

// UPIRefundStatusResponse represents a refund status check response
type UPIRefundStatusResponse struct {
	Success        bool
	Status         string
	FailureCode    *string
	FailureMessage *string
	ProcessedAt    *time.Time
}

// ProcessRefund processes a refund through UPI Core
func (c *UPIClient) ProcessRefund(ctx context.Context, req UPIRefundRequest) (*UPIRefundResponse, error) {
	log := c.logger.WithFields(logrus.Fields{
		"refund_id":           req.RefundID,
		"original_payment_id": req.OriginalPaymentID,
		"transaction_id":      req.TransactionID,
		"amount":              req.Amount.String(),
		"reason":              req.Reason,
	})

	log.Info("Processing UPI refund")

	// Create gRPC refund request
	grpcReq := &pb.RefundRequest{
		RefundId:      req.RefundID.String(),
		TransactionId: req.TransactionID,
		AmountPaisa:   req.Amount.IntPart() * 100, // Convert to paisa
		Reason:        req.Reason,
		InitiatedAt:   timestamppb.Now(),
	}

	// Call UPI Core service for refund processing
	grpcResp, err := c.client.ProcessRefund(ctx, grpcReq)
	if err != nil {
		log.WithError(err).Error("Failed to call UPI Core service for refund")
		return &UPIRefundResponse{
			Success:        false,
			Status:         models.RefundStatusFailed,
			FailureCode:    func() *string { s := "UPI_REFUND_SERVICE_ERROR"; return &s }(),
			FailureMessage: func() *string { s := err.Error(); return &s }(),
			ProcessedAt:    time.Now(),
		}, nil
	}

	// Convert gRPC response to our response format
	response := &UPIRefundResponse{
		Success:         grpcResp.Status == pb.RefundStatus_REFUND_STATUS_SUCCESS,
		RefundReference: grpcResp.RefundRrn,
		ProcessedAt:     grpcResp.ProcessedAt.AsTime(),
	}

	if response.Success {
		response.Status = models.RefundStatusSucceeded
	} else {
		response.Status = models.RefundStatusFailed
		if grpcResp.ErrorCode != "" {
			response.FailureCode = &grpcResp.ErrorCode
			response.FailureMessage = &grpcResp.ErrorMessage
		}
	}

	if response.Success {
		log.WithField("refund_reference", response.RefundReference).Info("UPI refund processed successfully")
	} else {
		log.WithFields(logrus.Fields{
			"failure_code":    response.FailureCode,
			"failure_message": response.FailureMessage,
		}).Error("UPI refund failed")
	}

	return response, nil
}

// CheckPaymentStatus checks the status of a UPI payment
func (c *UPIClient) CheckPaymentStatus(ctx context.Context, transactionID string) (*UPIPaymentResponse, error) {
	log := c.logger.WithField("transaction_id", transactionID)
	log.Info("Checking UPI payment status")

	// Create gRPC status check request
	grpcReq := &pb.StatusCheckRequest{
		TransactionId: transactionID,
	}

	// Call UPI Core service for status check
	grpcResp, err := c.client.CheckTransactionStatus(ctx, grpcReq)
	if err != nil {
		log.WithError(err).Error("Failed to call UPI Core service for status check")
		return &UPIPaymentResponse{
			Success:        false,
			Status:         models.PaymentStatusFailed,
			FailureCode:    func() *string { s := "UPI_STATUS_SERVICE_ERROR"; return &s }(),
			FailureMessage: func() *string { s := err.Error(); return &s }(),
		}, nil
	}

	// Convert gRPC response to our response format
	response := &UPIPaymentResponse{
		Success:       grpcResp.Status == pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		TransactionID: transactionID,
		ProcessedAt:   grpcResp.ProcessedAt.AsTime(),
	}

	// Map UPI Core status to our internal status
	switch grpcResp.Status {
	case pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS:
		response.Status = models.PaymentStatusSucceeded
	case pb.TransactionStatus_TRANSACTION_STATUS_PENDING:
		response.Status = models.PaymentStatusPending
	case pb.TransactionStatus_TRANSACTION_STATUS_FAILED:
		response.Status = models.PaymentStatusFailed
		if grpcResp.ErrorCode != "" {
			response.FailureCode = &grpcResp.ErrorCode
			response.FailureMessage = &grpcResp.ErrorMessage
		}
	case pb.TransactionStatus_TRANSACTION_STATUS_EXPIRED:
		response.Status = models.PaymentStatusExpired
	default:
		response.Status = models.PaymentStatusFailed
		failureMsg := "Unknown transaction status"
		response.FailureMessage = &failureMsg
	}

	log.WithFields(logrus.Fields{
		"status":  response.Status,
		"success": response.Success,
	}).Info("UPI payment status retrieved")

	return response, nil
}

// ValidateVPA validates a Virtual Payment Address
func (c *UPIClient) ValidateVPA(ctx context.Context, vpa string) (bool, error) {
	log := c.logger.WithField("vpa", vpa)
	log.Info("Validating VPA")

	// Basic format validation first
	if len(vpa) < 6 || !contains(vpa, "@") {
		log.Warn("VPA validation failed: invalid format")
		return false, fmt.Errorf("invalid VPA format")
	}

	// Create gRPC VPA validation request
	grpcReq := &pb.VpaValidationRequest{
		Vpa: vpa,
	}

	// Call UPI Core service for VPA validation
	grpcResp, err := c.client.ValidateVpa(ctx, grpcReq)
	if err != nil {
		log.WithError(err).Error("Failed to call UPI Core service for VPA validation")
		// Fall back to basic validation if service is unavailable
		return len(vpa) >= 6 && contains(vpa, "@"), nil
	}

	// Check validation result
	isValid := grpcResp.IsValid

	if isValid {
		log.WithFields(logrus.Fields{
			"bank_code": grpcResp.BankCode,
			"bank_name": grpcResp.BankName,
		}).Info("VPA validation successful")
	} else {
		log.WithField("error_message", grpcResp.ErrorMessage).Warn("VPA validation failed")
	}

	return isValid, nil
}

// CheckRefundStatus checks the status of a UPI refund
func (c *UPIClient) CheckRefundStatus(ctx context.Context, req UPIRefundStatusRequest) (*UPIRefundStatusResponse, error) {
	log := c.logger.WithFields(logrus.Fields{
		"refund_reference": req.RefundReference,
		"refund_id":        req.RefundID,
	})

	log.Info("Checking UPI refund status")

	// Create gRPC refund status check request
	grpcReq := &pb.RefundStatusRequest{
		RefundReference: req.RefundReference,
	}

	// Call UPI Core service for refund status check
	grpcResp, err := c.client.CheckRefundStatus(ctx, grpcReq)
	if err != nil {
		log.WithError(err).Error("Failed to call UPI Core service for refund status check")
		return &UPIRefundStatusResponse{
			Success:        false,
			Status:         models.RefundStatusFailed,
			FailureCode:    func() *string { s := "UPI_REFUND_STATUS_SERVICE_ERROR"; return &s }(),
			FailureMessage: func() *string { s := err.Error(); return &s }(),
		}, nil
	}

	// Convert gRPC response to our response format
	response := &UPIRefundStatusResponse{
		Success: grpcResp.Status != pb.RefundStatus_REFUND_STATUS_FAILED,
	}

	// Map UPI Core refund status to our internal status
	switch grpcResp.Status {
	case pb.RefundStatus_REFUND_STATUS_SUCCESS:
		response.Status = models.RefundStatusSucceeded
		if grpcResp.ProcessedAt != nil {
			processedAt := grpcResp.ProcessedAt.AsTime()
			response.ProcessedAt = &processedAt
		}
	case pb.RefundStatus_REFUND_STATUS_PENDING:
		response.Status = models.RefundStatusPending
	case pb.RefundStatus_REFUND_STATUS_PROCESSING:
		response.Status = models.RefundStatusProcessing
	case pb.RefundStatus_REFUND_STATUS_FAILED:
		response.Status = models.RefundStatusFailed
		if grpcResp.ErrorCode != "" {
			response.FailureCode = &grpcResp.ErrorCode
			response.FailureMessage = &grpcResp.ErrorMessage
		}
	default:
		response.Status = models.RefundStatusFailed
		failureMsg := "Unknown refund status"
		response.FailureMessage = &failureMsg
	}

	log.WithFields(logrus.Fields{
		"status":  response.Status,
		"success": response.Success,
	}).Info("UPI refund status retrieved")

	return response, nil
}

// contains checks if a string contains a substring
func contains(str, substr string) bool {
	for i := 0; i <= len(str)-len(substr); i++ {
		if str[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
