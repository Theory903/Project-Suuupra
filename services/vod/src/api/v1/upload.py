from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid
import os
import aiofiles

from src.core.database import get_db
from src.core.config import settings
from src.schemas.video import VideoCreateRequest, VideoResponse
from src.services.video_service import VideoService
from src.services.upload_service import UploadService
from src.middleware.auth import get_current_user
from src.utils.logger import logger

router = APIRouter()


@router.post("/video", response_model=VideoResponse)
async def upload_video(
    file: UploadFile = File(..., description="Video file to upload"),
    title: str = Form(..., description="Video title"),
    description: Optional[str] = Form(None, description="Video description"),
    is_public: bool = Form(True, description="Whether video is public"),
    enable_drm: bool = Form(False, description="Enable DRM protection"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload a new video file."""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Check file format
        file_extension = file.filename.split('.')[-1].lower()
        if file_extension not in settings.ALLOWED_VIDEO_FORMATS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported format. Allowed: {', '.join(settings.ALLOWED_VIDEO_FORMATS)}"
            )
        
        # Check file size
        if file.size and file.size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE // (1024*1024*1024)}GB"
            )
        
        upload_service = UploadService(db)
        video_service = VideoService(db)
        
        # Create video record
        video_data = VideoCreateRequest(
            title=title,
            description=description,
            creator_id=current_user.id,
            original_filename=file.filename,
            format=file_extension,
            is_public=is_public,
            enable_drm=enable_drm
        )
        
        # Process upload
        video = await upload_service.process_upload(file, video_data)
        
        logger.info(f"Video uploaded successfully: {video.id}")
        return VideoResponse.from_orm(video)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading video: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")


@router.post("/multipart/initiate")
async def initiate_multipart_upload(
    filename: str = Form(...),
    file_size: int = Form(...),
    content_type: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Initiate multipart upload for large files."""
    try:
        # Validate file size
        if file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE // (1024*1024*1024)}GB"
            )
        
        # Validate content type
        if not content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="Invalid content type")
        
        upload_service = UploadService(db)
        
        upload_info = await upload_service.initiate_multipart_upload(
            filename=filename,
            file_size=file_size,
            content_type=content_type,
            title=title,
            description=description,
            creator_id=current_user.id
        )
        
        return upload_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating multipart upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate upload")


@router.post("/multipart/{upload_id}/part")
async def upload_part(
    upload_id: str = Path(...),
    part_number: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload a part of multipart upload."""
    try:
        upload_service = UploadService(db)
        
        part_info = await upload_service.upload_part(
            upload_id=upload_id,
            part_number=part_number,
            file_data=await file.read(),
            user_id=current_user.id
        )
        
        return part_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading part: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload part")


@router.post("/multipart/{upload_id}/complete")
async def complete_multipart_upload(
    upload_id: str = Path(...),
    parts: list = Form(..., description="List of completed parts"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Complete multipart upload."""
    try:
        upload_service = UploadService(db)
        
        video = await upload_service.complete_multipart_upload(
            upload_id=upload_id,
            parts=parts,
            user_id=current_user.id
        )
        
        if not video:
            raise HTTPException(status_code=400, detail="Failed to complete upload")
        
        return VideoResponse.from_orm(video)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing multipart upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete upload")


@router.delete("/multipart/{upload_id}/abort")
async def abort_multipart_upload(
    upload_id: str = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Abort multipart upload."""
    try:
        upload_service = UploadService(db)
        
        success = await upload_service.abort_multipart_upload(
            upload_id=upload_id,
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to abort upload")
        
        return {"message": "Upload aborted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error aborting multipart upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to abort upload")


@router.get("/upload/{upload_id}/status")
async def get_upload_status(
    upload_id: str = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get upload status."""
    try:
        upload_service = UploadService(db)
        status = await upload_service.get_upload_status(upload_id, current_user.id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Upload not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting upload status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get upload status")
