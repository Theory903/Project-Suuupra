package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	ServiceName string `mapstructure:"service_name"`
	Environment string `mapstructure:"environment"`
	Port        int    `mapstructure:"port"`
	LogLevel    string `mapstructure:"log_level"`

	DatabaseURL string      `mapstructure:"database_url"`
	Redis       RedisConfig `mapstructure:"redis"`
	Security    Security    `mapstructure:"security"`
	UPI         UPIConfig   `mapstructure:"upi"`

	// External Services
	UPICoreServiceURL      string `mapstructure:"upi_core_service_url"`
	PaymentServiceURL      string `mapstructure:"payment_service_url"`
	NotificationServiceURL string `mapstructure:"notification_service_url"`

	// Observability
	PrometheusMetricsPort int    `mapstructure:"prometheus_metrics_port"`
	JaegerEndpoint        string `mapstructure:"jaeger_endpoint"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

// Security holds security-related configuration
type Security struct {
	JWTSecret          string `mapstructure:"jwt_secret"`
	JWTExpirationHours int    `mapstructure:"jwt_expiration_hours"`
	EncryptionKey      string `mapstructure:"encryption_key"`
	BCryptCost         int    `mapstructure:"bcrypt_cost"`
}

// UPIConfig holds UPI-specific configuration
type UPIConfig struct {
	AcquirerID string `mapstructure:"acquirer_id"`
	PSPID      string `mapstructure:"psp_id"`
	MerchantID string `mapstructure:"merchant_id"`
}

// Load loads configuration from environment variables and config files
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")

	// Set default values
	setDefaults()

	// Enable reading from environment variables
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Read config file (optional)
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate required fields
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

// setDefaults sets default configuration values
func setDefaults() {
	// Service defaults
	viper.SetDefault("service_name", "upi-psp-service")
	viper.SetDefault("environment", "development")
	viper.SetDefault("port", 8097)
	viper.SetDefault("log_level", "info")

	// Database defaults
	viper.SetDefault("database_url", "postgresql://upi_psp:upi_psp_password@localhost:5432/upi_psp_db?sslmode=disable")

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)

	// Security defaults
	viper.SetDefault("security.jwt_secret", "change-me-in-production")
	viper.SetDefault("security.jwt_expiration_hours", 24)
	viper.SetDefault("security.encryption_key", "change-me-in-production")
	viper.SetDefault("security.bcrypt_cost", 12)

	// UPI defaults
	viper.SetDefault("upi.acquirer_id", "SUUUPRA")
	viper.SetDefault("upi.psp_id", "SUUUPRAPSP")
	viper.SetDefault("upi.merchant_id", "SUUUPRA001")

	// External service defaults
	viper.SetDefault("upi_core_service_url", "localhost:50051")
	viper.SetDefault("payment_service_url", "http://localhost:8084")
	viper.SetDefault("notification_service_url", "http://localhost:8085")

	// Observability defaults
	viper.SetDefault("prometheus_metrics_port", 9090)
	viper.SetDefault("jaeger_endpoint", "http://localhost:14268")
}

// validateConfig validates the configuration
func validateConfig(config *Config) error {
	if config.DatabaseURL == "" {
		return fmt.Errorf("database_url is required")
	}

	if config.Security.JWTSecret == "" || config.Security.JWTSecret == "change-me-in-production" {
		if config.Environment == "production" {
			return fmt.Errorf("jwt_secret must be set in production")
		}
	}

	if config.Security.EncryptionKey == "" || config.Security.EncryptionKey == "change-me-in-production" {
		if config.Environment == "production" {
			return fmt.Errorf("encryption_key must be set in production")
		}
	}

	if config.UPI.AcquirerID == "" {
		return fmt.Errorf("upi.acquirer_id is required")
	}

	if config.UPI.PSPID == "" {
		return fmt.Errorf("upi.psp_id is required")
	}

	if config.Port <= 0 || config.Port > 65535 {
		return fmt.Errorf("invalid port number: %d", config.Port)
	}

	return nil
}
