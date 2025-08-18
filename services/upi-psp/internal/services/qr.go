package services

import (
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/suuupra/upi-psp/internal/models"
)

// QRService handles QR code operations
type QRService struct {
	logger *logrus.Logger
}

// NewQRService creates a new QR service
func NewQRService(logger *logrus.Logger) *QRService {
	return &QRService{
		logger: logger,
	}
}

// GenerateQRRequest represents a QR code generation request
type GenerateQRRequest struct {
	VPA         string          `json:"vpa" binding:"required"`
	Amount      decimal.Decimal `json:"amount"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`
	Type        models.QRType   `json:"type" binding:"required"`
	ExpiresIn   int             `json:"expires_in"` // Minutes
	IsReusable  bool            `json:"is_reusable"`
	MaxUsage    int             `json:"max_usage"`
}

// ScanQRRequest represents a QR code scan request
type ScanQRRequest struct {
	QRString string `json:"qr_string" binding:"required"`
	DeviceID string `json:"device_id" binding:"required"`
}

// QRResponse represents a QR code response
type QRResponse struct {
	ID          uuid.UUID       `json:"id"`
	QRString    string          `json:"qr_string"`
	QRCode      string          `json:"qr_code"` // Base64 encoded image
	ShortURL    string          `json:"short_url,omitempty"`
	VPA         string          `json:"vpa"`
	Amount      decimal.Decimal `json:"amount"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`
	Type        models.QRType   `json:"type"`
	ExpiresAt   *time.Time      `json:"expires_at,omitempty"`
	IsReusable  bool            `json:"is_reusable"`
}

// ScanQRResponse represents a QR scan response
type ScanQRResponse struct {
	VPA         string          `json:"vpa"`
	Amount      decimal.Decimal `json:"amount"`
	Description string          `json:"description"`
	Reference   string          `json:"reference"`
	PayeeName   string          `json:"payee_name,omitempty"`
	IsValid     bool            `json:"is_valid"`
	Message     string          `json:"message"`
}

// GenerateQR generates a QR code for payment
func (s *QRService) GenerateQR(userID uuid.UUID, req GenerateQRRequest) (*QRResponse, error) {
	s.logger.WithFields(logrus.Fields{
		"user_id": userID,
		"vpa":     req.VPA,
		"amount":  req.Amount,
		"type":    req.Type,
	}).Info("Generating QR code")

	// Create UPI payment string
	upiString := s.createUPIString(req.VPA, req.Amount, req.Description, req.Reference)

	// Generate QR code image (base64 encoded)
	qrCodeImage, err := s.generateQRCodeImage(upiString)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code image: %w", err)
	}

	// Calculate expiry time
	var expiresAt *time.Time
	if req.ExpiresIn > 0 {
		expiry := time.Now().Add(time.Duration(req.ExpiresIn) * time.Minute)
		expiresAt = &expiry
	}

	// Create QR code record
	qrCode := &models.QRCode{
		UserID:      userID,
		QRString:    upiString,
		Code:        qrCodeImage,
		VPA:         req.VPA,
		Amount:      req.Amount,
		Currency:    "INR",
		Description: req.Description,
		Reference:   req.Reference,
		Type:        req.Type,
		IsReusable:  req.IsReusable,
		IsActive:    true,
		ExpiresAt:   expiresAt,
		MaxUsage:    req.MaxUsage,
	}

	// Generate short URL for sharing (simplified)
	shortURL := s.generateShortURL(qrCode.ID)
	qrCode.ShortURL = shortURL

	s.logger.WithField("qr_id", qrCode.ID).Info("QR code generated successfully")

	return &QRResponse{
		ID:          qrCode.ID,
		QRString:    qrCode.QRString,
		QRCode:      qrCode.Code,
		ShortURL:    qrCode.ShortURL,
		VPA:         qrCode.VPA,
		Amount:      qrCode.Amount,
		Description: qrCode.Description,
		Reference:   qrCode.Reference,
		Type:        qrCode.Type,
		ExpiresAt:   qrCode.ExpiresAt,
		IsReusable:  qrCode.IsReusable,
	}, nil
}

// ScanQR scans and validates a QR code
func (s *QRService) ScanQR(userID uuid.UUID, req ScanQRRequest) (*ScanQRResponse, error) {
	s.logger.WithFields(logrus.Fields{
		"user_id":   userID,
		"device_id": req.DeviceID,
	}).Info("Scanning QR code")

	// Parse UPI string
	paymentInfo, err := s.parseUPIString(req.QRString)
	if err != nil {
		return &ScanQRResponse{
			IsValid: false,
			Message: "Invalid QR code format",
		}, nil
	}

	// Validate VPA format
	if !s.isValidVPA(paymentInfo.VPA) {
		return &ScanQRResponse{
			IsValid: false,
			Message: "Invalid VPA in QR code",
		}, nil
	}

	// TODO: Resolve VPA to get payee name (requires UPI service integration)
	payeeName := ""

	response := &ScanQRResponse{
		VPA:         paymentInfo.VPA,
		Amount:      paymentInfo.Amount,
		Description: paymentInfo.Description,
		Reference:   paymentInfo.Reference,
		PayeeName:   payeeName,
		IsValid:     true,
		Message:     "QR code scanned successfully",
	}

	s.logger.WithField("vpa", paymentInfo.VPA).Info("QR code scanned successfully")

	return response, nil
}

// GetQRCode gets a QR code by ID
func (s *QRService) GetQRCode(userID, qrID uuid.UUID) (*models.QRCode, error) {
	// TODO: Implement with QR repository
	// For now, return a placeholder
	return nil, fmt.Errorf("not implemented")
}

// DeactivateQR deactivates a QR code
func (s *QRService) DeactivateQR(userID, qrID uuid.UUID) error {
	// TODO: Implement with QR repository
	s.logger.WithFields(logrus.Fields{
		"user_id": userID,
		"qr_id":   qrID,
	}).Info("QR code deactivated")

	return nil
}

// ListUserQRCodes lists QR codes for a user
func (s *QRService) ListUserQRCodes(userID uuid.UUID, limit, offset int) ([]models.QRCode, error) {
	// TODO: Implement with QR repository
	return []models.QRCode{}, nil
}

// createUPIString creates a UPI payment string
func (s *QRService) createUPIString(vpa string, amount decimal.Decimal, description, reference string) string {
	upiString := fmt.Sprintf("upi://pay?pa=%s", vpa)

	if !amount.IsZero() {
		upiString += fmt.Sprintf("&am=%s", amount.String())
	}

	if description != "" {
		upiString += fmt.Sprintf("&tn=%s", description)
	}

	if reference != "" {
		upiString += fmt.Sprintf("&tr=%s", reference)
	}

	upiString += "&cu=INR"

	return upiString
}

// parseUPIString parses a UPI payment string
func (s *QRService) parseUPIString(upiString string) (*UPIPaymentInfo, error) {
	info := &UPIPaymentInfo{
		Currency: "INR",
	}

	// Simple parsing - in production, use proper URL parsing
	params := s.parseURLParams(upiString)

	if vpa, exists := params["pa"]; exists {
		info.VPA = vpa
	} else {
		return nil, fmt.Errorf("missing VPA parameter")
	}

	if amountStr, exists := params["am"]; exists {
		if amount, err := decimal.NewFromString(amountStr); err == nil {
			info.Amount = amount
		}
	}

	if description, exists := params["tn"]; exists {
		info.Description = description
	}

	if reference, exists := params["tr"]; exists {
		info.Reference = reference
	}

	return info, nil
}

// generateQRCodeImage generates a QR code image (mock implementation)
func (s *QRService) generateQRCodeImage(data string) (string, error) {
	// This is a mock implementation
	// In production, use a QR code generation library like "github.com/skip2/go-qrcode"

	// For now, return a base64 encoded placeholder
	placeholder := fmt.Sprintf("QR_CODE_FOR_%s", data)
	encoded := base64.StdEncoding.EncodeToString([]byte(placeholder))

	return encoded, nil
}

// generateShortURL generates a short URL for QR code sharing
func (s *QRService) generateShortURL(qrID uuid.UUID) string {
	// This is a simplified implementation
	// In production, use a proper URL shortening service
	return fmt.Sprintf("https://pay.suuupra.com/qr/%s", qrID.String()[:8])
}

// parseURLParams parses URL parameters from a string
func (s *QRService) parseURLParams(urlStr string) map[string]string {
	params := make(map[string]string)

	// Find the start of parameters
	queryStart := -1
	for i, char := range urlStr {
		if char == '?' {
			queryStart = i + 1
			break
		}
	}

	if queryStart == -1 {
		return params
	}

	// Parse parameters
	query := urlStr[queryStart:]
	pairs := s.splitString(query, '&')

	for _, pair := range pairs {
		kv := s.splitString(pair, '=')
		if len(kv) == 2 {
			params[kv[0]] = kv[1]
		}
	}

	return params
}

// splitString splits a string by delimiter
func (s *QRService) splitString(str string, delimiter rune) []string {
	var parts []string
	var current string

	for _, char := range str {
		if char == delimiter {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}

	if current != "" {
		parts = append(parts, current)
	}

	return parts
}

// isValidVPA validates VPA format
func (s *QRService) isValidVPA(vpa string) bool {
	if len(vpa) < 3 {
		return false
	}

	// Check for @ symbol
	hasAt := false
	for _, char := range vpa {
		if char == '@' {
			hasAt = true
			break
		}
	}

	return hasAt
}

// UPIPaymentInfo is defined in upi.go
