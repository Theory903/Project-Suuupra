package config

import (
	"os"
	"strconv"
)

type Config struct {
	// Server configuration
	ServiceName  string `env:"SERVICE_NAME" default:"payments"`
	Environment  string `env:"ENVIRONMENT" default:"development"`
	Port         string `env:"PORT" default:"8084"`
	ReadTimeout  int    `env:"READ_TIMEOUT" default:"30"`
	WriteTimeout int    `env:"WRITE_TIMEOUT" default:"30"`
	IdleTimeout  int    `env:"IDLE_TIMEOUT" default:"120"`

	// Database configuration
	DatabaseURL             string `env:"DATABASE_URL" required:"true"`
	DatabaseMaxOpenConns    int    `env:"DATABASE_MAX_OPEN_CONNS" default:"25"`
	DatabaseMaxIdleConns    int    `env:"DATABASE_MAX_IDLE_CONNS" default:"25"`
	DatabaseConnMaxLifetime string `env:"DATABASE_CONN_MAX_LIFETIME" default:"5m"`

	// Redis configuration
	RedisURL      string `env:"REDIS_URL" default:"redis://localhost:6379/0"`
	RedisPassword string `env:"REDIS_PASSWORD" default:""`
	RedisDB       int    `env:"REDIS_DB" default:"0"`
	RedisPoolSize int    `env:"REDIS_POOL_SIZE" default:"10"`

	// UPI Core Service configuration
	UPICoreGRPC       string `env:"UPI_CORE_GRPC" default:"localhost:50051"`
	UPICoreHTTP       string `env:"UPI_CORE_HTTP" default:"http://localhost:8081"`
	UPICoreTimeout    string `env:"UPI_CORE_TIMEOUT" default:"30s"`
	UPICoreMaxRetries int    `env:"UPI_CORE_MAX_RETRIES" default:"3"`

	// Security configuration
	JWTSecret             string `env:"JWT_SECRET" required:"true"`
	HMACSigningSecret     string `env:"HMAC_SIGNING_SECRET" required:"true"`
	FieldEncryptionKey    string `env:"FIELD_ENCRYPTION_KEY" required:"true"`
	WebhookSigningSecret  string `env:"WEBHOOK_SIGNING_SECRET" required:"true"`

	// Observability configuration
	LogLevel        string `env:"LOG_LEVEL" default:"info"`
	LogFormat       string `env:"LOG_FORMAT" default:"json"`
	JaegerEndpoint  string `env:"JAEGER_ENDPOINT" default:"http://localhost:14268/api/traces"`
	MetricsPort     string `env:"METRICS_PORT" default:"9090"`

	// Business Logic configuration
	MaxRetryAttempts          int `env:"MAX_RETRY_ATTEMPTS" default:"3"`
	IdempotencyTTLHours       int `env:"IDEMPOTENCY_TTL_HOURS" default:"24"`
	WebhookTimeoutSeconds     int `env:"WEBHOOK_TIMEOUT_SECONDS" default:"30"`
	MaxWebhookRetries         int `env:"MAX_WEBHOOK_RETRIES" default:"5"`
	PaymentIntentExpiryMinutes int `env:"PAYMENT_INTENT_EXPIRY_MINUTES" default:"15"`
	MaxRefundAgeDays          int `env:"MAX_REFUND_AGE_DAYS" default:"90"`

	// Rate Limiting configuration
	RateLimitEnabled           bool `env:"RATE_LIMIT_ENABLED" default:"true"`
	RateLimitRequestsPerMinute int  `env:"RATE_LIMIT_REQUESTS_PER_MINUTE" default:"1000"`
	RateLimitBurstSize         int  `env:"RATE_LIMIT_BURST_SIZE" default:"100"`

	// Risk Assessment configuration
	RiskAssessmentEnabled   bool `env:"RISK_ASSESSMENT_ENABLED" default:"true"`
	RiskHighThreshold       int  `env:"RISK_HIGH_THRESHOLD" default:"75"`
	RiskMediumThreshold     int  `env:"RISK_MEDIUM_THRESHOLD" default:"50"`
	DefaultRiskWeightAmount int  `env:"DEFAULT_RISK_WEIGHT_AMOUNT" default:"10"`
	DefaultRiskWeightVelocity int  `env:"DEFAULT_RISK_WEIGHT_VELOCITY" default:"15"`
	DefaultRiskWeightDevice int  `env:"DEFAULT_RISK_WEIGHT_DEVICE" default:"20"`
	DefaultRiskWeightIP     int  `env:"DEFAULT_RISK_WEIGHT_IP" default:"10"`
	DefaultRiskWeightTime   int  `env:"DEFAULT_RISK_WEIGHT_TIME" default:"5"`
	DefaultRiskWeightMerchant int  `env:"DEFAULT_RISK_WEIGHT_MERCHANT" default:"10"`

	// External Services configuration
	BankSimulatorGRPC     string `env:"BANK_SIMULATOR_GRPC" default:"localhost:50050"`
	NotificationServiceURL string `env:"NOTIFICATION_SERVICE_URL" default:"http://localhost:8085"`
	ERPWebhookURL         string `env:"ERP_WEBHOOK_URL" default:"http://localhost:8086/webhooks"`

	// Development/Testing configuration
	EnableMockUPI        bool `env:"ENABLE_MOCK_UPI" default:"false"`
	EnableDebugEndpoints bool `env:"ENABLE_DEBUG_ENDPOINTS" default:"false"`
	SkipAuthInDev        bool `env:"SKIP_AUTH_IN_DEV" default:"false"`
}

func Load() *Config {
	cfg := &Config{}
	
	// Set defaults using environment variables
	cfg.ServiceName = getEnv("SERVICE_NAME", "payments")
	cfg.Environment = getEnv("ENVIRONMENT", "development")
	cfg.Port = getEnv("PORT", "8084")
	cfg.ReadTimeout = getEnvAsInt("READ_TIMEOUT", 30)
	cfg.WriteTimeout = getEnvAsInt("WRITE_TIMEOUT", 30)
	cfg.IdleTimeout = getEnvAsInt("IDLE_TIMEOUT", 120)
	
	// Database
	cfg.DatabaseURL = getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/payments?sslmode=disable")
	cfg.DatabaseMaxOpenConns = getEnvAsInt("DATABASE_MAX_OPEN_CONNS", 25)
	cfg.DatabaseMaxIdleConns = getEnvAsInt("DATABASE_MAX_IDLE_CONNS", 25)
	cfg.DatabaseConnMaxLifetime = getEnv("DATABASE_CONN_MAX_LIFETIME", "5m")
	
	// Redis
	cfg.RedisURL = getEnv("REDIS_URL", "redis://localhost:6379/0")
	cfg.RedisPassword = getEnv("REDIS_PASSWORD", "")
	cfg.RedisDB = getEnvAsInt("REDIS_DB", 0)
	cfg.RedisPoolSize = getEnvAsInt("REDIS_POOL_SIZE", 10)
	
	// UPI Core Service
	cfg.UPICoreGRPC = getEnv("UPI_CORE_GRPC", "localhost:50051")
	cfg.UPICoreHTTP = getEnv("UPI_CORE_HTTP", "http://localhost:8081")
	cfg.UPICoreTimeout = getEnv("UPI_CORE_TIMEOUT", "30s")
	cfg.UPICoreMaxRetries = getEnvAsInt("UPI_CORE_MAX_RETRIES", 3)
	
	// Security - these should be overridden in production
	cfg.JWTSecret = getEnv("JWT_SECRET", "dev-jwt-secret-key")
	cfg.HMACSigningSecret = getEnv("HMAC_SIGNING_SECRET", "dev-hmac-signing-secret")
	cfg.FieldEncryptionKey = getEnv("FIELD_ENCRYPTION_KEY", "dev-32-character-encryption-key!!")
	cfg.WebhookSigningSecret = getEnv("WEBHOOK_SIGNING_SECRET", "dev-webhook-signing-secret")
	
	// Observability
	cfg.LogLevel = getEnv("LOG_LEVEL", "info")
	cfg.LogFormat = getEnv("LOG_FORMAT", "json")
	cfg.JaegerEndpoint = getEnv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces")
	cfg.MetricsPort = getEnv("METRICS_PORT", "9090")
	
	// Business Logic
	cfg.MaxRetryAttempts = getEnvAsInt("MAX_RETRY_ATTEMPTS", 3)
	cfg.IdempotencyTTLHours = getEnvAsInt("IDEMPOTENCY_TTL_HOURS", 24)
	cfg.WebhookTimeoutSeconds = getEnvAsInt("WEBHOOK_TIMEOUT_SECONDS", 30)
	cfg.MaxWebhookRetries = getEnvAsInt("MAX_WEBHOOK_RETRIES", 5)
	cfg.PaymentIntentExpiryMinutes = getEnvAsInt("PAYMENT_INTENT_EXPIRY_MINUTES", 15)
	cfg.MaxRefundAgeDays = getEnvAsInt("MAX_REFUND_AGE_DAYS", 90)
	
	// Rate Limiting
	cfg.RateLimitEnabled = getEnvAsBool("RATE_LIMIT_ENABLED", true)
	cfg.RateLimitRequestsPerMinute = getEnvAsInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 1000)
	cfg.RateLimitBurstSize = getEnvAsInt("RATE_LIMIT_BURST_SIZE", 100)
	
	// Risk Assessment
	cfg.RiskAssessmentEnabled = getEnvAsBool("RISK_ASSESSMENT_ENABLED", true)
	cfg.RiskHighThreshold = getEnvAsInt("RISK_HIGH_THRESHOLD", 75)
	cfg.RiskMediumThreshold = getEnvAsInt("RISK_MEDIUM_THRESHOLD", 50)
	cfg.DefaultRiskWeightAmount = getEnvAsInt("DEFAULT_RISK_WEIGHT_AMOUNT", 10)
	cfg.DefaultRiskWeightVelocity = getEnvAsInt("DEFAULT_RISK_WEIGHT_VELOCITY", 15)
	cfg.DefaultRiskWeightDevice = getEnvAsInt("DEFAULT_RISK_WEIGHT_DEVICE", 20)
	cfg.DefaultRiskWeightIP = getEnvAsInt("DEFAULT_RISK_WEIGHT_IP", 10)
	cfg.DefaultRiskWeightTime = getEnvAsInt("DEFAULT_RISK_WEIGHT_TIME", 5)
	cfg.DefaultRiskWeightMerchant = getEnvAsInt("DEFAULT_RISK_WEIGHT_MERCHANT", 10)
	
	// External Services
	cfg.BankSimulatorGRPC = getEnv("BANK_SIMULATOR_GRPC", "localhost:50050")
	cfg.NotificationServiceURL = getEnv("NOTIFICATION_SERVICE_URL", "http://localhost:8085")
	cfg.ERPWebhookURL = getEnv("ERP_WEBHOOK_URL", "http://localhost:8086/webhooks")
	
	// Development/Testing
	cfg.EnableMockUPI = getEnvAsBool("ENABLE_MOCK_UPI", false)
	cfg.EnableDebugEndpoints = getEnvAsBool("ENABLE_DEBUG_ENDPOINTS", false)
	cfg.SkipAuthInDev = getEnvAsBool("SKIP_AUTH_IN_DEV", false)
	
	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}