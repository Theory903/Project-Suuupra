"""
OpenTelemetry tracing setup for Commerce Service.

Configures distributed tracing for observability.
"""

from typing import Optional
import structlog
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.sdk.resources import Resource

from ..config.settings import Settings

logger = structlog.get_logger(__name__)


def setup_tracing(settings: Settings) -> None:
    """
    Set up OpenTelemetry tracing.
    
    Args:
        settings: Application settings
    """
    if not settings.enable_tracing:
        logger.info("Tracing disabled")
        return
    
    logger.info("Setting up OpenTelemetry tracing")
    
    # Create resource
    resource = Resource.create({
        "service.name": settings.service_name,
        "service.version": "1.0.0",
        "deployment.environment": settings.environment,
    })
    
    # Create tracer provider
    tracer_provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(tracer_provider)
    
    # Add span processors
    if settings.jaeger_endpoint:
        # OTLP exporter for Jaeger
        otlp_exporter = OTLPSpanExporter(
            endpoint=f"{settings.jaeger_endpoint}/v1/traces",
        )
        tracer_provider.add_span_processor(
            BatchSpanProcessor(otlp_exporter)
        )
        logger.info("OTLP exporter configured", endpoint=settings.jaeger_endpoint)
    
    # Auto-instrument libraries
    FastAPIInstrumentor().instrument()
    AsyncPGInstrumentor().instrument()
    RedisInstrumentor().instrument()
    
    logger.info("OpenTelemetry tracing configured successfully")


def get_tracer(name: str) -> trace.Tracer:
    """Get a tracer instance."""
    return trace.get_tracer(name)

