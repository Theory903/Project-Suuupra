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
	"github.com/suuupra/search-crawler/internal/api"
	"github.com/suuupra/search-crawler/internal/config"
	"github.com/suuupra/search-crawler/internal/crawler"
	"github.com/suuupra/search-crawler/internal/database"
	"github.com/suuupra/search-crawler/internal/elasticsearch"
	"github.com/suuupra/search-crawler/internal/queue"
	"github.com/suuupra/search-crawler/internal/scheduler"
	"github.com/suuupra/search-crawler/pkg/logger"
	"github.com/suuupra/search-crawler/pkg/metrics"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := logger.New(cfg.LogLevel)
	logger.Info("Starting Search Crawler Service", "version", "1.0.0", "environment", cfg.Environment)

	// Initialize metrics
	metrics.Init()

	// Initialize database
	db, err := database.New(cfg.DatabaseURL, logger)
	if err != nil {
		logger.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Run database migrations
	if err := db.AutoMigrate(); err != nil {
		logger.Error("Failed to run database migrations", "error", err)
		os.Exit(1)
	}

	// Initialize Elasticsearch
	esClient, err := elasticsearch.New(cfg.ElasticsearchURL, logger)
	if err != nil {
		logger.Error("Failed to connect to Elasticsearch", "error", err)
		os.Exit(1)
	}

	// Initialize Redis queue
	queueClient, err := queue.New(cfg.RedisURL, logger)
	if err != nil {
		logger.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer queueClient.Close()

	// Initialize crawler
	crawlerService := crawler.New(cfg, db, esClient, queueClient, logger)

	// Initialize scheduler
	schedulerService := scheduler.New(cfg, db, queueClient, logger)

	// Start background services
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start crawler workers
	go crawlerService.StartWorkers(ctx)

	// Start scheduler
	go schedulerService.Start(ctx)

	// Initialize HTTP server
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())

	// Setup API routes
	apiHandler := api.NewHandler(cfg, db, esClient, crawlerService, logger)
	apiHandler.SetupRoutes(router)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
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
