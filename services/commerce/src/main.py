"""
Commerce Service - FastAPI Application Entry Point

This service implements CQRS, Event Sourcing, and Saga patterns for
distributed order management and commerce operations.
"""

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import make_asgi_app

from commerce.api.v1.router import api_router
from commerce.config.settings import get_settings
from commerce.infrastructure.database import init_database, close_database
from commerce.infrastructure.redis import init_redis, close_redis
from commerce.infrastructure.messaging.event_bus import init_event_bus, close_event_bus
from commerce.utils.logging import setup_logging
from commerce.utils.metrics import setup_metrics
from commerce.utils.tracing import setup_tracing


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan management."""
    settings = get_settings()
    
    # Setup logging
    setup_logging(settings.log_level)
    logger = structlog.get_logger(__name__)
    
    logger.info("Starting Commerce Service", version="1.0.0")
    
    try:
        # Initialize infrastructure
        await init_database(settings.database_url)
        await init_redis(settings.redis_url)
        await init_event_bus()
        
        # Setup observability
        setup_metrics()
        setup_tracing(settings)
        
        logger.info("Commerce Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error("Failed to start Commerce Service", error=str(e))
        sys.exit(1)
    finally:
        # Cleanup
        logger.info("Shutting down Commerce Service")
        await close_event_bus()
        await close_redis()
        await close_database()
        logger.info("Commerce Service shutdown complete")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="Commerce Service",
        description="Production-grade Commerce microservice with CQRS, Event Sourcing, and Saga patterns",
        version="1.0.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
        lifespan=lifespan,
    )
    
    # Add middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add routes
    app.include_router(api_router, prefix="/api/v1")
    
    # Add Prometheus metrics endpoint
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "commerce", "version": "1.0.0"}
    
    @app.get("/ready")
    async def readiness_check():
        # TODO: Add actual readiness checks for database, redis, etc.
        return {"status": "ready", "service": "commerce"}
    
    return app


app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.environment == "development",
        log_config=None,  # We handle logging ourselves
    )

