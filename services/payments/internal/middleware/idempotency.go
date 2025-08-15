package middleware

import (
	"bytes"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/suuupra/payments/internal/services"
)

const IdempotencyKeyHeader = "Idempotency-Key"

// Idempotency middleware handles idempotency for unsafe HTTP methods
func Idempotency(idempotencyService *services.IdempotencyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only apply idempotency to unsafe methods
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		// Get idempotency key from header
		idempotencyKey := c.GetHeader(IdempotencyKeyHeader)
		if idempotencyKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Idempotency-Key header is required for this operation",
				"code":  "MISSING_IDEMPOTENCY_KEY",
			})
			c.Abort()
			return
		}

		// Read request body
		requestBody, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Failed to read request body",
				"code":  "INVALID_REQUEST_BODY",
			})
			c.Abort()
			return
		}

		// Restore request body for downstream handlers
		c.Request.Body = io.NopCloser(bytes.NewReader(requestBody))

		// Check idempotency
		result, err := idempotencyService.CheckIdempotency(c.Request.Context(), idempotencyKey, requestBody)
		if err != nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "Idempotency key conflict: " + err.Error(),
				"code":  "IDEMPOTENCY_CONFLICT",
			})
			c.Abort()
			return
		}

		// If cached response exists, return it
		if result.Found {
			cachedResponse, err := idempotencyService.UnmarshalResponse(result.ResponseData)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Failed to parse cached response",
					"code":  "CACHE_ERROR",
				})
				c.Abort()
				return
			}

			c.Header("X-Idempotent-Replay", "true")
			
			if cachedResponse.Error != nil {
				c.JSON(cachedResponse.StatusCode, gin.H{
					"error": *cachedResponse.Error,
					"code":  "CACHED_ERROR",
				})
			} else {
				c.JSON(cachedResponse.StatusCode, cachedResponse.Data)
			}
			c.Abort()
			return
		}

		// Store idempotency key and request body for later use
		c.Set("idempotency_key", idempotencyKey)
		c.Set("request_body", requestBody)
		c.Set("idempotency_service", idempotencyService)

		// Create a custom response writer to capture the response
		customWriter := &responseWriter{
			ResponseWriter: c.Writer,
			body:          &bytes.Buffer{},
		}
		c.Writer = customWriter

		// Continue to next handler
		c.Next()

		// After the handler completes, store the response for idempotency
		statusCode := customWriter.Status()
		responseBody := customWriter.body.Bytes()

		// Only cache successful responses or known error responses
		if statusCode < 500 {
			err := idempotencyService.StoreIdempotencyResult(
				c.Request.Context(),
				idempotencyKey,
				requestBody,
				responseBody,
				statusCode,
			)
			if err != nil {
				// Log error but don't fail the request
				// The response has already been sent to the client
				c.Header("X-Idempotency-Store-Error", "true")
			}
		}
	}
}

// responseWriter captures the response for idempotency caching
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseWriter) Write(data []byte) (int, error) {
	// Write to both the actual response and our buffer
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func (w *responseWriter) WriteString(s string) (int, error) {
	// Write to both the actual response and our buffer
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}