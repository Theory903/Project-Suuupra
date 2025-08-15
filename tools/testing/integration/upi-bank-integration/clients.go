package main

import (
	"context"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// BankSimulator gRPC client interface and implementations
type BankSimulatorClient interface {
	ProcessTransaction(ctx context.Context, req *TransactionRequest, opts ...grpc.CallOption) (*TransactionResponse, error)
	GetTransactionStatus(ctx context.Context, req *TransactionStatusRequest, opts ...grpc.CallOption) (*TransactionStatusResponse, error)
	CreateAccount(ctx context.Context, req *CreateAccountRequest, opts ...grpc.CallOption) (*CreateAccountResponse, error)
	GetAccountBalance(ctx context.Context, req *AccountBalanceRequest, opts ...grpc.CallOption) (*AccountBalanceResponse, error)
	GetAccountDetails(ctx context.Context, req *AccountDetailsRequest, opts ...grpc.CallOption) (*AccountDetailsResponse, error)
	LinkVPA(ctx context.Context, req *LinkVPARequest, opts ...grpc.CallOption) (*LinkVPAResponse, error)
	UnlinkVPA(ctx context.Context, req *UnlinkVPARequest, opts ...grpc.CallOption) (*UnlinkVPAResponse, error)
	ResolveVPA(ctx context.Context, req *ResolveVPARequest, opts ...grpc.CallOption) (*ResolveVPAResponse, error)
	GetBankInfo(ctx context.Context, req *BankInfoRequest, opts ...grpc.CallOption) (*BankInfoResponse, error)
	CheckBankHealth(ctx context.Context, req *BankHealthRequest, opts ...grpc.CallOption) (*BankHealthResponse, error)
	GetBankStats(ctx context.Context, req *BankStatsRequest, opts ...grpc.CallOption) (*BankStatsResponse, error)
}

// UpiCore gRPC client interface
type UpiCoreClient interface {
	ProcessTransaction(ctx context.Context, req *TransactionRequest, opts ...grpc.CallOption) (*TransactionResponse, error)
	GetTransactionStatus(ctx context.Context, req *TransactionStatusRequest, opts ...grpc.CallOption) (*TransactionStatusResponse, error)
	CancelTransaction(ctx context.Context, req *CancelTransactionRequest, opts ...grpc.CallOption) (*CancelTransactionResponse, error)
	ReverseTransaction(ctx context.Context, req *ReverseTransactionRequest, opts ...grpc.CallOption) (*ReverseTransactionResponse, error)
	ResolveVPA(ctx context.Context, req *ResolveVPARequest, opts ...grpc.CallOption) (*ResolveVPAResponse, error)
	RegisterVPA(ctx context.Context, req *RegisterVPARequest, opts ...grpc.CallOption) (*RegisterVPAResponse, error)
	UpdateVPA(ctx context.Context, req *UpdateVPARequest, opts ...grpc.CallOption) (*UpdateVPAResponse, error)
	DeactivateVPA(ctx context.Context, req *DeactivateVPARequest, opts ...grpc.CallOption) (*DeactivateVPAResponse, error)
	RegisterBank(ctx context.Context, req *RegisterBankRequest, opts ...grpc.CallOption) (*RegisterBankResponse, error)
	UpdateBankStatus(ctx context.Context, req *UpdateBankStatusRequest, opts ...grpc.CallOption) (*UpdateBankStatusResponse, error)
	GetBankStatus(ctx context.Context, req *BankStatusRequest, opts ...grpc.CallOption) (*BankStatusResponse, error)
	ListBanks(ctx context.Context, req *ListBanksRequest, opts ...grpc.CallOption) (*ListBanksResponse, error)
	InitiateSettlement(ctx context.Context, req *InitiateSettlementRequest, opts ...grpc.CallOption) (*InitiateSettlementResponse, error)
	GetSettlementStatus(ctx context.Context, req *SettlementStatusRequest, opts ...grpc.CallOption) (*SettlementStatusResponse, error)
	GetSettlementReport(ctx context.Context, req *SettlementReportRequest, opts ...grpc.CallOption) (*SettlementReportResponse, error)
	HealthCheck(ctx context.Context, req *HealthCheckRequest, opts ...grpc.CallOption) (*HealthCheckResponse, error)
	GetMetrics(ctx context.Context, req *MetricsRequest, opts ...grpc.CallOption) (*MetricsResponse, error)
}

// Mock implementations for compilation until generated code is available
type mockBankSimulatorClient struct {
	conn *grpc.ClientConn
}

func NewBankSimulatorClient(conn *grpc.ClientConn) BankSimulatorClient {
	return &mockBankSimulatorClient{conn: conn}
}

func (c *mockBankSimulatorClient) ProcessTransaction(ctx context.Context, req *TransactionRequest, opts ...grpc.CallOption) (*TransactionResponse, error) {
	return &TransactionResponse{
		TransactionId:   req.TransactionId,
		Status:          TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		BankReferenceId: "BANK_REF_123",
	}, nil
}

func (c *mockBankSimulatorClient) GetTransactionStatus(ctx context.Context, req *TransactionStatusRequest, opts ...grpc.CallOption) (*TransactionStatusResponse, error) {
	return &TransactionStatusResponse{
		TransactionId: req.TransactionId,
		Status:        TransactionStatus_TRANSACTION_STATUS_SUCCESS,
	}, nil
}

func (c *mockBankSimulatorClient) CreateAccount(ctx context.Context, req *CreateAccountRequest, opts ...grpc.CallOption) (*CreateAccountResponse, error) {
	return &CreateAccountResponse{
		AccountNumber: "1234567890123456",
		IfscCode:      req.BankCode + "0001234",
		Status:        AccountStatus_ACCOUNT_STATUS_ACTIVE,
	}, nil
}

func (c *mockBankSimulatorClient) GetAccountBalance(ctx context.Context, req *AccountBalanceRequest, opts ...grpc.CallOption) (*AccountBalanceResponse, error) {
	return &AccountBalanceResponse{
		AccountNumber:            req.AccountNumber,
		AvailableBalancePaisa:    100000,
		LedgerBalancePaisa:       100000,
		DailyLimitRemainingPaisa: 500000,
		LastUpdated:              timestamppb.Now(),
	}, nil
}

func (c *mockBankSimulatorClient) GetAccountDetails(ctx context.Context, req *AccountDetailsRequest, opts ...grpc.CallOption) (*AccountDetailsResponse, error) {
	return &AccountDetailsResponse{
		AccountNumber:         req.AccountNumber,
		IfscCode:              req.BankCode + "0001234",
		AccountHolderName:     "Test Customer",
		AccountType:           AccountType_ACCOUNT_TYPE_SAVINGS,
		Status:                AccountStatus_ACCOUNT_STATUS_ACTIVE,
		AvailableBalancePaisa: 100000,
		DailyLimitPaisa:       500000,
		CreatedAt:             timestamppb.Now(),
	}, nil
}

func (c *mockBankSimulatorClient) LinkVPA(ctx context.Context, req *LinkVPARequest, opts ...grpc.CallOption) (*LinkVPAResponse, error) {
	return &LinkVPAResponse{
		Success: true,
	}, nil
}

func (c *mockBankSimulatorClient) UnlinkVPA(ctx context.Context, req *UnlinkVPARequest, opts ...grpc.CallOption) (*UnlinkVPAResponse, error) {
	return &UnlinkVPAResponse{
		Success: true,
	}, nil
}

func (c *mockBankSimulatorClient) ResolveVPA(ctx context.Context, req *ResolveVPARequest, opts ...grpc.CallOption) (*ResolveVPAResponse, error) {
	return &ResolveVPAResponse{
		Exists:              true,
		BankCode:            "HDFC",
		AccountNumber:       "1234567890123456",
		AccountHolderName:   "Test Customer",
		IsActive:            true,
	}, nil
}

func (c *mockBankSimulatorClient) GetBankInfo(ctx context.Context, req *BankInfoRequest, opts ...grpc.CallOption) (*BankInfoResponse, error) {
	return &BankInfoResponse{
		BankCode:         req.BankCode,
		BankName:         "HDFC Bank",
		IfscPrefix:       "HDFC",
		IsActive:         true,
		Features:         []string{"UPI", "IMPS", "RTGS"},
		DailyLimitPaisa:  10000000,
		MinBalancePaisa:  10000,
	}, nil
}

func (c *mockBankSimulatorClient) CheckBankHealth(ctx context.Context, req *BankHealthRequest, opts ...grpc.CallOption) (*BankHealthResponse, error) {
	return &BankHealthResponse{
		BankCode:            req.BankCode,
		HealthStatus:        HealthStatus_HEALTH_STATUS_HEALTHY,
		SuccessRatePercent:  99,
		AvgResponseTimeMs:   150,
		TotalAccounts:       1000000,
		ActiveAccounts:      950000,
		LastChecked:         timestamppb.Now(),
	}, nil
}

func (c *mockBankSimulatorClient) GetBankStats(ctx context.Context, req *BankStatsRequest, opts ...grpc.CallOption) (*BankStatsResponse, error) {
	return &BankStatsResponse{
		BankCode:               req.BankCode,
		TotalTransactions:      1000000,
		SuccessfulTransactions: 990000,
		FailedTransactions:     10000,
		TotalVolumePaisa:       10000000000,
		SuccessRatePercent:     99,
		AvgResponseTimeMs:      150,
	}, nil
}

// Mock UPI Core client
type mockUpiCoreClient struct {
	conn *grpc.ClientConn
}

func NewUpiCoreClient(conn *grpc.ClientConn) UpiCoreClient {
	return &mockUpiCoreClient{conn: conn}
}

func (c *mockUpiCoreClient) ProcessTransaction(ctx context.Context, req *TransactionRequest, opts ...grpc.CallOption) (*TransactionResponse, error) {
	return &TransactionResponse{
		TransactionId:   req.TransactionId,
		Rrn:             req.Rrn,
		Status:          TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		PayerBankCode:   "HDFC",
		PayeeBankCode:   "HDFC",
		ProcessedAt:     timestamppb.Now(),
		SettlementId:    "SETTLEMENT_123",
	}, nil
}

func (c *mockUpiCoreClient) GetTransactionStatus(ctx context.Context, req *TransactionStatusRequest, opts ...grpc.CallOption) (*TransactionStatusResponse, error) {
	return &TransactionStatusResponse{
		TransactionId: req.TransactionId,
		Rrn:           req.Rrn,
		Status:        TransactionStatus_TRANSACTION_STATUS_SUCCESS,
	}, nil
}

func (c *mockUpiCoreClient) CancelTransaction(ctx context.Context, req *CancelTransactionRequest, opts ...grpc.CallOption) (*CancelTransactionResponse, error) {
	return &CancelTransactionResponse{
		Success:     true,
		CancelledAt: timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) ReverseTransaction(ctx context.Context, req *ReverseTransactionRequest, opts ...grpc.CallOption) (*ReverseTransactionResponse, error) {
	return &ReverseTransactionResponse{
		Success:               true,
		ReversalTransactionId: req.ReversalTransactionId,
		ReversedAt:            timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) ResolveVPA(ctx context.Context, req *ResolveVPARequest, opts ...grpc.CallOption) (*ResolveVPAResponse, error) {
	return &ResolveVPAResponse{
		Exists:            true,
		BankCode:          "HDFC",
		AccountNumber:     "1234567890123456",
		AccountHolderName: "Test Customer",
		IsActive:          true,
	}, nil
}

func (c *mockUpiCoreClient) RegisterVPA(ctx context.Context, req *RegisterVPARequest, opts ...grpc.CallOption) (*RegisterVPAResponse, error) {
	return &RegisterVPAResponse{
		Success:      true,
		RegisteredAt: timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) UpdateVPA(ctx context.Context, req *UpdateVPARequest, opts ...grpc.CallOption) (*UpdateVPAResponse, error) {
	return &UpdateVPAResponse{
		Success:   true,
		UpdatedAt: timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) DeactivateVPA(ctx context.Context, req *DeactivateVPARequest, opts ...grpc.CallOption) (*DeactivateVPAResponse, error) {
	return &DeactivateVPAResponse{
		Success:       true,
		DeactivatedAt: timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) RegisterBank(ctx context.Context, req *RegisterBankRequest, opts ...grpc.CallOption) (*RegisterBankResponse, error) {
	return &RegisterBankResponse{
		Success:      true,
		BankId:       "BANK_ID_123",
		RegisteredAt: timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) UpdateBankStatus(ctx context.Context, req *UpdateBankStatusRequest, opts ...grpc.CallOption) (*UpdateBankStatusResponse, error) {
	return &UpdateBankStatusResponse{
		Success:   true,
		UpdatedAt: timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) GetBankStatus(ctx context.Context, req *BankStatusRequest, opts ...grpc.CallOption) (*BankStatusResponse, error) {
	return &BankStatusResponse{
		BankCode:           req.BankCode,
		BankName:           "HDFC Bank",
		Status:             BankStatus_BANK_STATUS_ACTIVE,
		SuccessRatePercent: 99,
		AvgResponseTimeMs:  150,
		LastHeartbeat:      timestamppb.Now(),
		SupportedFeatures:  []string{"UPI", "IMPS", "RTGS"},
	}, nil
}

func (c *mockUpiCoreClient) ListBanks(ctx context.Context, req *ListBanksRequest, opts ...grpc.CallOption) (*ListBanksResponse, error) {
	return &ListBanksResponse{
		Banks: []*BankInfo{
			{
				BankCode:          "HDFC",
				BankName:          "HDFC Bank",
				IfscPrefix:        "HDFC",
				Status:            BankStatus_BANK_STATUS_ACTIVE,
				EndpointUrl:       "localhost:50050",
				SupportedFeatures: []string{"UPI", "IMPS", "RTGS"},
				RegisteredAt:      timestamppb.Now(),
			},
		},
		TotalCount: 1,
	}, nil
}

func (c *mockUpiCoreClient) InitiateSettlement(ctx context.Context, req *InitiateSettlementRequest, opts ...grpc.CallOption) (*InitiateSettlementResponse, error) {
	return &InitiateSettlementResponse{
		Success:      true,
		SettlementId: "SETTLEMENT_123",
		InitiatedAt:  timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) GetSettlementStatus(ctx context.Context, req *SettlementStatusRequest, opts ...grpc.CallOption) (*SettlementStatusResponse, error) {
	return &SettlementStatusResponse{
		SettlementId: req.SettlementId,
		Status:       SettlementStatus_SETTLEMENT_STATUS_COMPLETED,
		CreatedAt:    timestamppb.Now(),
		CompletedAt:  timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) GetSettlementReport(ctx context.Context, req *SettlementReportRequest, opts ...grpc.CallOption) (*SettlementReportResponse, error) {
	return &SettlementReportResponse{
		BankCode:              req.BankCode,
		TotalCreditPaisa:      1000000000,
		TotalDebitPaisa:       900000000,
		NetSettlementPaisa:    100000000,
		TransactionCount:      1000,
	}, nil
}

func (c *mockUpiCoreClient) HealthCheck(ctx context.Context, req *HealthCheckRequest, opts ...grpc.CallOption) (*HealthCheckResponse, error) {
	return &HealthCheckResponse{
		Status:    HealthStatus_HEALTH_STATUS_SERVING,
		Details:   map[string]string{"version": "1.0.0", "status": "healthy"},
		Timestamp: timestamppb.Now(),
	}, nil
}

func (c *mockUpiCoreClient) GetMetrics(ctx context.Context, req *MetricsRequest, opts ...grpc.CallOption) (*MetricsResponse, error) {
	return &MetricsResponse{
		Metrics: []*Metric{
			{
				Name:      "transactions_total",
				Value:     "1000000",
				Unit:      "count",
				Labels:    map[string]string{"status": "success"},
				Timestamp: timestamppb.Now(),
			},
		},
		GeneratedAt: timestamppb.Now(),
	}, nil
}