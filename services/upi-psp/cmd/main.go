package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/suuupra/upi-psp/internal/config"
	"github.com/suuupra/upi-psp/internal/database"
	"github.com/suuupra/upi-psp/internal/handlers"
	"github.com/suuupra/upi-psp/internal/middleware"
	"github.com/suuupra/upi-psp/internal/repository"
	"github.com/suuupra/upi-psp/internal/services"
)

func main() {
	// Initialize logger
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.InfoLevel)

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.WithError(err).Fatal("Failed to load configuration")
	}

	// Set log level from config
	if level, err := logrus.ParseLevel(cfg.LogLevel); err == nil {
		logger.SetLevel(level)
	}

	logger.WithFields(logrus.Fields{
		"service": cfg.ServiceName,
		"port":    cfg.Port,
		"env":     cfg.Environment,
	}).Info("Starting UPI PSP Service")

	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL, logger)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize database")
	}

	// Initialize Redis
	redisClient, err := database.InitializeRedis(cfg.Redis, logger)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize Redis")
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	deviceRepo := repository.NewDeviceRepository(db)
	transactionRepo := repository.NewTransactionRepository(db)

	// Initialize services
	authService := services.NewAuthService(userRepo, deviceRepo, redisClient, cfg.Security, logger)
	upiService := services.NewUPIService(cfg.UPI, logger)
	paymentService := services.NewPaymentService(transactionRepo, upiService, logger)
	qrService := services.NewQRService(logger)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, logger)
	paymentHandler := handlers.NewPaymentHandler(paymentService, authService, logger)
	qrHandler := handlers.NewQRHandler(qrService, logger)
	healthHandler := handlers.NewHealthHandler(db, redisClient, logger)

	// Setup router
	router := setupRouter(cfg, authHandler, paymentHandler, qrHandler, healthHandler, logger)

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		logger.WithField("port", cfg.Port).Info("Starting HTTP server")
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
		logger.WithError(err).Error("Server forced to shutdown")
	}

	// Close database connections
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.Close()
	}
	redisClient.Close()

	logger.Info("Server shutdown complete")
}

func setupRouter(
	cfg *config.Config,
	authHandler *handlers.AuthHandler,
	paymentHandler *handlers.PaymentHandler,
	qrHandler *handlers.QRHandler,
	healthHandler *handlers.HealthHandler,
	logger *logrus.Logger,
) *gin.Engine {
	// Set Gin mode based on environment
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global middleware
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.CORS())
	router.Use(middleware.SecurityHeaders())

	// Health endpoints (no auth required)
	router.GET("/health", healthHandler.Health)
	router.GET("/ready", healthHandler.Ready)
	router.GET("/metrics", healthHandler.Metrics)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Authentication routes
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/logout", middleware.Auth(cfg.Security.JWTSecret), authHandler.Logout)
			auth.POST("/device/bind", middleware.Auth(cfg.Security.JWTSecret), authHandler.BindDevice)
			auth.DELETE("/device/:deviceId", middleware.Auth(cfg.Security.JWTSecret), authHandler.UnbindDevice)
		}

		// Protected routes
		protected := v1.Group("/")
		protected.Use(middleware.Auth(cfg.Security.JWTSecret))
		protected.Use(middleware.DeviceValidation())
		{
			// Payment routes
			payments := protected.Group("/payments")
			{
				payments.POST("/send", paymentHandler.SendMoney)
				payments.POST("/request", paymentHandler.RequestMoney)
				payments.GET("/history", paymentHandler.GetHistory)
				payments.GET("/:paymentId", paymentHandler.GetPayment)
				payments.POST("/:paymentId/cancel", paymentHandler.CancelPayment)
			}

			// QR Code routes
			qr := protected.Group("/qr")
			{
				qr.POST("/generate", qrHandler.GenerateQR)
				qr.POST("/scan", qrHandler.ScanQR)
			}

			// User profile routes
			profile := protected.Group("/profile")
			{
				profile.GET("/", authHandler.GetProfile)
				profile.PUT("/", authHandler.UpdateProfile)
				profile.GET("/devices", authHandler.GetDevices)
			}
		}
	}

	return router
}
