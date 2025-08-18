// Counters Service - High-performance distributed counters
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/suuupra/counters/internal/api"
	"github.com/suuupra/counters/internal/config"
	"github.com/suuupra/counters/internal/counter"
	"github.com/suuupra/counters/internal/database"
	"github.com/suuupra/counters/pkg/logger"
	"github.com/suuupra/counters/pkg/metrics"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := logger.New(cfg.LogLevel)
	logger.Info("Starting Counters Service", "version", "1.0.0", "environment", cfg.Environment)

	// Initialize metrics
	metrics.Init()

	// Initialize Redis cluster
	rdb := redis.NewClusterClient(&redis.ClusterOptions{
		Addrs:    cfg.RedisClusterAddrs,
		Password: cfg.RedisPassword,
	})
	defer rdb.Close()

	// Test Redis connection
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Error("Failed to connect to Redis cluster", "error", err)
		os.Exit(1)
	}
	logger.Info("Connected to Redis cluster")

	// Initialize database for persistence
	db, err := database.New(cfg.DatabaseURL, logger)
	if err != nil {
		logger.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Initialize counter service
	counterService := counter.New(cfg, rdb, db, logger)

	// Start background services
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start persistence worker
	go counterService.StartPersistenceWorker(ctx)

	// Start aggregation worker
	go counterService.StartAggregationWorker(ctx)

	// Initialize HTTP server
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())

	// Setup API routes
	apiHandler := api.NewHandler(cfg, counterService, logger)
	apiHandler.SetupRoutes(router)

	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("Starting HTTP server", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Failed to start server", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Cancel background services
	cancel()

	// Shutdown HTTP server
	ctx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited")
}
