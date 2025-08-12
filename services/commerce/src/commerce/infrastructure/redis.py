"""
Redis connection and session management for Commerce Service.

Handles Redis connections for caching, cart persistence, and messaging.
"""

from typing import Optional
import structlog
import redis.asyncio as redis
from redis.asyncio import Redis

from ..config.settings import get_settings

logger = structlog.get_logger(__name__)

# Global Redis client
_redis_client: Optional[Redis] = None


async def init_redis(redis_url: str) -> None:
    """Initialize the Redis connection."""
    global _redis_client
    
    settings = get_settings()
    
    logger.info("Initializing Redis connection", url=redis_url)
    
    # Create Redis client
    _redis_client = redis.from_url(
        redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=settings.redis_pool_size,
        retry_on_timeout=True,
        health_check_interval=30,
    )
    
    # Test connection
    try:
        await _redis_client.ping()
        logger.info("Redis connection initialized successfully")
    except Exception as e:
        logger.error("Failed to connect to Redis", error=str(e))
        raise


async def close_redis() -> None:
    """Close the Redis connection."""
    global _redis_client
    
    if _redis_client:
        logger.info("Closing Redis connection")
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection closed")


def get_redis_client() -> Redis:
    """Get the Redis client."""
    if _redis_client is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis_client

