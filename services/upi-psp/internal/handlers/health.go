package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	db          *gorm.DB
	redisClient *redis.Client
	logger      *logrus.Logger
	startTime   time.Time
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *gorm.DB, redisClient *redis.Client, logger *logrus.Logger) *HealthHandler {
	return &HealthHandler{
		db:          db,
		redisClient: redisClient,
		logger:      logger,
		startTime:   time.Now(),
	}
}

// Health performs basic health check
func (h *HealthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "upi-psp-service",
		"timestamp": time.Now().UTC(),
		"uptime":    time.Since(h.startTime).String(),
	})
}

// Ready performs readiness check with dependencies
func (h *HealthHandler) Ready(c *gin.Context) {
	checks := make(map[string]interface{})
	allHealthy := true

	// Check database connection
	if sqlDB, err := h.db.DB(); err != nil {
		checks["database"] = map[string]interface{}{
			"status": "unhealthy",
			"error":  err.Error(),
		}
		allHealthy = false
	} else if err := sqlDB.Ping(); err != nil {
		checks["database"] = map[string]interface{}{
			"status": "unhealthy",
			"error":  err.Error(),
		}
		allHealthy = false
	} else {
		checks["database"] = map[string]interface{}{
			"status": "healthy",
		}
	}

	// Check Redis connection
	if err := h.redisClient.Ping(c.Request.Context()).Err(); err != nil {
		checks["redis"] = map[string]interface{}{
			"status": "unhealthy",
			"error":  err.Error(),
		}
		allHealthy = false
	} else {
		checks["redis"] = map[string]interface{}{
			"status": "healthy",
		}
	}

	status := http.StatusOK
	if !allHealthy {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"status":    map[string]string{"healthy": "ready", "unhealthy": "not ready"}[map[bool]string{true: "healthy", false: "unhealthy"}[allHealthy]],
		"service":   "upi-psp-service",
		"timestamp": time.Now().UTC(),
		"checks":    checks,
	})
}

// Metrics returns basic service metrics
func (h *HealthHandler) Metrics(c *gin.Context) {
	// Basic metrics - in production, integrate with Prometheus
	metrics := gin.H{
		"service":   "upi-psp-service",
		"timestamp": time.Now().UTC(),
		"uptime":    time.Since(h.startTime).String(),
		"version":   "1.0.0",
		"build":     "dev",
		"metrics": gin.H{
			"requests_total":     0, // Would be tracked by middleware
			"requests_per_sec":   0,
			"response_time_avg":  0,
			"error_rate":         0,
			"active_connections": 0,
		},
		"system": gin.H{
			"memory_usage": 0,
			"cpu_usage":    0,
			"goroutines":   0,
			"gc_runs":      0,
		},
		"database": gin.H{
			"connections_active": 0,
			"connections_idle":   0,
			"queries_total":      0,
			"query_time_avg":     0,
		},
		"redis": gin.H{
			"connections_active": 0,
			"commands_total":     0,
			"memory_usage":       0,
		},
	}

	c.JSON(http.StatusOK, metrics)
}

// Live performs liveness check (simpler than readiness)
func (h *HealthHandler) Live(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "alive",
		"service":   "upi-psp-service",
		"timestamp": time.Now().UTC(),
	})
}
