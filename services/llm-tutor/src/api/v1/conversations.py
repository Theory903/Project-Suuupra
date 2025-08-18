"""
Conversation API endpoints for the LLM Tutor service
"""

from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import structlog
from datetime import datetime

from ...core.database import get_db_session
from ...core.exceptions import ConversationNotFoundError, UserNotAuthorizedError
from ...middleware.auth import get_current_user, get_optional_user
from ...services.conversation_manager import ConversationManager
from ...services.voice_service import VoiceService
from ...services.safety_service import SafetyService
from ...observability.tracing import get_tracer
from ...observability.metrics import get_metrics
from ...models.user import User
from ... import schemas

logger = structlog.get_logger(__name__)
router = APIRouter()

# Get global services
def get_tracer_service():
    try:
        from ...observability.tracing import get_tracer
        return get_tracer()
    except:
        return None

def get_metrics_service():
    try:
        from ...observability.metrics import get_metrics
        return get_metrics()
    except:
        return None

@router.post("/", response_model=schemas.ConversationStartResponse)
async def start_conversation(
    request: schemas.ConversationStartRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Start a new conversation with the AI tutor"""
    
    # Use user_id from request if no authenticated user (for backwards compatibility)
    user_id = str(current_user.id) if current_user else request.user_id
    
    tracer = get_tracer_service()
    metrics = get_metrics_service()
    
    # Tracing context
    if tracer:
        with tracer.trace_operation("conversation_start", user_id=user_id, subject=request.subject):
            pass
    
    # Metrics timing
    start_time = datetime.utcnow()
    
    try:
        conversation_manager = ConversationManager(db)
        conversation_id, created_at = await conversation_manager.create_conversation(
            user_id, 
            request.subject
        )
        
        logger.info(
            "Conversation started",
            conversation_id=conversation_id,
            user_id=user_id,
            subject=request.subject
        )
        
        # Record metrics
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_conversation_operation("start", duration, success=True)
        
        return schemas.ConversationStartResponse(
            conversation_id=conversation_id,
            created_at=created_at
        )
        
    except Exception as e:
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_conversation_operation("start", duration, success=False)
        raise

@router.post("/{conversation_id}/messages", response_model=schemas.PostMessageResponse)
async def post_message(
    conversation_id: str,
    request: schemas.PostMessageRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Post a text message to the conversation"""
    
    # Use user_id from request if no authenticated user (for backwards compatibility)
    user_id = str(current_user.id) if current_user else request.user_id
    
    tracer = get_tracer_service()
    metrics = get_metrics_service()
    
    # Tracing context
    if tracer:
        with tracer.trace_operation("message_processing", 
                                   conversation_id=conversation_id,
                                   user_id=user_id,
                                   message_type="text"):
            pass
    
    start_time = datetime.utcnow()
    
    try:
        # Safety check
        safety_service = SafetyService()
        if not safety_service.is_input_safe(request.message.text):
            raise HTTPException(
                status_code=400,
                detail="Message contains inappropriate content"
            )
        
        conversation_manager = ConversationManager(db)
        response_message = await conversation_manager.post_message(
            user_id, 
            conversation_id, 
            request.message
        )
        
        # Update learning progress in background
        background_tasks.add_task(
            conversation_manager.update_learning_progress,
            user_id,
            request.message.text,
            response_message.text
        )
        
        logger.info(
            "Message processed",
            conversation_id=conversation_id,
            user_id=user_id,
            input_length=len(request.message.text),
            output_length=len(response_message.text)
        )
        
        # Record metrics
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_conversation_operation("message", duration, success=True)
        
        return schemas.PostMessageResponse(
            message=response_message, 
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_conversation_operation("message", duration, success=False)
        raise

@router.post("/{conversation_id}/messages/voice", response_model=schemas.PostMessageResponse)
async def post_voice_message(
    conversation_id: str,
    user_id: str = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db_session)
):
    """Post a voice message to the conversation"""
    
    tracer = get_tracer_service()
    metrics = get_metrics_service()
    
    # Tracing context
    if tracer:
        with tracer.trace_operation("voice_processing", 
                                   conversation_id=conversation_id,
                                   user_id=user_id):
            pass
    
    start_time = datetime.utcnow()
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=400,
                detail="File must be an audio file"
            )
        
        voice_service = VoiceService()
        
        # Transcribe audio
        transcribed_text = await voice_service.transcribe_audio(file)
        
        # Safety check
        safety_service = SafetyService()
        if not safety_service.is_input_safe(transcribed_text):
            raise HTTPException(
                status_code=400,
                detail="Audio content contains inappropriate material"
            )
        
        # Process message
        conversation_manager = ConversationManager(db)
        message_input = schemas.MessageInput(text=transcribed_text)
        response_message = await conversation_manager.post_message(
            user_id, 
            conversation_id, 
            message_input
        )
        
        # Convert response to speech
        audio_data = await voice_service.text_to_speech(response_message.text)
        response_message.audio_data = audio_data
        
        # Update learning progress in background
        background_tasks.add_task(
            conversation_manager.update_learning_progress,
            user_id,
            transcribed_text,
            response_message.text
        )
        
        logger.info(
            "Voice message processed",
            conversation_id=conversation_id,
            user_id=user_id,
            transcribed_length=len(transcribed_text),
            response_length=len(response_message.text)
        )
        
        # Record metrics
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_voice_operation("full_pipeline", duration, success=True)
        
        return schemas.PostMessageResponse(
            message=response_message, 
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        if metrics:
            duration = (datetime.utcnow() - start_time).total_seconds()
            metrics.record_voice_operation("full_pipeline", duration, success=False)
        raise

@router.post("/{conversation_id}/hint", response_model=schemas.MessageOutput)
async def get_hint(
    conversation_id: str,
    user_id: str = Form(...),
    db: AsyncSession = Depends(get_db_session)
):
    """Get a hint for the current conversation context"""
    
    tracer = get_tracer_service()
    
    # Tracing context
    if tracer:
        with tracer.trace_operation("hint_generation", conversation_id=conversation_id):
            pass
    
    try:
        conversation_manager = ConversationManager(db)
        hint = await conversation_manager.get_hint(user_id, conversation_id)
        
        logger.info(
            "Hint generated",
            conversation_id=conversation_id,
            user_id=user_id
        )
        
        return schemas.MessageOutput(text=hint)
        
    except Exception as e:
        logger.error("Hint generation failed", error=str(e))
        raise

@router.get("/{conversation_id}/messages", response_model=schemas.ConversationHistoryResponse)
async def get_conversation_history(
    conversation_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_session)
):
    """Get conversation message history"""
    
    try:
        conversation_manager = ConversationManager(db)
        messages = await conversation_manager.get_conversation_history(
            conversation_id, 
            limit, 
            offset
        )
        
        logger.info(
            "Conversation history retrieved",
            conversation_id=conversation_id,
            message_count=len(messages)
        )
        
        return schemas.ConversationHistoryResponse(messages=messages)
        
    except Exception as e:
        logger.error("Failed to retrieve conversation history", error=str(e))
        raise

@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Get conversation details"""
    
    try:
        conversation_manager = ConversationManager(db)
        conversation = await conversation_manager.get_conversation(conversation_id)
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "id": conversation_id,
            "subject": getattr(conversation, 'subject', None),
            "created_at": getattr(conversation, 'created_at', None),
            "updated_at": getattr(conversation, 'updated_at', None),
            "message_count": len(getattr(conversation, 'messages', []))
        }
        
    except Exception as e:
        logger.error("Failed to retrieve conversation", error=str(e))
        raise

@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user_id: str = Form(...),
    db: AsyncSession = Depends(get_db_session)
):
    """Delete a conversation"""
    
    try:
        conversation_manager = ConversationManager(db)
        success = await conversation_manager.delete_conversation(conversation_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        logger.info(
            "Conversation deleted",
            conversation_id=conversation_id,
            user_id=user_id
        )
        
        return {"message": "Conversation deleted successfully"}
        
    except Exception as e:
        logger.error("Failed to delete conversation", error=str(e))
        raise