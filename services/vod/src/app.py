from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
import time
import structlog

from src.core.config import settings
from src.core.exceptions import setup_exception_handlers
from src.middleware.auth import AuthMiddleware
from src.middleware.rate_limit import RateLimitMiddleware
from src.middleware.request_logging import RequestLoggingMiddleware
from src.api.v1 import api_router
from src.utils.logger import logger


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    app = FastAPI(
        title="VOD Service",
        description="Production-ready Video-on-Demand service with transcoding and CDN integration",
        version="1.0.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan
    )

    # Security middleware
    if settings.ENVIRONMENT == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS
        )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
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

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        from src.core.database import get_db_health
        from src.core.redis import get_redis_health
        
        db_health = await get_db_health()
        redis_health = await get_redis_health()
        
        health_status = {
            "status": "healthy" if db_health and redis_health else "unhealthy",
            "timestamp": time.time(),
            "service": "vod",
            "version": "1.0.0",
            "checks": {
                "database": "up" if db_health else "down",
                "redis": "up" if redis_health else "down",
                "storage": "up"  # Would check S3 connectivity in real implementation
            }
        }
        
        status_code = 200 if health_status["status"] == "healthy" else 503
        return JSONResponse(content=health_status, status_code=status_code)

    # Metrics endpoint
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    # API routes
    app.include_router(api_router, prefix="/api/v1")

    # Request timing middleware
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response

    return app


# Import lifespan here to avoid circular imports
from src.main import lifespan

app = create_app()
