package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Server configuration
	Environment string
	Port        string
	LogLevel    string

	// Database configuration
	DatabaseURL string

	// Elasticsearch configuration
	ElasticsearchURL string
	IndexName        string

	// Redis configuration
	RedisURL string

	// Crawler configuration
	MaxCrawlers       int
	CrawlDelay        int // seconds
	RequestTimeout    int // seconds
	MaxRetries        int
	UserAgent         string
	RespectRobotsTxt  bool
	MaxDepth          int
	MaxPagesPerDomain int

	// Content processing
	MinContentLength int
	MaxContentLength int
	AllowedDomains   []string
	BlockedDomains   []string

	// Search configuration
	MaxSearchResults int
	DefaultPageSize  int

	// Security
	JWTSecret string
	APIKeys   []string

	// Monitoring
	MetricsEnabled bool
	TracingEnabled bool
	JaegerEndpoint string

	// Storage
	S3Bucket       string
	S3Region       string
	AWSAccessKeyID string
	AWSSecretKey   string
}

func Load() (*Config, error) {
	cfg := &Config{
		Environment:       getEnv("ENVIRONMENT", "development"),
		Port:              getEnv("PORT", "8090"),
		LogLevel:          getEnv("LOG_LEVEL", "info"),
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://user:password@localhost:5432/search_crawler?sslmode=disable"),
		ElasticsearchURL:  getEnv("ELASTICSEARCH_URL", "http://localhost:9200"),
		IndexName:         getEnv("ELASTICSEARCH_INDEX", "suuupra_content"),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379/0"),
		MaxCrawlers:       getEnvAsInt("MAX_CRAWLERS", 10),
		CrawlDelay:        getEnvAsInt("CRAWL_DELAY", 1),
		RequestTimeout:    getEnvAsInt("REQUEST_TIMEOUT", 30),
		MaxRetries:        getEnvAsInt("MAX_RETRIES", 3),
		UserAgent:         getEnv("USER_AGENT", "Suuupra-Crawler/1.0 (+https://suuupra.com/crawler)"),
		RespectRobotsTxt:  getEnvAsBool("RESPECT_ROBOTS_TXT", true),
		MaxDepth:          getEnvAsInt("MAX_DEPTH", 10),
		MaxPagesPerDomain: getEnvAsInt("MAX_PAGES_PER_DOMAIN", 10000),
		MinContentLength:  getEnvAsInt("MIN_CONTENT_LENGTH", 100),
		MaxContentLength:  getEnvAsInt("MAX_CONTENT_LENGTH", 1000000),
		AllowedDomains:    getEnvAsSlice("ALLOWED_DOMAINS", ","),
		BlockedDomains:    getEnvAsSlice("BLOCKED_DOMAINS", ","),
		MaxSearchResults:  getEnvAsInt("MAX_SEARCH_RESULTS", 1000),
		DefaultPageSize:   getEnvAsInt("DEFAULT_PAGE_SIZE", 20),
		JWTSecret:         getEnv("JWT_SECRET", "your-secret-key"),
		APIKeys:           getEnvAsSlice("API_KEYS", ","),
		MetricsEnabled:    getEnvAsBool("METRICS_ENABLED", true),
		TracingEnabled:    getEnvAsBool("TRACING_ENABLED", true),
		JaegerEndpoint:    getEnv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces"),
		S3Bucket:          getEnv("S3_BUCKET", "suuupra-search-crawler"),
		S3Region:          getEnv("S3_REGION", "us-east-1"),
		AWSAccessKeyID:    getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretKey:      getEnv("AWS_SECRET_ACCESS_KEY", ""),
	}

	return cfg, nil
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

func getEnvAsSlice(key, separator string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, separator)
	}
	return []string{}
}
