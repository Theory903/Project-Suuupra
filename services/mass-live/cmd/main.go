package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mass-live/internal/api"
	"mass-live/internal/config"
	"mass-live/internal/database"
	"mass-live/internal/ingestion"
	"mass-live/internal/monitoring"
	"mass-live/internal/redis"
	"mass-live/internal/streaming"
	"mass-live/pkg/logger"
)

// @title Mass Live Streaming API
// @version 1.0
// @description Production-ready mass live streaming service with LL-HLS and multi-CDN
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.suuupra.com/support
// @contact.email support@suuupra.com

// @license.name Proprietary
// @license.url http://www.suuupra.com/license

// @host localhost:8088
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := logger.New(cfg.LogLevel, cfg.Environment)
	logger.Info("🎬 Starting Mass Live Streaming Service...")

	// Initialize database
	db, err := database.New(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("Failed to initialize database", "error", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(); err != nil {
		logger.Fatal("Failed to run migrations", "error", err)
	}
	logger.Info("✅ Database initialized and migrated")

	// Initialize Redis
	redisClient, err := redis.New(cfg.RedisURL)
	if err != nil {
		logger.Fatal("Failed to initialize Redis", "error", err)
	}
	defer redisClient.Close()
	logger.Info("✅ Redis initialized")

	// Initialize monitoring
	monitoring := monitoring.New(cfg)
	monitoring.Start()
	defer monitoring.Stop()
	logger.Info("✅ Monitoring initialized")

	// Initialize streaming engine
	streamingEngine := streaming.New(cfg, db, redisClient, logger)
	if err := streamingEngine.Start(); err != nil {
		logger.Fatal("Failed to start streaming engine", "error", err)
	}
	defer streamingEngine.Stop()
	logger.Info("✅ Streaming engine started")

	// Initialize RTMP ingestion server
	ingestionServer := ingestion.New(cfg, streamingEngine, logger)
	go func() {
		if err := ingestionServer.Start(); err != nil {
			logger.Fatal("Failed to start ingestion server", "error", err)
		}
	}()
	defer ingestionServer.Stop()
	logger.Info("✅ RTMP ingestion server started")

	// Initialize HTTP API server
	apiServer := api.New(cfg, db, redisClient, streamingEngine, logger)
	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      apiServer.Router(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start HTTP server
	go func() {
		logger.Info(fmt.Sprintf("🚀 Mass Live Service running on :%d", cfg.Port))
		logger.Info(fmt.Sprintf("📖 API Documentation: http://localhost:%d/docs", cfg.Port))
		logger.Info(fmt.Sprintf("📊 Metrics: http://localhost:%d/metrics", cfg.Port))
		logger.Info(fmt.Sprintf("📺 RTMP Ingestion: rtmp://localhost:%d/live", cfg.RTMPPort))
		
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start HTTP server", "error", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("🛑 Shutting down Mass Live Service...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("HTTP server forced to shutdown", "error", err)
	}

	logger.Info("✅ Mass Live Service shut down gracefully")
}
