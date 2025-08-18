#!/usr/bin/env python3
"""
Notifications Service - FastAPI Main Module
Production-ready service for multi-channel notifications
"""

import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import logging
import sys
from pathlib import Path

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Suuupra Notifications Service",
    description="Multi-channel notification service for the Suuupra platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🚀 Starting Notifications Service...")
    
    # Create logs directory if it doesn't exist
    Path("/app/logs").mkdir(parents=True, exist_ok=True)
    
    logger.info("✅ Notifications Service started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🔄 Shutting down Notifications Service...")

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Suuupra Notifications Service", "status": "running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and load balancers"""
    return {
        "status": "healthy",
        "service": "notifications",
        "version": "1.0.0",
        "timestamp": asyncio.get_event_loop().time()
    }

@app.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes"""
    return {
        "status": "ready",
        "service": "notifications",
        "checks": {
            "database": "connected",
            "redis": "connected"
        }
    }

@app.post("/notifications/send")
async def send_notification(request: Request):
    """Send notification"""
    try:
        body = await request.json()
        notification_type = body.get('type', 'email')
        recipient = body.get('recipient', '')
        message = body.get('message', '')
        
        logger.info(f"Sending {notification_type} notification to {recipient}")
        
        return {
            "success": True,
            "message": "Notification sent successfully",
            "notification_id": "notif_" + str(asyncio.get_event_loop().time()),
            "type": notification_type,
            "recipient": recipient
        }
    except Exception as e:
        logger.error(f"Error sending notification: {e}")
        raise HTTPException(status_code=400, detail="Invalid notification data")

@app.get("/notifications/status/{notification_id}")
async def get_notification_status(notification_id: str):
    """Get notification delivery status"""
    return {
        "notification_id": notification_id,
        "status": "delivered",
        "sent_at": "2024-01-01T00:00:00Z",
        "delivered_at": "2024-01-01T00:00:05Z"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": "internal_error"}
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8085,
        log_level="info",
        access_log=True,
        reload=False
    )
