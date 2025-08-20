package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
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
			"status":     param.StatusCode,
			"method":     param.Method,
			"path":       param.Path,
			"ip":         param.ClientIP,
			"latency":    param.Latency,
			"user_agent": param.Request.UserAgent(),
			"request_id": param.Request.Header.Get(RequestIDHeader),
			"user_id":    param.Request.Header.Get(UserIDHeader),
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

// JWTClaims represents the JWT claims structure from Identity Service
type JWTClaims struct {
	jwt.RegisteredClaims
	Sub        string   `json:"sub"`
	Email      string   `json:"email"`
	Roles      []string `json:"roles"`
	SessionID  string   `json:"sid"`
	MFALevel   int      `json:"mfa_level"`
	AuthMethod []string `json:"amr"`
}

// validateJWTWithIdentityService validates JWT token and fetches user data from Identity Service
func validateJWTWithIdentityService(tokenString, jwtSecret string) (*JWTClaims, error) {
	// Parse and validate JWT
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("token is not valid")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Additional validation with Identity Service to ensure token is still valid
	identityServiceURL := "http://localhost:8081"
	client := &http.Client{Timeout: 5 * time.Second}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/v1/users/%s/validate", identityServiceURL, claims.Sub), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create validation request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		// If Identity Service is down, allow JWT validation to proceed
		// This provides graceful degradation
		return claims, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("identity service validation failed: %d", resp.StatusCode)
	}

	return claims, nil
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

		// Validate JWT token with Identity Service
		claims, err := validateJWTWithIdentityService(token, jwtSecret)
		if err != nil {
			c.JSON(401, gin.H{
				"error":   "Invalid or expired token",
				"code":    "INVALID_TOKEN",
				"details": err.Error(),
			})
			c.Abort()
			return
		}

		// Set user context from validated JWT claims
		c.Set("user_id", claims.Sub)
		c.Set("user_email", claims.Email)
		c.Set("user_roles", claims.Roles)
		c.Set("session_id", claims.SessionID)
		c.Set("mfa_level", claims.MFALevel)

		// For backward compatibility, set merchant_id to user_id for now
		// This can be refined based on actual business logic
		c.Set("merchant_id", claims.Sub)

		c.Next()
	}
}

// RateLimit middleware with Redis-based sliding window rate limiting
func RateLimit() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		// Get client identifier (IP address or merchant ID)
		clientID := c.ClientIP()
		if merchantID := c.GetString("merchant_id"); merchantID != "" {
			clientID = merchantID
		}

		// Rate limiting configuration
		rateLimit := 1000 // requests per hour
		windowSize := time.Hour

		// Redis key for rate limiting
		redisKey := fmt.Sprintf("rate_limit:payments:%s", clientID)

		// Initialize Redis client
		rdb := redis.NewClient(&redis.Options{
			Addr:     os.Getenv("REDIS_HOST") + ":" + os.Getenv("REDIS_PORT"),
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       1, // Use database 1 for rate limiting
		})
		defer rdb.Close()

		ctx := context.Background()
		now := time.Now().Unix()

		// Sliding window rate limiting using Redis sorted sets
		pipe := rdb.Pipeline()

		// Remove expired entries
		pipe.ZRemRangeByScore(ctx, redisKey, "0", fmt.Sprintf("%d", now-int64(windowSize.Seconds())))

		// Count current requests in window
		pipe.ZCard(ctx, redisKey)

		// Add current request
		pipe.ZAdd(ctx, redisKey, redis.Z{Score: float64(now), Member: uuid.New().String()})

		// Set expiry on the key
		pipe.Expire(ctx, redisKey, windowSize+time.Minute)

		results, err := pipe.Exec(ctx)
		if err != nil {
			// If Redis is unavailable, log and continue with basic headers
			logrus.WithError(err).Warn("Redis unavailable for rate limiting, allowing request")
			c.Header("X-RateLimit-Limit", strconv.Itoa(rateLimit))
			c.Header("X-RateLimit-Remaining", strconv.Itoa(rateLimit-1))
			c.Header("X-RateLimit-Reset", strconv.FormatInt(now+int64(windowSize.Seconds()), 10))
			c.Next()
			return
		}

		// Get current count from pipeline results
		currentCount := results[1].(*redis.IntCmd).Val()

		// Check if rate limit exceeded
		if currentCount > int64(rateLimit) {
			retryAfter := int64(windowSize.Seconds()) - (now % int64(windowSize.Seconds()))
			c.Header("X-RateLimit-Limit", strconv.Itoa(rateLimit))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", strconv.FormatInt(now+retryAfter, 10))
			c.Header("Retry-After", strconv.FormatInt(retryAfter, 10))

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"retry_after": retryAfter,
			})
			c.Abort()
			return
		}

		// Set rate limit headers
		remaining := rateLimit - int(currentCount)
		if remaining < 0 {
			remaining = 0
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(rateLimit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(now+int64(windowSize.Seconds()), 10))

		c.Next()
	})
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
