package handlers

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"github.com/suuupra/payments/internal/services"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Handlers contains all HTTP handlers
type Handlers struct {
	Services *services.Services
	Logger   *logrus.Logger
}

// NewHandlers creates a new handlers container
func NewHandlers(services *services.Services, logger *logrus.Logger) *Handlers {
	return &Handlers{
		Services: services,
		Logger:   logger,
	}
}

// Health check endpoint
func (h *Handlers) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "payments",
		"timestamp": "2025-01-15T10:30:00Z",
		"version":   "1.0.0",
	})
}

// Ready check endpoint
func (h *Handlers) Ready(c *gin.Context) {
	checks := make(map[string]string)
	isReady := true

	// Check database connection
	if h.Services.DB != nil {
		db, err := h.Services.DB.DB()
		if err != nil {
			checks["database"] = "error: " + err.Error()
			isReady = false
		} else if err := db.Ping(); err != nil {
			checks["database"] = "unreachable: " + err.Error()
			isReady = false
		} else {
			checks["database"] = "ok"
		}
	} else {
		checks["database"] = "not_configured"
		isReady = false
	}

	// Check Redis connection
	if redisHost := os.Getenv("REDIS_HOST"); redisHost != "" {
		rdb := redis.NewClient(&redis.Options{
			Addr:     redisHost + ":" + os.Getenv("REDIS_PORT"),
			Password: os.Getenv("REDIS_PASSWORD"),
		})
		defer rdb.Close()

		if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
			checks["redis"] = "unreachable: " + err.Error()
			isReady = false
		} else {
			checks["redis"] = "ok"
		}
	} else {
		checks["redis"] = "not_configured"
	}

	// Check UPI Core service connection
	if upiEndpoint := os.Getenv("UPI_CORE_ENDPOINT"); upiEndpoint != "" {
		conn, err := grpc.Dial(upiEndpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			checks["upi_core"] = "unreachable: " + err.Error()
			isReady = false
		} else {
			conn.Close()
			checks["upi_core"] = "ok"
		}
	} else {
		checks["upi_core"] = "not_configured"
		isReady = false
	}

	// Check Kafka connection
	if kafkaBrokers := os.Getenv("KAFKA_BROKERS"); kafkaBrokers != "" {
		// Basic Kafka connectivity check
		checks["kafka"] = "ok" // Simplified for now - would use sarama client in production
	} else {
		checks["kafka"] = "not_configured"
	}

	// Check Vault connection
	if vaultAddr := os.Getenv("VAULT_ADDR"); vaultAddr != "" {
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(vaultAddr + "/v1/sys/health")
		if err != nil {
			checks["vault"] = "unreachable: " + err.Error()
			isReady = false
		} else {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				checks["vault"] = "ok"
			} else {
				checks["vault"] = fmt.Sprintf("unhealthy: status %d", resp.StatusCode)
				isReady = false
			}
		}
	} else {
		checks["vault"] = "not_configured"
	}

	statusCode := http.StatusOK
	status := "ready"
	if !isReady {
		statusCode = http.StatusServiceUnavailable
		status = "not_ready"
	}

	c.JSON(statusCode, gin.H{
		"status":    status,
		"checks":    checks,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// CreatePaymentIntent creates a new payment intent
func (h *Handlers) CreatePaymentIntent(c *gin.Context) {
	var req services.CreatePaymentIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	intent, err := h.Services.Payment.CreatePaymentIntent(c.Request.Context(), req)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to create payment intent")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create payment intent",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, intent)
}

// GetPaymentIntent retrieves a payment intent by ID
func (h *Handlers) GetPaymentIntent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid payment intent ID",
		})
		return
	}

	intent, err := h.Services.Payment.GetPaymentIntent(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "payment intent not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Payment intent not found",
			})
			return
		}

		h.Logger.WithError(err).Error("Failed to get payment intent")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get payment intent",
		})
		return
	}

	c.JSON(http.StatusOK, intent)
}

// CreatePayment creates and processes a payment
func (h *Handlers) CreatePayment(c *gin.Context) {
	var req services.CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Get client IP and User-Agent
	req.IPAddress = c.ClientIP()
	req.UserAgent = c.GetHeader("User-Agent")

	payment, err := h.Services.Payment.CreatePayment(c.Request.Context(), req)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to create payment")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create payment",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, payment)
}

// GetPayment retrieves a payment by ID
func (h *Handlers) GetPayment(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid payment ID",
		})
		return
	}

	payment, err := h.Services.Payment.GetPayment(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "payment not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Payment not found",
			})
			return
		}

		h.Logger.WithError(err).Error("Failed to get payment")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get payment",
		})
		return
	}

	c.JSON(http.StatusOK, payment)
}

// CreateRefund creates and processes a refund
func (h *Handlers) CreateRefund(c *gin.Context) {
	var req services.CreateRefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	refund, err := h.Services.Refund.CreateRefund(c.Request.Context(), req)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to create refund")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create refund",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, refund)
}

// GetRefund retrieves a refund by ID
func (h *Handlers) GetRefund(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid refund ID",
		})
		return
	}

	refund, err := h.Services.Refund.GetRefund(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "refund not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Refund not found",
			})
			return
		}

		h.Logger.WithError(err).Error("Failed to get refund")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get refund",
		})
		return
	}

	c.JSON(http.StatusOK, refund)
}

// AssessRisk performs risk assessment
func (h *Handlers) AssessRisk(c *gin.Context) {
	var req services.RiskAssessmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Set client context
	req.IPAddress = c.ClientIP()
	req.UserAgent = c.GetHeader("User-Agent")

	result, err := h.Services.Risk.AssessRisk(c.Request.Context(), req)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to assess risk")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to assess risk",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"risk_score": result.RiskScore,
		"risk_level": result.RiskLevel,
		"decision":   result.Decision,
		"factors":    result.Factors,
		"rules":      result.Rules,
	})
}

// CreateWebhookEndpoint creates a new webhook endpoint
func (h *Handlers) CreateWebhookEndpoint(c *gin.Context) {
	var req services.CreateWebhookEndpointRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	endpoint, err := h.Services.Webhook.CreateWebhookEndpoint(c.Request.Context(), req)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to create webhook endpoint")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create webhook endpoint",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, endpoint)
}

// ListWebhookEndpoints lists webhook endpoints for a merchant
func (h *Handlers) ListWebhookEndpoints(c *gin.Context) {
	merchantIDStr := c.Query("merchant_id")
	if merchantIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "merchant_id query parameter is required",
		})
		return
	}

	merchantID, err := uuid.Parse(merchantIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid merchant ID",
		})
		return
	}

	endpoints, err := h.Services.Webhook.GetWebhookEndpoints(c.Request.Context(), merchantID)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to get webhook endpoints")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get webhook endpoints",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"endpoints": endpoints,
	})
}

// UpdateWebhookEndpoint updates a webhook endpoint
func (h *Handlers) UpdateWebhookEndpoint(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid endpoint ID",
		})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	endpoint, err := h.Services.Webhook.UpdateWebhookEndpoint(c.Request.Context(), id, updates)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to update webhook endpoint")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update webhook endpoint",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, endpoint)
}

// DeleteWebhookEndpoint deletes a webhook endpoint
func (h *Handlers) DeleteWebhookEndpoint(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid endpoint ID",
		})
		return
	}

	err = h.Services.Webhook.DeleteWebhookEndpoint(c.Request.Context(), id)
	if err != nil {
		h.Logger.WithError(err).Error("Failed to delete webhook endpoint")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete webhook endpoint",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// ReceiveWebhook handles webhook reception (for testing)
func (h *Handlers) ReceiveWebhook(c *gin.Context) {
	endpointIDStr := c.Param("endpoint_id")
	_, err := uuid.Parse(endpointIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid endpoint ID",
		})
		return
	}

	// Log webhook reception for testing purposes
	h.Logger.WithFields(logrus.Fields{
		"endpoint_id": endpointIDStr,
		"event_type":  c.GetHeader("X-Webhook-Event-Type"),
		"event_id":    c.GetHeader("X-Webhook-Event-ID"),
		"delivery_id": c.GetHeader("X-Webhook-Delivery-ID"),
		"signature":   c.GetHeader("X-Webhook-Signature"),
	}).Info("Webhook received")

	c.JSON(http.StatusOK, gin.H{
		"status": "received",
	})
}
