from sqlalchemy import Column, String, Integer, DateTime, Boolean, JSON, Text, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from enum import Enum

from src.core.database import Base


class VideoStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    TRANSCODING = "transcoding"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"


class TranscodingStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class DRMType(str, Enum):
    NONE = "none"
    WIDEVINE = "widevine"
    FAIRPLAY = "fairplay"
    PLAYREADY = "playready"


class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    creator_id = Column(String, nullable=False)
    
    # File information
    original_filename = Column(String, nullable=False)
    file_size = Column(BigInteger, nullable=False)
    duration = Column(Integer)  # in seconds
    format = Column(String, nullable=False)
    
    # Status and processing
    status = Column(String, default=VideoStatus.UPLOADED, nullable=False)
    processing_progress = Column(Integer, default=0)  # 0-100
    error_message = Column(Text)
    
    # Storage
    s3_key = Column(String, nullable=False)
    s3_bucket = Column(String, nullable=False)
    cdn_url = Column(String)
    
    # Metadata
    width = Column(Integer)
    height = Column(Integer)
    frame_rate = Column(String)
    bit_rate = Column(Integer)
    codec = Column(String)
    
    # Thumbnails
    thumbnail_url = Column(String)
    preview_gif_url = Column(String)
    
    # Content protection
    drm_type = Column(String, default=DRMType.NONE)
    drm_key_id = Column(String)
    
    # Analytics
    view_count = Column(Integer, default=0)
    total_watch_time = Column(BigInteger, default=0)  # in seconds
    
    # Timestamps
    uploaded_at = Column(DateTime, default=func.now(), nullable=False)
    processed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relations
    transcoding_jobs = relationship("TranscodingJob", back_populates="video", cascade="all, delete-orphan")
    analytics = relationship("VideoAnalytics", back_populates="video", cascade="all, delete-orphan")


class TranscodingJob(Base):
    __tablename__ = "transcoding_jobs"

    id = Column(String, primary_key=True)
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    
    # Job configuration
    output_format = Column(String, nullable=False)  # mp4, webm, hls
    quality = Column(String, nullable=False)  # 240p, 360p, 480p, 720p, 1080p
    preset = Column(String, default="medium")  # fast, medium, slow
    
    # Processing details
    status = Column(String, default=TranscodingStatus.PENDING, nullable=False)
    progress = Column(Integer, default=0)  # 0-100
    error_message = Column(Text)
    
    # Output information
    output_s3_key = Column(String)
    output_file_size = Column(BigInteger)
    output_duration = Column(Integer)
    output_bitrate = Column(Integer)
    
    # Timestamps
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relations
    video = relationship("Video", back_populates="transcoding_jobs")


class VideoAnalytics(Base):
    __tablename__ = "video_analytics"

    id = Column(String, primary_key=True)
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    
    # View tracking
    user_id = Column(String)  # null for anonymous views
    session_id = Column(String, nullable=False)
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Viewing details
    watch_duration = Column(Integer, nullable=False)  # seconds watched
    completion_rate = Column(Integer, default=0)  # 0-100
    quality_watched = Column(String)  # 240p, 360p, etc.
    
    # Engagement
    paused_count = Column(Integer, default=0)
    seeked_count = Column(Integer, default=0)
    fullscreen_time = Column(Integer, default=0)
    
    # Geographic and device info
    country = Column(String)
    device_type = Column(String)  # mobile, desktop, tablet, tv
    browser = Column(String)
    
    # Timestamps
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relations
    video = relationship("Video", back_populates="analytics")


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    creator_id = Column(String, nullable=False)
    
    # Configuration
    is_public = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    
    # Content
    video_ids = Column(JSON, default=list)  # Ordered list of video IDs
    thumbnail_url = Column(String)
    
    # Analytics
    view_count = Column(Integer, default=0)
    subscriber_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)


class VideoComment(Base):
    __tablename__ = "video_comments"

    id = Column(String, primary_key=True)
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    user_id = Column(String, nullable=False)
    
    # Comment content
    content = Column(Text, nullable=False)
    timestamp = Column(Integer)  # Video timestamp in seconds
    
    # Moderation
    is_approved = Column(Boolean, default=True)
    is_flagged = Column(Boolean, default=False)
    moderated_by = Column(String)
    moderated_at = Column(DateTime)
    
    # Engagement
    like_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    parent_comment_id = Column(String, ForeignKey("video_comments.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relations
    video = relationship("Video")
    replies = relationship("VideoComment", remote_side=[id])


class CDNCache(Base):
    __tablename__ = "cdn_cache"

    id = Column(String, primary_key=True)
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    
    # CDN information
    cdn_provider = Column(String, nullable=False)  # cloudfront, cloudflare, fastly
    cache_key = Column(String, nullable=False)
    cache_url = Column(String, nullable=False)
    
    # Cache status
    is_cached = Column(Boolean, default=False)
    cache_hit_ratio = Column(Integer, default=0)  # 0-100
    
    # Performance metrics
    edge_response_time = Column(Integer)  # milliseconds
    bandwidth_usage = Column(BigInteger, default=0)  # bytes
    
    # Timestamps
    cached_at = Column(DateTime)
    last_accessed = Column(DateTime)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relations
    video = relationship("Video")
