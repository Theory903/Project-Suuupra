package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Logger middleware logs HTTP requests
func Logger(logger *logrus.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Log request details
		logger.WithFields(logrus.Fields{
			"timestamp":  param.TimeStamp.Format(time.RFC3339),
			"status":     param.StatusCode,
			"latency":    param.Latency,
			"client_ip":  param.ClientIP,
			"method":     param.Method,
			"path":       param.Path,
			"user_agent": param.Request.UserAgent(),
			"error":      param.ErrorMessage,
		}).Info("HTTP Request")

		return ""
	})
}

// Recovery middleware recovers from panics and logs them
func Recovery(logger *logrus.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		logger.WithFields(logrus.Fields{
			"panic":     recovered,
			"path":      c.Request.URL.Path,
			"method":    c.Request.Method,
			"client_ip": c.ClientIP(),
		}).Error("Panic recovered")

		c.JSON(500, gin.H{
			"error":   "internal_server_error",
			"message": "Internal server error",
		})
	})
}
