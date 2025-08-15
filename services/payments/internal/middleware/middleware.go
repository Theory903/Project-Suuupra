package middleware

import (
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/suuupra/payments/pkg/metrics"
)

const (
	RequestIDHeader = "X-Request-ID"
	UserIDHeader    = "X-User-ID"
)

// Logger middleware for structured logging
func Logger(logger *logrus.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logger.WithFields(logrus.Fields{
			"status":      param.StatusCode,
			"method":      param.Method,
			"path":        param.Path,
			"ip":          param.ClientIP,
			"latency":     param.Latency,
			"user_agent":  param.Request.UserAgent(),
			"request_id":  param.Request.Header.Get(RequestIDHeader),
			"user_id":     param.Request.Header.Get(UserIDHeader),
		}).Info("HTTP Request")
		return ""
	})
}

// CORS middleware
func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"*"} // Configure appropriately for production
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	config.AllowHeaders = []string{
		"Origin",
		"Content-Length",
		"Content-Type",
		"Authorization",
		"X-Requested-With",
		"Accept",
		"Accept-Encoding",
		"Accept-Language",
		RequestIDHeader,
		IdempotencyKeyHeader,
	}
	config.ExposeHeaders = []string{
		RequestIDHeader,
		"X-Idempotent-Replay",
	}
	return cors.New(config)
}

// RequestID middleware generates or extracts request ID
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(RequestIDHeader)
		if requestID == "" {
			requestID = uuid.New().String()
		}
		
		c.Header(RequestIDHeader, requestID)
		c.Set("request_id", requestID)
		
		// Add to span if tracing is enabled
		if span := trace.SpanFromContext(c.Request.Context()); span.IsRecording() {
			span.SetAttributes(attribute.String("request.id", requestID))
		}
		
		c.Next()
	}
}

// Metrics middleware for Prometheus metrics
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		
		c.Next()
		
		duration := time.Since(start).Seconds()
		
		// Record metrics
		metrics.HTTPRequestsTotal.WithLabelValues(
			c.Request.Method,
			c.FullPath(),
			strconv.Itoa(c.Writer.Status()),
		).Inc()
		
		metrics.HTTPRequestDuration.WithLabelValues(
			c.Request.Method,
			c.FullPath(),
		).Observe(duration)
	}
}

// Tracing middleware using OpenTelemetry
func Tracing() gin.HandlerFunc {
	return otelgin.Middleware("payments-service")
}

// Authentication middleware (JWT validation)
func Authentication(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for health check endpoints
		if c.FullPath() == "/health" || c.FullPath() == "/ready" || c.FullPath() == "/metrics" {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{
				"error": "Authorization header required",
				"code":  "MISSING_AUTHORIZATION",
			})
			c.Abort()
			return
		}

		// TODO: Implement proper JWT validation
		// For now, we'll accept any Bearer token for development
		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			c.JSON(401, gin.H{
				"error": "Invalid authorization header format",
				"code":  "INVALID_AUTHORIZATION_FORMAT",
			})
			c.Abort()
			return
		}

		token := authHeader[7:]
		if token == "" {
			c.JSON(401, gin.H{
				"error": "Empty authorization token",
				"code":  "EMPTY_TOKEN",
			})
			c.Abort()
			return
		}

		// TODO: Validate JWT token with jwtSecret
		// Extract user/merchant information from token
		// For development, we'll set mock values
		c.Set("user_id", "mock-user-id")
		c.Set("merchant_id", "mock-merchant-id")
		
		c.Next()
	}
}

// RateLimit middleware (basic implementation)
func RateLimit() gin.HandlerFunc {
	// TODO: Implement proper rate limiting with Redis
	return func(c *gin.Context) {
		// For now, just add rate limit headers
		c.Header("X-RateLimit-Limit", "1000")
		c.Header("X-RateLimit-Remaining", "999")
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Hour).Unix(), 10))
		c.Next()
	}
}

// SecurityHeaders middleware adds security headers
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Next()
	}
}