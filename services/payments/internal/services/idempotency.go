package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/suuupra/payments/internal/models"
)

// IdempotencyService handles idempotency key management
type IdempotencyService struct {
	db     *gorm.DB
	logger *logrus.Logger
	ttl    time.Duration
}

// NewIdempotencyService creates a new idempotency service
func NewIdempotencyService(db *gorm.DB, logger *logrus.Logger, ttlHours int) *IdempotencyService {
	return &IdempotencyService{
		db:     db,
		logger: logger,
		ttl:    time.Duration(ttlHours) * time.Hour,
	}
}

// IdempotencyResult represents the result of an idempotency check
type IdempotencyResult struct {
	Found        bool
	ResponseData []byte
	StatusCode   int
}

// CheckIdempotency checks if an idempotency key exists and is valid
func (s *IdempotencyService) CheckIdempotency(ctx context.Context, key string, requestBody []byte) (*IdempotencyResult, error) {
	log := s.logger.WithFields(logrus.Fields{
		"idempotency_key": key,
		"request_hash":    s.generateRequestHash(requestBody),
	})

	// Clean up expired keys first
	if err := s.cleanupExpiredKeys(ctx); err != nil {
		log.WithError(err).Warn("Failed to cleanup expired idempotency keys")
	}

	var idempotencyKey models.IdempotencyKey
	err := s.db.WithContext(ctx).
		Where("key = ? AND expires_at > ?", key, time.Now()).
		First(&idempotencyKey).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Debug("Idempotency key not found or expired")
			return &IdempotencyResult{Found: false}, nil
		}
		log.WithError(err).Error("Failed to check idempotency key")
		return nil, fmt.Errorf("failed to check idempotency key: %w", err)
	}

	// Verify request hash matches
	requestHash := s.generateRequestHash(requestBody)
	if idempotencyKey.RequestHash != requestHash {
		log.WithFields(logrus.Fields{
			"stored_hash":  idempotencyKey.RequestHash,
			"request_hash": requestHash,
		}).Error("Idempotency key found but request hash mismatch")
		return nil, fmt.Errorf("idempotency key exists but request body differs")
	}

	log.WithField("status_code", idempotencyKey.StatusCode).Info("Idempotency key found, returning cached response")
	return &IdempotencyResult{
		Found:        true,
		ResponseData: idempotencyKey.ResponseData,
		StatusCode:   idempotencyKey.StatusCode,
	}, nil
}

// StoreIdempotencyResult stores the result of an operation with an idempotency key
func (s *IdempotencyService) StoreIdempotencyResult(ctx context.Context, key string, requestBody []byte, responseData []byte, statusCode int) error {
	log := s.logger.WithFields(logrus.Fields{
		"idempotency_key": key,
		"status_code":     statusCode,
		"response_size":   len(responseData),
	})

	requestHash := s.generateRequestHash(requestBody)
	expiresAt := time.Now().Add(s.ttl)

	idempotencyKey := &models.IdempotencyKey{
		ID:           uuid.New(),
		Key:          key,
		RequestHash:  requestHash,
		ResponseData: responseData,
		StatusCode:   statusCode,
		ExpiresAt:    expiresAt,
		CreatedAt:    time.Now(),
	}

	err := s.db.WithContext(ctx).Create(idempotencyKey).Error
	if err != nil {
		log.WithError(err).Error("Failed to store idempotency result")
		return fmt.Errorf("failed to store idempotency result: %w", err)
	}

	log.WithField("expires_at", expiresAt).Info("Idempotency result stored successfully")
	return nil
}

// generateRequestHash generates a SHA256 hash of the request body
func (s *IdempotencyService) generateRequestHash(requestBody []byte) string {
	hash := sha256.Sum256(requestBody)
	return hex.EncodeToString(hash[:])
}

// cleanupExpiredKeys removes expired idempotency keys
func (s *IdempotencyService) cleanupExpiredKeys(ctx context.Context) error {
	result := s.db.WithContext(ctx).
		Where("expires_at < ?", time.Now()).
		Delete(&models.IdempotencyKey{})

	if result.Error != nil {
		return fmt.Errorf("failed to cleanup expired keys: %w", result.Error)
	}

	if result.RowsAffected > 0 {
		s.logger.WithField("cleaned_count", result.RowsAffected).Info("Cleaned up expired idempotency keys")
	}

	return nil
}

// StartCleanupTask starts a background task to periodically clean up expired keys
func (s *IdempotencyService) StartCleanupTask(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour) // Run cleanup every hour
	defer ticker.Stop()

	s.logger.Info("Starting idempotency key cleanup task")

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("Stopping idempotency key cleanup task")
			return
		case <-ticker.C:
			if err := s.cleanupExpiredKeys(ctx); err != nil {
				s.logger.WithError(err).Error("Failed to cleanup expired idempotency keys")
			}
		}
	}
}

// ResponseCacheEntry represents a cached response for idempotency
type ResponseCacheEntry struct {
	StatusCode int         `json:"status_code"`
	Data       interface{} `json:"data"`
	Error      *string     `json:"error,omitempty"`
}

// MarshalResponse marshals a response for caching
func (s *IdempotencyService) MarshalResponse(statusCode int, data interface{}, err error) ([]byte, error) {
	entry := ResponseCacheEntry{
		StatusCode: statusCode,
		Data:       data,
	}

	if err != nil {
		errStr := err.Error()
		entry.Error = &errStr
	}

	return json.Marshal(entry)
}

// UnmarshalResponse unmarshals a cached response
func (s *IdempotencyService) UnmarshalResponse(responseData []byte) (*ResponseCacheEntry, error) {
	var entry ResponseCacheEntry
	err := json.Unmarshal(responseData, &entry)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached response: %w", err)
	}

	return &entry, nil
}