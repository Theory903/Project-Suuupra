import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import get_settings
from src.database import init_db, get_db
from src.redis_client import init_redis, get_redis
from src.models import engine
from src.api.v1 import recommendations, analytics, health, admin
from src.services.recommendation_engine import RecommendationEngine
from src.services.model_trainer import ModelTrainer
from src.middleware.auth import auth_middleware
from src.middleware.metrics import MetricsMiddleware
from src.middleware.logging import LoggingMiddleware
from src.utils.logger import setup_logger

settings = get_settings()
logger = setup_logger(__name__)

# Global services
recommendation_engine: RecommendationEngine = None
model_trainer: ModelTrainer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    global recommendation_engine, model_trainer
    
    logger.info("Starting Recommendation Service", extra={
        "service": "recommendations",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    })
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Initialize Redis
    await init_redis()
    logger.info("Redis initialized")
    
    # Initialize recommendation engine
    db = next(get_db())
    redis = await get_redis()
    
    recommendation_engine = RecommendationEngine(db, redis, settings)
    await recommendation_engine.initialize()
    logger.info("Recommendation engine initialized")
    
    # Initialize model trainer
    model_trainer = ModelTrainer(db, redis, settings)
    logger.info("Model trainer initialized")
    
    # Start background tasks
    asyncio.create_task(recommendation_engine.start_background_tasks())
    asyncio.create_task(model_trainer.start_training_scheduler())
    
    logger.info("Recommendation service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down Recommendation Service")
    if recommendation_engine:
        await recommendation_engine.cleanup()
    if model_trainer:
        await model_trainer.cleanup()

app = FastAPI(
    title="Suuupra Recommendation Service",
    description="ML-powered recommendation engine for personalized content discovery",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Security middleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

# CORS middleware
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Custom middleware
app.add_middleware(MetricsMiddleware)
app.add_middleware(LoggingMiddleware)

# Authentication middleware (except for health endpoints)
@app.middleware("http")
async def auth_middleware_handler(request, call_next):
    return await auth_middleware(request, call_next, settings.JWT_SECRET)

# API Routes
app.include_router(
    health.router,
    prefix="/health",
    tags=["Health"]
)

app.include_router(
    recommendations.router,
    prefix="/api/v1/recommendations",
    tags=["Recommendations"]
)

app.include_router(
    analytics.router,
    prefix="/api/v1/analytics",
    tags=["Analytics"]
)

app.include_router(
    admin.router,
    prefix="/api/v1/admin",
    tags=["Admin"]
)

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Suuupra Recommendation Service",
        "version": "1.0.0",
        "status": "running",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.ENVIRONMENT != "production" else None,
        "health": "/health",
        "metrics": "/metrics"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", extra={
        "path": request.url.path,
        "method": request.method,
        "exception": str(exc)
    })
    return HTTPException(status_code=500, detail="Internal server error")

def get_recommendation_engine() -> RecommendationEngine:
    """Dependency to get recommendation engine instance"""
    if not recommendation_engine:
        raise HTTPException(status_code=503, detail="Recommendation engine not initialized")
    return recommendation_engine

def get_model_trainer() -> ModelTrainer:
    """Dependency to get model trainer instance"""
    if not model_trainer:
        raise HTTPException(status_code=503, detail="Model trainer not initialized")
    return model_trainer

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(settings.PORT),
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True
    )
