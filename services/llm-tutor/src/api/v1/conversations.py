"""
API Endpoints for Conversations
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from .. import schemas
from ..core.database import get_db_session
from ..services.conversation_manager import ConversationManager
from ..services.voice_service import VoiceService

router = APIRouter()

@router.post("/conversations", response_model=schemas.ConversationStartResponse)
async def start_conversation(
    request: schemas.ConversationStartRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Starts a new conversation."""
    conv_manager = ConversationManager(db)
    conversation_id, created_at = await conv_manager.create_conversation(request.user_id, request.subject)
    return schemas.ConversationStartResponse(conversation_id=conversation_id, created_at=created_at)

@router.post("/conversations/{conversation_id}/messages", response_model=schemas.PostMessageResponse)
async def post_message(
    conversation_id: str,
    request: schemas.PostMessageRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Posts a message to a conversation and gets a response from the tutor."""
    conv_manager = ConversationManager(db)
    response_message = await conv_manager.post_message(request.user_id, conversation_id, request.message)
    return schemas.PostMessageResponse(message=response_message, timestamp=datetime.utcnow())

@router.post("/conversations/{conversation_id}/messages/voice", response_model=schemas.PostMessageResponse)
async def post_voice_message(
    conversation_id: str,
    user_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session)
):
    """Posts a voice message to a conversation and gets a response from the tutor."""
    voice_service = VoiceService()
    text = await voice_service.transcribe_audio(file)

    conv_manager = ConversationManager(db)
    message = schemas.MessageInput(text=text)
    response_message = await conv_manager.post_message(conversation_id, message)

    response_audio = await voice_service.text_to_speech(response_message.text)
    response_message.audio_data = response_audio

    return schemas.PostMessageResponse(message=response_message, timestamp=datetime.utcnow())

@router.get("/conversations/{conversation_id}/messages", response_model=schemas.ConversationHistoryResponse)
async def get_conversation_history(
    conversation_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_session)
):
    """Gets the history of a conversation."""
    conv_manager = ConversationManager(db)
    messages = await conv_manager.get_conversation_history(conversation_id, limit, offset)
    return schemas.ConversationHistoryResponse(messages=messages)
