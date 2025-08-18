"""
Pydantic schemas for the LLM Tutor service API
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# Base conversation schemas
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
    message: MessageInput = Field(..., description="The message to post.")

class PostMessageResponse(BaseModel):
    message: MessageOutput = Field(..., description="The response message.")
    timestamp: datetime = Field(..., description="The timestamp of the response.")

class ConversationMessage(BaseModel):
    sender: str = Field(..., description="The sender of the message (user or bot).")
    message: MessageOutput = Field(..., description="The message content.")
    timestamp: datetime = Field(..., description="The timestamp of the message.")

class ConversationHistoryResponse(BaseModel):
    messages: List[ConversationMessage] = Field(..., description="The list of messages in the conversation.")

class ConversationDetailsResponse(BaseModel):
    id: str = Field(..., description="The conversation ID.")
    subject: Optional[str] = Field(None, description="The conversation subject.")
    created_at: datetime = Field(..., description="When the conversation was created.")
    updated_at: datetime = Field(..., description="When the conversation was last updated.")
    message_count: int = Field(..., description="Number of messages in the conversation.")

class ConversationSummary(BaseModel):
    id: str = Field(..., description="The conversation ID.")
    subject: Optional[str] = Field(None, description="The conversation subject.")
    created_at: datetime = Field(..., description="When the conversation was created.")
    updated_at: datetime = Field(..., description="When the conversation was last updated.")
    message_count: int = Field(..., description="Number of messages in the conversation.")

class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1-5 stars.")
    comment: Optional[str] = Field(None, description="Optional feedback comment.")

class FeedbackResponse(BaseModel):
    id: str = Field(..., description="The feedback ID.")
    rating: int = Field(..., description="The rating given.")
    comment: Optional[str] = Field(None, description="The feedback comment.")
    created_at: datetime = Field(..., description="When the feedback was created.")

# Authentication schemas
class LoginRequest(BaseModel):
    username: str = Field(..., description="Username or email.")
    password: str = Field(..., description="User password.")
    ip_address: Optional[str] = Field(None, description="Client IP address.")
    user_agent: Optional[str] = Field(None, description="Client user agent.")

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Refresh token.")

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Current password.")
    new_password: str = Field(..., description="New password.")

class UserInfo(BaseModel):
    id: str = Field(..., description="User ID.")
    username: str = Field(..., description="Username.")
    roles: List[str] = Field(..., description="User roles.")

class AuthResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token.")
    refresh_token: str = Field(..., description="JWT refresh token.")
    token_type: str = Field(..., description="Token type (bearer).")
    expires_in: int = Field(..., description="Token expiry in seconds.")
    user: UserInfo = Field(..., description="User information.")

class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token.")
    refresh_token: str = Field(..., description="JWT refresh token.")
    token_type: str = Field(..., description="Token type (bearer).")
    expires_in: int = Field(..., description="Token expiry in seconds.")

class UserProfile(BaseModel):
    id: str = Field(..., description="User ID.")
    external_id: str = Field(..., description="External user ID.")
    email: str = Field(..., description="User email.")
    username: Optional[str] = Field(None, description="Username.")
    full_name: Optional[str] = Field(None, description="Full name.")
    role: str = Field(..., description="User role.")
    is_active: bool = Field(..., description="Whether user is active.")
    is_verified: bool = Field(..., description="Whether user is verified.")
    is_premium: bool = Field(..., description="Whether user has premium access.")
    created_at: datetime = Field(..., description="Account creation date.")
    last_login_at: Optional[datetime] = Field(None, description="Last login date.")

# User management schemas
class LearningProfileResponse(BaseModel):
    learning_style: str = Field(..., description="Preferred learning style.")
    current_level: str = Field(..., description="Current difficulty level.")
    preferred_difficulty: str = Field(..., description="Preferred difficulty level.")
    subjects_of_interest: List[str] = Field(..., description="Subjects of interest.")
    learning_goals: List[str] = Field(..., description="Learning goals.")
    voice_enabled: bool = Field(..., description="Whether voice is enabled.")
    total_study_time: int = Field(..., description="Total study time in minutes.")
    questions_answered: int = Field(..., description="Total questions answered.")
    correct_answers: int = Field(..., description="Total correct answers.")
    streak_days: int = Field(..., description="Current streak in days.")

class UserProfileResponse(BaseModel):
    id: str = Field(..., description="User ID.")
    external_id: str = Field(..., description="External user ID.")
    email: str = Field(..., description="User email.")
    username: Optional[str] = Field(None, description="Username.")
    full_name: Optional[str] = Field(None, description="Full name.")
    role: str = Field(..., description="User role.")
    is_active: bool = Field(..., description="Whether user is active.")
    is_verified: bool = Field(..., description="Whether user is verified.")
    is_premium: bool = Field(..., description="Whether user has premium access.")
    created_at: datetime = Field(..., description="Account creation date.")
    last_login_at: Optional[datetime] = Field(None, description="Last login date.")
    learning_profile: Optional[LearningProfileResponse] = Field(None, description="Learning profile.")
    progress_summary: int = Field(..., description="Number of progress records.")

class UpdateLearningProfileRequest(BaseModel):
    learning_style: Optional[str] = Field(None, description="Preferred learning style.")
    preferred_difficulty: Optional[str] = Field(None, description="Preferred difficulty level.")
    subjects_of_interest: Optional[List[str]] = Field(None, description="Subjects of interest.")
    learning_goals: Optional[List[str]] = Field(None, description="Learning goals.")
    voice_enabled: Optional[bool] = Field(None, description="Whether voice is enabled.")

class UpdateUserProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, description="Full name.")
    learning_profile: Optional[UpdateLearningProfileRequest] = Field(None, description="Learning profile updates.")

class LearningProgressResponse(BaseModel):
    id: str = Field(..., description="Progress record ID.")
    subject: str = Field(..., description="Subject area.")
    topic: str = Field(..., description="Specific topic.")
    skill: str = Field(..., description="Skill being learned.")
    mastery_level: float = Field(..., description="Mastery level (0-1).")
    confidence_score: float = Field(..., description="Confidence score (0-1).")
    difficulty_level: str = Field(..., description="Current difficulty level.")
    total_time_spent: int = Field(..., description="Time spent in seconds.")
    total_questions: int = Field(..., description="Total questions attempted.")
    correct_answers: int = Field(..., description="Correct answers.")
    accuracy_rate: float = Field(..., description="Accuracy rate (0-1).")
    next_review_date: Optional[datetime] = Field(None, description="Next review date.")
    last_attempt_at: datetime = Field(..., description="Last attempt date.")

class UserStatsResponse(BaseModel):
    total_study_time: int = Field(..., description="Total study time in minutes.")
    total_questions: int = Field(..., description="Total questions answered.")
    correct_answers: int = Field(..., description="Total correct answers.")
    accuracy_rate: float = Field(..., description="Overall accuracy rate.")
    streak_days: int = Field(..., description="Current streak in days.")
    total_subjects: int = Field(..., description="Number of subjects studied.")
    total_skills: int = Field(..., description="Number of skills learned.")
    average_mastery: float = Field(..., description="Average mastery level.")
    mastery_distribution: Dict[str, int] = Field(..., description="Distribution by mastery level.")
    engagement_score: float = Field(..., description="Engagement score.")
    comprehension_score: float = Field(..., description="Comprehension score.")

# Voice processing schemas
class TranscriptionResponse(BaseModel):
    text: str = Field(..., description="Transcribed text.")
    language: str = Field(..., description="Detected language.")
    confidence: float = Field(..., description="Transcription confidence.")
    duration: float = Field(..., description="Audio duration in seconds.")
    segments: List[Dict[str, Any]] = Field(..., description="Transcription segments.")

class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize.")
    voice_id: Optional[str] = Field(None, description="Voice ID to use.")
    speed: Optional[float] = Field(1.0, description="Speech speed.")
    language: Optional[str] = Field("en", description="Language code.")

class VoiceInfo(BaseModel):
    id: str = Field(..., description="Voice ID.")
    name: str = Field(..., description="Voice name.")
    language: str = Field(..., description="Language code.")
    gender: str = Field(..., description="Voice gender.")
    description: str = Field(..., description="Voice description.")

class VoiceListResponse(BaseModel):
    voices: List[VoiceInfo] = Field(..., description="Available voices.")

# Analytics schemas
class AnalyticsDashboard(BaseModel):
    period_days: int = Field(..., description="Analysis period in days.")
    total_conversations: int = Field(..., description="Total conversations.")
    total_messages: int = Field(..., description="Total messages.")
    total_study_time: int = Field(..., description="Total study time.")
    subjects_studied: int = Field(..., description="Number of subjects studied.")
    subject_breakdown: Dict[str, Any] = Field(..., description="Statistics by subject.")
    daily_activity: List[Dict[str, Any]] = Field(..., description="Daily activity data.")
    generated_at: datetime = Field(..., description="When analytics were generated.")

class ProgressTrend(BaseModel):
    subject: Optional[str] = Field(None, description="Subject filter.")
    period_days: int = Field(..., description="Analysis period.")
    trend_data: List[Dict[str, Any]] = Field(..., description="Trend data points.")
    total_sessions: int = Field(..., description="Total learning sessions.")
    generated_at: datetime = Field(..., description="When analytics were generated.")

class LearningPatterns(BaseModel):
    peak_study_hour: int = Field(..., description="Peak study hour (0-23).")
    peak_study_day: int = Field(..., description="Peak study day (0=Monday).")
    avg_session_length: float = Field(..., description="Average session length in seconds.")
    preferred_difficulty: str = Field(..., description="Preferred difficulty level.")
    hourly_activity: List[int] = Field(..., description="Activity by hour.")
    daily_activity: List[int] = Field(..., description="Activity by day of week.")
    difficulty_distribution: Dict[str, int] = Field(..., description="Distribution by difficulty.")
    insights: List[str] = Field(..., description="Generated insights.")
    generated_at: datetime = Field(..., description="When patterns were analyzed.")

class LearningRecommendations(BaseModel):
    recommendations: List[Dict[str, Any]] = Field(..., description="Learning recommendations.")
    generated_at: datetime = Field(..., description="When recommendations were generated.")

# Admin schemas
class SystemStats(BaseModel):
    total_users: int = Field(..., description="Total users.")
    active_users: int = Field(..., description="Active users.")
    new_users_period: int = Field(..., description="New users in period.")
    total_conversations_period: int = Field(..., description="Conversations in period.")
    total_messages_period: int = Field(..., description="Messages in period.")
    role_distribution: Dict[str, int] = Field(..., description="Users by role.")
    daily_activity: List[Dict[str, Any]] = Field(..., description="Daily activity.")
    period_days: int = Field(..., description="Analysis period.")
    generated_at: datetime = Field(..., description="Generation timestamp.")

class AdminUserView(BaseModel):
    id: str = Field(..., description="User ID.")
    external_id: str = Field(..., description="External ID.")
    email: str = Field(..., description="Email address.")
    username: Optional[str] = Field(None, description="Username.")
    full_name: Optional[str] = Field(None, description="Full name.")
    role: str = Field(..., description="User role.")
    is_active: bool = Field(..., description="Is active.")
    is_verified: bool = Field(..., description="Is verified.")
    is_premium: bool = Field(..., description="Is premium.")
    created_at: datetime = Field(..., description="Creation date.")
    last_login_at: Optional[datetime] = Field(None, description="Last login.")
    conversation_count: int = Field(..., description="Number of conversations.")

class AdminUserUpdate(BaseModel):
    role: Optional[str] = Field(None, description="User role.")
    is_active: Optional[bool] = Field(None, description="Is active.")
    is_verified: Optional[bool] = Field(None, description="Is verified.")
    is_premium: Optional[bool] = Field(None, description="Is premium.")

class AdminConversationView(BaseModel):
    id: str = Field(..., description="Conversation ID.")
    user_id: str = Field(..., description="User ID.")
    user_email: str = Field(..., description="User email.")
    subject: Optional[str] = Field(None, description="Subject.")
    message_count: int = Field(..., description="Message count.")
    created_at: datetime = Field(..., description="Creation date.")
    updated_at: datetime = Field(..., description="Update date.")

class AdminFeedbackView(BaseModel):
    id: str = Field(..., description="Feedback ID.")
    conversation_id: str = Field(..., description="Conversation ID.")
    user_id: str = Field(..., description="User ID.")
    user_email: str = Field(..., description="User email.")
    rating: int = Field(..., description="Rating.")
    comment: Optional[str] = Field(None, description="Comment.")
    created_at: datetime = Field(..., description="Creation date.")