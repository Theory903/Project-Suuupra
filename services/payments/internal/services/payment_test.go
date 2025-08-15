package services

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/suuupra/payments/internal/models"
)

// MockUPIClient mocks the UPI client for testing
type MockUPIClient struct {
	mock.Mock
}

func (m *MockUPIClient) ProcessPayment(ctx context.Context, req UPIPaymentRequest) (*UPIPaymentResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*UPIPaymentResponse), args.Error(1)
}

func (m *MockUPIClient) ProcessRefund(ctx context.Context, req UPIRefundRequest) (*UPIRefundResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*UPIRefundResponse), args.Error(1)
}

func (m *MockUPIClient) CheckPaymentStatus(ctx context.Context, transactionID string) (*UPIPaymentResponse, error) {
	args := m.Called(ctx, transactionID)
	return args.Get(0).(*UPIPaymentResponse), args.Error(1)
}

func (m *MockUPIClient) ValidateVPA(ctx context.Context, vpa string) (bool, error) {
	args := m.Called(ctx, vpa)
	return args.Bool(0), args.Error(1)
}

func (m *MockUPIClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

// MockWebhookService mocks the webhook service for testing
type MockWebhookService struct {
	mock.Mock
}

func (m *MockWebhookService) TriggerWebhook(ctx context.Context, merchantID uuid.UUID, eventType string, data interface{}) {
	m.Called(ctx, merchantID, eventType, data)
}

func (m *MockWebhookService) CreateWebhookEndpoint(ctx context.Context, req CreateWebhookEndpointRequest) (*models.WebhookEndpoint, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*models.WebhookEndpoint), args.Error(1)
}

func (m *MockWebhookService) GetWebhookEndpoints(ctx context.Context, merchantID uuid.UUID) ([]models.WebhookEndpoint, error) {
	args := m.Called(ctx, merchantID)
	return args.Get(0).([]models.WebhookEndpoint), args.Error(1)
}

func (m *MockWebhookService) UpdateWebhookEndpoint(ctx context.Context, id uuid.UUID, updates map[string]interface{}) (*models.WebhookEndpoint, error) {
	args := m.Called(ctx, id, updates)
	return args.Get(0).(*models.WebhookEndpoint), args.Error(1)
}

func (m *MockWebhookService) DeleteWebhookEndpoint(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockWebhookService) Start() {
	m.Called()
}

func (m *MockWebhookService) Stop() {
	m.Called()
}

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Auto-migrate test schemas
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
	require.NoError(t, err)

	return db
}

func TestPaymentService_CreatePaymentIntent(t *testing.T) {
	db := setupTestDB(t)
	logger := logrus.New()
	
	mockUPIClient := &MockUPIClient{}
	mockWebhookService := &MockWebhookService{}
	
	ledgerService := NewLedgerService(db, logger)
	riskService := NewRiskService(db, logger)
	
	service := NewPaymentService(db, logger, mockUPIClient, ledgerService, riskService, mockWebhookService)

	merchantID := uuid.New()
	amount := decimal.NewFromFloat(100.50)

	req := CreatePaymentIntentRequest{
		MerchantID:    merchantID,
		Amount:        amount,
		Currency:      "INR",
		Description:   "Test payment",
		PaymentMethod: "upi",
	}

	// Mock webhook trigger
	mockWebhookService.On("TriggerWebhook", mock.Anything, merchantID, "payment_intent.created", mock.Anything).Return()

	ctx := context.Background()
	intent, err := service.CreatePaymentIntent(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, intent)
	assert.Equal(t, merchantID, intent.MerchantID)
	assert.Equal(t, amount, intent.Amount)
	assert.Equal(t, "INR", intent.Currency)
	assert.Equal(t, "Test payment", intent.Description)
	assert.Equal(t, "upi", intent.PaymentMethod)
	assert.Equal(t, models.PaymentIntentStatusCreated, intent.Status)
	assert.NotNil(t, intent.ExpiresAt)

	mockWebhookService.AssertExpectations(t)
}

func TestPaymentService_CreatePayment_Success(t *testing.T) {
	db := setupTestDB(t)
	logger := logrus.New()
	
	mockUPIClient := &MockUPIClient{}
	mockWebhookService := &MockWebhookService{}
	
	ledgerService := NewLedgerService(db, logger)
	riskService := NewRiskService(db, logger)
	
	service := NewPaymentService(db, logger, mockUPIClient, ledgerService, riskService, mockWebhookService)

	// Create a payment intent first
	merchantID := uuid.New()
	amount := decimal.NewFromFloat(100.50)
	
	intent := &models.PaymentIntent{
		ID:            uuid.New(),
		MerchantID:    merchantID,
		Amount:        amount,
		Currency:      "INR",
		Description:   "Test payment",
		Status:        models.PaymentIntentStatusCreated,
		PaymentMethod: "upi",
		ExpiresAt:     timePtr(time.Now().Add(15 * time.Minute)),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	
	err := db.Create(intent).Error
	require.NoError(t, err)

	// Mock UPI client responses
	mockUPIClient.On("ValidateVPA", mock.Anything, "payer@upi").Return(true, nil)
	mockUPIClient.On("ValidateVPA", mock.Anything, "payee@upi").Return(true, nil)
	mockUPIClient.On("ProcessPayment", mock.Anything, mock.AnythingOfType("UPIPaymentRequest")).Return(&UPIPaymentResponse{
		Success:       true,
		TransactionID: "UPI_TEST_123",
		Status:        models.PaymentStatusSucceeded,
		ProcessedAt:   time.Now(),
	}, nil)

	// Mock webhook trigger
	mockWebhookService.On("TriggerWebhook", mock.Anything, merchantID, "payment.succeeded", mock.Anything).Return()

	req := CreatePaymentRequest{
		PaymentIntentID: intent.ID,
		PayerVPA:        "payer@upi",
		PayeeVPA:        "payee@upi",
		IPAddress:       "127.0.0.1",
		UserAgent:       "Test-Agent",
	}

	ctx := context.Background()
	payment, err := service.CreatePayment(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, payment)
	assert.Equal(t, intent.ID, payment.PaymentIntentID)
	assert.Equal(t, amount, payment.Amount)
	assert.Equal(t, "INR", payment.Currency)
	assert.Equal(t, models.PaymentStatusSucceeded, payment.Status)
	assert.Equal(t, "UPI_TEST_123", payment.RailTransactionID)
	assert.NotNil(t, payment.ProcessedAt)

	mockUPIClient.AssertExpectations(t)
	mockWebhookService.AssertExpectations(t)
}

func TestPaymentService_CreatePayment_ExpiredIntent(t *testing.T) {
	db := setupTestDB(t)
	logger := logrus.New()
	
	mockUPIClient := &MockUPIClient{}
	mockWebhookService := &MockWebhookService{}
	
	ledgerService := NewLedgerService(db, logger)
	riskService := NewRiskService(db, logger)
	
	service := NewPaymentService(db, logger, mockUPIClient, ledgerService, riskService, mockWebhookService)

	// Create an expired payment intent
	merchantID := uuid.New()
	amount := decimal.NewFromFloat(100.50)
	
	intent := &models.PaymentIntent{
		ID:            uuid.New(),
		MerchantID:    merchantID,
		Amount:        amount,
		Currency:      "INR",
		Description:   "Test payment",
		Status:        models.PaymentIntentStatusCreated,
		PaymentMethod: "upi",
		ExpiresAt:     timePtr(time.Now().Add(-1 * time.Minute)), // Expired
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	
	err := db.Create(intent).Error
	require.NoError(t, err)

	req := CreatePaymentRequest{
		PaymentIntentID: intent.ID,
		PayerVPA:        "payer@upi",
		PayeeVPA:        "payee@upi",
		IPAddress:       "127.0.0.1",
		UserAgent:       "Test-Agent",
	}

	ctx := context.Background()
	payment, err := service.CreatePayment(ctx, req)

	assert.Error(t, err)
	assert.Nil(t, payment)
	assert.Contains(t, err.Error(), "expired")
}

func TestPaymentService_CreatePayment_InvalidVPA(t *testing.T) {
	db := setupTestDB(t)
	logger := logrus.New()
	
	mockUPIClient := &MockUPIClient{}
	mockWebhookService := &MockWebhookService{}
	
	ledgerService := NewLedgerService(db, logger)
	riskService := NewRiskService(db, logger)
	
	service := NewPaymentService(db, logger, mockUPIClient, ledgerService, riskService, mockWebhookService)

	// Create a payment intent
	merchantID := uuid.New()
	amount := decimal.NewFromFloat(100.50)
	
	intent := &models.PaymentIntent{
		ID:            uuid.New(),
		MerchantID:    merchantID,
		Amount:        amount,
		Currency:      "INR",
		Description:   "Test payment",
		Status:        models.PaymentIntentStatusCreated,
		PaymentMethod: "upi",
		ExpiresAt:     timePtr(time.Now().Add(15 * time.Minute)),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	
	err := db.Create(intent).Error
	require.NoError(t, err)

	// Mock invalid VPA validation
	mockUPIClient.On("ValidateVPA", mock.Anything, "invalid-vpa").Return(false, nil)

	req := CreatePaymentRequest{
		PaymentIntentID: intent.ID,
		PayerVPA:        "invalid-vpa",
		PayeeVPA:        "payee@upi",
		IPAddress:       "127.0.0.1",
		UserAgent:       "Test-Agent",
	}

	ctx := context.Background()
	payment, err := service.CreatePayment(ctx, req)

	assert.Error(t, err)
	assert.Nil(t, payment)
	assert.Contains(t, err.Error(), "invalid payer VPA")

	mockUPIClient.AssertExpectations(t)
}

func timePtr(t time.Time) *time.Time {
	return &t
}