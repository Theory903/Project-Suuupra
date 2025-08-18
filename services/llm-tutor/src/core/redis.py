"""
Redis configuration and connection management
Handles Redis connections for caching, sessions, and real-time features
"""

import json
import logging
from typing import Any, Optional, Union, Dict, List
import asyncio
from datetime import datetime, timedelta

import structlog
import redis.asyncio as redis
from redis.asyncio import ConnectionPool, Redis

from ..config.settings import settings

logger = structlog.get_logger(__name__)

# Global Redis connection
_redis_pool: Optional[ConnectionPool] = None
_redis_client: Optional[Redis] = None


def get_redis_pool() -> ConnectionPool:
    """Get Redis connection pool"""
    global _redis_pool
    if _redis_pool is None:
        redis_config = settings.redis_url_parsed
        _redis_pool = ConnectionPool(
            host=redis_config["host"],
            port=redis_config["port"],
            db=redis_config["db"],
            password=redis_config["password"],
            max_connections=settings.REDIS_POOL_SIZE,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
            socket_keepalive_options={},
            retry_on_timeout=True,
            health_check_interval=30,
        )
    return _redis_pool


async def get_redis() -> Redis:
    """Get Redis client instance"""
    global _redis_client
    if _redis_client is None:
        pool = get_redis_pool()
        _redis_client = Redis(connection_pool=pool)
    return _redis_client


async def init_redis():
    """Initialize Redis connection"""
    try:
        redis_client = await get_redis()
        await redis_client.ping()
        logger.info("Redis initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize Redis", error=str(e))
        raise


async def close_redis():
    """Close Redis connections"""
    global _redis_client, _redis_pool
    
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
    
    if _redis_pool:
        await _redis_pool.disconnect()
        _redis_pool = None
    
    logger.info("Redis connections closed")


class RedisKeyManager:
    """Centralized Redis key management with consistent naming conventions"""
    
    # Key prefixes
    SESSION_PREFIX = "session"
    USER_PREFIX = "user"
    CONVERSATION_PREFIX = "conv"
    RATE_LIMIT_PREFIX = "ratelimit" 
    CACHE_PREFIX = "cache"
    ANALYTICS_PREFIX = "analytics"
    
    @classmethod
    def session_key(cls, session_id: str) -> str:
        """Generate session key"""
        return f"{cls.SESSION_PREFIX}:{session_id}"
    
    @classmethod
    def user_session_key(cls, user_id: str) -> str:
        """Generate user session list key"""
        return f"{cls.USER_PREFIX}:{user_id}:sessions"
    
    @classmethod
    def conversation_key(cls, conversation_id: str) -> str:
        """Generate conversation key"""
        return f"{cls.CONVERSATION_PREFIX}:{conversation_id}"
    
    @classmethod
    def conversation_history_key(cls, conversation_id: str) -> str:
        """Generate conversation history key"""
        return f"{cls.CONVERSATION_PREFIX}:{conversation_id}:history"
    
    @classmethod
    def rate_limit_key(cls, identifier: str, window: str) -> str:
        """Generate rate limit key"""
        return f"{cls.RATE_LIMIT_PREFIX}:{identifier}:{window}"
    
    @classmethod
    def cache_key(cls, namespace: str, key: str) -> str:
        """Generate cache key"""
        return f"{cls.CACHE_PREFIX}:{namespace}:{key}"
    
    @classmethod
    def analytics_key(cls, metric: str, timestamp: str) -> str:
        """Generate analytics key"""
        return f"{cls.ANALYTICS_PREFIX}:{metric}:{timestamp}"


class SessionManager:
    """Redis-based session management"""
    
    def __init__(self, redis_client: Redis, ttl: int = None):
        self.redis = redis_client
        self.ttl = ttl or settings.REDIS_SESSION_TTL
    
    async def create_session(self, user_id: str, session_data: Dict[str, Any]) -> str:
        """Create a new session"""
        import uuid
        
        session_id = str(uuid.uuid4())
        session_key = RedisKeyManager.session_key(session_id)
        
        # Add metadata
        session_data.update({
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "last_accessed": datetime.utcnow().isoformat(),
        })
        
        # Store session data
        await self.redis.hset(session_key, mapping={
            k: json.dumps(v) if not isinstance(v, str) else v 
            for k, v in session_data.items()
        })
        
        # Set expiration
        await self.redis.expire(session_key, self.ttl)
        
        # Add to user's session list
        user_sessions_key = RedisKeyManager.user_session_key(user_id)
        await self.redis.sadd(user_sessions_key, session_id)
        await self.redis.expire(user_sessions_key, self.ttl)
        
        logger.info("Session created", session_id=session_id, user_id=user_id)
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        session_key = RedisKeyManager.session_key(session_id)
        
        session_data = await self.redis.hgetall(session_key)
        if not session_data:
            return None
        
        # Parse JSON values
        parsed_data = {}
        for k, v in session_data.items():
            try:
                parsed_data[k] = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                parsed_data[k] = v
        
        # Update last accessed time
        await self.touch_session(session_id)
        
        return parsed_data
    
    async def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session data"""
        session_key = RedisKeyManager.session_key(session_id)
        
        # Check if session exists
        if not await self.redis.exists(session_key):
            return False
        
        # Add last accessed time
        updates["last_accessed"] = datetime.utcnow().isoformat()
        
        # Update data
        await self.redis.hset(session_key, mapping={
            k: json.dumps(v) if not isinstance(v, str) else v 
            for k, v in updates.items()
        })
        
        # Refresh TTL
        await self.redis.expire(session_key, self.ttl)
        
        return True
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        session_key = RedisKeyManager.session_key(session_id)
        
        # Get user_id before deletion
        user_id = await self.redis.hget(session_key, "user_id")
        
        # Delete session
        result = await self.redis.delete(session_key)
        
        # Remove from user's session list
        if user_id:
            user_sessions_key = RedisKeyManager.user_session_key(user_id)
            await self.redis.srem(user_sessions_key, session_id)
        
        logger.info("Session deleted", session_id=session_id)
        return bool(result)
    
    async def touch_session(self, session_id: str) -> bool:
        """Update session last accessed time and refresh TTL"""
        session_key = RedisKeyManager.session_key(session_id)
        
        if not await self.redis.exists(session_key):
            return False
        
        await self.redis.hset(
            session_key, 
            "last_accessed", 
            datetime.utcnow().isoformat()
        )
        await self.redis.expire(session_key, self.ttl)
        
        return True
    
    async def get_user_sessions(self, user_id: str) -> List[str]:
        """Get all active sessions for a user"""
        user_sessions_key = RedisKeyManager.user_session_key(user_id)
        sessions = await self.redis.smembers(user_sessions_key)
        return list(sessions)


class ConversationCache:
    """Redis-based conversation history management"""
    
    def __init__(self, redis_client: Redis, max_history: int = 50):
        self.redis = redis_client
        self.max_history = max_history
    
    async def add_message(self, conversation_id: str, message: Dict[str, Any]) -> None:
        """Add a message to conversation history"""
        history_key = RedisKeyManager.conversation_history_key(conversation_id)
        
        # Add timestamp
        message["timestamp"] = datetime.utcnow().isoformat()
        
        # Add to list (newest first)
        await self.redis.lpush(history_key, json.dumps(message))
        
        # Trim to max history
        await self.redis.ltrim(history_key, 0, self.max_history - 1)
        
        # Set TTL (24 hours for conversation history)
        await self.redis.expire(history_key, 86400)
    
    async def get_history(self, conversation_id: str, limit: int = None) -> List[Dict[str, Any]]:
        """Get conversation history"""
        history_key = RedisKeyManager.conversation_history_key(conversation_id)
        
        # Get messages (newest first)
        limit = limit or self.max_history
        messages = await self.redis.lrange(history_key, 0, limit - 1)
        
        # Parse JSON messages
        parsed_messages = []
        for msg in messages:
            try:
                parsed_messages.append(json.loads(msg))
            except json.JSONDecodeError:
                logger.warning("Failed to parse message", message=msg)
                continue
        
        return parsed_messages
    
    async def clear_history(self, conversation_id: str) -> None:
        """Clear conversation history"""
        history_key = RedisKeyManager.conversation_history_key(conversation_id)
        await self.redis.delete(history_key)


class RateLimiter:
    """Redis-based rate limiting using token bucket algorithm"""
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    async def is_allowed(
        self, 
        identifier: str, 
        limit: int, 
        window: int, 
        burst: int = None
    ) -> tuple[bool, Dict[str, Any]]:
        """
        Check if request is allowed under rate limit
        Returns (allowed, info) where info contains remaining, reset_time, etc.
        """
        current_time = datetime.utcnow()
        window_start = current_time.replace(second=0, microsecond=0)
        
        rate_key = RedisKeyManager.rate_limit_key(
            identifier, 
            window_start.strftime("%Y-%m-%d:%H:%M")
        )
        
        # Use Lua script for atomic increment and check
        lua_script = """
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local current_time = tonumber(ARGV[3])
        
        local current = redis.call('GET', key)
        if current == false then
            current = 0
        else
            current = tonumber(current)
        end
        
        if current < limit then
            local new_val = redis.call('INCR', key)
            if new_val == 1 then
                redis.call('EXPIRE', key, window)
            end
            return {1, new_val, limit - new_val, current_time + window}
        else
            local ttl = redis.call('TTL', key)
            return {0, current, 0, current_time + ttl}
        end
        """
        
        result = await self.redis.eval(
            lua_script,
            1,
            rate_key,
            str(limit),
            str(window),
            str(int(current_time.timestamp()))
        )
        
        allowed = bool(result[0])
        current_count = result[1]
        remaining = result[2]
        reset_time = result[3]
        
        info = {
            "allowed": allowed,
            "current": current_count,
            "remaining": remaining,
            "limit": limit,
            "reset_time": reset_time,
            "window": window
        }
        
        return allowed, info


class CacheManager:
    """Generic Redis cache manager"""
    
    def __init__(self, redis_client: Redis, default_ttl: int = 3600):
        self.redis = redis_client
        self.default_ttl = default_ttl
    
    async def get(self, namespace: str, key: str) -> Optional[Any]:
        """Get cached value"""
        cache_key = RedisKeyManager.cache_key(namespace, key)
        value = await self.redis.get(cache_key)
        
        if value is None:
            return None
        
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    
    async def set(
        self, 
        namespace: str, 
        key: str, 
        value: Any, 
        ttl: int = None
    ) -> None:
        """Set cached value"""
        cache_key = RedisKeyManager.cache_key(namespace, key)
        ttl = ttl or self.default_ttl
        
        # Serialize value
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        
        await self.redis.setex(cache_key, ttl, value)
    
    async def delete(self, namespace: str, key: str) -> bool:
        """Delete cached value"""
        cache_key = RedisKeyManager.cache_key(namespace, key)
        result = await self.redis.delete(cache_key)
        return bool(result)
    
    async def exists(self, namespace: str, key: str) -> bool:
        """Check if key exists in cache"""
        cache_key = RedisKeyManager.cache_key(namespace, key)
        result = await self.redis.exists(cache_key)
        return bool(result)


class RedisHealthCheck:
    """Redis health check utilities"""
    
    @staticmethod
    async def check_connection() -> bool:
        """Check Redis connection"""
        try:
            redis_client = await get_redis()
            await redis_client.ping()
            return True
        except Exception as e:
            logger.error("Redis health check failed", error=str(e))
            return False
    
    @staticmethod
    async def get_info() -> Dict[str, Any]:
        """Get Redis server information"""
        try:
            redis_client = await get_redis()
            info = await redis_client.info()
            
            return {
                "version": info.get("redis_version"),
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_connections_received": info.get("total_connections_received"),
                "total_commands_processed": info.get("total_commands_processed"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses"),
            }
        except Exception as e:
            logger.error("Failed to get Redis info", error=str(e))
            return {"error": str(e)}


# Convenience functions for common operations
async def get_session_manager() -> SessionManager:
    """Get session manager instance"""
    redis_client = await get_redis()
    return SessionManager(redis_client)


async def get_conversation_cache() -> ConversationCache:
    """Get conversation cache instance"""
    redis_client = await get_redis()
    return ConversationCache(redis_client)


async def get_rate_limiter() -> RateLimiter:
    """Get rate limiter instance"""
    redis_client = await get_redis()
    return RateLimiter(redis_client)


async def get_cache_manager() -> CacheManager:
    """Get cache manager instance"""
    redis_client = await get_redis()
    return CacheManager(redis_client)
