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
	PaymentID       uuid.UUID
	PayerVPA        string
	PayeeVPA        string
	Amount          decimal.Decimal
	Currency        string
	Description     string
	MerchantID      string
	TransactionRef  string
}

// UPIPaymentResponse represents a UPI payment response
type UPIPaymentResponse struct {
	Success           bool
	TransactionID     string
	Status            string
	FailureCode       *string
	FailureMessage    *string
	ProcessedAt       time.Time
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
		TransactionId:   req.PaymentID.String(),
		PayerVpa:        req.PayerVPA,
		PayeeVpa:        req.PayeeVPA,
		AmountPaisa:     req.Amount.IntPart() * 100, // Convert to paisa
		Type:            pb.TransactionType_TRANSACTION_TYPE_P2M,
		Reference:       req.Description,
		PayerBankCode:   "HDFC", // This should be resolved from VPA
		PayeeBankCode:   "ICICI", // This should be resolved from VPA
		InitiatedAt:     timestamppb.Now(),
	}

	// Call UPI Core service
	grpcResp, err := c.client.ProcessTransaction(ctx, grpcReq)
	if err != nil {
		log.WithError(err).Error("Failed to call UPI Core service")
		return &UPIPaymentResponse{
			Success: false,
			Status:  models.PaymentStatusFailed,
			FailureCode: func() *string { s := "UPI_SERVICE_ERROR"; return &s }(),
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

	// TODO: Implement actual gRPC call to UPI Core service
	// This is a mock implementation for now
	
	// Simulate processing time
	time.Sleep(200 * time.Millisecond)

	// Mock response - in real implementation, this would come from UPI Core
	response := &UPIRefundResponse{
		Success:         true, // Mock success for now
		RefundReference: fmt.Sprintf("REF_%s_%d", req.RefundID.String()[:8], time.Now().Unix()),
		Status:          models.RefundStatusSucceeded,
		ProcessedAt:     time.Now(),
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

	// TODO: Implement actual gRPC call to UPI Core service
	// This is a mock implementation for now

	// Mock response
	response := &UPIPaymentResponse{
		Success:       true,
		TransactionID: transactionID,
		Status:        models.PaymentStatusSucceeded,
		ProcessedAt:   time.Now(),
	}

	log.WithField("status", response.Status).Info("UPI payment status retrieved")
	return response, nil
}

// ValidateVPA validates a Virtual Payment Address
func (c *UPIClient) ValidateVPA(ctx context.Context, vpa string) (bool, error) {
	log := c.logger.WithField("vpa", vpa)
	log.Info("Validating VPA")

	// TODO: Implement actual gRPC call to UPI Core service
	// This is a mock implementation for now

	// Simple validation logic (in real implementation, this would be more sophisticated)
	if len(vpa) < 6 || !contains(vpa, "@") {
		log.Warn("VPA validation failed")
		return false, nil
	}

	log.Info("VPA validation successful")
	return true, nil
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