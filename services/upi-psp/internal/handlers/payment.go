package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"github.com/suuupra/upi-psp/internal/middleware"
	"github.com/suuupra/upi-psp/internal/services"
)

// PaymentHandler handles payment endpoints
type PaymentHandler struct {
	paymentService *services.PaymentService
	authService    *services.AuthService
	logger         *logrus.Logger
}

// NewPaymentHandler creates a new payment handler
func NewPaymentHandler(
	paymentService *services.PaymentService,
	authService *services.AuthService,
	logger *logrus.Logger,
) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
		authService:    authService,
		logger:         logger,
	}
}

// SendMoney handles send money requests
func (h *PaymentHandler) SendMoney(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	var req services.SendMoneyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// Set client IP and device ID
	req.IPAddress = c.ClientIP()
	if deviceID, exists := middleware.GetDeviceID(c); exists {
		req.DeviceID = deviceID
	}

	response, err := h.paymentService.SendMoney(userID, req)
	if err != nil {
		h.logger.WithError(err).Error("Send money failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "payment_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transaction_id": response.TransactionID,
		"status":         response.Status,
		"message":        response.Message,
		"rrn":            response.RRN,
		"processed_at":   response.ProcessedAt,
	})
}

// RequestMoney handles request money requests
func (h *PaymentHandler) RequestMoney(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	var req services.RequestMoneyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	paymentRequest, err := h.paymentService.RequestMoney(userID, req)
	if err != nil {
		h.logger.WithError(err).Error("Request money failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "request_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"request_id": paymentRequest.RequestID,
		"status":     paymentRequest.Status,
		"expires_at": paymentRequest.ExpiresAt,
		"message":    "Payment request created successfully",
	})
}

// GetHistory gets transaction history
func (h *PaymentHandler) GetHistory(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 50
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	transactions, err := h.paymentService.GetTransactionHistory(userID, limit, offset)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get transaction history")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "fetch_failed",
			"message": "Failed to fetch transaction history",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transactions": transactions,
		"limit":        limit,
		"offset":       offset,
		"count":        len(transactions),
	})
}

// GetPayment gets a specific payment
func (h *PaymentHandler) GetPayment(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": "Payment ID is required",
		})
		return
	}

	transaction, err := h.paymentService.GetTransaction(userID, paymentID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get transaction")
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "transaction_not_found",
			"message": "Transaction not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transaction": transaction,
	})
}

// CancelPayment cancels a pending payment
func (h *PaymentHandler) CancelPayment(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": "Payment ID is required",
		})
		return
	}

	err := h.paymentService.CancelTransaction(userID, paymentID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to cancel transaction")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "cancel_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Transaction cancelled successfully",
	})
}

// GetPaymentStatus gets payment status
func (h *PaymentHandler) GetPaymentStatus(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": "Payment ID is required",
		})
		return
	}

	transaction, err := h.paymentService.GetTransactionStatus(userID, paymentID)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get transaction status")
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "transaction_not_found",
			"message": "Transaction not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transaction_id": transaction.TransactionID,
		"status":         transaction.Status,
		"rrn":            transaction.RRN,
		"amount":         transaction.Amount,
		"processed_at":   transaction.ProcessedAt,
		"completed_at":   transaction.CompletedAt,
		"error_code":     transaction.ErrorCode,
		"error_message":  transaction.ErrorMessage,
	})
}
