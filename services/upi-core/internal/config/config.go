package config

import (
	"fmt"
	"time"
)

// Config represents the application configuration
type Config struct {
	App       AppConfig       `mapstructure:"app"`
	Server    ServerConfig    `mapstructure:"server"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Redis     RedisConfig     `mapstructure:"redis"`
	Kafka     KafkaConfig     `mapstructure:"kafka"`
	Security  SecurityConfig  `mapstructure:"security"`
	Logging   LoggingConfig   `mapstructure:"logging"`
	Telemetry TelemetryConfig `mapstructure:"telemetry"`
}

// AppConfig contains application-level configuration
type AppConfig struct {
	Name        string `mapstructure:"name"`
	Version     string `mapstructure:"version"`
	Environment string `mapstructure:"environment"`
}

// ServerConfig contains server configuration
type ServerConfig struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
}

// DatabaseConfig contains database configuration
type DatabaseConfig struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	Username     string        `mapstructure:"username"`
	Password     string        `mapstructure:"password"`
	Database     string        `mapstructure:"database"`
	SSLMode      string        `mapstructure:"ssl_mode"`
	MaxOpenConns int           `mapstructure:"max_open_conns"`
	MaxIdleConns int           `mapstructure:"max_idle_conns"`
	ConnTimeout  time.Duration `mapstructure:"conn_timeout"`
}

// RedisConfig contains Redis configuration
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

// KafkaConfig contains Kafka configuration
type KafkaConfig struct {
	Brokers []string          `mapstructure:"brokers"`
	GroupID string            `mapstructure:"group_id"`
	Topics  KafkaTopicsConfig `mapstructure:"topics"`
}

// KafkaTopicsConfig contains Kafka topic configuration
type KafkaTopicsConfig struct {
	Transactions string `mapstructure:"transactions"`
	Settlements  string `mapstructure:"settlements"`
	Events       string `mapstructure:"events"`
}

// SecurityConfig contains security configuration
type SecurityConfig struct {
	PrivateKeyPath string `mapstructure:"private_key_path"`
	PublicKeyPath  string `mapstructure:"public_key_path"`
	EnableTLS      bool   `mapstructure:"enable_tls"`
	TLSCertFile    string `mapstructure:"tls_cert_file"`
	TLSKeyFile     string `mapstructure:"tls_key_file"`
}

// LoggingConfig contains logging configuration
type LoggingConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

// TelemetryConfig contains telemetry configuration
type TelemetryConfig struct {
	Enabled        bool    `mapstructure:"enabled"`
	ServiceName    string  `mapstructure:"service_name"`
	JaegerEndpoint string  `mapstructure:"jaeger_endpoint"`
	MetricsPort    int     `mapstructure:"metrics_port"`
	SampleRate     float64 `mapstructure:"sample_rate"`
}

// GetDSN returns the database connection string
func (d DatabaseConfig) GetDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.Username, d.Password, d.Database, d.SSLMode)
}

// GetRedisAddr returns the Redis address
func (r RedisConfig) GetRedisAddr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}
