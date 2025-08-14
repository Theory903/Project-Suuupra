package server

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"upi-core/internal/infrastructure/database"
	"upi-core/internal/infrastructure/kafka"
	"upi-core/internal/infrastructure/redis"
	pb "upi-core/pkg/pb"
)

// UpiCoreService implements the UPI Core gRPC service
type UpiCoreService struct {
	pb.UnimplementedUpiCoreServer
	db     *database.Database
	redis  *redis.Client
	kafka  *kafka.Producer
	logger *logrus.Logger
}

// NewUpiCoreService creates a new UPI Core service instance
func NewUpiCoreService(
	db *database.Database,
	redis *redis.Client,
	kafka *kafka.Producer,
	logger *logrus.Logger,
) *UpiCoreService {
	return &UpiCoreService{
		db:     db,
		redis:  redis,
		kafka:  kafka,
		logger: logger,
	}
}

// RegisterUpiCoreServer registers the UPI Core service with the gRPC server
func RegisterUpiCoreServer(s *grpc.Server, srv *UpiCoreService) {
	pb.RegisterUpiCoreServer(s, srv)
}

// ProcessTransaction handles transaction processing requests
func (s *UpiCoreService) ProcessTransaction(ctx context.Context, req *pb.TransactionRequest) (*pb.TransactionResponse, error) {
	s.logger.WithFields(logrus.Fields{
		"transaction_id": req.TransactionId,
		"payer_vpa":      req.PayerVpa,
		"payee_vpa":      req.PayeeVpa,
		"amount_paisa":   req.AmountPaisa,
	}).Info("Processing transaction")

	// Validate request
	if req.TransactionId == "" {
		return nil, status.Error(codes.InvalidArgument, "transaction_id is required")
	}
	if req.PayerVpa == "" {
		return nil, status.Error(codes.InvalidArgument, "payer_vpa is required")
	}
	if req.PayeeVpa == "" {
		return nil, status.Error(codes.InvalidArgument, "payee_vpa is required")
	}
	if req.AmountPaisa <= 0 {
		return nil, status.Error(codes.InvalidArgument, "amount_paisa must be positive")
	}

	// Mock response for now
	response := &pb.TransactionResponse{
		TransactionId: req.TransactionId,
		Rrn:           generateRRN(),
		Status:        pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		PayerBankCode: "HDFC", // Mock
		PayeeBankCode: "SBI",  // Mock
		ProcessedAt:   timestamppb.Now(),
		Fees: &pb.TransactionFees{
			SwitchFeePaisa: 100,
			BankFeePaisa:   50,
			TotalFeePaisa:  150,
		},
		SettlementId: generateSettlementID(),
	}

	s.logger.WithFields(logrus.Fields{
		"transaction_id": response.TransactionId,
		"rrn":            response.Rrn,
		"status":         response.Status,
	}).Info("Transaction processed successfully")

	return response, nil
}

// GetTransactionStatus retrieves transaction status
func (s *UpiCoreService) GetTransactionStatus(ctx context.Context, req *pb.TransactionStatusRequest) (*pb.TransactionStatusResponse, error) {
	if req.TransactionId == "" && req.Rrn == "" {
		return nil, status.Error(codes.InvalidArgument, "either transaction_id or rrn is required")
	}

	// Mock response
	return &pb.TransactionStatusResponse{
		TransactionId: req.TransactionId,
		Rrn:           req.Rrn,
		Status:        pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		AmountPaisa:   10000,
		PayerVpa:      "user@hdfc",
		PayeeVpa:      "merchant@sbi",
		PayerBankCode: "HDFC",
		PayeeBankCode: "SBI",
		InitiatedAt:   timestamppb.Now(),
		ProcessedAt:   timestamppb.Now(),
	}, nil
}

// CancelTransaction cancels a pending transaction
func (s *UpiCoreService) CancelTransaction(ctx context.Context, req *pb.CancelTransactionRequest) (*pb.CancelTransactionResponse, error) {
	if req.TransactionId == "" {
		return nil, status.Error(codes.InvalidArgument, "transaction_id is required")
	}

	// Mock response
	return &pb.CancelTransactionResponse{
		Success:     true,
		CancelledAt: timestamppb.Now(),
	}, nil
}

// ReverseTransaction reverses a completed transaction
func (s *UpiCoreService) ReverseTransaction(ctx context.Context, req *pb.ReverseTransactionRequest) (*pb.ReverseTransactionResponse, error) {
	if req.OriginalTransactionId == "" {
		return nil, status.Error(codes.InvalidArgument, "original_transaction_id is required")
	}
	if req.ReversalTransactionId == "" {
		return nil, status.Error(codes.InvalidArgument, "reversal_transaction_id is required")
	}

	// Mock response
	return &pb.ReverseTransactionResponse{
		Success:               true,
		ReversalTransactionId: req.ReversalTransactionId,
		ReversedAt:            timestamppb.Now(),
	}, nil
}

// ResolveVPA resolves VPA to bank account information
func (s *UpiCoreService) ResolveVPA(ctx context.Context, req *pb.ResolveVPARequest) (*pb.ResolveVPAResponse, error) {
	if req.Vpa == "" {
		return nil, status.Error(codes.InvalidArgument, "vpa is required")
	}

	s.logger.WithField("vpa", req.Vpa).Info("Resolving VPA")

	// Try cache first
	bankCode, accountNumber, err := s.redis.GetVPAMapping(ctx, req.Vpa)
	if err == nil {
		s.logger.WithFields(logrus.Fields{
			"vpa":            req.Vpa,
			"bank_code":      bankCode,
			"account_number": accountNumber,
		}).Info("VPA resolved from cache")

		return &pb.ResolveVPAResponse{
			Exists:            true,
			BankCode:          bankCode,
			AccountNumber:     accountNumber,
			AccountHolderName: "Mock User", // Would fetch from database
			IsActive:          true,
		}, nil
	}

	// Mock response for database lookup
	return &pb.ResolveVPAResponse{
		Exists:            true,
		BankCode:          "HDFC",
		AccountNumber:     "1234567890",
		AccountHolderName: "Mock User",
		IsActive:          true,
	}, nil
}

// RegisterVPA registers a new VPA mapping
func (s *UpiCoreService) RegisterVPA(ctx context.Context, req *pb.RegisterVPARequest) (*pb.RegisterVPAResponse, error) {
	if req.Vpa == "" {
		return nil, status.Error(codes.InvalidArgument, "vpa is required")
	}
	if req.BankCode == "" {
		return nil, status.Error(codes.InvalidArgument, "bank_code is required")
	}
	if req.AccountNumber == "" {
		return nil, status.Error(codes.InvalidArgument, "account_number is required")
	}

	// Cache the VPA mapping
	err := s.redis.SetVPAMapping(ctx, req.Vpa, req.BankCode, req.AccountNumber, 24*time.Hour)
	if err != nil {
		s.logger.WithError(err).Error("Failed to cache VPA mapping")
	}

	return &pb.RegisterVPAResponse{
		Success:      true,
		RegisteredAt: timestamppb.Now(),
	}, nil
}

// UpdateVPA updates an existing VPA mapping
func (s *UpiCoreService) UpdateVPA(ctx context.Context, req *pb.UpdateVPARequest) (*pb.UpdateVPAResponse, error) {
	if req.Vpa == "" {
		return nil, status.Error(codes.InvalidArgument, "vpa is required")
	}

	return &pb.UpdateVPAResponse{
		Success:   true,
		UpdatedAt: timestamppb.Now(),
	}, nil
}

// DeactivateVPA deactivates a VPA mapping
func (s *UpiCoreService) DeactivateVPA(ctx context.Context, req *pb.DeactivateVPARequest) (*pb.DeactivateVPAResponse, error) {
	if req.Vpa == "" {
		return nil, status.Error(codes.InvalidArgument, "vpa is required")
	}

	return &pb.DeactivateVPAResponse{
		Success:       true,
		DeactivatedAt: timestamppb.Now(),
	}, nil
}

// RegisterBank registers a new bank in the network
func (s *UpiCoreService) RegisterBank(ctx context.Context, req *pb.RegisterBankRequest) (*pb.RegisterBankResponse, error) {
	if req.BankCode == "" {
		return nil, status.Error(codes.InvalidArgument, "bank_code is required")
	}

	return &pb.RegisterBankResponse{
		Success:      true,
		BankId:       generateBankID(),
		RegisteredAt: timestamppb.Now(),
	}, nil
}

// UpdateBankStatus updates bank status
func (s *UpiCoreService) UpdateBankStatus(ctx context.Context, req *pb.UpdateBankStatusRequest) (*pb.UpdateBankStatusResponse, error) {
	if req.BankCode == "" {
		return nil, status.Error(codes.InvalidArgument, "bank_code is required")
	}

	return &pb.UpdateBankStatusResponse{
		Success:   true,
		UpdatedAt: timestamppb.Now(),
	}, nil
}

// GetBankStatus retrieves bank status information
func (s *UpiCoreService) GetBankStatus(ctx context.Context, req *pb.BankStatusRequest) (*pb.BankStatusResponse, error) {
	if req.BankCode == "" {
		return nil, status.Error(codes.InvalidArgument, "bank_code is required")
	}

	return &pb.BankStatusResponse{
		BankCode:           req.BankCode,
		BankName:           "Mock Bank",
		Status:             "ACTIVE",
		SuccessRatePercent: 99,
		AvgResponseTimeMs:  50,
		LastHeartbeat:      timestamppb.Now(),
		SupportedFeatures:  []string{"UPI", "IMPS", "NEFT"},
	}, nil
}

// ListBanks lists all registered banks
func (s *UpiCoreService) ListBanks(ctx context.Context, req *pb.ListBanksRequest) (*pb.ListBanksResponse, error) {
	// Mock response
	banks := []*pb.BankInfo{
		{
			BankCode:    "HDFC",
			BankName:    "HDFC Bank",
			IfscPrefix:  "HDFC",
			Status:      "ACTIVE",
			EndpointUrl: "https://api.hdfc.com/upi",
		},
	}

	return &pb.ListBanksResponse{
		Banks: banks,
	}, nil
}

// InitiateSettlement initiates settlement process
func (s *UpiCoreService) InitiateSettlement(ctx context.Context, req *pb.InitiateSettlementRequest) (*pb.InitiateSettlementResponse, error) {
	if req.BatchId == "" {
		return nil, status.Error(codes.InvalidArgument, "batch_id is required")
	}

	return &pb.InitiateSettlementResponse{
		Success:      true,
		SettlementId: generateSettlementID(),
		InitiatedAt:  timestamppb.Now(),
	}, nil
}

// GetSettlementStatus retrieves settlement status
func (s *UpiCoreService) GetSettlementStatus(ctx context.Context, req *pb.SettlementStatusRequest) (*pb.SettlementStatusResponse, error) {
	if req.SettlementId == "" {
		return nil, status.Error(codes.InvalidArgument, "settlement_id is required")
	}

	return &pb.SettlementStatusResponse{
		SettlementId: req.SettlementId,
		Status:       "COMPLETED",
		CreatedAt:    timestamppb.Now(),
		CompletedAt:  timestamppb.Now(),
	}, nil
}

// GetSettlementReport generates settlement report
func (s *UpiCoreService) GetSettlementReport(ctx context.Context, req *pb.SettlementReportRequest) (*pb.SettlementReportResponse, error) {
	if req.BankCode == "" {
		return nil, status.Error(codes.InvalidArgument, "bank_code is required")
	}

	return &pb.SettlementReportResponse{
		BankCode:         req.BankCode,
		TotalCreditPaisa: 1000000000,
		TotalDebitPaisa:  900000000,
		NetAmountPaisa:   100000000,
		TransactionCount: 10000,
	}, nil
}

// HealthCheck provides health status
func (s *UpiCoreService) HealthCheck(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	details := make(map[string]string)
	status := pb.HealthStatus_HEALTH_STATUS_SERVING

	// Check database health
	if err := s.db.Health(); err != nil {
		details["database"] = "unhealthy: " + err.Error()
		status = pb.HealthStatus_HEALTH_STATUS_NOT_SERVING
	} else {
		details["database"] = "healthy"
	}

	// Check Redis health
	if err := s.redis.Health(); err != nil {
		details["redis"] = "unhealthy: " + err.Error()
		status = pb.HealthStatus_HEALTH_STATUS_NOT_SERVING
	} else {
		details["redis"] = "healthy"
	}

	// Check Kafka health
	if err := s.kafka.Health(); err != nil {
		details["kafka"] = "unhealthy: " + err.Error()
		status = pb.HealthStatus_HEALTH_STATUS_NOT_SERVING
	} else {
		details["kafka"] = "healthy"
	}

	return &pb.HealthCheckResponse{
		Status:    status,
		Details:   details,
		Timestamp: timestamppb.Now(),
	}, nil
}

// GetMetrics retrieves service metrics
func (s *UpiCoreService) GetMetrics(ctx context.Context, req *pb.MetricsRequest) (*pb.MetricsResponse, error) {
	// Mock metrics
	metrics := []*pb.Metric{
		{
			Name:      "transactions_total",
			Value:     "10000",
			Unit:      "count",
			Timestamp: timestamppb.Now(),
		},
		{
			Name:      "transaction_duration_avg",
			Value:     "50.5",
			Unit:      "milliseconds",
			Timestamp: timestamppb.Now(),
		},
	}

	return &pb.MetricsResponse{
		Metrics:     metrics,
		GeneratedAt: timestamppb.Now(),
	}, nil
}

// Helper functions
func generateRRN() string {
	return fmt.Sprintf("RRN%d", time.Now().UnixNano())
}

func generateSettlementID() string {
	return fmt.Sprintf("SETT%d", time.Now().UnixNano())
}

func generateBankID() string {
	return fmt.Sprintf("BANK%d", time.Now().UnixNano())
}
