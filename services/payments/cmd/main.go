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
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
	"github.com/suuupra/payments/internal/config"
	"github.com/suuupra/payments/internal/database"
	"github.com/suuupra/payments/internal/handlers"
	"github.com/suuupra/payments/internal/middleware"
	"github.com/suuupra/payments/internal/repository"
	"github.com/suuupra/payments/internal/services"
	"github.com/suuupra/payments/pkg/logger"
	"github.com/suuupra/payments/pkg/metrics"
	"github.com/suuupra/payments/pkg/redis"
	"github.com/suuupra/payments/pkg/tracing"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize configuration
	cfg := config.Load()

	// Initialize logger
	logger := logger.NewLogger(cfg.LogLevel)

	// Initialize tracing
	cleanup, err := tracing.InitTracer(cfg.ServiceName, cfg.JaegerEndpoint)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize tracing")
	}
	defer cleanup()

	// Initialize metrics
	metrics.InitMetrics()

	// Initialize Redis
	redisClient, err := redis.NewClient(cfg.RedisURL)
	if err != nil {
		logger.WithError(err).Fatal("Failed to connect to Redis")
	}
	defer redisClient.Close()

	// Initialize database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.WithError(err).Fatal("Failed to connect to database")
	}

	// Run migrations
	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		logger.WithError(err).Fatal("Failed to run migrations")
	}

	// Initialize repositories
	repos := repository.NewRepositories(db)

	// Initialize services
	upiClient, err := services.NewUPIClient(cfg.UPICoreGRPC)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize UPI client")
	}
	defer upiClient.Close()

	services := services.NewServices(services.Dependencies{
		Repos:     repos,
		Redis:     redisClient,
		UPIClient: upiClient,
		Logger:    logger,
		Config:    cfg,
	})

	// Initialize handlers
	handlers := handlers.NewHandlers(services, logger)

	// Setup Gin router
	router := setupRouter(cfg, handlers, logger)

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(cfg.IdleTimeout) * time.Second,
	}

	// Start server in goroutine
	go func() {
		logger.WithField("port", cfg.Port).Info("Starting payment gateway server")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.WithError(err).Fatal("Failed to start server")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.WithError(err).Fatal("Server forced to shutdown")
	}

	logger.Info("Server exited")
}

func setupRouter(cfg *config.Config, handlers *handlers.Handlers, logger *logrus.Logger) *gin.Engine {
	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())
	router.Use(middleware.Metrics())
	router.Use(middleware.Tracing())

	// Health check endpoints
	router.GET("/health", handlers.Health)
	router.GET("/ready", handlers.Ready)

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	// API v1 routes
	v1 := router.Group("/api/v1")
	v1.Use(middleware.Authentication(cfg.JWTSecret))
	v1.Use(middleware.Idempotency(handlers.Services.Idempotency))
	{
		// Payment routes
		v1.POST("/intents", handlers.CreatePaymentIntent)
		v1.GET("/intents/:id", handlers.GetPaymentIntent)
		v1.POST("/payments", handlers.CreatePayment)
		v1.GET("/payments/:id", handlers.GetPayment)

		// Refund routes
		v1.POST("/refunds", handlers.CreateRefund)
		v1.GET("/refunds/:id", handlers.GetRefund)

		// Risk assessment
		v1.POST("/risk/assess", handlers.AssessRisk)

		// Webhook routes
		v1.POST("/webhooks/endpoints", handlers.CreateWebhookEndpoint)
		v1.GET("/webhooks/endpoints", handlers.ListWebhookEndpoints)
		v1.PUT("/webhooks/endpoints/:id", handlers.UpdateWebhookEndpoint)
		v1.DELETE("/webhooks/endpoints/:id", handlers.DeleteWebhookEndpoint)
	}

	// Webhook delivery endpoint (no auth required)
	router.POST("/webhooks/receive/:endpoint_id", handlers.ReceiveWebhook)

	return router
}