from fastapi import APIRouter

from src.api.v1.videos import router as videos_router
from src.api.v1.upload import router as upload_router
from src.api.v1.streaming import router as streaming_router
from src.api.v1.analytics import router as analytics_router
from src.api.v1.admin import router as admin_router

api_router = APIRouter()

# Include all route modules
api_router.include_router(videos_router, prefix="/videos", tags=["videos"])
api_router.include_router(upload_router, prefix="/upload", tags=["upload"])
api_router.include_router(streaming_router, prefix="/stream", tags=["streaming"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
