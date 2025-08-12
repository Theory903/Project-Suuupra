"""
Prometheus metrics for Commerce Service.

Defines and manages application metrics for observability.
"""

from prometheus_client import Counter, Histogram, Gauge, Info

# Application info
app_info = Info("commerce_service_info", "Commerce service information")

# HTTP metrics
http_requests_total = Counter(
    "commerce_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"]
)

http_request_duration_seconds = Histogram(
    "commerce_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"]
)

# Cart metrics
cart_operations_total = Counter(
    "commerce_cart_operations_total",
    "Total cart operations",
    ["operation", "status"]
)

active_carts_gauge = Gauge(
    "commerce_active_carts",
    "Number of active shopping carts"
)

cart_abandonment_total = Counter(
    "commerce_cart_abandonment_total",
    "Total abandoned carts"
)

# Order metrics
orders_total = Counter(
    "commerce_orders_total",
    "Total orders created",
    ["status"]
)

order_processing_duration_seconds = Histogram(
    "commerce_order_processing_duration_seconds",
    "Order processing duration in seconds",
    ["status"]
)

order_value_histogram = Histogram(
    "commerce_order_value_usd",
    "Order values in USD",
    buckets=[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
)

# Saga metrics
saga_executions_total = Counter(
    "commerce_saga_executions_total",
    "Total saga executions",
    ["saga_type", "status"]
)

saga_step_duration_seconds = Histogram(
    "commerce_saga_step_duration_seconds",
    "Saga step execution duration",
    ["saga_type", "step_name", "status"]
)

saga_compensations_total = Counter(
    "commerce_saga_compensations_total",
    "Total saga compensations",
    ["saga_type", "step_name"]
)

# Event store metrics
events_stored_total = Counter(
    "commerce_events_stored_total",
    "Total events stored",
    ["event_type", "aggregate_type"]
)

event_store_latency_seconds = Histogram(
    "commerce_event_store_latency_seconds",
    "Event store operation latency",
    ["operation"]
)

# External service metrics
external_service_requests_total = Counter(
    "commerce_external_service_requests_total",
    "Total external service requests",
    ["service", "operation", "status"]
)

external_service_duration_seconds = Histogram(
    "commerce_external_service_duration_seconds",
    "External service request duration",
    ["service", "operation"]
)


def setup_metrics() -> None:
    """Initialize application metrics."""
    app_info.info({
        "version": "1.0.0",
        "service": "commerce",
        "description": "Commerce microservice with CQRS and Event Sourcing"
    })

