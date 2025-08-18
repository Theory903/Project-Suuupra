"""
Voice processing API endpoints for the LLM Tutor service
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import structlog
import io
from datetime import datetime

from ...core.database import get_db_session
from ...middleware.auth import get_current_user, get_optional_user
from ...services.voice_service import VoiceService
from ...services.safety_service import SafetyService
from ...observability.metrics import get_metrics
from ...models.user import User
from ... import schemas

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.post("/transcribe", response_model=schemas.TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto"),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Transcribe audio file to text using ASR"""
    
    start_time = datetime.utcnow()
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an audio file"
            )
        
        # Check file size (limit to 25MB)
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if file_size > 25 * 1024 * 1024:  # 25MB limit
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio file too large (max 25MB)"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        voice_service = VoiceService()
        
        # Transcribe audio
        transcription_result = await voice_service.transcribe_audio_detailed(
            file, 
            language=language if language != "auto" else None
        )
        
        # Safety check
        safety_service = SafetyService()
        if not safety_service.is_input_safe(transcription_result["text"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transcribed content contains inappropriate material"
            )
        
        # Record metrics
        metrics = get_metrics()
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_voice_metrics(
                operation="transcribe",
                duration=duration,
                quality_score=transcription_result.get("confidence", 0.0),
                model_name="whisper-large-v3",
                language=transcription_result.get("language", "unknown"),
                audio_duration=transcription_result.get("duration", 0.0),
                file_size=file_size
            )
        
        logger.info(
            "Audio transcribed",
            user_id=str(current_user.id) if current_user else "anonymous",
            file_size=file_size,
            duration=transcription_result.get("duration", 0.0),
            language=transcription_result.get("language", "unknown"),
            confidence=transcription_result.get("confidence", 0.0)
        )
        
        return schemas.TranscriptionResponse(
            text=transcription_result["text"],
            language=transcription_result.get("language", "unknown"),
            confidence=transcription_result.get("confidence", 0.0),
            duration=transcription_result.get("duration", 0.0),
            segments=transcription_result.get("segments", [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Transcription failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transcription failed"
        )

@router.post("/synthesize")
async def synthesize_speech(
    request: schemas.TTSRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Convert text to speech using TTS"""
    
    start_time = datetime.utcnow()
    
    try:
        # Validate text length
        if len(request.text) > 5000:  # 5000 character limit
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text too long (max 5000 characters)"
            )
        
        # Safety check
        safety_service = SafetyService()
        if not safety_service.is_output_safe(request.text):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text contains inappropriate content"
            )
        
        voice_service = VoiceService()
        
        # Generate speech
        audio_data = await voice_service.text_to_speech_detailed(
            request.text,
            voice_id=request.voice_id,
            speed=request.speed,
            language=request.language
        )
        
        # Record metrics
        metrics = get_metrics()
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_voice_metrics(
                operation="synthesize",
                duration=duration,
                quality_score=1.0,  # Assume high quality for TTS
                model_name=request.voice_id or "default",
                language=request.language or "en",
                text_length=len(request.text),
                audio_size=len(audio_data) if audio_data else 0
            )
        
        logger.info(
            "Speech synthesized",
            user_id=str(current_user.id) if current_user else "anonymous",
            text_length=len(request.text),
            voice_id=request.voice_id,
            language=request.language,
            audio_size=len(audio_data) if audio_data else 0
        )
        
        # Return audio as streaming response
        audio_stream = io.BytesIO(audio_data)
        
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=speech.wav",
                "Content-Length": str(len(audio_data))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Speech synthesis failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Speech synthesis failed"
        )

@router.get("/voices", response_model=schemas.VoiceListResponse)
async def list_available_voices():
    """Get list of available TTS voices"""
    
    try:
        voice_service = VoiceService()
        voices = await voice_service.list_available_voices()
        
        return schemas.VoiceListResponse(
            voices=[
                schemas.VoiceInfo(
                    id=voice["id"],
                    name=voice["name"],
                    language=voice["language"],
                    gender=voice.get("gender", "unknown"),
                    description=voice.get("description", "")
                )
                for voice in voices
            ]
        )
        
    except Exception as e:
        logger.error("Failed to list voices", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve voice list"
        )

@router.post("/clone-voice")
async def clone_voice(
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Clone a voice from audio sample (premium feature)"""
    
    try:
        # Check if user has premium access
        if not current_user.is_premium:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Voice cloning requires premium subscription"
            )
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an audio file"
            )
        
        # Check file size (limit to 10MB for voice cloning)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio file too large (max 10MB)"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        voice_service = VoiceService()
        
        # Clone voice (this would be implemented with actual voice cloning service)
        voice_id = await voice_service.clone_voice(
            file,
            voice_name=voice_name,
            user_id=str(current_user.id),
            description=description
        )
        
        logger.info(
            "Voice cloned",
            user_id=str(current_user.id),
            voice_name=voice_name,
            voice_id=voice_id
        )
        
        return {
            "voice_id": voice_id,
            "voice_name": voice_name,
            "message": "Voice cloning completed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Voice cloning failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Voice cloning failed"
        )

@router.delete("/voices/{voice_id}")
async def delete_cloned_voice(
    voice_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a user's cloned voice"""
    
    try:
        voice_service = VoiceService()
        
        # Verify voice ownership
        success = await voice_service.delete_cloned_voice(
            voice_id,
            user_id=str(current_user.id)
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Voice not found or not owned by user"
            )
        
        logger.info(
            "Cloned voice deleted",
            user_id=str(current_user.id),
            voice_id=voice_id
        )
        
        return {"message": "Voice deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete voice", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete voice"
        )
