"""
API v1 package
Main router for all v1 endpoints
"""

from fastapi import APIRouter
from .conversations import router as conversations_router

# Create main v1 router
router = APIRouter()

# Include all sub-routers
router.include_router(conversations_router)

# Add other routers as they're created
# router.include_router(users_router)
# router.include_router(analytics_router)
# router.include_router(voice_router)

__all__ = ["router"]
