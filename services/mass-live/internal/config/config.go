package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all configuration for the mass live service
type Config struct {
	// Server configuration
	Port        int    `json:"port"`
	Host        string `json:"host"`
	Environment string `json:"environment"`
	ServiceName string `json:"service_name"`

	// Database configuration
	DatabaseURL string `json:"database_url"`

	// Redis configuration
	RedisURL string `json:"redis_url"`

	// RTMP configuration
	RTMPPort     int    `json:"rtmp_port"`
	RTMPPath     string `json:"rtmp_path"`
	RTMPMaxConns int    `json:"rtmp_max_conns"`

	// Streaming configuration
	HLSSegmentDuration int      `json:"hls_segment_duration"`
	HLSPlaylistSize    int      `json:"hls_playlist_size"`
	LLHLSEnabled       bool     `json:"llhls_enabled"`
	OutputFormats      []string `json:"output_formats"`
	QualityLevels      []string `json:"quality_levels"`

	// Storage configuration
	S3Bucket          string `json:"s3_bucket"`
	S3Region          string `json:"s3_region"`
	AWSAccessKeyID    string `json:"aws_access_key_id"`
	AWSSecretKey      string `json:"aws_secret_key"`
	StorageBackend    string `json:"storage_backend"` // s3, gcs, local
	LocalStoragePath  string `json:"local_storage_path"`

	// CDN configuration
	CDNEnabled         bool     `json:"cdn_enabled"`
	CDNProviders       []string `json:"cdn_providers"`
	CloudFrontDistID   string   `json:"cloudfront_dist_id"`
	CloudflareZoneID   string   `json:"cloudflare_zone_id"`
	FastlyServiceID    string   `json:"fastly_service_id"`
	CDNBaseURL         string   `json:"cdn_base_url"`

	// Authentication
	JWTSecret    string `json:"jwt_secret"`
	JWTExpiresIn string `json:"jwt_expires_in"`

	// Rate limiting
	RateLimitRequests int `json:"rate_limit_requests"`
	RateLimitWindow   int `json:"rate_limit_window"`

	// Observability
	LogLevel        string `json:"log_level"`
	PrometheusPort  int    `json:"prometheus_port"`
	JaegerEndpoint  string `json:"jaeger_endpoint"`
	OTELServiceName string `json:"otel_service_name"`

	// Feature flags
	EnableRecording   bool `json:"enable_recording"`
	EnableAnalytics   bool `json:"enable_analytics"`
	EnableDRM         bool `json:"enable_drm"`
	EnableWatermark   bool `json:"enable_watermark"`

	// Performance tuning
	MaxConcurrentStreams int `json:"max_concurrent_streams"`
	MaxViewersPerStream  int `json:"max_viewers_per_stream"`
	TranscodingWorkers   int `json:"transcoding_workers"`
	BufferSize           int `json:"buffer_size"`

	// Security
	AllowedOrigins []string `json:"allowed_origins"`
	TrustedProxies []string `json:"trusted_proxies"`
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		// Server defaults
		Port:        getEnvInt("PORT", 8088),
		Host:        getEnv("HOST", "0.0.0.0"),
		Environment: getEnv("ENVIRONMENT", "development"),
		ServiceName: getEnv("SERVICE_NAME", "mass-live"),

		// Database
		DatabaseURL: getEnv("DATABASE_URL", "postgres://massuser:masspass@localhost:5432/mass_live_db?sslmode=disable"),

		// Redis
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379/5"),

		// RTMP
		RTMPPort:     getEnvInt("RTMP_PORT", 1935),
		RTMPPath:     getEnv("RTMP_PATH", "/live"),
		RTMPMaxConns: getEnvInt("RTMP_MAX_CONNS", 1000),

		// Streaming
		HLSSegmentDuration: getEnvInt("HLS_SEGMENT_DURATION", 2),
		HLSPlaylistSize:    getEnvInt("HLS_PLAYLIST_SIZE", 6),
		LLHLSEnabled:       getEnvBool("LLHLS_ENABLED", true),
		OutputFormats:      getEnvStringSlice("OUTPUT_FORMATS", []string{"hls", "dash"}),
		QualityLevels:      getEnvStringSlice("QUALITY_LEVELS", []string{"240p", "360p", "480p", "720p", "1080p"}),

		// Storage
		S3Bucket:         getEnv("S3_BUCKET", "suuupra-mass-live"),
		S3Region:         getEnv("S3_REGION", "us-west-2"),
		AWSAccessKeyID:   getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretKey:     getEnv("AWS_SECRET_ACCESS_KEY", ""),
		StorageBackend:   getEnv("STORAGE_BACKEND", "s3"),
		LocalStoragePath: getEnv("LOCAL_STORAGE_PATH", "/tmp/streams"),

		// CDN
		CDNEnabled:       getEnvBool("CDN_ENABLED", true),
		CDNProviders:     getEnvStringSlice("CDN_PROVIDERS", []string{"cloudfront", "cloudflare"}),
		CloudFrontDistID: getEnv("CLOUDFRONT_DIST_ID", ""),
		CloudflareZoneID: getEnv("CLOUDFLARE_ZONE_ID", ""),
		FastlyServiceID:  getEnv("FASTLY_SERVICE_ID", ""),
		CDNBaseURL:       getEnv("CDN_BASE_URL", "https://cdn.suuupra.com"),

		// Authentication
		JWTSecret:    getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
		JWTExpiresIn: getEnv("JWT_EXPIRES_IN", "24h"),

		// Rate limiting
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 1000),
		RateLimitWindow:   getEnvInt("RATE_LIMIT_WINDOW", 60),

		// Observability
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		PrometheusPort:  getEnvInt("PROMETHEUS_PORT", 9090),
		JaegerEndpoint:  getEnv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces"),
		OTELServiceName: getEnv("OTEL_SERVICE_NAME", "mass-live"),

		// Feature flags
		EnableRecording: getEnvBool("ENABLE_RECORDING", true),
		EnableAnalytics: getEnvBool("ENABLE_ANALYTICS", true),
		EnableDRM:       getEnvBool("ENABLE_DRM", false),
		EnableWatermark: getEnvBool("ENABLE_WATERMARK", false),

		// Performance
		MaxConcurrentStreams: getEnvInt("MAX_CONCURRENT_STREAMS", 10000),
		MaxViewersPerStream:  getEnvInt("MAX_VIEWERS_PER_STREAM", 1000000),
		TranscodingWorkers:   getEnvInt("TRANSCODING_WORKERS", 4),
		BufferSize:           getEnvInt("BUFFER_SIZE", 1024*1024), // 1MB

		// Security
		AllowedOrigins: getEnvStringSlice("ALLOWED_ORIGINS", []string{"*"}),
		TrustedProxies: getEnvStringSlice("TRUSTED_PROXIES", []string{"127.0.0.1"}),
	}

	// Validate required fields
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.RedisURL == "" {
		return fmt.Errorf("REDIS_URL is required")
	}
	if c.JWTSecret == "" || c.JWTSecret == "your-super-secret-jwt-key-change-in-production" {
		if c.Environment == "production" {
			return fmt.Errorf("JWT_SECRET must be set to a secure value in production")
		}
	}
	if c.StorageBackend == "s3" && (c.AWSAccessKeyID == "" || c.AWSSecretKey == "") {
		if c.Environment == "production" {
			return fmt.Errorf("AWS credentials are required when using S3 storage backend")
		}
	}
	return nil
}

// Helper functions for environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}
