package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/suuupra/upi-psp/internal/middleware"
	"github.com/suuupra/upi-psp/internal/services"
)

// QRHandler handles QR code endpoints
type QRHandler struct {
	qrService *services.QRService
	logger    *logrus.Logger
}

// NewQRHandler creates a new QR handler
func NewQRHandler(qrService *services.QRService, logger *logrus.Logger) *QRHandler {
	return &QRHandler{
		qrService: qrService,
		logger:    logger,
	}
}

// GenerateQR generates a QR code for payment
func (h *QRHandler) GenerateQR(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	var req services.GenerateQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	qrResponse, err := h.qrService.GenerateQR(userID, req)
	if err != nil {
		h.logger.WithError(err).Error("QR generation failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "qr_generation_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"qr_id":       qrResponse.ID,
		"qr_string":   qrResponse.QRString,
		"qr_code":     qrResponse.QRCode,
		"short_url":   qrResponse.ShortURL,
		"vpa":         qrResponse.VPA,
		"amount":      qrResponse.Amount,
		"description": qrResponse.Description,
		"reference":   qrResponse.Reference,
		"type":        qrResponse.Type,
		"expires_at":  qrResponse.ExpiresAt,
		"is_reusable": qrResponse.IsReusable,
		"message":     "QR code generated successfully",
	})
}

// ScanQR scans and validates a QR code
func (h *QRHandler) ScanQR(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	var req services.ScanQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	scanResponse, err := h.qrService.ScanQR(userID, req)
	if err != nil {
		h.logger.WithError(err).Error("QR scan failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "qr_scan_failed",
			"message": err.Error(),
		})
		return
	}

	if !scanResponse.IsValid {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_qr",
			"message": scanResponse.Message,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"vpa":         scanResponse.VPA,
		"amount":      scanResponse.Amount,
		"description": scanResponse.Description,
		"reference":   scanResponse.Reference,
		"payee_name":  scanResponse.PayeeName,
		"is_valid":    scanResponse.IsValid,
		"message":     scanResponse.Message,
	})
}

// GetQRCode gets a QR code by ID
func (h *QRHandler) GetQRCode(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	qrIDStr := c.Param("qrId")
	qrID, err := uuid.Parse(qrIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_qr_id",
			"message": "Invalid QR ID format",
		})
		return
	}

	qrCode, err := h.qrService.GetQRCode(userID, qrID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get QR code")
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "qr_not_found",
			"message": "QR code not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"qr_code": qrCode,
	})
}

// ListQRCodes lists user's QR codes
func (h *QRHandler) ListQRCodes(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	// Parse query parameters
	limit := 20
	offset := 0

	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := uuid.Parse(limitStr); err == nil {
			_ = l // Use parsed limit
		}
	}

	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := uuid.Parse(offsetStr); err == nil {
			_ = o // Use parsed offset
		}
	}

	qrCodes, err := h.qrService.ListUserQRCodes(userID, limit, offset)
	if err != nil {
		h.logger.WithError(err).Error("Failed to list QR codes")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "fetch_failed",
			"message": "Failed to fetch QR codes",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"qr_codes": qrCodes,
		"limit":    limit,
		"offset":   offset,
		"count":    len(qrCodes),
	})
}

// DeactivateQR deactivates a QR code
func (h *QRHandler) DeactivateQR(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	qrIDStr := c.Param("qrId")
	qrID, err := uuid.Parse(qrIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_qr_id",
			"message": "Invalid QR ID format",
		})
		return
	}

	err = h.qrService.DeactivateQR(userID, qrID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to deactivate QR code")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "deactivation_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "QR code deactivated successfully",
	})
}
