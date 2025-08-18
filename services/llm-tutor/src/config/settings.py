"""
Configuration settings for the LLM Tutor service
Centralizes all environment variables and configuration
"""

from functools import lru_cache
from typing import Optional, List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # Basic Service Configuration
    ENVIRONMENT: str = Field(default="development", description="Environment: development, staging, production")
    SERVICE_NAME: str = Field(default="llm-tutor", description="Service name for logging and tracing")
    DEBUG: bool = Field(default=False, description="Enable debug mode")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    
    # API Configuration
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8092, description="Server port")
    WORKERS: int = Field(default=1, description="Number of worker processes")
    ALLOWED_HOSTS: Optional[str] = Field(default=None, description="Comma-separated allowed hosts")
    CORS_ORIGINS: Optional[str] = Field(default=None, description="Comma-separated CORS origins")
    
    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://llm_tutor:password@localhost:5432/llm_tutor",
        description="PostgreSQL database URL"
    )
    DATABASE_POOL_SIZE: int = Field(default=20, description="Database connection pool size")
    DATABASE_MAX_OVERFLOW: int = Field(default=30, description="Database max overflow connections")
    
    # Redis Configuration
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    REDIS_POOL_SIZE: int = Field(default=50, description="Redis connection pool size")
    REDIS_SESSION_TTL: int = Field(default=3600, description="Session TTL in seconds")
    
    # Vector Database Configuration
    MILVUS_HOST: str = Field(default="localhost", description="Milvus host")
    MILVUS_PORT: int = Field(default=19530, description="Milvus port")
    MILVUS_COLLECTION_NAME: str = Field(default="educational_content", description="Milvus collection name")
    MILVUS_DIMENSION: int = Field(default=384, description="Vector dimension")
    
    # Elasticsearch Configuration
    ELASTICSEARCH_URL: str = Field(
        default="http://localhost:9200",
        description="Elasticsearch URL"
    )
    ELASTICSEARCH_INDEX: str = Field(default="educational_content", description="Elasticsearch index name")
    
    # LLM Configuration
    LLM_MODEL_NAME: str = Field(
        default="microsoft/DialoGPT-large",
        description="HuggingFace model name for LLM"
    )
    LLM_MAX_TOKENS: int = Field(default=2048, description="Maximum tokens for LLM generation")
    LLM_TEMPERATURE: float = Field(default=0.7, description="LLM temperature")
    LLM_TOP_P: float = Field(default=0.9, description="LLM top-p sampling")
    LLM_BATCH_SIZE: int = Field(default=4, description="LLM batch size")
    
    # Embedding Model Configuration
    EMBEDDING_MODEL_NAME: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="Embedding model name"
    )
    EMBEDDING_BATCH_SIZE: int = Field(default=32, description="Embedding batch size")
    
    # RAG Configuration
    RAG_TOP_K: int = Field(default=10, description="Number of documents to retrieve")
    RAG_RERANK_TOP_K: int = Field(default=5, description="Number of documents after reranking")
    RAG_CHUNK_SIZE: int = Field(default=512, description="Document chunk size")
    RAG_CHUNK_OVERLAP: int = Field(default=50, description="Chunk overlap size")
    RAG_SIMILARITY_THRESHOLD: float = Field(default=0.7, description="Minimum similarity threshold")
    
    # Voice Processing Configuration
    ASR_MODEL_NAME: str = Field(default="openai/whisper-large-v3", description="ASR model name")
    TTS_MODEL_NAME: str = Field(default="coqui/XTTS-v2", description="TTS model name")
    AUDIO_SAMPLE_RATE: int = Field(default=16000, description="Audio sample rate")
    AUDIO_CHUNK_SIZE: int = Field(default=1024, description="Audio chunk size")
    
    # Authentication & Security
    JWT_SECRET_KEY: str = Field(default="dev-secret-key", description="JWT secret key")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="JWT access token expiry")
    
    # API Gateway Integration
    API_GATEWAY_URL: str = Field(
        default="http://localhost:8080",
        description="API Gateway URL for service discovery"
    )
    IDENTITY_SERVICE_URL: str = Field(
        default="http://localhost:8081",
        description="Identity service URL for authentication"
    )
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = Field(default=60, description="Rate limit per minute per user")
    RATE_LIMIT_BURST: int = Field(default=10, description="Rate limit burst capacity")
    
    # OpenAI API (for fallback or comparison)
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API key")
    OPENAI_MODEL: str = Field(default="gpt-3.5-turbo", description="OpenAI model name")
    
    # HuggingFace Configuration
    HUGGINGFACE_API_TOKEN: Optional[str] = Field(default=None, description="HuggingFace API token")
    HUGGINGFACE_CACHE_DIR: str = Field(default="./models", description="HuggingFace model cache directory")
    
    # Observability
    ENABLE_TRACING: bool = Field(default=True, description="Enable OpenTelemetry tracing")
    JAEGER_ENDPOINT: Optional[str] = Field(default=None, description="Jaeger endpoint URL")
    JAEGER_HOST: str = Field(default="localhost", description="Jaeger agent host")
    JAEGER_PORT: int = Field(default=6831, description="Jaeger agent port")
    
    PROMETHEUS_ENABLED: bool = Field(default=True, description="Enable Prometheus metrics")
    METRICS_PORT: int = Field(default=9090, description="Metrics server port")
    
    # Performance & Scaling
    GPU_ENABLED: bool = Field(default=False, description="Enable GPU acceleration")
    MAX_CONCURRENT_REQUESTS: int = Field(default=100, description="Maximum concurrent requests")
    REQUEST_TIMEOUT: int = Field(default=30, description="Request timeout in seconds")
    
    # Safety & Content Filtering
    ENABLE_CONTENT_FILTER: bool = Field(default=True, description="Enable content filtering")
    CONTENT_FILTER_THRESHOLD: float = Field(default=0.8, description="Content filter threshold")
    ENABLE_PII_DETECTION: bool = Field(default=True, description="Enable PII detection")
    
    # Data Storage
    CONTENT_STORAGE_PATH: str = Field(default="./data/content", description="Content storage path")
    MODEL_STORAGE_PATH: str = Field(default="./data/models", description="Model storage path")
    LOGS_STORAGE_PATH: str = Field(default="./logs", description="Logs storage path")
    
    # AWS Configuration (for production deployment)
    AWS_REGION: Optional[str] = Field(default=None, description="AWS region")
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None, description="AWS access key ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None, description="AWS secret access key")
    S3_BUCKET_NAME: Optional[str] = Field(default=None, description="S3 bucket for content storage")
    
    # Feature Flags
    ENABLE_VOICE_INTERFACE: bool = Field(default=True, description="Enable voice interface")
    ENABLE_PERSONALIZATION: bool = Field(default=True, description="Enable personalization features")
    ENABLE_ANALYTICS: bool = Field(default=True, description="Enable analytics collection")
    ENABLE_EXPERIMENTS: bool = Field(default=False, description="Enable A/B testing")
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL for migrations"""
        return self.DATABASE_URL.replace("+asyncpg", "")
    
    @property
    def redis_url_parsed(self) -> dict:
        """Parse Redis URL into components"""
        from urllib.parse import urlparse
        parsed = urlparse(self.REDIS_URL)
        return {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 6379,
            "db": int(parsed.path.lstrip("/")) if parsed.path else 0,
            "password": parsed.password,
        }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
