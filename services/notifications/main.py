"""
Notifications Service - Multi-channel notification delivery system
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from src.config import get_settings
from src.database import init_db, get_db
from src.redis_client import init_redis, get_redis
from src.services.notification_engine import NotificationEngine
from src.services.template_manager import TemplateManager
from src.services.delivery_manager import DeliveryManager
from src.services.preference_manager import PreferenceManager
from src.api.v1 import notifications, templates, preferences, analytics, health
from src.middleware.auth import auth_middleware
from src.middleware.metrics import MetricsMiddleware
from src.utils.logger import setup_logger

settings = get_settings()
logger = setup_logger(__name__)

# Global services
notification_engine: NotificationEngine = None
template_manager: TemplateManager = None
delivery_manager: DeliveryManager = None
preference_manager: PreferenceManager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    global notification_engine, template_manager, delivery_manager, preference_manager
    
    logger.info("Starting Notifications Service", extra={
        "service": "notifications",
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
    
    template_manager = TemplateManager(db, redis, settings)
    preference_manager = PreferenceManager(db, redis, settings)
    delivery_manager = DeliveryManager(db, redis, settings)
    notification_engine = NotificationEngine(
        db, redis, settings, template_manager, delivery_manager, preference_manager
    )
    
    # Initialize templates and providers
    await template_manager.initialize()
    await delivery_manager.initialize_providers()
    
    # Start background processing
    asyncio.create_task(notification_engine.start_processing())
    asyncio.create_task(delivery_manager.start_delivery_workers())
    
    logger.info("Notifications service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down Notifications Service")
    if notification_engine:
        await notification_engine.cleanup()
    if delivery_manager:
        await delivery_manager.cleanup()

app = FastAPI(
    title="Suuupra Notifications Service",
    description="Multi-channel notification delivery system with templates and preferences",
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
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["Templates"])
app.include_router(preferences.router, prefix="/api/v1/preferences", tags=["Preferences"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Suuupra Notifications Service",
        "version": "1.0.0",
        "status": "running",
        "environment": settings.ENVIRONMENT,
        "channels": ["email", "push", "sms", "in_app", "webhook"],
        "features": [
            "Multi-channel delivery",
            "Template management",
            "User preferences",
            "Delivery tracking",
            "A/B testing",
            "Scheduled notifications"
        ]
    }

# High-throughput notification sending
@app.post("/api/v1/send")
async def send_notification(
    notification_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    engine: NotificationEngine = Depends(lambda: notification_engine)
):
    """High-performance notification sending endpoint"""
    background_tasks.add_task(engine.send_notification, notification_data)
    return {"status": "queued", "timestamp": datetime.utcnow().isoformat()}

# Bulk notification sending
@app.post("/api/v1/send/bulk")
async def send_bulk_notifications(
    notifications: List[Dict[str, Any]],
    background_tasks: BackgroundTasks,
    engine: NotificationEngine = Depends(lambda: notification_engine)
):
    """Bulk notification sending endpoint"""
    background_tasks.add_task(engine.send_bulk_notifications, notifications)
    return {
        "status": "queued",
        "count": len(notifications),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(settings.PORT),
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )
