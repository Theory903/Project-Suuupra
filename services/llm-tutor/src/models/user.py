"""
User and Learning Profile Models
Defines database models for user management and learning progress tracking
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

from sqlalchemy import Column, String, DateTime, JSON, Boolean, Integer, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class UserRole(str, Enum):
    """User roles in the system"""
    STUDENT = "student"
    TEACHER = "teacher" 
    ADMIN = "admin"
    PARENT = "parent"


class LearningStyle(str, Enum):
    """Different learning styles for personalization"""
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING_WRITING = "reading_writing"


class DifficultyLevel(str, Enum):
    """Difficulty levels for content and questions"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class User(Base):
    """Main user model with basic information"""
    
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic Info
    external_id = Column(String(255), unique=True, nullable=False, index=True)  # From Identity service
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    full_name = Column(String(255), nullable=True)
    
    # User Configuration
    role = Column(String(50), default=UserRole.STUDENT, nullable=False)
    preferred_language = Column(String(10), default="en", nullable=False)
    timezone = Column(String(50), default="UTC", nullable=False)
    
    # Account Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    learning_profile = relationship("LearningProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    learning_progress = relationship("LearningProgress", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


class LearningProfile(Base):
    """Detailed learning profile for personalization"""
    
    __tablename__ = "learning_profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Learning Preferences
    learning_style = Column(String(50), default=LearningStyle.VISUAL, nullable=False)
    current_level = Column(String(50), default=DifficultyLevel.BEGINNER, nullable=False)
    preferred_difficulty = Column(String(50), default=DifficultyLevel.INTERMEDIATE, nullable=False)
    
    # Learning Goals and Interests
    subjects_of_interest = Column(JSON, default=list, nullable=False)  # List of subject areas
    learning_goals = Column(JSON, default=list, nullable=False)  # List of learning objectives
    skill_levels = Column(JSON, default=dict, nullable=False)  # Dict of skill -> level mappings
    
    # Personalization Data
    interaction_preferences = Column(JSON, default=dict, nullable=False)  # UI/UX preferences
    feedback_preferences = Column(JSON, default=dict, nullable=False)  # How user likes to receive feedback
    pacing_preference = Column(String(20), default="moderate", nullable=False)  # slow, moderate, fast
    
    # Voice Preferences
    voice_enabled = Column(Boolean, default=True, nullable=False)
    preferred_voice_gender = Column(String(20), nullable=True)
    preferred_voice_accent = Column(String(50), nullable=True)
    speech_rate = Column(Float, default=1.0, nullable=False)  # 0.5 to 2.0
    
    # Accessibility Settings
    accessibility_features = Column(JSON, default=dict, nullable=False)
    font_size_preference = Column(String(20), default="medium", nullable=False)
    high_contrast_mode = Column(Boolean, default=False, nullable=False)
    
    # Analytics and Tracking
    total_study_time = Column(Integer, default=0, nullable=False)  # in minutes
    questions_answered = Column(Integer, default=0, nullable=False)
    correct_answers = Column(Integer, default=0, nullable=False)
    streak_days = Column(Integer, default=0, nullable=False)
    
    # Performance Metrics
    average_response_time = Column(Float, default=0.0, nullable=False)  # in seconds
    comprehension_score = Column(Float, default=0.0, nullable=False)  # 0.0 to 1.0
    engagement_score = Column(Float, default=0.0, nullable=False)  # 0.0 to 1.0
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="learning_profile")
    
    def __repr__(self):
        return f"<LearningProfile(user_id={self.user_id}, style={self.learning_style}, level={self.current_level})>"
    
    def get_accuracy_rate(self) -> float:
        """Calculate question accuracy rate"""
        if self.questions_answered == 0:
            return 0.0
        return self.correct_answers / self.questions_answered
    
    def update_performance_metrics(
        self, 
        response_time: float, 
        is_correct: bool, 
        comprehension_score: float = None,
        engagement_score: float = None
    ):
        """Update performance metrics based on latest interaction"""
        
        # Update question stats
        self.questions_answered += 1
        if is_correct:
            self.correct_answers += 1
        
        # Update average response time (exponential moving average)
        alpha = 0.1  # Smoothing factor
        if self.average_response_time == 0:
            self.average_response_time = response_time
        else:
            self.average_response_time = (1 - alpha) * self.average_response_time + alpha * response_time
        
        # Update comprehension score if provided
        if comprehension_score is not None:
            if self.comprehension_score == 0:
                self.comprehension_score = comprehension_score
            else:
                self.comprehension_score = (1 - alpha) * self.comprehension_score + alpha * comprehension_score
        
        # Update engagement score if provided
        if engagement_score is not None:
            if self.engagement_score == 0:
                self.engagement_score = engagement_score
            else:
                self.engagement_score = (1 - alpha) * self.engagement_score + alpha * engagement_score


class LearningProgress(Base):
    """Tracks learning progress across different subjects and skills"""
    
    __tablename__ = "learning_progress"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Progress Tracking
    subject = Column(String(100), nullable=False, index=True)
    topic = Column(String(200), nullable=False, index=True)
    skill = Column(String(200), nullable=False)
    
    # Progress Metrics
    mastery_level = Column(Float, default=0.0, nullable=False)  # 0.0 to 1.0
    confidence_score = Column(Float, default=0.0, nullable=False)  # 0.0 to 1.0
    difficulty_level = Column(String(50), default=DifficultyLevel.BEGINNER, nullable=False)
    
    # Learning Statistics
    total_time_spent = Column(Integer, default=0, nullable=False)  # in seconds
    total_questions = Column(Integer, default=0, nullable=False)
    correct_answers = Column(Integer, default=0, nullable=False)
    hints_used = Column(Integer, default=0, nullable=False)
    
    # Spaced Repetition Data
    next_review_date = Column(DateTime(timezone=True), nullable=True)
    review_interval = Column(Integer, default=1, nullable=False)  # days
    ease_factor = Column(Float, default=2.5, nullable=False)  # Spaced repetition ease factor
    
    # Performance History (last 10 attempts)
    recent_scores = Column(JSON, default=list, nullable=False)  # List of recent performance scores
    
    # Timestamps
    first_attempt_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_attempt_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="learning_progress")
    
    def __repr__(self):
        return f"<LearningProgress(user_id={self.user_id}, subject={self.subject}, mastery={self.mastery_level:.2f})>"
    
    def get_accuracy_rate(self) -> float:
        """Calculate accuracy rate for this skill"""
        if self.total_questions == 0:
            return 0.0
        return self.correct_answers / self.total_questions
    
    def update_progress(self, is_correct: bool, response_time: float, used_hint: bool = False):
        """Update progress based on latest attempt"""
        
        # Update basic stats
        self.total_questions += 1
        if is_correct:
            self.correct_answers += 1
        if used_hint:
            self.hints_used += 1
        
        # Calculate current performance score (0.0 to 1.0)
        performance_score = 1.0 if is_correct else 0.0
        if used_hint:
            performance_score *= 0.7  # Reduce score if hint was used
        
        # Adjust for response time (faster responses get slight bonus)
        time_factor = max(0.5, min(1.2, 30.0 / max(response_time, 1.0)))
        performance_score *= time_factor
        
        # Update recent scores
        if not self.recent_scores:
            self.recent_scores = []
        self.recent_scores.append(performance_score)
        if len(self.recent_scores) > 10:
            self.recent_scores.pop(0)
        
        # Update mastery level (exponential moving average)
        alpha = 0.2
        if self.mastery_level == 0:
            self.mastery_level = performance_score
        else:
            self.mastery_level = (1 - alpha) * self.mastery_level + alpha * performance_score
        
        # Update confidence score based on consistency
        if len(self.recent_scores) >= 3:
            import statistics
            recent_variance = statistics.variance(self.recent_scores)
            consistency_factor = max(0.0, 1.0 - recent_variance)
            self.confidence_score = (self.mastery_level + consistency_factor) / 2
        else:
            self.confidence_score = self.mastery_level * 0.5
        
        # Update spaced repetition parameters
        self._update_spaced_repetition(performance_score)
    
    def _update_spaced_repetition(self, performance_score: float):
        """Update spaced repetition scheduling"""
        from datetime import timedelta
        
        if performance_score >= 0.8:
            # Good performance - increase interval
            self.ease_factor = min(3.0, self.ease_factor + 0.1)
            self.review_interval = max(1, int(self.review_interval * self.ease_factor))
        elif performance_score >= 0.6:
            # Okay performance - maintain interval
            pass
        else:
            # Poor performance - decrease interval and ease factor
            self.ease_factor = max(1.3, self.ease_factor - 0.2)
            self.review_interval = max(1, int(self.review_interval * 0.5))
        
        # Set next review date
        self.next_review_date = datetime.utcnow() + timedelta(days=self.review_interval)
    
    def should_review_now(self) -> bool:
        """Check if this skill should be reviewed now"""
        if self.next_review_date is None:
            return True
        return datetime.utcnow() >= self.next_review_date
    
    def get_difficulty_recommendation(self) -> DifficultyLevel:
        """Recommend difficulty level based on current progress"""
        if self.mastery_level >= 0.9 and self.confidence_score >= 0.8:
            return DifficultyLevel.EXPERT
        elif self.mastery_level >= 0.7 and self.confidence_score >= 0.6:
            return DifficultyLevel.ADVANCED
        elif self.mastery_level >= 0.5 and self.confidence_score >= 0.4:
            return DifficultyLevel.INTERMEDIATE
        else:
            return DifficultyLevel.BEGINNER


class UserSession(Base):
    """Track user sessions for analytics"""
    
    __tablename__ = "user_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Session Info
    session_id = Column(String(255), nullable=False, unique=True, index=True)
    device_info = Column(JSON, default=dict, nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    
    # Session Metrics
    duration = Column(Integer, default=0, nullable=False)  # in seconds
    interactions_count = Column(Integer, default=0, nullable=False)
    questions_asked = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, duration={self.duration})>"
