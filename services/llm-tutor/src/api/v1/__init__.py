"""
API v1 router initialization
"""

from fastapi import APIRouter
from .conversations import router as conversations_router
from .auth import router as auth_router
from .users import router as users_router
from .voice import router as voice_router
from .analytics import router as analytics_router
from .admin import router as admin_router

# Create main API router
router = APIRouter()

# Include sub-routers
router.include_router(
    conversations_router,
    prefix="/conversations",
    tags=["conversations"]
)

router.include_router(
    auth_router,
    prefix="/auth",
    tags=["authentication"]
)

router.include_router(
    users_router,
    prefix="/users",
    tags=["users"]
)

router.include_router(
    voice_router,
    prefix="/voice",
    tags=["voice"]
)

router.include_router(
    analytics_router,
    prefix="/analytics",
    tags=["analytics"]
)

router.include_router(
    admin_router,
    prefix="/admin",
    tags=["admin"]
)