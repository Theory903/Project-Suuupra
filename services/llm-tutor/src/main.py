"""
LLM Tutor Service - Main Application Entry Point
Production-ready FastAPI application for AI-powered educational tutoring
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import make_asgi_app

from .config.settings import Settings
from .api.v1 import router as api_v1_router
from .core.database import init_db
from .core.redis import init_redis
from .core.exceptions import setup_exception_handlers
from .middleware.auth import AuthMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.request_logging import RequestLoggingMiddleware
from .observability.metrics import init_metrics
from .services.model_manager import ModelManager

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Global settings
settings = Settings()

def setup_tracing():
    """Configure OpenTelemetry tracing for distributed observability"""
    if not settings.JAEGER_ENDPOINT:
        return
    
    resource = Resource(attributes={
        "service.name": "llm-tutor",
        "service.version": "1.0.0",
    })
    
    trace.set_tracer_provider(TracerProvider(resource=resource))
    tracer = trace.get_tracer(__name__)
    
    jaeger_exporter = JaegerExporter(
        agent_host_name=settings.JAEGER_HOST,
        agent_port=settings.JAEGER_PORT,
    )
    
    span_processor = BatchSpanProcessor(jaeger_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown tasks"""
    logger.info("Starting LLM Tutor service...")
    
    # Initialize core services
    await init_db()
    await init_redis()
    init_metrics()
    
    # Initialize AI/ML models
    model_manager = ModelManager(settings)
    await model_manager.initialize()
    app.state.model_manager = model_manager
    
    # Setup OpenTelemetry instrumentation
    if settings.ENABLE_TRACING:
        setup_tracing()
        FastAPIInstrumentor.instrument_app(app)
        RedisInstrumentor().instrument()
        SQLAlchemyInstrumentor().instrument()
    
    logger.info("LLM Tutor service started successfully")
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down LLM Tutor service...")
    
    if hasattr(app.state, 'model_manager'):
        await app.state.model_manager.cleanup()
    
    logger.info("LLM Tutor service shutdown complete")

def create_app() -> FastAPI:
    """Create and configure the FastAPI application"""
    
    app = FastAPI(
        title="LLM Tutor Service",
        description="AI-powered educational tutoring service with RAG and voice capabilities",
        version="1.0.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )
    
    # Security middleware
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=settings.ALLOWED_HOSTS.split(",") if settings.ALLOWED_HOSTS else ["*"]
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Custom middleware
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(AuthMiddleware)
    
    # Exception handlers
    setup_exception_handlers(app)
    
    # API routes
    app.include_router(api_v1_router, prefix="/api/v1")
    
    # Health check endpoints
    @app.get("/health")
    async def health_check():
        """Basic health check endpoint"""
        return {"status": "healthy", "service": "llm-tutor"}
    
    @app.get("/ready")
    async def readiness_check(request: Request):
        """Readiness check for Kubernetes"""
        checks = {}
        
        # Check model availability
        if hasattr(request.app.state, 'model_manager'):
            model_manager = request.app.state.model_manager
            checks["llm_model"] = model_manager.is_llm_ready()
            checks["embedding_model"] = model_manager.is_embedding_ready()
        else:
            checks["models"] = False
        
        # Check database connectivity
        try:
            from .core.database import get_db_session
            async with get_db_session() as session:
                await session.execute("SELECT 1")
            checks["database"] = True
        except Exception as e:
            logger.error("Database health check failed", error=str(e))
            checks["database"] = False
        
        # Check Redis connectivity
        try:
            from .core.redis import get_redis
            redis = await get_redis()
            await redis.ping()
            checks["redis"] = True
        except Exception as e:
            logger.error("Redis health check failed", error=str(e))
            checks["redis"] = False
        
        all_healthy = all(checks.values())
        status_code = 200 if all_healthy else 503
        
        return JSONResponse(
            content={
                "status": "ready" if all_healthy else "not_ready",
                "checks": checks
            },
            status_code=status_code
        )
    
    # Prometheus metrics endpoint
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)
    
    return app

# Create the application instance
app = create_app()

if __name__ == "__main__":
    # Development server
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8092,
        reload=True,
        log_level="info",
        access_log=True,
    )
