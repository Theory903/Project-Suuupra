from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings."""
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8087
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    SERVICE_NAME: str = "vod"
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://voduser:vodpass@localhost:5432/vod_db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/4"
    REDIS_POOL_SIZE: int = 10
    
    # Storage Configuration
    S3_BUCKET_NAME: str = "suuupra-vod-content"
    S3_REGION: str = "us-west-2"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    CDN_BASE_URL: str = "https://cdn.suuupra.com"
    
    # Transcoding Configuration
    TRANSCODING_ENABLED: bool = True
    TRANSCODING_QUEUE: str = "vod-transcoding"
    TRANSCODING_WORKERS: int = 2
    VIDEO_STORAGE_PATH: str = "/tmp/videos"
    OUTPUT_STORAGE_PATH: str = "/tmp/transcoded"
    
    # Video Processing Settings
    MAX_FILE_SIZE: int = 5 * 1024 * 1024 * 1024  # 5GB
    ALLOWED_VIDEO_FORMATS: List[str] = ["mp4", "avi", "mov", "mkv", "webm"]
    OUTPUT_FORMATS: List[str] = ["mp4", "webm"]
    QUALITY_LEVELS: List[str] = ["240p", "360p", "480p", "720p", "1080p"]
    
    # DRM Configuration
    DRM_ENABLED: bool = True
    WIDEVINE_KEY_SERVER: str = ""
    FAIRPLAY_KEY_SERVER: str = ""
    
    # Authentication
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Security
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: List[str] = ["*"]
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # Observability
    LOG_LEVEL: str = "INFO"
    PROMETHEUS_ENABLED: bool = True
    JAEGER_ENDPOINT: str = "http://localhost:14268/api/traces"
    OTEL_SERVICE_NAME: str = "vod"
    
    # Feature Flags
    ENABLE_THUMBNAILS: bool = True
    ENABLE_WATERMARKING: bool = True
    ENABLE_ANALYTICS: bool = True
    ENABLE_RECOMMENDATIONS: bool = True
    
    # CDN Configuration
    CLOUDFRONT_DISTRIBUTION_ID: str = ""
    CLOUDFLARE_ZONE_ID: str = ""
    FASTLY_SERVICE_ID: str = ""
    
    # Notification Configuration
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8090"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()

# Validate critical settings
if not settings.AWS_ACCESS_KEY_ID and settings.ENVIRONMENT == "production":
    raise ValueError("AWS_ACCESS_KEY_ID is required in production")

if not settings.AWS_SECRET_ACCESS_KEY and settings.ENVIRONMENT == "production":
    raise ValueError("AWS_SECRET_ACCESS_KEY is required in production")
