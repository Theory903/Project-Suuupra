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

// PaymentService handles payment processing
type PaymentService struct {
	db            *gorm.DB
	logger        *logrus.Logger
	upiClient     *UPIClient
	ledgerService *LedgerService
	riskService   *RiskService
	webhookService *WebhookService
}

// NewPaymentService creates a new payment service
func NewPaymentService(
	db *gorm.DB,
	logger *logrus.Logger,
	upiClient *UPIClient,
	ledgerService *LedgerService,
	riskService *RiskService,
	webhookService *WebhookService,
) *PaymentService {
	return &PaymentService{
		db:            db,
		logger:        logger,
		upiClient:     upiClient,
		ledgerService: ledgerService,
		riskService:   riskService,
		webhookService: webhookService,
	}
}

// CreatePaymentIntentRequest represents a payment intent creation request
type CreatePaymentIntentRequest struct {
	MerchantID    uuid.UUID       `json:"merchant_id" binding:"required"`
	Amount        decimal.Decimal `json:"amount" binding:"required"`
	Currency      string          `json:"currency"`
	Description   string          `json:"description"`
	PaymentMethod string          `json:"payment_method" binding:"required"`
	CustomerID    *uuid.UUID      `json:"customer_id"`
	Metadata      map[string]interface{} `json:"metadata"`
	ExpiresIn     *int            `json:"expires_in"` // Seconds from now
}

// CreatePaymentIntent creates a new payment intent
func (s *PaymentService) CreatePaymentIntent(ctx context.Context, req CreatePaymentIntentRequest) (*models.PaymentIntent, error) {
	log := s.logger.WithFields(logrus.Fields{
		"merchant_id":    req.MerchantID,
		"amount":         req.Amount.String(),
		"payment_method": req.PaymentMethod,
	})

	// Validate input
	if req.Amount.LessThanOrEqual(decimal.Zero) {
		return nil, fmt.Errorf("amount must be greater than zero")
	}

	if req.Currency == "" {
		req.Currency = "INR"
	}

	// Calculate expiration time
	var expiresAt *time.Time
	if req.ExpiresIn != nil {
		expTime := time.Now().Add(time.Duration(*req.ExpiresIn) * time.Second)
		expiresAt = &expTime
	} else {
		// Default expiration: 15 minutes
		expTime := time.Now().Add(15 * time.Minute)
		expiresAt = &expTime
	}

	// Create payment intent
	intent := &models.PaymentIntent{
		ID:            uuid.New(),
		MerchantID:    req.MerchantID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Description:   req.Description,
		Status:        models.PaymentIntentStatusCreated,
		PaymentMethod: req.PaymentMethod,
		CustomerID:    req.CustomerID,
		Metadata:      req.Metadata,
		ExpiresAt:     expiresAt,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	err := s.db.WithContext(ctx).Create(intent).Error
	if err != nil {
		log.WithError(err).Error("Failed to create payment intent")
		return nil, fmt.Errorf("failed to create payment intent: %w", err)
	}

	log.WithField("intent_id", intent.ID).Info("Payment intent created successfully")

	// Trigger webhook
	s.webhookService.TriggerWebhook(ctx, req.MerchantID, "payment_intent.created", intent)

	return intent, nil
}

// GetPaymentIntent retrieves a payment intent by ID
func (s *PaymentService) GetPaymentIntent(ctx context.Context, id uuid.UUID) (*models.PaymentIntent, error) {
	var intent models.PaymentIntent
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&intent).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("payment intent not found")
		}
		return nil, fmt.Errorf("failed to get payment intent: %w", err)
	}

	return &intent, nil
}

// CreatePaymentRequest represents a payment creation request
type CreatePaymentRequest struct {
	PaymentIntentID uuid.UUID `json:"payment_intent_id" binding:"required"`
	PayerVPA        string    `json:"payer_vpa" binding:"required"`
	PayeeVPA        string    `json:"payee_vpa" binding:"required"`
	IPAddress       string    `json:"ip_address"`
	UserAgent       string    `json:"user_agent"`
	DeviceID        *string   `json:"device_id"`
}

// CreatePayment processes a payment
func (s *PaymentService) CreatePayment(ctx context.Context, req CreatePaymentRequest) (*models.Payment, error) {
	log := s.logger.WithFields(logrus.Fields{
		"payment_intent_id": req.PaymentIntentID,
		"payer_vpa":         req.PayerVPA,
		"payee_vpa":         req.PayeeVPA,
	})

	// Get payment intent
	intent, err := s.GetPaymentIntent(ctx, req.PaymentIntentID)
	if err != nil {
		return nil, err
	}

	// Check if intent is still valid
	if intent.Status != models.PaymentIntentStatusCreated {
		return nil, fmt.Errorf("payment intent is not in created status")
	}

	if intent.ExpiresAt != nil && time.Now().After(*intent.ExpiresAt) {
		// Update intent status to expired
		s.db.WithContext(ctx).Model(intent).Update("status", models.PaymentIntentStatusExpired)
		return nil, fmt.Errorf("payment intent has expired")
	}

	// Validate VPAs
	payerValid, err := s.upiClient.ValidateVPA(ctx, req.PayerVPA)
	if err != nil {
		log.WithError(err).Error("Failed to validate payer VPA")
		return nil, fmt.Errorf("failed to validate payer VPA: %w", err)
	}
	if !payerValid {
		return nil, fmt.Errorf("invalid payer VPA")
	}

	payeeValid, err := s.upiClient.ValidateVPA(ctx, req.PayeeVPA)
	if err != nil {
		log.WithError(err).Error("Failed to validate payee VPA")
		return nil, fmt.Errorf("failed to validate payee VPA: %w", err)
	}
	if !payeeValid {
		return nil, fmt.Errorf("invalid payee VPA")
	}

	// Perform risk assessment
	riskReq := RiskAssessmentRequest{
		PaymentIntentID: intent.ID,
		Amount:          intent.Amount,
		Currency:        intent.Currency,
		PaymentMethod:   intent.PaymentMethod,
		MerchantID:      intent.MerchantID,
		CustomerID:      intent.CustomerID,
		IPAddress:       req.IPAddress,
		UserAgent:       req.UserAgent,
		DeviceID:        req.DeviceID,
	}

	riskResult, err := s.riskService.AssessRisk(ctx, riskReq)
	if err != nil {
		log.WithError(err).Error("Risk assessment failed")
		return nil, fmt.Errorf("risk assessment failed: %w", err)
	}

	// Check risk decision
	if riskResult.Decision == models.RiskDecisionBlock {
		log.WithField("risk_score", riskResult.RiskScore).Warn("Payment blocked by risk assessment")
		return nil, fmt.Errorf("payment blocked due to risk assessment")
	}

	// Create payment record
	payment := &models.Payment{
		ID:              uuid.New(),
		PaymentIntentID: intent.ID,
		Amount:          intent.Amount,
		Currency:        intent.Currency,
		Status:          models.PaymentStatusPending,
		PaymentMethod:   intent.PaymentMethod,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Start database transaction
	return payment, s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create payment record
		if err := tx.Create(payment).Error; err != nil {
			log.WithError(err).Error("Failed to create payment record")
			return fmt.Errorf("failed to create payment record: %w", err)
		}

		// Update payment status to processing
		payment.Status = models.PaymentStatusProcessing
		if err := tx.Save(payment).Error; err != nil {
			return fmt.Errorf("failed to update payment status: %w", err)
		}

		// Process payment through UPI
		upiReq := UPIPaymentRequest{
			PaymentID:      payment.ID,
			PayerVPA:       req.PayerVPA,
			PayeeVPA:       req.PayeeVPA,
			Amount:         payment.Amount,
			Currency:       payment.Currency,
			Description:    intent.Description,
			MerchantID:     intent.MerchantID.String(),
			TransactionRef: payment.ID.String(),
		}

		upiResp, err := s.upiClient.ProcessPayment(ctx, upiReq)
		if err != nil {
			log.WithError(err).Error("UPI payment processing failed")
			// Update payment status to failed
			payment.Status = models.PaymentStatusFailed
			failureMsg := err.Error()
			payment.FailureMessage = &failureMsg
			tx.Save(payment)
			return fmt.Errorf("UPI payment processing failed: %w", err)
		}

		// Update payment with UPI response
		if upiResp.Success {
			payment.Status = models.PaymentStatusSucceeded
			payment.RailTransactionID = upiResp.TransactionID
			processedAt := upiResp.ProcessedAt
			payment.ProcessedAt = &processedAt
		} else {
			payment.Status = models.PaymentStatusFailed
			payment.FailureCode = upiResp.FailureCode
			payment.FailureMessage = upiResp.FailureMessage
		}

		if err := tx.Save(payment).Error; err != nil {
			return fmt.Errorf("failed to update payment with UPI response: %w", err)
		}

		// If payment succeeded, post to ledger
		if payment.Status == models.PaymentStatusSucceeded {
			if err := s.ledgerService.PostPaymentTransaction(ctx, payment); err != nil {
				log.WithError(err).Error("Failed to post payment to ledger")
				// In a real system, you might want to handle this differently
				// For now, we'll still consider the payment successful but log the ledger error
			}

			// Update payment intent status
			intent.Status = models.PaymentIntentStatusSucceeded
			if err := tx.Save(intent).Error; err != nil {
				return fmt.Errorf("failed to update payment intent status: %w", err)
			}
		}

		log.WithFields(logrus.Fields{
			"payment_id":       payment.ID,
			"status":           payment.Status,
			"transaction_id":   payment.RailTransactionID,
		}).Info("Payment processing completed")

		// Trigger webhooks
		go func() {
			if payment.Status == models.PaymentStatusSucceeded {
				s.webhookService.TriggerWebhook(context.Background(), intent.MerchantID, "payment.succeeded", payment)
			} else {
				s.webhookService.TriggerWebhook(context.Background(), intent.MerchantID, "payment.failed", payment)
			}
		}()

		return nil
	})
}

// GetPayment retrieves a payment by ID
func (s *PaymentService) GetPayment(ctx context.Context, id uuid.UUID) (*models.Payment, error) {
	var payment models.Payment
	err := s.db.WithContext(ctx).
		Preload("PaymentIntent").
		Where("id = ?", id).
		First(&payment).Error
	
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("payment not found")
		}
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}

	return &payment, nil
}