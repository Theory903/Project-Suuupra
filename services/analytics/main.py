"""
Analytics Service - Real-time data collection and business intelligence
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from src.config import get_settings
from src.database import init_db, get_db
from src.redis_client import init_redis, get_redis
from src.services.event_collector import EventCollector
from src.services.analytics_engine import AnalyticsEngine
from src.services.real_time_processor import RealTimeProcessor
from src.api.v1 import events, dashboards, reports, health
from src.middleware.auth import auth_middleware
from src.middleware.metrics import MetricsMiddleware
from src.utils.logger import setup_logger

settings = get_settings()
logger = setup_logger(__name__)

# Global services
event_collector: EventCollector = None
analytics_engine: AnalyticsEngine = None
real_time_processor: RealTimeProcessor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    global event_collector, analytics_engine, real_time_processor
    
    logger.info("Starting Analytics Service", extra={
        "service": "analytics",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    })
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Initialize Redis
    await init_redis()
    logger.info("Redis initialized")
    
    # Initialize services
    db = next(get_db())
    redis = await get_redis()
    
    event_collector = EventCollector(db, redis, settings)
    analytics_engine = AnalyticsEngine(db, redis, settings)
    real_time_processor = RealTimeProcessor(db, redis, settings)
    
    # Start background processing
    asyncio.create_task(event_collector.start_processing())
    asyncio.create_task(analytics_engine.start_aggregation_tasks())
    asyncio.create_task(real_time_processor.start_real_time_processing())
    
    logger.info("Analytics service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down Analytics Service")
    if event_collector:
        await event_collector.cleanup()
    if analytics_engine:
        await analytics_engine.cleanup()
    if real_time_processor:
        await real_time_processor.cleanup()

app = FastAPI(
    title="Suuupra Analytics Service",
    description="Real-time data collection and business intelligence platform",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(MetricsMiddleware)

# Authentication middleware
@app.middleware("http")
async def auth_middleware_handler(request, call_next):
    return await auth_middleware(request, call_next, settings.JWT_SECRET)

# API Routes
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(events.router, prefix="/api/v1/events", tags=["Events"])
app.include_router(dashboards.router, prefix="/api/v1/dashboards", tags=["Dashboards"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Suuupra Analytics Service",
        "version": "1.0.0",
        "status": "running",
        "environment": settings.ENVIRONMENT,
        "features": [
            "Real-time event collection",
            "Business intelligence dashboards",
            "Custom reports and analytics",
            "User behavior tracking",
            "Performance monitoring"
        ]
    }

# Event collection endpoint (high-throughput)
@app.post("/api/v1/track")
async def track_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    collector: EventCollector = Depends(lambda: event_collector)
):
    """High-performance event tracking endpoint"""
    background_tasks.add_task(collector.collect_event, event_data)
    return {"status": "accepted", "timestamp": datetime.utcnow().isoformat()}

# Real-time analytics endpoint
@app.get("/api/v1/real-time/{metric}")
async def get_real_time_metric(
    metric: str,
    time_window: int = Query(default=300, description="Time window in seconds"),
    processor: RealTimeProcessor = Depends(lambda: real_time_processor)
):
    """Get real-time metrics"""
    data = await processor.get_real_time_metric(metric, time_window)
    return {"metric": metric, "time_window": time_window, "data": data}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(settings.PORT),
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )
