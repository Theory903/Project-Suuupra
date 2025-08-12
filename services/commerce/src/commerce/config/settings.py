"""
Configuration settings for Commerce Service.

Uses Pydantic Settings for environment variable management and validation.
"""

import os
from functools import lru_cache
from typing import List, Optional

from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="forbid"
    )
    
    # Application
    environment: str = Field(default="development", description="Environment: development, staging, production")
    service_name: str = Field(default="commerce-service", description="Service name for logging and metrics")
    port: int = Field(default=8084, description="HTTP server port")
    debug: bool = Field(default=False, description="Enable debug mode")
    
    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://commerce:commerce@localhost:5432/commerce_dev",
        description="PostgreSQL database URL for event store and read models"
    )
    database_pool_size: int = Field(default=10, description="Database connection pool size")
    database_max_overflow: int = Field(default=20, description="Database connection pool max overflow")
    
    # Redis
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for caching, cart persistence, and messaging"
    )
    redis_pool_size: int = Field(default=10, description="Redis connection pool size")
    
    # Security
    jwt_secret: str = Field(default="your-jwt-secret-change-in-production", description="JWT signing secret")
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    jwt_expiration_hours: int = Field(default=24, description="JWT token expiration in hours")
    
    # CORS
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        description="Allowed CORS origins"
    )
    
    # Logging
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(default="json", description="Log format: json or console")
    
    # Observability
    enable_tracing: bool = Field(default=True, description="Enable OpenTelemetry tracing")
    jaeger_endpoint: Optional[str] = Field(default=None, description="Jaeger collector endpoint")
    prometheus_metrics_port: int = Field(default=9090, description="Prometheus metrics port")
    
    # Business Logic
    cart_ttl_hours: int = Field(default=24, description="Shopping cart TTL in hours")
    order_timeout_minutes: int = Field(default=30, description="Order processing timeout in minutes")
    saga_retry_attempts: int = Field(default=3, description="Maximum saga retry attempts")
    saga_retry_delay_seconds: int = Field(default=5, description="Saga retry delay in seconds")
    
    # External Services
    payment_service_url: str = Field(
        default="http://localhost:8086",
        description="Payment service URL"
    )
    inventory_service_url: str = Field(
        default="http://localhost:8087",
        description="Inventory service URL"
    )
    shipping_service_url: str = Field(
        default="http://localhost:8088",
        description="Shipping service URL"
    )
    notification_service_url: str = Field(
        default="http://localhost:8085",
        description="Notification service URL"
    )
    
    # Feature Flags
    enable_saga_orchestration: bool = Field(default=True, description="Enable saga orchestration")
    enable_event_sourcing: bool = Field(default=True, description="Enable event sourcing")
    enable_cqrs: bool = Field(default=True, description="Enable CQRS pattern")
    enable_optimistic_locking: bool = Field(default=True, description="Enable optimistic locking")
    
    @validator("environment")
    def validate_environment(cls, v):
        allowed = ["development", "staging", "production", "test"]
        if v not in allowed:
            raise ValueError(f"Environment must be one of: {allowed}")
        return v
    
    @validator("log_level")
    def validate_log_level(cls, v):
        allowed = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in allowed:
            raise ValueError(f"Log level must be one of: {allowed}")
        return v.upper()
    
    @validator("log_format")
    def validate_log_format(cls, v):
        allowed = ["json", "console"]
        if v not in allowed:
            raise ValueError(f"Log format must be one of: {allowed}")
        return v
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in test environment."""
        return self.environment == "test"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

