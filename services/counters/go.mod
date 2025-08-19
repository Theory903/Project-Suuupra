module github.com/suuupra/counters

go 1.21

require (
	github.com/go-chi/chi/v5 v5.0.11
	github.com/go-chi/cors v1.2.1
	github.com/lib/pq v1.10.9
	github.com/prometheus/client_golang v1.18.0
	github.com/redis/go-redis/v9 v9.3.0
	github.com/segmentio/kafka-go v0.4.40
	github.com/sirupsen/logrus v1.9.3
	go.opentelemetry.io/contrib/instrumentation/github.com/go-chi/chi/otelchi v0.48.0
	go.opentelemetry.io/otel v1.21.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.21.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.21.0
	go.opentelemetry.io/otel/sdk v1.21.0
	go.opentelemetry.io/otel/trace v1.21.0
	google.golang.org/grpc v1.60.0
	google.golang.org/protobuf v1.31.0
)