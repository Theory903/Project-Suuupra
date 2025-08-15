package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/suuupra/payments/internal/models"
)

// WebhookService handles webhook management and delivery
type WebhookService struct {
	db              *gorm.DB
	logger          *logrus.Logger
	httpClient      *http.Client
	signingSecret   string
	maxRetries      int
	timeoutSeconds  int
	cron            *cron.Cron
}

// NewWebhookService creates a new webhook service
func NewWebhookService(db *gorm.DB, logger *logrus.Logger, signingSecret string, maxRetries, timeoutSeconds int) *WebhookService {
	return &WebhookService{
		db:              db,
		logger:          logger,
		httpClient:      &http.Client{Timeout: time.Duration(timeoutSeconds) * time.Second},
		signingSecret:   signingSecret,
		maxRetries:      maxRetries,
		timeoutSeconds:  timeoutSeconds,
		cron:            cron.New(),
	}
}

// Start starts the webhook service and retry scheduler
func (s *WebhookService) Start() {
	s.logger.Info("Starting webhook service")
	
	// Schedule retry job every minute
	s.cron.AddFunc("@every 1m", func() {
		ctx := context.Background()
		if err := s.retryFailedDeliveries(ctx); err != nil {
			s.logger.WithError(err).Error("Failed to retry webhook deliveries")
		}
	})
	
	s.cron.Start()
}

// Stop stops the webhook service
func (s *WebhookService) Stop() {
	s.logger.Info("Stopping webhook service")
	s.cron.Stop()
}

// CreateWebhookEndpointRequest represents a webhook endpoint creation request
type CreateWebhookEndpointRequest struct {
	MerchantID  uuid.UUID `json:"merchant_id" binding:"required"`
	URL         string    `json:"url" binding:"required"`
	Events      []string  `json:"events" binding:"required"`
	Secret      string    `json:"secret"`
	Description string    `json:"description"`
	Version     string    `json:"version"`
}

// CreateWebhookEndpoint creates a new webhook endpoint
func (s *WebhookService) CreateWebhookEndpoint(ctx context.Context, req CreateWebhookEndpointRequest) (*models.WebhookEndpoint, error) {
	log := s.logger.WithFields(logrus.Fields{
		"merchant_id": req.MerchantID,
		"url":         req.URL,
		"events":      req.Events,
	})

	// Generate secret if not provided
	if req.Secret == "" {
		req.Secret = s.generateSecret()
	}

	if req.Version == "" {
		req.Version = "v1"
	}

	endpoint := &models.WebhookEndpoint{
		ID:          uuid.New(),
		MerchantID:  req.MerchantID,
		URL:         req.URL,
		Secret:      req.Secret,
		Events:      req.Events,
		Active:      true,
		Version:     req.Version,
		Description: req.Description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := s.db.WithContext(ctx).Create(endpoint).Error
	if err != nil {
		log.WithError(err).Error("Failed to create webhook endpoint")
		return nil, fmt.Errorf("failed to create webhook endpoint: %w", err)
	}

	log.WithField("endpoint_id", endpoint.ID).Info("Webhook endpoint created successfully")
	return endpoint, nil
}

// GetWebhookEndpoints retrieves webhook endpoints for a merchant
func (s *WebhookService) GetWebhookEndpoints(ctx context.Context, merchantID uuid.UUID) ([]models.WebhookEndpoint, error) {
	var endpoints []models.WebhookEndpoint
	err := s.db.WithContext(ctx).
		Where("merchant_id = ?", merchantID).
		Order("created_at DESC").
		Find(&endpoints).Error
	
	if err != nil {
		return nil, fmt.Errorf("failed to get webhook endpoints: %w", err)
	}

	return endpoints, nil
}

// UpdateWebhookEndpoint updates a webhook endpoint
func (s *WebhookService) UpdateWebhookEndpoint(ctx context.Context, id uuid.UUID, updates map[string]interface{}) (*models.WebhookEndpoint, error) {
	var endpoint models.WebhookEndpoint
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&endpoint).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("webhook endpoint not found")
		}
		return nil, fmt.Errorf("failed to find webhook endpoint: %w", err)
	}

	updates["updated_at"] = time.Now()
	err = s.db.WithContext(ctx).Model(&endpoint).Updates(updates).Error
	if err != nil {
		return nil, fmt.Errorf("failed to update webhook endpoint: %w", err)
	}

	return &endpoint, nil
}

// DeleteWebhookEndpoint deletes a webhook endpoint
func (s *WebhookService) DeleteWebhookEndpoint(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).Delete(&models.WebhookEndpoint{}, "id = ?", id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete webhook endpoint: %w", result.Error)
	}
	
	if result.RowsAffected == 0 {
		return fmt.Errorf("webhook endpoint not found")
	}

	return nil
}

// WebhookEvent represents a webhook event payload
type WebhookEvent struct {
	ID        uuid.UUID   `json:"id"`
	Type      string      `json:"type"`
	CreatedAt time.Time   `json:"created_at"`
	Data      interface{} `json:"data"`
	Version   string      `json:"version"`
}

// TriggerWebhook triggers a webhook for a specific event
func (s *WebhookService) TriggerWebhook(ctx context.Context, merchantID uuid.UUID, eventType string, data interface{}) {
	log := s.logger.WithFields(logrus.Fields{
		"merchant_id": merchantID,
		"event_type":  eventType,
	})

	// Get active webhook endpoints for this merchant that subscribe to this event
	var endpoints []models.WebhookEndpoint
	err := s.db.WithContext(ctx).
		Where("merchant_id = ? AND active = true", merchantID).
		Find(&endpoints).Error
	
	if err != nil {
		log.WithError(err).Error("Failed to get webhook endpoints")
		return
	}

	// Filter endpoints that subscribe to this event type
	relevantEndpoints := make([]models.WebhookEndpoint, 0)
	for _, endpoint := range endpoints {
		for _, subscribedEvent := range endpoint.Events {
			if subscribedEvent == eventType || subscribedEvent == "*" {
				relevantEndpoints = append(relevantEndpoints, endpoint)
				break
			}
		}
	}

	if len(relevantEndpoints) == 0 {
		log.Debug("No webhook endpoints found for event type")
		return
	}

	// Create webhook event
	event := WebhookEvent{
		ID:        uuid.New(),
		Type:      eventType,
		CreatedAt: time.Now(),
		Data:      data,
		Version:   "v1",
	}

	eventPayload, err := json.Marshal(event)
	if err != nil {
		log.WithError(err).Error("Failed to marshal webhook event")
		return
	}

	// Create delivery records for each endpoint
	for _, endpoint := range relevantEndpoints {
		delivery := &models.WebhookDelivery{
			ID:            uuid.New(),
			EndpointID:    endpoint.ID,
			EventType:     eventType,
			EventID:       event.ID,
			Payload:       eventPayload,
			Status:        "pending",
			AttemptCount:  0,
			MaxAttempts:   s.maxRetries,
			NextAttemptAt: timePtr(time.Now()),
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}

		// Generate HMAC signature
		delivery.Signature = s.generateSignature(eventPayload, endpoint.Secret)

		err := s.db.WithContext(ctx).Create(delivery).Error
		if err != nil {
			log.WithError(err).WithField("endpoint_id", endpoint.ID).Error("Failed to create webhook delivery")
			continue
		}

		// Attempt immediate delivery
		go s.attemptDelivery(delivery, &endpoint)
	}

	log.WithField("endpoint_count", len(relevantEndpoints)).Info("Webhook triggered for endpoints")
}

// attemptDelivery attempts to deliver a webhook
func (s *WebhookService) attemptDelivery(delivery *models.WebhookDelivery, endpoint *models.WebhookEndpoint) {
	log := s.logger.WithFields(logrus.Fields{
		"delivery_id":   delivery.ID,
		"endpoint_id":   delivery.EndpointID,
		"event_type":    delivery.EventType,
		"attempt_count": delivery.AttemptCount + 1,
		"url":           endpoint.URL,
	})

	log.Info("Attempting webhook delivery")

	// Increment attempt count
	delivery.AttemptCount++
	delivery.UpdatedAt = time.Now()

	// Create HTTP request
	req, err := http.NewRequest("POST", endpoint.URL, bytes.NewReader(delivery.Payload))
	if err != nil {
		log.WithError(err).Error("Failed to create HTTP request")
		s.markDeliveryFailed(delivery, fmt.Sprintf("Failed to create request: %v", err))
		return
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Signature", delivery.Signature)
	req.Header.Set("X-Webhook-Event-Type", delivery.EventType)
	req.Header.Set("X-Webhook-Event-ID", delivery.EventID.String())
	req.Header.Set("X-Webhook-Delivery-ID", delivery.ID.String())
	req.Header.Set("User-Agent", "Suuupra-Webhooks/1.0")

	// Send request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.WithError(err).Error("HTTP request failed")
		s.scheduleRetry(delivery, fmt.Sprintf("Request failed: %v", err))
		return
	}
	defer resp.Body.Close()

	// Read response body
	var responseBody bytes.Buffer
	responseBody.ReadFrom(resp.Body)
	responseBodyStr := responseBody.String()

	delivery.ResponseStatus = &resp.StatusCode
	delivery.ResponseBody = &responseBodyStr

	// Check if delivery was successful (2xx status codes)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.WithField("status_code", resp.StatusCode).Info("Webhook delivered successfully")
		s.markDeliverySuccessful(delivery)
	} else {
		log.WithFields(logrus.Fields{
			"status_code":    resp.StatusCode,
			"response_body":  responseBodyStr,
		}).Warn("Webhook delivery failed with non-2xx status")
		s.scheduleRetry(delivery, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, responseBodyStr))
	}
}

// markDeliverySuccessful marks a delivery as successful
func (s *WebhookService) markDeliverySuccessful(delivery *models.WebhookDelivery) {
	now := time.Now()
	delivery.Status = "delivered"
	delivery.DeliveredAt = &now
	delivery.NextAttemptAt = nil
	delivery.UpdatedAt = now

	err := s.db.Save(delivery).Error
	if err != nil {
		s.logger.WithError(err).WithField("delivery_id", delivery.ID).Error("Failed to update delivery status")
	}
}

// markDeliveryFailed marks a delivery as permanently failed
func (s *WebhookService) markDeliveryFailed(delivery *models.WebhookDelivery, reason string) {
	delivery.Status = "failed"
	delivery.FailureReason = &reason
	delivery.NextAttemptAt = nil
	delivery.UpdatedAt = time.Now()

	err := s.db.Save(delivery).Error
	if err != nil {
		s.logger.WithError(err).WithField("delivery_id", delivery.ID).Error("Failed to update delivery status")
	}
}

// scheduleRetry schedules a retry for a failed delivery
func (s *WebhookService) scheduleRetry(delivery *models.WebhookDelivery, reason string) {
	if delivery.AttemptCount >= delivery.MaxAttempts {
		s.markDeliveryFailed(delivery, reason)
		return
	}

	// Exponential backoff: 1min, 2min, 4min, 8min, 16min
	backoffMinutes := 1 << (delivery.AttemptCount - 1)
	nextAttempt := time.Now().Add(time.Duration(backoffMinutes) * time.Minute)

	delivery.Status = "retrying"
	delivery.FailureReason = &reason
	delivery.NextAttemptAt = &nextAttempt
	delivery.UpdatedAt = time.Now()

	err := s.db.Save(delivery).Error
	if err != nil {
		s.logger.WithError(err).WithField("delivery_id", delivery.ID).Error("Failed to schedule retry")
	}

	s.logger.WithFields(logrus.Fields{
		"delivery_id":     delivery.ID,
		"attempt_count":   delivery.AttemptCount,
		"next_attempt_at": nextAttempt,
		"reason":          reason,
	}).Info("Webhook delivery scheduled for retry")
}

// retryFailedDeliveries retries failed webhook deliveries
func (s *WebhookService) retryFailedDeliveries(ctx context.Context) error {
	var deliveries []models.WebhookDelivery
	err := s.db.WithContext(ctx).
		Preload("Endpoint").
		Where("status IN ('pending', 'retrying') AND next_attempt_at <= ? AND attempt_count < max_attempts", time.Now()).
		Find(&deliveries).Error
	
	if err != nil {
		return fmt.Errorf("failed to fetch deliveries for retry: %w", err)
	}

	if len(deliveries) == 0 {
		return nil
	}

	s.logger.WithField("delivery_count", len(deliveries)).Info("Retrying webhook deliveries")

	for _, delivery := range deliveries {
		if delivery.Endpoint != nil {
			go s.attemptDelivery(&delivery, delivery.Endpoint)
		}
	}

	return nil
}

// generateSignature generates HMAC-SHA256 signature for webhook payload
func (s *WebhookService) generateSignature(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// generateSecret generates a random secret for webhook endpoints
func (s *WebhookService) generateSecret() string {
	return uuid.New().String()
}

// timePtr returns a pointer to a time value
func timePtr(t time.Time) *time.Time {
	return &t
}