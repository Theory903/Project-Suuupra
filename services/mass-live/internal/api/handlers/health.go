package handlers

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

type HealthHandler struct {
	db          *gorm.DB
	redisClient *redis.Client
}

func NewHealthHandler(db *gorm.DB, redisClient *redis.Client) *HealthHandler {
	return &HealthHandler{
		db:          db,
		redisClient: redisClient,
	}
}

type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Version   string            `json:"version"`
	Uptime    string            `json:"uptime"`
	Checks    map[string]string `json:"checks"`
}

func (h *HealthHandler) Health(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	checks := make(map[string]string)
	overallStatus := "healthy"

	// Check database
	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err != nil {
			checks["database"] = "error: " + err.Error()
			overallStatus = "unhealthy"
		} else {
			err = sqlDB.PingContext(ctx)
			if err != nil {
				checks["database"] = "error: " + err.Error()
				overallStatus = "unhealthy"
			} else {
				checks["database"] = "healthy"
			}
		}
	} else {
		checks["database"] = "not configured"
	}

	// Check Redis
	if h.redisClient != nil {
		err := h.redisClient.Ping(ctx).Err()
		if err != nil {
			checks["redis"] = "error: " + err.Error()
			overallStatus = "unhealthy"
		} else {
			checks["redis"] = "healthy"
		}
	} else {
		checks["redis"] = "not configured"
	}

	response := HealthResponse{
		Status:    overallStatus,
		Timestamp: time.Now(),
		Version:   getBuildVersion(), // Get from build info
		Uptime:    time.Since(ServiceStartTime).String(),
		Checks:    checks,
	}

	statusCode := http.StatusOK
	if overallStatus == "unhealthy" {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

func (h *HealthHandler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	// Quick readiness checks
	ready := true
	checks := make(map[string]string)

	// Check database connectivity
	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err != nil || sqlDB.PingContext(ctx) != nil {
			ready = false
			checks["database"] = "not ready"
		} else {
			checks["database"] = "ready"
		}
	}

	// Check Redis connectivity
	if h.redisClient != nil {
		if h.redisClient.Ping(ctx).Err() != nil {
			ready = false
			checks["redis"] = "not ready"
		} else {
			checks["redis"] = "ready"
		}
	}

	response := map[string]interface{}{
		"ready":     ready,
		"timestamp": time.Now(),
		"checks":    checks,
	}

	statusCode := http.StatusOK
	if !ready {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

func (h *HealthHandler) Live(c *gin.Context) {
	c.JSON(http.StatusOK, map[string]interface{}{
		"alive":     true,
		"timestamp": time.Now(),
	})
}

// getBuildVersion retrieves version from environment or build info
func getBuildVersion() string {
	// Try to get version from environment variable first
	if version := os.Getenv("BUILD_VERSION"); version != "" {
		return version
	}

	// Try to get from build tags or git info (would be set at build time)
	if version := os.Getenv("GIT_COMMIT"); version != "" {
		if len(version) >= 8 {
			return version[:8] // Short commit hash
		}
		return version
	}

	// Fallback to default version
	return "1.0.0"
}
