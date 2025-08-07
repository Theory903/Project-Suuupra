// Package logging provides the Suuupra Global Logger - Go Implementation
//
// Features:
// - Ultra-fast structured logging with minimal allocations
// - Wide events for Observability 2.0
// - OpenTelemetry integration
// - Context propagation
// - PII masking and security
// - Gin/Echo middleware support
package logging

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// LogLevel represents the severity of a log entry
type LogLevel int

const (
	TraceLevel LogLevel = iota
	DebugLevel
	InfoLevel
	WarnLevel
	ErrorLevel
	FatalLevel
)

// String returns the string representation of the log level
func (l LogLevel) String() string {
	switch l {
	case TraceLevel:
		return "TRACE"
	case DebugLevel:
		return "DEBUG"
	case InfoLevel:
		return "INFO"
	case WarnLevel:
		return "WARN"
	case ErrorLevel:
		return "ERROR"
	case FatalLevel:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// LogContext holds contextual information for log entries
type LogContext struct {
	// Request Context
	RequestID string `json:"request_id,omitempty"`
	TraceID   string `json:"trace_id,omitempty"`
	SpanID    string `json:"span_id,omitempty"`
	UserID    string `json:"user_id,omitempty"`
	SessionID string `json:"session_id,omitempty"`

	// Service Context
	Service     string `json:"service"`
	Version     string `json:"version,omitempty"`
	Environment string `json:"environment"`
	Component   string `json:"component,omitempty"`

	// Infrastructure Context
	InstanceID       string `json:"instance_id,omitempty"`
	Region           string `json:"region,omitempty"`
	AvailabilityZone string `json:"availability_zone,omitempty"`

	// Business Context
	TenantID       string `json:"tenant_id,omitempty"`
	OrganizationID string `json:"organization_id,omitempty"`

	// Custom fields
	Extra map[string]interface{} `json:"extra,omitempty"`
}

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Context   LogContext             `json:"context"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Error     *ErrorInfo             `json:"error,omitempty"`
	Metrics   *MetricsInfo           `json:"metrics,omitempty"`
	HTTP      *HTTPInfo              `json:"http,omitempty"`
	Database  *DatabaseInfo          `json:"database,omitempty"`
	Security  *SecurityInfo          `json:"security,omitempty"`
}

// ErrorInfo contains error details
type ErrorInfo struct {
	Type     string `json:"type"`
	Message  string `json:"message"`
	Stack    string `json:"stack,omitempty"`
	Code     string `json:"code,omitempty"`
	Category string `json:"category,omitempty"`
}

// MetricsInfo contains performance metrics
type MetricsInfo struct {
	Duration       float64 `json:"duration_ms,omitempty"`
	Memory         uint64  `json:"memory_bytes,omitempty"`
	CPU            float64 `json:"cpu_percent,omitempty"`
	NetworkLatency float64 `json:"network_latency_ms,omitempty"`
}

// HTTPInfo contains HTTP request/response information
type HTTPInfo struct {
	Method       string            `json:"method"`
	URL          string            `json:"url"`
	StatusCode   int               `json:"status_code,omitempty"`
	Duration     float64           `json:"duration_ms,omitempty"`
	RequestSize  int64             `json:"request_size,omitempty"`
	ResponseSize int64             `json:"response_size,omitempty"`
	UserAgent    string            `json:"user_agent,omitempty"`
	IP           string            `json:"ip,omitempty"`
	Headers      map[string]string `json:"headers,omitempty"`
}

// DatabaseInfo contains database operation information
type DatabaseInfo struct {
	Operation    string  `json:"operation"`
	Table        string  `json:"table"`
	Duration     float64 `json:"duration_ms"`
	RowsAffected int64   `json:"rows_affected,omitempty"`
	Query        string  `json:"query,omitempty"` // Be careful with PII
}

// SecurityInfo contains security event information
type SecurityInfo struct {
	Type     string                 `json:"type"`
	Severity string                 `json:"severity"`
	UserID   string                 `json:"user_id,omitempty"`
	IP       string                 `json:"ip,omitempty"`
	Details  map[string]interface{} `json:"details,omitempty"`
}

// WideEvent represents a wide event for Observability 2.0
type WideEvent struct {
	EventID     string                 `json:"event_id"`
	EventType   string                 `json:"event_type"`
	Timestamp   string                 `json:"timestamp"`
	RequestID   string                 `json:"request_id"`
	TraceID     string                 `json:"trace_id"`
	SpanID      string                 `json:"span_id,omitempty"`
	Service     string                 `json:"service"`
	Version     string                 `json:"version,omitempty"`
	Environment string                 `json:"environment"`
	InstanceID  string                 `json:"instance_id,omitempty"`
	Region      string                 `json:"region,omitempty"`
	HTTP        *HTTPInfo              `json:"http,omitempty"`
	User        *UserInfo              `json:"user,omitempty"`
	Business    *BusinessInfo          `json:"business,omitempty"`
	Performance *MetricsInfo           `json:"performance,omitempty"`
	Error       *ErrorInfo             `json:"error,omitempty"`
	Dimensions  map[string]interface{} `json:"dimensions,omitempty"`
}

// UserInfo contains user context information
type UserInfo struct {
	ID          string   `json:"id"`
	Type        string   `json:"type,omitempty"`
	AuthMethod  string   `json:"auth_method,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

// BusinessInfo contains business context information
type BusinessInfo struct {
	TenantID       string          `json:"tenant_id,omitempty"`
	OrganizationID string          `json:"organization_id,omitempty"`
	FeatureFlags   map[string]bool `json:"feature_flags,omitempty"`
	ABTestVariant  string          `json:"ab_test_variant,omitempty"`
}

// Config holds logger configuration
type Config struct {
	Service       string
	Version       string
	Environment   string
	Level         LogLevel
	Format        string // "json", "text", "pretty"
	MaskPII       bool
	OpenTelemetry bool
	InstanceID    string
	Region        string
}

// Logger is the main logger interface
type Logger interface {
	// Core logging methods
	Trace(message string, fields ...Field)
	Debug(message string, fields ...Field)
	Info(message string, fields ...Field)
	Warn(message string, fields ...Field)
	Error(message string, fields ...Field)
	Fatal(message string, fields ...Field)

	// Context management
	WithContext(ctx LogContext) Logger
	WithRequestID(requestID string) Logger
	WithUserID(userID string) Logger
	WithTraceID(traceID string) Logger

	// Performance logging
	StartTimer(name string) Timer
	LogDuration(name string, duration time.Duration, fields ...Field)

	// Structured logging helpers
	LogRequest(req *HTTPRequest, resp *HTTPResponse)
	LogDatabaseQuery(query *DatabaseQuery)
	LogSecurityEvent(event *SecurityEvent)

	// Lifecycle
	Flush() error
	Close() error
}

// Field represents a key-value pair for structured logging
type Field struct {
	Key   string
	Value interface{}
}

// Field constructors for type safety and performance
func String(key, val string) Field {
	return Field{Key: key, Value: val}
}

func Int(key string, val int) Field {
	return Field{Key: key, Value: val}
}

func Int64(key string, val int64) Field {
	return Field{Key: key, Value: val}
}

func Float64(key string, val float64) Field {
	return Field{Key: key, Value: val}
}

func Bool(key string, val bool) Field {
	return Field{Key: key, Value: val}
}

func Duration(key string, val time.Duration) Field {
	return Field{Key: key, Value: val.Milliseconds()}
}

func Any(key string, val interface{}) Field {
	return Field{Key: key, Value: val}
}

func Error(err error) Field {
	return Field{Key: "error", Value: err.Error()}
}

// Timer interface for performance measurements
type Timer interface {
	End(fields ...Field) time.Duration
	GetDuration() time.Duration
}

// HTTPRequest represents an HTTP request for logging
type HTTPRequest struct {
	Method    string
	URL       string
	Headers   map[string]string
	Body      interface{}
	IP        string
	UserAgent string
}

// HTTPResponse represents an HTTP response for logging
type HTTPResponse struct {
	StatusCode int
	Headers    map[string]string
	Body       interface{}
	Duration   time.Duration
}

// DatabaseQuery represents a database query for logging
type DatabaseQuery struct {
	Operation    string
	Table        string
	Query        string
	Duration     time.Duration
	RowsAffected int64
	Error        error
}

// SecurityEvent represents a security event for logging
type SecurityEvent struct {
	Type     string
	Severity string
	UserID   string
	IP       string
	Details  map[string]interface{}
}

// SuuupraLogger is the main logger implementation
type SuuupraLogger struct {
	config  Config
	context LogContext
	zap     *zap.Logger
	tracer  trace.Tracer
	pii     *PIIMasker
	mu      sync.RWMutex
}

// PIIMasker handles PII masking
type PIIMasker struct {
	emailRegex      *regexp.Regexp
	creditCardRegex *regexp.Regexp
	ssnRegex        *regexp.Regexp
	phoneRegex      *regexp.Regexp
	piiFields       map[string]bool
}

// NewPIIMasker creates a new PII masker
func NewPIIMasker() *PIIMasker {
	return &PIIMasker{
		emailRegex:      regexp.MustCompile(`\b[\w\.-]+@[\w\.-]+\.\w+\b`),
		creditCardRegex: regexp.MustCompile(`\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b`),
		ssnRegex:        regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),
		phoneRegex:      regexp.MustCompile(`\b\d{3}-\d{3}-\d{4}\b`),
		piiFields: map[string]bool{
			"password":    true,
			"token":       true,
			"secret":      true,
			"key":         true,
			"ssn":         true,
			"credit_card": true,
			"creditcard":  true,
		},
	}
}

// MaskText masks PII in text
func (p *PIIMasker) MaskText(text string) string {
	text = p.emailRegex.ReplaceAllString(text, "[EMAIL]")
	text = p.creditCardRegex.ReplaceAllString(text, "[CARD]")
	text = p.ssnRegex.ReplaceAllString(text, "[SSN]")
	text = p.phoneRegex.ReplaceAllString(text, "[PHONE]")
	return text
}

// MaskData masks PII in structured data
func (p *PIIMasker) MaskData(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}

	masked := make(map[string]interface{})
	for k, v := range data {
		key := strings.ToLower(k)
		if p.piiFields[key] {
			masked[k] = "[REDACTED]"
		} else if str, ok := v.(string); ok {
			masked[k] = p.MaskText(str)
		} else if nested, ok := v.(map[string]interface{}); ok {
			masked[k] = p.MaskData(nested)
		} else {
			masked[k] = v
		}
	}
	return masked
}

// timer implements the Timer interface
type timer struct {
	name      string
	logger    *SuuupraLogger
	startTime time.Time
}

func (t *timer) End(fields ...Field) time.Duration {
	duration := time.Since(t.startTime)
	t.logger.LogDuration(t.name, duration, fields...)
	return duration
}

func (t *timer) GetDuration() time.Duration {
	return time.Since(t.startTime)
}

// New creates a new logger with the given configuration
func New(config Config) Logger {
	if config.Service == "" {
		config.Service = "unknown-service"
	}
	if config.Environment == "" {
		config.Environment = "development"
	}
	if config.Format == "" {
		config.Format = "json"
	}
	if config.InstanceID == "" {
		config.InstanceID = uuid.New().String()
	}

	// Configure Zap
	var zapConfig zap.Config
	if config.Environment == "production" {
		zapConfig = zap.NewProductionConfig()
	} else {
		zapConfig = zap.NewDevelopmentConfig()
	}

	zapConfig.EncoderConfig.TimeKey = "timestamp"
	zapConfig.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	zapLogger, _ := zapConfig.Build()

	context := LogContext{
		Service:     config.Service,
		Version:     config.Version,
		Environment: config.Environment,
		InstanceID:  config.InstanceID,
		Region:      config.Region,
		Extra:       make(map[string]interface{}),
	}

	return &SuuupraLogger{
		config:  config,
		context: context,
		zap:     zapLogger,
		tracer:  otel.Tracer("suuupra-logger"),
		pii:     NewPIIMasker(),
	}
}

func (l *SuuupraLogger) shouldLog(level LogLevel) bool {
	return level >= l.config.Level
}

func (l *SuuupraLogger) createLogEntry(level LogLevel, message string, fields []Field) LogEntry {
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)

	// Extract context from current goroutine if available
	ctx := context.Background()
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		l.context.TraceID = span.SpanContext().TraceID().String()
		l.context.SpanID = span.SpanContext().SpanID().String()
	}

	// Build data from fields
	data := make(map[string]interface{})
	for _, field := range fields {
		data[field.Key] = field.Value
	}

	// Mask PII if enabled
	if l.config.MaskPII {
		message = l.pii.MaskText(message)
		data = l.pii.MaskData(data)
	}

	return LogEntry{
		Timestamp: timestamp,
		Level:     level.String(),
		Message:   message,
		Context:   l.context,
		Data:      data,
	}
}

func (l *SuuupraLogger) createWideEvent(eventType string, data map[string]interface{}) WideEvent {
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)

	return WideEvent{
		EventID:     uuid.New().String(),
		EventType:   eventType,
		Timestamp:   timestamp,
		RequestID:   l.context.RequestID,
		TraceID:     l.context.TraceID,
		SpanID:      l.context.SpanID,
		Service:     l.context.Service,
		Version:     l.context.Version,
		Environment: l.context.Environment,
		InstanceID:  l.context.InstanceID,
		Region:      l.context.Region,
		Dimensions:  data,
	}
}

func (l *SuuupraLogger) writeEntry(entry LogEntry) {
	// Convert to Zap fields for performance
	zapFields := make([]zap.Field, 0, len(entry.Data)+10)

	// Add context fields
	zapFields = append(zapFields,
		zap.String("service", entry.Context.Service),
		zap.String("environment", entry.Context.Environment),
		zap.String("request_id", entry.Context.RequestID),
		zap.String("trace_id", entry.Context.TraceID),
		zap.String("user_id", entry.Context.UserID),
	)

	// Add data fields
	for k, v := range entry.Data {
		zapFields = append(zapFields, zap.Any(k, v))
	}

	// Add error if present
	if entry.Error != nil {
		zapFields = append(zapFields,
			zap.String("error_type", entry.Error.Type),
			zap.String("error_message", entry.Error.Message),
		)
	}

	// Write to Zap logger
	switch entry.Level {
	case "TRACE", "DEBUG":
		l.zap.Debug(entry.Message, zapFields...)
	case "INFO":
		l.zap.Info(entry.Message, zapFields...)
	case "WARN":
		l.zap.Warn(entry.Message, zapFields...)
	case "ERROR":
		l.zap.Error(entry.Message, zapFields...)
	case "FATAL":
		l.zap.Fatal(entry.Message, zapFields...)
	}
}

// Core logging methods
func (l *SuuupraLogger) Trace(message string, fields ...Field) {
	if l.shouldLog(TraceLevel) {
		entry := l.createLogEntry(TraceLevel, message, fields)
		l.writeEntry(entry)
	}
}

func (l *SuuupraLogger) Debug(message string, fields ...Field) {
	if l.shouldLog(DebugLevel) {
		entry := l.createLogEntry(DebugLevel, message, fields)
		l.writeEntry(entry)
	}
}

func (l *SuuupraLogger) Info(message string, fields ...Field) {
	if l.shouldLog(InfoLevel) {
		entry := l.createLogEntry(InfoLevel, message, fields)
		l.writeEntry(entry)
	}
}

func (l *SuuupraLogger) Warn(message string, fields ...Field) {
	if l.shouldLog(WarnLevel) {
		entry := l.createLogEntry(WarnLevel, message, fields)
		l.writeEntry(entry)
	}
}

func (l *SuuupraLogger) Error(message string, fields ...Field) {
	if l.shouldLog(ErrorLevel) {
		entry := l.createLogEntry(ErrorLevel, message, fields)
		l.writeEntry(entry)
	}
}

func (l *SuuupraLogger) Fatal(message string, fields ...Field) {
	if l.shouldLog(FatalLevel) {
		entry := l.createLogEntry(FatalLevel, message, fields)
		l.writeEntry(entry)
		os.Exit(1)
	}
}

// Context management
func (l *SuuupraLogger) WithContext(ctx LogContext) Logger {
	l.mu.Lock()
	defer l.mu.Unlock()

	newLogger := &SuuupraLogger{
		config: l.config,
		context: LogContext{
			RequestID:        ctx.RequestID,
			TraceID:          ctx.TraceID,
			SpanID:           ctx.SpanID,
			UserID:           ctx.UserID,
			SessionID:        ctx.SessionID,
			Service:          l.context.Service,
			Version:          l.context.Version,
			Environment:      l.context.Environment,
			Component:        ctx.Component,
			InstanceID:       l.context.InstanceID,
			Region:           l.context.Region,
			AvailabilityZone: ctx.AvailabilityZone,
			TenantID:         ctx.TenantID,
			OrganizationID:   ctx.OrganizationID,
			Extra:            ctx.Extra,
		},
		zap:    l.zap,
		tracer: l.tracer,
		pii:    l.pii,
	}

	return newLogger
}

func (l *SuuupraLogger) WithRequestID(requestID string) Logger {
	return l.WithContext(LogContext{RequestID: requestID})
}

func (l *SuuupraLogger) WithUserID(userID string) Logger {
	return l.WithContext(LogContext{UserID: userID})
}

func (l *SuuupraLogger) WithTraceID(traceID string) Logger {
	return l.WithContext(LogContext{TraceID: traceID})
}

// Performance logging
func (l *SuuupraLogger) StartTimer(name string) Timer {
	return &timer{
		name:      name,
		logger:    l,
		startTime: time.Now(),
	}
}

func (l *SuuupraLogger) LogDuration(name string, duration time.Duration, fields ...Field) {
	allFields := append(fields,
		String("timer", name),
		Int64("duration_ms", duration.Milliseconds()),
	)
	l.Info(fmt.Sprintf("Timer: %s", name), allFields...)
}

// Structured logging helpers
func (l *SuuupraLogger) LogRequest(req *HTTPRequest, resp *HTTPResponse) {
	wideEvent := l.createWideEvent("http_request", map[string]interface{}{
		"http": HTTPInfo{
			Method:     req.Method,
			URL:        req.URL,
			StatusCode: resp.StatusCode,
			Duration:   float64(resp.Duration.Milliseconds()),
			IP:         req.IP,
			UserAgent:  req.UserAgent,
		},
	})

	l.Info("HTTP Request", Any("wide_event", wideEvent))
}

func (l *SuuupraLogger) LogDatabaseQuery(query *DatabaseQuery) {
	fields := []Field{
		String("operation", query.Operation),
		String("table", query.Table),
		Duration("duration", query.Duration),
		Int64("rows_affected", query.RowsAffected),
	}

	if query.Error != nil {
		fields = append(fields, Error(query.Error))
		l.Error("Database Query Failed", fields...)
	} else {
		l.Info("Database Query", fields...)
	}
}

func (l *SuuupraLogger) LogSecurityEvent(event *SecurityEvent) {
	l.Warn("Security Event",
		String("type", event.Type),
		String("severity", event.Severity),
		String("user_id", event.UserID),
		String("ip", event.IP),
		Any("details", event.Details),
	)
}

// Lifecycle
func (l *SuuupraLogger) Flush() error {
	return l.zap.Sync()
}

func (l *SuuupraLogger) Close() error {
	return l.zap.Sync()
}

// Context utilities
type contextKey string

const loggerContextKey contextKey = "suuupra_logger_context"

// WithLoggerContext adds logger context to Go context
func WithLoggerContext(ctx context.Context, logCtx LogContext) context.Context {
	return context.WithValue(ctx, loggerContextKey, logCtx)
}

// FromContext extracts logger context from Go context
func FromContext(ctx context.Context) (LogContext, bool) {
	logCtx, ok := ctx.Value(loggerContextKey).(LogContext)
	return logCtx, ok
}

// CreateRequestContext creates a new request context
func CreateRequestContext(requestID string) LogContext {
	if requestID == "" {
		requestID = uuid.New().String()
	}

	return LogContext{
		RequestID: requestID,
		TraceID:   uuid.New().String(),
	}
}
