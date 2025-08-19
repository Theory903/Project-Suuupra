package tracing

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

// InitTracer initializes OpenTelemetry tracing
func InitTracer(serviceName, otlpEndpoint string) (func(), error) {
	// Create OTLP gRPC exporter
	ctx := context.Background()
	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithEndpoint(otlpEndpoint), otlptracegrpc.WithInsecure())
	if err != nil {
		return nil, fmt.Errorf("failed to create otlp exporter: %w", err)
	}

	// Create resource
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion("1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace provider
	tp := trace.NewTracerProvider(
		trace.WithBatcher(exporter),
		trace.WithResource(res),
		trace.WithSampler(trace.AlwaysSample()),
	)

	// Set global trace provider
	otel.SetTracerProvider(tp)

	// Set global text map propagator
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Return cleanup function
	return func() {
		ctx := context.Background()
		if err := tp.Shutdown(ctx); err != nil {
			fmt.Printf("Error shutting down tracer provider: %v\n", err)
		}
	}, nil
}
