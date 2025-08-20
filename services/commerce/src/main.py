"""
Commerce Service - FastAPI Application Entry Point

This service implements CQRS, Event Sourcing, and Saga patterns for
distributed order management and commerce operations.
"""

import logging
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# Add src directory to Python path for local development
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

import structlog
import uvicorn
import json
import time
from fastapi import FastAPI, Response
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
        # Implement actual readiness checks for database, redis, etc.
        import asyncio
        import asyncpg
        import aioredis
        import httpx
        import os
        from contextlib import asynccontextmanager
        
        checks = {}
        is_ready = True
        
        # Check database connection
        try:
            db_url = os.getenv('DATABASE_URL')
            if db_url:
                async with asyncpg.connect(db_url) as conn:
                    await conn.fetchval('SELECT 1')
                checks['database'] = 'ok'
            else:
                checks['database'] = 'not_configured'
                is_ready = False
        except Exception as e:
            checks['database'] = f'error: {str(e)}'
            is_ready = False
        
        # Check Redis connection
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            redis_client = aioredis.from_url(redis_url)
            await redis_client.ping()
            await redis_client.close()
            checks['redis'] = 'ok'
        except Exception as e:
            checks['redis'] = f'error: {str(e)}'
            is_ready = False
        
        # Check payments service connectivity
        try:
            payments_url = os.getenv('PAYMENTS_SERVICE_URL', 'http://localhost:8083')
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f'{payments_url}/health')
                if response.status_code == 200:
                    checks['payments_service'] = 'ok'
                else:
                    checks['payments_service'] = f'unhealthy: status {response.status_code}'
                    is_ready = False
        except Exception as e:
            checks['payments_service'] = f'unreachable: {str(e)}'
            is_ready = False
        
        # Check notifications service connectivity
        try:
            notifications_url = os.getenv('NOTIFICATIONS_SERVICE_URL', 'http://localhost:8087')
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f'{notifications_url}/health')
                if response.status_code == 200:
                    checks['notifications_service'] = 'ok'
                else:
                    checks['notifications_service'] = f'unhealthy: status {response.status_code}'
        except Exception as e:
            checks['notifications_service'] = f'unreachable: {str(e)}'
        
        # Check inventory service connectivity (if configured)
        try:
            inventory_url = os.getenv('INVENTORY_SERVICE_URL')
            if inventory_url:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f'{inventory_url}/health')
                    if response.status_code == 200:
                        checks['inventory_service'] = 'ok'
                    else:
                        checks['inventory_service'] = f'unhealthy: status {response.status_code}'
            else:
                checks['inventory_service'] = 'not_configured'
        except Exception as e:
            checks['inventory_service'] = f'unreachable: {str(e)}'
        
        # Check shipping service connectivity (if configured)
        try:
            shipping_url = os.getenv('SHIPPING_SERVICE_URL')
            if shipping_url:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f'{shipping_url}/health')
                    if response.status_code == 200:
                        checks['shipping_service'] = 'ok'
                    else:
                        checks['shipping_service'] = f'unhealthy: status {response.status_code}'
            else:
                checks['shipping_service'] = 'not_configured'
        except Exception as e:
            checks['shipping_service'] = f'unreachable: {str(e)}'
        
        status_code = 200 if is_ready else 503
        return Response(
            content=json.dumps({
                "status": "ready" if is_ready else "not_ready",
                "service": "commerce", 
                "checks": checks,
                "timestamp": time.time()
            }),
            status_code=status_code,
            media_type="application/json"
        )
    
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

