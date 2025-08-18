package middleware

import (
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/gin-gonic/gin"
)

func LoggingMiddleware(logger *slog.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Create structured log entry
		logger.Info("HTTP Request",
			slog.String("method", param.Method),
			slog.String("path", param.Path),
			slog.String("query", param.Request.URL.RawQuery),
			slog.Int("status", param.StatusCode),
			slog.Duration("latency", param.Latency),
			slog.String("client_ip", param.ClientIP),
			slog.String("user_agent", param.Request.UserAgent()),
			slog.String("referer", param.Request.Referer()),
			slog.Int("body_size", param.BodySize),
			slog.String("request_id", param.Request.Header.Get("X-Request-ID")),
		)

		// Return empty string since we're using structured logging
		return ""
	})
}

func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}

		c.Header("X-Request-ID", requestID)
		c.Set("request_id", requestID)

		c.Next()
	}
}

func generateRequestID() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), rand.Int63())
}

// ErrorLoggingMiddleware logs errors with context
func ErrorLoggingMiddleware(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Log errors if any occurred
		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				logger.Error("Request error",
					slog.String("error", err.Error()),
					slog.String("type", err.Type.String()),
					slog.String("method", c.Request.Method),
					slog.String("path", c.Request.URL.Path),
					slog.String("client_ip", c.ClientIP()),
					slog.String("request_id", c.GetString("request_id")),
					slog.Any("user_id", c.Get("user_id")),
				)
			}
		}
	}
}
