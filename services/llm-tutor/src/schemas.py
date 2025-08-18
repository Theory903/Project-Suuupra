"""
Pydantic Schemas for API Data Transfer Objects (DTOs)
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

class ConversationStartRequest(BaseModel):
    user_id: str = Field(..., description="The ID of the user starting the conversation.")
    subject: Optional[str] = Field(None, description="The subject of the conversation.")

class ConversationStartResponse(BaseModel):
    conversation_id: str = Field(..., description="The ID of the new conversation.")
    created_at: datetime = Field(..., description="The timestamp when the conversation was created.")

class MessageInput(BaseModel):
    text: Optional[str] = Field(None, description="The text of the message.")
    audio_data: Optional[bytes] = Field(None, description="The audio data of the message.")

class MessageOutput(BaseModel):
    text: str = Field(..., description="The text of the response.")
    audio_data: Optional[bytes] = Field(None, description="The audio data of the response.")
    citations: List[Dict[str, Any]] = Field([], description="A list of citations for the response.")

class PostMessageRequest(BaseModel):
    user_id: str = Field(..., description="The ID of the user posting the message.")
    conversation_id: str = Field(..., description="The ID of the conversation.")
    message: MessageInput = Field(..., description="The message to post.")

class PostMessageResponse(BaseModel):
    message: MessageOutput = Field(..., description="The response message.")
    timestamp: datetime = Field(..., description="The timestamp of the response.")

class ConversationHistoryRequest(BaseModel):
    conversation_id: str = Field(..., description="The ID of the conversation.")
    limit: int = Field(100, description="The maximum number of messages to return.")
    offset: int = Field(0, description="The offset for pagination.")

class ConversationMessage(BaseModel):
    sender: str = Field(..., description="The sender of the message (user or bot).")
    message: MessageOutput = Field(..., description="The message content.")
    timestamp: datetime = Field(..., description="The timestamp of the message.")

class ConversationHistoryResponse(BaseModel):
    messages: List[ConversationMessage] = Field(..., description="The list of messages in the conversation.")
