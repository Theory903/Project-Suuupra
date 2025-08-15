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

// RiskService handles risk assessment for payments
type RiskService struct {
	db     *gorm.DB
	logger *logrus.Logger
}

// NewRiskService creates a new risk service
func NewRiskService(db *gorm.DB, logger *logrus.Logger) *RiskService {
	return &RiskService{
		db:     db,
		logger: logger,
	}
}

// RiskAssessmentRequest represents a risk assessment request
type RiskAssessmentRequest struct {
	PaymentIntentID uuid.UUID       `json:"payment_intent_id"`
	Amount          decimal.Decimal `json:"amount"`
	Currency        string          `json:"currency"`
	PaymentMethod   string          `json:"payment_method"`
	MerchantID      uuid.UUID       `json:"merchant_id"`
	CustomerID      *uuid.UUID      `json:"customer_id"`
	IPAddress       string          `json:"ip_address"`
	UserAgent       string          `json:"user_agent"`
	DeviceID        *string         `json:"device_id"`
}

// RiskAssessmentResult represents a risk assessment result
type RiskAssessmentResult struct {
	Assessment *models.RiskAssessment
	RiskScore  float64
	RiskLevel  string
	Decision   string
	Factors    map[string]interface{}
	Rules      []string
}

// AssessRisk performs risk assessment on a payment
func (s *RiskService) AssessRisk(ctx context.Context, req RiskAssessmentRequest) (*RiskAssessmentResult, error) {
	log := s.logger.WithFields(logrus.Fields{
		"payment_intent_id": req.PaymentIntentID,
		"amount":            req.Amount.String(),
		"merchant_id":       req.MerchantID,
		"ip_address":        req.IPAddress,
	})

	log.Info("Starting risk assessment")

	// Initialize risk factors
	factors := make(map[string]interface{})
	rules := make([]string, 0)
	riskScore := 0.0

	// Amount-based risk assessment
	amountRisk := s.assessAmountRisk(req.Amount)
	factors["amount_risk"] = amountRisk
	riskScore += amountRisk

	// Velocity risk assessment
	velocityRisk, err := s.assessVelocityRisk(ctx, req)
	if err != nil {
		log.WithError(err).Warn("Failed to assess velocity risk, defaulting to medium risk")
		velocityRisk = 0.5
	}
	factors["velocity_risk"] = velocityRisk
	riskScore += velocityRisk

	// Device risk assessment
	deviceRisk := s.assessDeviceRisk(req.DeviceID)
	factors["device_risk"] = deviceRisk
	riskScore += deviceRisk

	// IP address risk assessment
	ipRisk := s.assessIPRisk(req.IPAddress)
	factors["ip_risk"] = ipRisk
	riskScore += ipRisk

	// Time-based risk assessment
	timeRisk := s.assessTimeRisk()
	factors["time_risk"] = timeRisk
	riskScore += timeRisk

	// Merchant risk assessment
	merchantRisk, err := s.assessMerchantRisk(ctx, req.MerchantID)
	if err != nil {
		log.WithError(err).Warn("Failed to assess merchant risk, defaulting to low risk")
		merchantRisk = 0.1
	}
	factors["merchant_risk"] = merchantRisk
	riskScore += merchantRisk

	// Normalize risk score (0.0 to 1.0)
	riskScore = riskScore / 6.0 // We have 6 risk factors

	// Apply risk rules
	if riskScore, rules = s.applyRiskRules(riskScore, factors, req); riskScore > 1.0 {
		riskScore = 1.0
	}

	// Determine risk level and decision
	riskLevel, decision := s.determineRiskDecision(riskScore)

	log.WithFields(logrus.Fields{
		"risk_score": riskScore,
		"risk_level": riskLevel,
		"decision":   decision,
		"factors":    factors,
		"rules":      rules,
	}).Info("Risk assessment completed")

	// Create risk assessment record
	assessment := &models.RiskAssessment{
		ID:              uuid.New(),
		PaymentIntentID: req.PaymentIntentID,
		RiskScore:       riskScore,
		RiskLevel:       riskLevel,
		Decision:        decision,
		Factors:         factors,
		Rules:           rules,
		DeviceID:        req.DeviceID,
		IPAddress:       req.IPAddress,
		UserAgent:       req.UserAgent,
		CreatedAt:       time.Now(),
	}

	err = s.db.WithContext(ctx).Create(assessment).Error
	if err != nil {
		log.WithError(err).Error("Failed to save risk assessment")
		return nil, fmt.Errorf("failed to save risk assessment: %w", err)
	}

	return &RiskAssessmentResult{
		Assessment: assessment,
		RiskScore:  riskScore,
		RiskLevel:  riskLevel,
		Decision:   decision,
		Factors:    factors,
		Rules:      rules,
	}, nil
}

// assessAmountRisk assesses risk based on transaction amount
func (s *RiskService) assessAmountRisk(amount decimal.Decimal) float64 {
	// Higher amounts carry higher risk
	if amount.GreaterThan(decimal.NewFromInt(100000)) { // > 1 lakh
		return 0.9
	} else if amount.GreaterThan(decimal.NewFromInt(50000)) { // > 50k
		return 0.7
	} else if amount.GreaterThan(decimal.NewFromInt(10000)) { // > 10k
		return 0.4
	} else if amount.GreaterThan(decimal.NewFromInt(1000)) { // > 1k
		return 0.2
	}
	return 0.1
}

// assessVelocityRisk assesses risk based on transaction velocity
func (s *RiskService) assessVelocityRisk(ctx context.Context, req RiskAssessmentRequest) (float64, error) {
	// Count transactions in the last hour for this customer/merchant
	since := time.Now().Add(-1 * time.Hour)
	
	var count int64
	query := s.db.WithContext(ctx).Model(&models.Payment{}).
		Joins("JOIN payment_intents ON payments.payment_intent_id = payment_intents.id").
		Where("payment_intents.created_at > ?", since)

	if req.CustomerID != nil {
		query = query.Where("payment_intents.customer_id = ?", *req.CustomerID)
	} else {
		query = query.Where("payment_intents.merchant_id = ?", req.MerchantID)
	}

	err := query.Count(&count).Error
	if err != nil {
		return 0.5, err
	}

	// High velocity = higher risk
	if count > 10 {
		return 1.0, nil
	} else if count > 5 {
		return 0.8, nil
	} else if count > 3 {
		return 0.5, nil
	} else if count > 1 {
		return 0.3, nil
	}
	return 0.1, nil
}

// assessDeviceRisk assesses risk based on device information
func (s *RiskService) assessDeviceRisk(deviceID *string) float64 {
	if deviceID == nil {
		// No device ID = higher risk
		return 0.6
	}

	// TODO: Implement device fingerprinting and history analysis
	// For now, return low risk if device ID is present
	return 0.2
}

// assessIPRisk assesses risk based on IP address
func (s *RiskService) assessIPRisk(ipAddress string) float64 {
	// TODO: Implement IP reputation checking, geolocation analysis
	// For now, basic validation
	if ipAddress == "" {
		return 0.8
	}

	// Check for localhost/private IPs (higher risk in production)
	if ipAddress == "127.0.0.1" || ipAddress == "localhost" {
		return 0.9
	}

	return 0.2
}

// assessTimeRisk assesses risk based on transaction time
func (s *RiskService) assessTimeRisk() float64 {
	now := time.Now()
	hour := now.Hour()

	// Higher risk during unusual hours (11 PM to 6 AM)
	if hour >= 23 || hour <= 6 {
		return 0.6
	}

	// Medium risk during early morning (6 AM to 9 AM)
	if hour >= 6 && hour <= 9 {
		return 0.3
	}

	// Lower risk during business hours
	return 0.1
}

// assessMerchantRisk assesses risk based on merchant history
func (s *RiskService) assessMerchantRisk(ctx context.Context, merchantID uuid.UUID) (float64, error) {
	// Calculate merchant's recent failure rate
	since := time.Now().Add(-24 * time.Hour)
	
	var totalCount, failedCount int64
	
	// Get total transactions
	err := s.db.WithContext(ctx).Model(&models.Payment{}).
		Joins("JOIN payment_intents ON payments.payment_intent_id = payment_intents.id").
		Where("payment_intents.merchant_id = ? AND payment_intents.created_at > ?", merchantID, since).
		Count(&totalCount).Error
	if err != nil {
		return 0.3, err
	}

	if totalCount == 0 {
		// New merchant = medium risk
		return 0.5, nil
	}

	// Get failed transactions
	err = s.db.WithContext(ctx).Model(&models.Payment{}).
		Joins("JOIN payment_intents ON payments.payment_intent_id = payment_intents.id").
		Where("payment_intents.merchant_id = ? AND payment_intents.created_at > ? AND payments.status = ?", 
			merchantID, since, models.PaymentStatusFailed).
		Count(&failedCount).Error
	if err != nil {
		return 0.3, err
	}

	failureRate := float64(failedCount) / float64(totalCount)
	
	// Higher failure rate = higher risk
	if failureRate > 0.5 {
		return 1.0, nil
	} else if failureRate > 0.3 {
		return 0.8, nil
	} else if failureRate > 0.1 {
		return 0.4, nil
	}
	
	return 0.1, nil
}

// applyRiskRules applies business rules to adjust risk score
func (s *RiskService) applyRiskRules(riskScore float64, factors map[string]interface{}, req RiskAssessmentRequest) (float64, []string) {
	rules := make([]string, 0)

	// Rule: High amount transactions
	if req.Amount.GreaterThan(decimal.NewFromInt(100000)) {
		riskScore += 0.3
		rules = append(rules, "HIGH_AMOUNT_TRANSACTION")
	}

	// Rule: Weekend/holiday transactions (simplified)
	if time.Now().Weekday() == time.Saturday || time.Now().Weekday() == time.Sunday {
		riskScore += 0.1
		rules = append(rules, "WEEKEND_TRANSACTION")
	}

	// Rule: First-time customer with high amount
	if req.CustomerID == nil && req.Amount.GreaterThan(decimal.NewFromInt(10000)) {
		riskScore += 0.2
		rules = append(rules, "FIRST_TIME_HIGH_AMOUNT")
	}

	return riskScore, rules
}

// determineRiskDecision determines the risk level and decision based on score
func (s *RiskService) determineRiskDecision(riskScore float64) (string, string) {
	if riskScore >= 0.8 {
		return models.RiskLevelHigh, models.RiskDecisionBlock
	} else if riskScore >= 0.5 {
		return models.RiskLevelMedium, models.RiskDecisionChallenge
	} else {
		return models.RiskLevelLow, models.RiskDecisionPass
	}
}

// GetRiskAssessment retrieves a risk assessment by payment intent ID
func (s *RiskService) GetRiskAssessment(ctx context.Context, paymentIntentID uuid.UUID) (*models.RiskAssessment, error) {
	var assessment models.RiskAssessment
	err := s.db.WithContext(ctx).
		Where("payment_intent_id = ?", paymentIntentID).
		First(&assessment).Error
	
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("risk assessment not found")
		}
		return nil, fmt.Errorf("failed to get risk assessment: %w", err)
	}

	return &assessment, nil
}