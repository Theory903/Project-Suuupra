from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from src.core.database import get_db
from src.models.video import Video, VideoStatus
from src.schemas.video import VideoResponse, VideoListResponse, VideoUpdateRequest
from src.services.video_service import VideoService
from src.middleware.auth import get_current_user, require_role
from src.utils.logger import logger

router = APIRouter()


@router.get("/", response_model=VideoListResponse)
async def list_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[VideoStatus] = Query(None),
    creator_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List videos with filtering and pagination."""
    try:
        video_service = VideoService(db)
        
        filters = {}
        if status:
            filters["status"] = status
        if creator_id:
            filters["creator_id"] = creator_id
        if search:
            filters["search"] = search
        
        videos, total = await video_service.list_videos(
            skip=skip,
            limit=limit,
            filters=filters
        )
        
        return VideoListResponse(
            videos=videos,
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Error listing videos: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get video details by ID."""
    try:
        video_service = VideoService(db)
        video = await video_service.get_video(video_id)
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        return VideoResponse.from_orm(video)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{video_id}", response_model=VideoResponse)
async def update_video(
    video_id: str = Path(..., description="Video ID"),
    update_data: VideoUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update video metadata."""
    try:
        video_service = VideoService(db)
        
        # Check if video exists and user has permission
        video = await video_service.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Check ownership or admin role
        if video.creator_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Permission denied")
        
        updated_video = await video_service.update_video(video_id, update_data.dict(exclude_unset=True))
        
        return VideoResponse.from_orm(updated_video)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{video_id}")
async def delete_video(
    video_id: str = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a video."""
    try:
        video_service = VideoService(db)
        
        # Check if video exists and user has permission
        video = await video_service.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Check ownership or admin role
        if video.creator_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Permission denied")
        
        success = await video_service.delete_video(video_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete video")
        
        return {"message": "Video deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{video_id}/transcode")
async def start_transcoding(
    video_id: str = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Start transcoding for a video."""
    try:
        video_service = VideoService(db)
        
        # Check if video exists and user has permission
        video = await video_service.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Check ownership or admin role
        if video.creator_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # Start transcoding
        success = await video_service.start_transcoding(video_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to start transcoding")
        
        return {"message": "Transcoding started successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting transcoding for video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{video_id}/transcoding/progress")
async def get_transcoding_progress(
    video_id: str = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get transcoding progress for a video."""
    try:
        video_service = VideoService(db)
        progress = await video_service.get_transcoding_progress(video_id)
        
        return {"video_id": video_id, **progress}
        
    except Exception as e:
        logger.error(f"Error getting transcoding progress for video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{video_id}/transcoding/cancel")
async def cancel_transcoding(
    video_id: str = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Cancel transcoding for a video."""
    try:
        video_service = VideoService(db)
        
        # Check if video exists and user has permission
        video = await video_service.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Check ownership or admin role
        if video.creator_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Permission denied")
        
        success = await video_service.cancel_transcoding(video_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to cancel transcoding")
        
        return {"message": "Transcoding cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling transcoding for video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{video_id}/qualities")
async def get_available_qualities(
    video_id: str = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get available quality levels for a video."""
    try:
        video_service = VideoService(db)
        qualities = await video_service.get_available_qualities(video_id)
        
        return {"video_id": video_id, "qualities": qualities}
        
    except Exception as e:
        logger.error(f"Error getting qualities for video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{video_id}/thumbnail/generate")
async def generate_thumbnail(
    video_id: str = Path(..., description="Video ID"),
    timestamp: Optional[int] = Query(None, description="Timestamp in seconds"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate thumbnail for a video."""
    try:
        video_service = VideoService(db)
        
        # Check if video exists and user has permission
        video = await video_service.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Check ownership or admin role
        if video.creator_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Permission denied")
        
        success = await video_service.generate_thumbnail(video_id, timestamp)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to generate thumbnail")
        
        return {"message": "Thumbnail generation started"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating thumbnail for video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/creator/{creator_id}", response_model=VideoListResponse)
async def get_creator_videos(
    creator_id: str = Path(..., description="Creator ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[VideoStatus] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get videos by creator."""
    try:
        video_service = VideoService(db)
        
        filters = {"creator_id": creator_id}
        if status:
            filters["status"] = status
        
        videos, total = await video_service.list_videos(
            skip=skip,
            limit=limit,
            filters=filters
        )
        
        return VideoListResponse(
            videos=videos,
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Error getting creator videos: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
