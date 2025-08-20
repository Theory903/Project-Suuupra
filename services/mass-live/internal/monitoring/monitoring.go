package monitoring

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"mass-live/internal/config"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
)

// Custom Prometheus metrics
var (
	activeStreamsGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "mass_live_active_streams_total",
			Help: "Total number of active streams",
		},
		[]string{"quality"},
	)

	totalViewersGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "mass_live_total_viewers",
			Help: "Total number of viewers across all streams",
		},
		[]string{"stream_id"},
	)

	bandwidthCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "mass_live_bandwidth_bytes_total",
			Help: "Total bandwidth usage in bytes",
		},
		[]string{"direction", "quality"},
	)
)

func initCustomMetrics() {
	prometheus.MustRegister(activeStreamsGauge)
	prometheus.MustRegister(totalViewersGauge)
	prometheus.MustRegister(bandwidthCounter)
}

type Monitoring struct {
	config *config.Config
	logger *slog.Logger
}

func New(cfg *config.Config) *Monitoring {
	logger := slog.Default()

	return &Monitoring{
		config: cfg,
		logger: logger,
	}
}

func (m *Monitoring) Start() {
	m.logger.Info("Starting monitoring services")
	// Initialize Prometheus metrics, Jaeger tracing, etc.

	// Start Prometheus metrics server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		metricsPort := ":9090"
		if m.config.MetricsPort != "" {
			metricsPort = ":" + m.config.MetricsPort
		}

		m.logger.Info("Starting Prometheus metrics server", "port", metricsPort)
		if err := http.ListenAndServe(metricsPort, nil); err != nil {
			m.logger.Error("Failed to start metrics server", "error", err)
		}
	}()

	// Initialize Jaeger tracing
	if m.config.JaegerEndpoint != "" {
		// Basic OpenTelemetry setup for tracing
		ctx := context.Background()

		exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(m.config.JaegerEndpoint)))
		if err != nil {
			m.logger.Error("Failed to create Jaeger exporter", "error", err)
			return
		}

		tp := trace.NewTracerProvider(
			trace.WithBatcher(exp),
			trace.WithResource(resource.NewWithAttributes(
				semconv.SchemaURL,
				semconv.ServiceNameKey.String("mass-live"),
				semconv.ServiceVersionKey.String("1.0.0"),
			)),
		)

		otel.SetTracerProvider(tp)
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		))

		m.logger.Info("Jaeger tracing initialized", "endpoint", m.config.JaegerEndpoint)
	}

	// Initialize custom metrics
	initCustomMetrics()
}

func (m *Monitoring) Stop() {
	m.logger.Info("Stopping monitoring services")
	// Cleanup monitoring resources

	// Shutdown tracing provider if initialized
	if tp := otel.GetTracerProvider(); tp != nil {
		if tracerProvider, ok := tp.(*trace.TracerProvider); ok {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := tracerProvider.Shutdown(ctx); err != nil {
				m.logger.Error("Failed to shutdown tracer provider", "error", err)
			} else {
				m.logger.Info("Tracer provider shutdown successfully")
			}
		}
	}

	m.logger.Info("Monitoring services stopped")
}
