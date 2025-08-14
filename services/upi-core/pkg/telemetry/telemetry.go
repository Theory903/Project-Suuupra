package telemetry

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"

	"upi-core/internal/config"
)

// Init initializes telemetry (tracing and metrics)
func Init(cfg config.TelemetryConfig) (func(), error) {
	// Create resource
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion("1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	var shutdownFuncs []func() error

	// Initialize tracing
	if cfg.JaegerEndpoint != "" {
		tracerShutdown, err := initTracing(res, cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize tracing: %w", err)
		}
		shutdownFuncs = append(shutdownFuncs, tracerShutdown)
	}

	// Initialize metrics
	if cfg.MetricsPort > 0 {
		meterShutdown, err := initMetrics(res, cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize metrics: %w", err)
		}
		shutdownFuncs = append(shutdownFuncs, meterShutdown)
	}

	// Return shutdown function
	return func() {
		for _, shutdown := range shutdownFuncs {
			if err := shutdown(); err != nil {
				fmt.Printf("Error shutting down telemetry: %v\n", err)
			}
		}
	}, nil
}

func initTracing(res *resource.Resource, cfg config.TelemetryConfig) (func() error, error) {
	// Create Jaeger exporter
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(cfg.JaegerEndpoint)))
	if err != nil {
		return nil, fmt.Errorf("failed to create Jaeger exporter: %w", err)
	}

	// Create trace provider
	tp := trace.NewTracerProvider(
		trace.WithBatcher(exp),
		trace.WithResource(res),
		trace.WithSampler(trace.TraceIDRatioBased(cfg.SampleRate)),
	)

	// Set global trace provider
	otel.SetTracerProvider(tp)

	return func() error {
		return tp.Shutdown(context.Background())
	}, nil
}

func initMetrics(res *resource.Resource, cfg config.TelemetryConfig) (func() error, error) {
	// Create Prometheus exporter
	exp, err := prometheus.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus exporter: %w", err)
	}

	// Create meter provider
	mp := metric.NewMeterProvider(
		metric.WithResource(res),
		metric.WithReader(exp),
	)

	// Set global meter provider
	otel.SetMeterProvider(mp)

	return func() error {
		return mp.Shutdown(context.Background())
	}, nil
}
