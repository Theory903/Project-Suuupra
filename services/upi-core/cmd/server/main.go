package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"upi-core/internal/config"
	"upi-core/internal/domain/repository"
	"upi-core/internal/domain/service"
	"upi-core/internal/http"
	"upi-core/internal/infrastructure/database"
	"upi-core/internal/infrastructure/kafka"
	"upi-core/internal/infrastructure/redis"
	"upi-core/internal/server"
	"upi-core/pkg/logger"
	"upi-core/pkg/telemetry"
)

var (
	cfgFile string
	log     *logrus.Logger
)

func main() {
	if err := newRootCommand().Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func newRootCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "upi-core",
		Short: "UPI Core Service - The central UPI switch",
		Long:  `UPI Core Service handles transaction routing, VPA resolution, settlement processing, and provides the backbone for the UPI network.`,
		RunE:  runServer,
	}

	cmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.upi-core.yaml)")
	cmd.Flags().String("host", "0.0.0.0", "Server host")
	cmd.Flags().Int("port", 50051, "Server port")
	cmd.Flags().String("log-level", "info", "Log level (trace, debug, info, warn, error, fatal, panic)")

	// Bind flags to viper
	viper.BindPFlag("server.host", cmd.Flags().Lookup("host"))
	viper.BindPFlag("server.port", cmd.Flags().Lookup("port"))
	viper.BindPFlag("logging.level", cmd.Flags().Lookup("log-level"))

	return cmd
}

func runServer(cmd *cobra.Command, args []string) error {
	// Initialize configuration
	cfg, err := initConfig()
	if err != nil {
		return fmt.Errorf("failed to initialize config: %w", err)
	}

	// Initialize logger
	log = logger.New(cfg.Logging.Level, cfg.Logging.Format)
	log.WithFields(logrus.Fields{
		"version":     cfg.App.Version,
		"environment": cfg.App.Environment,
		"service":     cfg.App.Name,
	}).Info("Starting UPI Core Service")

	// Initialize telemetry
	if cfg.Telemetry.Enabled {
		shutdown, err := telemetry.Init(cfg.Telemetry)
		if err != nil {
			log.WithError(err).Error("Failed to initialize telemetry")
		} else {
			defer shutdown()
			log.Info("Telemetry initialized")
		}
	}

	// Initialize database
	db, err := database.New(cfg.Database)
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	defer db.Close()
	log.Info("Database connection established")

	// Initialize Redis
	redisClient, err := redis.New(cfg.Redis)
	if err != nil {
		return fmt.Errorf("failed to initialize Redis: %w", err)
	}
	defer redisClient.Close()
	log.Info("Redis connection established")

	// Initialize Kafka
	kafkaProducer, err := kafka.NewProducer(cfg.Kafka)
	if err != nil {
		return fmt.Errorf("failed to initialize Kafka producer: %w", err)
	}
	defer kafkaProducer.Close()
	log.Info("Kafka producer initialized")

	// Create gRPC server
	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(server.LoggingUnaryInterceptor(log)),
		grpc.StreamInterceptor(server.LoggingStreamInterceptor(log)),
	)

	// Register health service
	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	// Create repository and service layers
	repo := repository.NewPostgreSQLTransactionRepository(db.DB)
	transactionService := service.NewTransactionService(repo, redisClient, kafkaProducer, log)

	// Register UPI Core service
	upiCoreService := server.NewUpiCoreService(db, redisClient, kafkaProducer, log)
	server.RegisterUpiCoreServer(grpcServer, upiCoreService)

	// Create HTTP server for REST API (matching frontend expectations)
	httpServer := http.NewHTTPServer(transactionService, log, "8080")

	// Enable reflection in development
	if cfg.App.Environment == "development" {
		reflection.Register(grpcServer)
		log.Info("gRPC reflection enabled")
	}

	// Start server
	lis, err := net.Listen("tcp", fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port))
	if err != nil {
		return fmt.Errorf("failed to listen on port %d: %w", cfg.Server.Port, err)
	}

	// Start gRPC server in goroutine
	go func() {
		log.WithFields(logrus.Fields{
			"host": cfg.Server.Host,
			"port": cfg.Server.Port,
		}).Info("Starting gRPC server")

		if err := grpcServer.Serve(lis); err != nil {
			log.WithError(err).Fatal("Failed to serve gRPC server")
		}
	}()

	// Start HTTP server in goroutine
	go func() {
		log.Info("Starting HTTP server on :8080 (Payment API)")
		if err := httpServer.Start(); err != nil {
			log.WithError(err).Fatal("Failed to serve HTTP server")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Set health status to not serving
	healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)

	// Stop HTTP server
	if err := httpServer.Stop(ctx); err != nil {
		log.WithError(err).Error("Error stopping HTTP server")
	}

	// Stop gRPC server gracefully
	stopped := make(chan struct{})
	go func() {
		grpcServer.GracefulStop()
		close(stopped)
	}()

	select {
	case <-ctx.Done():
		log.Warn("Shutdown timeout exceeded, forcing stop")
		grpcServer.Stop()
	case <-stopped:
		log.Info("Server stopped gracefully")
	}

	return nil
}

func initConfig() (*config.Config, error) {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}

		viper.AddConfigPath(home)
		viper.AddConfigPath(".")
		viper.AddConfigPath("./configs")
		viper.SetConfigName(".upi-core")
		viper.SetConfigType("yaml")
	}

	// Environment variables
	viper.SetEnvPrefix("UPI_CORE")
	viper.AutomaticEnv()
	// Replace dots with underscores for environment variables
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Set defaults
	viper.SetDefault("app.name", "upi-core")
	viper.SetDefault("app.version", "1.0.0")
	viper.SetDefault("app.environment", "development")
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 50051)
	viper.SetDefault("server.read_timeout", "30s")
	viper.SetDefault("server.write_timeout", "30s")
	viper.SetDefault("server.idle_timeout", "120s")
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.username", "postgres")
	viper.SetDefault("database.password", "password")
	viper.SetDefault("database.database", "upi_core")
	viper.SetDefault("database.ssl_mode", "disable")
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.conn_timeout", "30s")
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)
	viper.SetDefault("kafka.brokers", []string{"localhost:9092"})
	viper.SetDefault("kafka.group_id", "upi-core")
	viper.SetDefault("kafka.topics.transactions", "upi.transactions")
	viper.SetDefault("kafka.topics.settlements", "upi.settlements")
	viper.SetDefault("kafka.topics.events", "upi.events")
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "text")
	viper.SetDefault("telemetry.enabled", false)
	viper.SetDefault("telemetry.service_name", "upi-core")
	viper.SetDefault("telemetry.jaeger_endpoint", "http://localhost:14268/api/traces")
	viper.SetDefault("telemetry.metrics_port", 9090)
	viper.SetDefault("telemetry.sample_rate", 0.1)

	// Read config file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found; ignore error if desired
			fmt.Println("No config file found, using defaults and environment variables")
		} else {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	var cfg config.Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unable to decode config: %w", err)
	}

	return &cfg, nil
}
