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

// RefundService handles refund processing
type RefundService struct {
	db             *gorm.DB
	logger         *logrus.Logger
	upiClient      *UPIClient
	ledgerService  *LedgerService
	webhookService *WebhookService
}

// NewRefundService creates a new refund service
func NewRefundService(
	db *gorm.DB,
	logger *logrus.Logger,
	upiClient *UPIClient,
	ledgerService *LedgerService,
	webhookService *WebhookService,
) *RefundService {
	return &RefundService{
		db:             db,
		logger:         logger,
		upiClient:      upiClient,
		ledgerService:  ledgerService,
		webhookService: webhookService,
	}
}

// CreateRefundRequest represents a refund creation request
type CreateRefundRequest struct {
	PaymentID uuid.UUID       `json:"payment_id" binding:"required"`
	Amount    decimal.Decimal `json:"amount" binding:"required"`
	Reason    string          `json:"reason"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// CreateRefund creates and processes a refund
func (s *RefundService) CreateRefund(ctx context.Context, req CreateRefundRequest) (*models.Refund, error) {
	log := s.logger.WithFields(logrus.Fields{
		"payment_id": req.PaymentID,
		"amount":     req.Amount.String(),
		"reason":     req.Reason,
	})

	log.Info("Starting refund creation")

	// Validate refund amount
	if req.Amount.LessThanOrEqual(decimal.Zero) {
		return nil, fmt.Errorf("refund amount must be greater than zero")
	}

	// Get original payment
	var payment models.Payment
	err := s.db.WithContext(ctx).
		Preload("PaymentIntent").
		Where("id = ?", req.PaymentID).
		First(&payment).Error
	
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("payment not found")
		}
		log.WithError(err).Error("Failed to fetch payment")
		return nil, fmt.Errorf("failed to fetch payment: %w", err)
	}

	// Validate payment status
	if payment.Status != models.PaymentStatusSucceeded {
		return nil, fmt.Errorf("can only refund successful payments")
	}

	// Check if refund amount is valid
	if req.Amount.GreaterThan(payment.Amount) {
		return nil, fmt.Errorf("refund amount cannot exceed payment amount")
	}

	// Check for existing refunds to ensure total doesn't exceed payment amount
	var existingRefundsTotal decimal.Decimal
	err = s.db.WithContext(ctx).
		Model(&models.Refund{}).
		Where("payment_id = ? AND status IN (?)", req.PaymentID, []string{
			models.RefundStatusSucceeded,
			models.RefundStatusPending,
			models.RefundStatusProcessing,
		}).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&existingRefundsTotal).Error
	
	if err != nil {
		log.WithError(err).Error("Failed to calculate existing refunds")
		return nil, fmt.Errorf("failed to calculate existing refunds: %w", err)
	}

	totalRefundAmount := existingRefundsTotal.Add(req.Amount)
	if totalRefundAmount.GreaterThan(payment.Amount) {
		return nil, fmt.Errorf("total refund amount would exceed payment amount")
	}

	// Generate unique refund reference
	refundReference := s.generateRefundReference()

	// Create refund record
	refund := &models.Refund{
		ID:              uuid.New(),
		PaymentID:       req.PaymentID,
		Amount:          req.Amount,
		Currency:        payment.Currency,
		Reason:          req.Reason,
		Status:          models.RefundStatusPending,
		RefundReference: refundReference,
		Metadata:        req.Metadata,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Start database transaction for refund processing
	return refund, s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create refund record
		if err := tx.Create(refund).Error; err != nil {
			log.WithError(err).Error("Failed to create refund record")
			return fmt.Errorf("failed to create refund record: %w", err)
		}

		// Update status to processing
		refund.Status = models.RefundStatusProcessing
		if err := tx.Save(refund).Error; err != nil {
			return fmt.Errorf("failed to update refund status: %w", err)
		}

		// Process refund through UPI
		upiReq := UPIRefundRequest{
			RefundID:          refund.ID,
			OriginalPaymentID: payment.ID,
			TransactionID:     payment.RailTransactionID,
			Amount:            refund.Amount,
			Currency:          refund.Currency,
			Reason:            refund.Reason,
		}

		upiResp, err := s.upiClient.ProcessRefund(ctx, upiReq)
		if err != nil {
			log.WithError(err).Error("UPI refund processing failed")
			// Update refund status to failed
			refund.Status = models.RefundStatusFailed
			failureMsg := err.Error()
			refund.FailureMessage = &failureMsg
			tx.Save(refund)
			return fmt.Errorf("UPI refund processing failed: %w", err)
		}

		// Update refund with UPI response
		if upiResp.Success {
			refund.Status = models.RefundStatusSucceeded
			refund.RefundReference = upiResp.RefundReference
			processedAt := upiResp.ProcessedAt
			refund.ProcessedAt = &processedAt
		} else {
			refund.Status = models.RefundStatusFailed
			refund.FailureCode = upiResp.FailureCode
			refund.FailureMessage = upiResp.FailureMessage
		}

		if err := tx.Save(refund).Error; err != nil {
			return fmt.Errorf("failed to update refund with UPI response: %w", err)
		}

		// If refund succeeded, post to ledger
		if refund.Status == models.RefundStatusSucceeded {
			if err := s.ledgerService.PostRefundTransaction(ctx, refund, &payment); err != nil {
				log.WithError(err).Error("Failed to post refund to ledger")
				// In a real system, you might want to handle this differently
				// For now, we'll still consider the refund successful but log the ledger error
			}
		}

		log.WithFields(logrus.Fields{
			"refund_id":        refund.ID,
			"status":           refund.Status,
			"refund_reference": refund.RefundReference,
		}).Info("Refund processing completed")

		// Trigger webhooks
		go func() {
			merchantID := payment.PaymentIntent.MerchantID
			if refund.Status == models.RefundStatusSucceeded {
				s.webhookService.TriggerWebhook(context.Background(), merchantID, "refund.succeeded", refund)
			} else {
				s.webhookService.TriggerWebhook(context.Background(), merchantID, "refund.failed", refund)
			}
		}()

		return nil
	})
}

// GetRefund retrieves a refund by ID
func (s *RefundService) GetRefund(ctx context.Context, id uuid.UUID) (*models.Refund, error) {
	var refund models.Refund
	err := s.db.WithContext(ctx).
		Preload("Payment").
		Preload("Payment.PaymentIntent").
		Where("id = ?", id).
		First(&refund).Error
	
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("refund not found")
		}
		return nil, fmt.Errorf("failed to get refund: %w", err)
	}

	return &refund, nil
}

// GetRefundsByPayment retrieves all refunds for a payment
func (s *RefundService) GetRefundsByPayment(ctx context.Context, paymentID uuid.UUID) ([]models.Refund, error) {
	var refunds []models.Refund
	err := s.db.WithContext(ctx).
		Where("payment_id = ?", paymentID).
		Order("created_at DESC").
		Find(&refunds).Error
	
	if err != nil {
		return nil, fmt.Errorf("failed to get refunds: %w", err)
	}

	return refunds, nil
}

// CheckRefundStatus checks the status of a refund with the payment rail
func (s *RefundService) CheckRefundStatus(ctx context.Context, refundID uuid.UUID) (*models.Refund, error) {
	refund, err := s.GetRefund(ctx, refundID)
	if err != nil {
		return nil, err
	}

	log := s.logger.WithFields(logrus.Fields{
		"refund_id":        refund.ID,
		"refund_reference": refund.RefundReference,
		"current_status":   refund.Status,
	})

	// Only check status for pending/processing refunds
	if refund.Status != models.RefundStatusPending && refund.Status != models.RefundStatusProcessing {
		log.Debug("Refund is not in pending/processing status, no need to check")
		return refund, nil
	}

	log.Info("Checking refund status with payment rail")

	// TODO: Implement actual status check with UPI Core
	// For now, we'll simulate status check logic
	
	// In a real implementation, you would call the UPI Core service to check status
	// This is a mock implementation
	now := time.Now()
	if refund.CreatedAt.Add(5 * time.Minute).Before(now) {
		// Simulate that refunds complete after 5 minutes
		refund.Status = models.RefundStatusSucceeded
		refund.ProcessedAt = &now
		
		err := s.db.WithContext(ctx).Save(refund).Error
		if err != nil {
			log.WithError(err).Error("Failed to update refund status")
			return nil, fmt.Errorf("failed to update refund status: %w", err)
		}

		log.Info("Refund status updated to succeeded")
		
		// Post to ledger if not already done
		if refund.Payment != nil {
			if err := s.ledgerService.PostRefundTransaction(ctx, refund, refund.Payment); err != nil {
				log.WithError(err).Error("Failed to post refund to ledger")
			}
		}
		
		// Trigger webhook
		if refund.Payment != nil && refund.Payment.PaymentIntent != nil {
			go s.webhookService.TriggerWebhook(
				context.Background(),
				refund.Payment.PaymentIntent.MerchantID,
				"refund.succeeded",
				refund,
			)
		}
	}

	return refund, nil
}

// generateRefundReference generates a unique refund reference
func (s *RefundService) generateRefundReference() string {
	return fmt.Sprintf("REF_%d_%s", time.Now().Unix(), uuid.New().String()[:8])
}

// CancelRefund cancels a pending refund
func (s *RefundService) CancelRefund(ctx context.Context, refundID uuid.UUID) (*models.Refund, error) {
	log := s.logger.WithField("refund_id", refundID)

	var refund models.Refund
	err := s.db.WithContext(ctx).
		Preload("Payment").
		Preload("Payment.PaymentIntent").
		Where("id = ?", refundID).
		First(&refund).Error
	
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("refund not found")
		}
		return nil, fmt.Errorf("failed to get refund: %w", err)
	}

	// Can only cancel pending refunds
	if refund.Status != models.RefundStatusPending {
		return nil, fmt.Errorf("can only cancel pending refunds")
	}

	// Update status to canceled
	refund.Status = models.RefundStatusCanceled
	refund.UpdatedAt = time.Now()

	err = s.db.WithContext(ctx).Save(&refund).Error
	if err != nil {
		log.WithError(err).Error("Failed to cancel refund")
		return nil, fmt.Errorf("failed to cancel refund: %w", err)
	}

	log.Info("Refund canceled successfully")

	// Trigger webhook
	if refund.Payment != nil && refund.Payment.PaymentIntent != nil {
		go s.webhookService.TriggerWebhook(
			context.Background(),
			refund.Payment.PaymentIntent.MerchantID,
			"refund.canceled",
			&refund,
		)
	}

	return &refund, nil
}