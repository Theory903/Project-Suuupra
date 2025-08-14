"""
Redis Caching Implementation for Commerce Service.

This module provides comprehensive caching strategies including:
- Read model caching
- Query result caching
- Frequently accessed data caching
- Cache invalidation strategies
- Cache warming
"""

import json
import pickle
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Union, Callable
from functools import wraps
import asyncio

import redis.asyncio as aioredis
import structlog
from pydantic import BaseModel

from ...domain.events.base import DomainEvent
from ..messaging.event_bus import EventBus


logger = structlog.get_logger(__name__)


class CacheConfig:
    """Cache configuration settings."""
    
    # Default TTL values (in seconds)
    DEFAULT_TTL = 3600  # 1 hour
    SHORT_TTL = 300     # 5 minutes
    MEDIUM_TTL = 1800   # 30 minutes
    LONG_TTL = 86400    # 24 hours
    
    # Cache key prefixes
    ORDER_PREFIX = "commerce:order:"
    INVENTORY_PREFIX = "commerce:inventory:"
    CUSTOMER_PREFIX = "commerce:customer:"
    PRODUCT_PREFIX = "commerce:product:"
    CART_PREFIX = "commerce:cart:"
    ANALYTICS_PREFIX = "commerce:analytics:"
    QUERY_PREFIX = "commerce:query:"
    
    # Cache strategies
    WRITE_THROUGH = "write_through"
    WRITE_BEHIND = "write_behind"
    CACHE_ASIDE = "cache_aside"


class CacheKey:
    """Utility class for generating cache keys."""
    
    @staticmethod
    def order(order_id: str) -> str:
        return f"{CacheConfig.ORDER_PREFIX}{order_id}"
    
    @staticmethod
    def order_list(customer_id: str, **filters) -> str:
        filter_hash = CacheKey._hash_filters(filters)
        return f"{CacheConfig.ORDER_PREFIX}list:{customer_id}:{filter_hash}"
    
    @staticmethod
    def inventory_item(inventory_id: str) -> str:
        return f"{CacheConfig.INVENTORY_PREFIX}item:{inventory_id}"
    
    @staticmethod
    def inventory_by_product(product_id: str) -> str:
        return f"{CacheConfig.INVENTORY_PREFIX}product:{product_id}"
    
    @staticmethod
    def inventory_summary(inventory_id: str) -> str:
        return f"{CacheConfig.INVENTORY_PREFIX}summary:{inventory_id}"
    
    @staticmethod
    def low_stock_items() -> str:
        return f"{CacheConfig.INVENTORY_PREFIX}low_stock"
    
    @staticmethod
    def reorder_items() -> str:
        return f"{CacheConfig.INVENTORY_PREFIX}reorder"
    
    @staticmethod
    def customer_profile(customer_id: str) -> str:
        return f"{CacheConfig.CUSTOMER_PREFIX}profile:{customer_id}"
    
    @staticmethod
    def customer_orders(customer_id: str, **filters) -> str:
        filter_hash = CacheKey._hash_filters(filters)
        return f"{CacheConfig.CUSTOMER_PREFIX}orders:{customer_id}:{filter_hash}"
    
    @staticmethod
    def shopping_cart(customer_id: str) -> str:
        return f"{CacheConfig.CART_PREFIX}{customer_id}"
    
    @staticmethod
    def analytics(metric_name: str, **params) -> str:
        param_hash = CacheKey._hash_filters(params)
        return f"{CacheConfig.ANALYTICS_PREFIX}{metric_name}:{param_hash}"
    
    @staticmethod
    def query_result(query_name: str, **params) -> str:
        param_hash = CacheKey._hash_filters(params)
        return f"{CacheConfig.QUERY_PREFIX}{query_name}:{param_hash}"
    
    @staticmethod
    def _hash_filters(filters: Dict[str, Any]) -> str:
        """Create a hash from filter parameters."""
        filter_str = json.dumps(filters, sort_keys=True, default=str)
        return hashlib.md5(filter_str.encode()).hexdigest()[:8]


class CacheSerializer:
    """Handles serialization/deserialization for different data types."""
    
    @staticmethod
    def serialize(data: Any) -> bytes:
        """Serialize data for Redis storage."""
        if isinstance(data, (str, int, float, bool)):
            return str(data).encode('utf-8')
        elif isinstance(data, BaseModel):
            return data.model_dump_json().encode('utf-8')
        elif isinstance(data, dict):
            return json.dumps(data, default=str).encode('utf-8')
        else:
            return pickle.dumps(data)
    
    @staticmethod
    def deserialize(data: bytes, data_type: Optional[type] = None) -> Any:
        """Deserialize data from Redis."""
        try:
            if data_type and issubclass(data_type, BaseModel):
                return data_type.model_validate_json(data)
            else:
                # Try JSON first
                return json.loads(data.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            # Fall back to pickle
            return pickle.loads(data)


class RedisCacheManager:
    """
    Redis-based cache manager with advanced caching strategies.
    
    Provides comprehensive caching functionality including:
    - Multiple caching patterns
    - Automatic cache invalidation
    - Cache warming strategies
    - Performance monitoring
    """
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        event_bus: Optional[EventBus] = None,
        max_connections: int = 50
    ):
        self.redis_url = redis_url
        self.event_bus = event_bus
        self.max_connections = max_connections
        self.redis: Optional[aioredis.Redis] = None
        
        # Cache statistics
        self.stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "invalidations": 0
        }
        
        # Cache invalidation patterns
        self.invalidation_patterns = {
            "OrderCreatedEvent": [
                lambda e: CacheKey.customer_orders(e.customer_id),
                lambda e: CacheKey.order_list(e.customer_id)
            ],
            "OrderUpdatedEvent": [
                lambda e: CacheKey.order(e.order_id),
                lambda e: CacheKey.customer_orders(e.customer_id)
            ],
            "InventoryItemCreatedEvent": [
                lambda e: CacheKey.inventory_by_product(e.product_id),
                lambda e: CacheKey.low_stock_items(),
                lambda e: CacheKey.reorder_items()
            ],
            "InventoryItemUpdatedEvent": [
                lambda e: CacheKey.inventory_item(e.inventory_id),
                lambda e: CacheKey.inventory_summary(e.inventory_id),
                lambda e: CacheKey.inventory_by_product(e.product_id)
            ],
            "StockReservedEvent": [
                lambda e: CacheKey.inventory_item(e.inventory_id),
                lambda e: CacheKey.inventory_summary(e.inventory_id)
            ],
            "LowStockAlertEvent": [
                lambda e: CacheKey.low_stock_items(),
                lambda e: CacheKey.inventory_summary(e.inventory_id)
            ],
            "ReorderRequiredEvent": [
                lambda e: CacheKey.reorder_items(),
                lambda e: CacheKey.inventory_summary(e.inventory_id)
            ]
        }
    
    async def initialize(self):
        """Initialize Redis connection."""
        try:
            self.redis = aioredis.from_url(
                self.redis_url,
                max_connections=self.max_connections,
                decode_responses=False  # We handle encoding ourselves
            )
            
            # Test connection
            await self.redis.ping()
            
            # Subscribe to events for cache invalidation
            if self.event_bus:
                await self.event_bus.subscribe(
                    "cache_invalidation",
                    self._handle_cache_invalidation
                )
            
            logger.info("Redis cache manager initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize Redis cache manager", error=str(e))
            raise
    
    async def close(self):
        """Close Redis connection."""
        if self.redis:
            await self.redis.close()
    
    async def get(
        self,
        key: str,
        data_type: Optional[type] = None,
        default: Any = None
    ) -> Any:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            data_type: Expected data type for deserialization
            default: Default value if key not found
            
        Returns:
            Cached value or default
        """
        try:
            if not self.redis:
                return default
            
            data = await self.redis.get(key)
            
            if data is None:
                self.stats["misses"] += 1
                return default
            
            self.stats["hits"] += 1
            return CacheSerializer.deserialize(data, data_type)
            
        except Exception as e:
            logger.error("Cache get failed", key=key, error=str(e))
            self.stats["misses"] += 1
            return default
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        nx: bool = False,
        xx: bool = False
    ) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            nx: Only set if key doesn't exist
            xx: Only set if key exists
            
        Returns:
            True if set successfully
        """
        try:
            if not self.redis:
                return False
            
            serialized_value = CacheSerializer.serialize(value)
            ttl = ttl or CacheConfig.DEFAULT_TTL
            
            result = await self.redis.set(
                key, serialized_value, ex=ttl, nx=nx, xx=xx
            )
            
            if result:
                self.stats["sets"] += 1
                return True
            
            return False
            
        except Exception as e:
            logger.error("Cache set failed", key=key, error=str(e))
            return False
    
    async def delete(self, *keys: str) -> int:
        """
        Delete keys from cache.
        
        Args:
            keys: Cache keys to delete
            
        Returns:
            Number of keys deleted
        """
        try:
            if not self.redis or not keys:
                return 0
            
            result = await self.redis.delete(*keys)
            self.stats["deletes"] += result
            return result
            
        except Exception as e:
            logger.error("Cache delete failed", keys=keys, error=str(e))
            return 0
    
    async def exists(self, *keys: str) -> int:
        """Check if keys exist in cache."""
        try:
            if not self.redis:
                return 0
            
            return await self.redis.exists(*keys)
            
        except Exception as e:
            logger.error("Cache exists check failed", keys=keys, error=str(e))
            return 0
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration time for a key."""
        try:
            if not self.redis:
                return False
            
            return await self.redis.expire(key, ttl)
            
        except Exception as e:
            logger.error("Cache expire failed", key=key, error=str(e))
            return False
    
    async def increment(self, key: str, amount: int = 1) -> int:
        """Increment a numeric value in cache."""
        try:
            if not self.redis:
                return 0
            
            return await self.redis.incrby(key, amount)
            
        except Exception as e:
            logger.error("Cache increment failed", key=key, error=str(e))
            return 0
    
    async def get_multi(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple values from cache."""
        try:
            if not self.redis or not keys:
                return {}
            
            values = await self.redis.mget(keys)
            result = {}
            
            for key, value in zip(keys, values):
                if value is not None:
                    try:
                        result[key] = CacheSerializer.deserialize(value)
                        self.stats["hits"] += 1
                    except Exception:
                        self.stats["misses"] += 1
                else:
                    self.stats["misses"] += 1
            
            return result
            
        except Exception as e:
            logger.error("Cache get_multi failed", keys=keys, error=str(e))
            self.stats["misses"] += len(keys)
            return {}
    
    async def set_multi(
        self,
        mapping: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Set multiple key-value pairs."""
        try:
            if not self.redis or not mapping:
                return False
            
            pipe = self.redis.pipeline()
            ttl = ttl or CacheConfig.DEFAULT_TTL
            
            for key, value in mapping.items():
                serialized_value = CacheSerializer.serialize(value)
                pipe.setex(key, ttl, serialized_value)
            
            results = await pipe.execute()
            successful = sum(1 for r in results if r)
            self.stats["sets"] += successful
            
            return successful == len(mapping)
            
        except Exception as e:
            logger.error("Cache set_multi failed", error=str(e))
            return False
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a pattern."""
        try:
            if not self.redis:
                return 0
            
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key.decode('utf-8') if isinstance(key, bytes) else key)
            
            if keys:
                deleted = await self.delete(*keys)
                self.stats["invalidations"] += deleted
                return deleted
            
            return 0
            
        except Exception as e:
            logger.error("Cache pattern invalidation failed", pattern=pattern, error=str(e))
            return 0
    
    async def warm_cache(self, warming_functions: Dict[str, Callable]) -> int:
        """Warm cache with commonly accessed data."""
        try:
            warmed_keys = 0
            
            for cache_key, warming_function in warming_functions.items():
                try:
                    data = await warming_function()
                    if data is not None:
                        await self.set(cache_key, data, ttl=CacheConfig.LONG_TTL)
                        warmed_keys += 1
                except Exception as e:
                    logger.warning("Cache warming failed for key", key=cache_key, error=str(e))
            
            logger.info("Cache warming completed", warmed_keys=warmed_keys)
            return warmed_keys
            
        except Exception as e:
            logger.error("Cache warming failed", error=str(e))
            return 0
    
    async def _handle_cache_invalidation(self, event: DomainEvent):
        """Handle cache invalidation based on domain events."""
        try:
            event_type = event.event_type
            
            if event_type in self.invalidation_patterns:
                keys_to_invalidate = []
                
                for pattern_func in self.invalidation_patterns[event_type]:
                    try:
                        key = pattern_func(event)
                        keys_to_invalidate.append(key)
                    except Exception as e:
                        logger.warning("Failed to generate invalidation key", error=str(e))
                
                if keys_to_invalidate:
                    deleted = await self.delete(*keys_to_invalidate)
                    self.stats["invalidations"] += deleted
                    
                    logger.debug(
                        "Cache invalidated",
                        event_type=event_type,
                        keys_deleted=deleted
                    )
            
        except Exception as e:
            logger.error("Cache invalidation failed", event_type=event.event_type, error=str(e))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self.stats["hits"] + self.stats["misses"]
        hit_rate = (self.stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "hits": self.stats["hits"],
            "misses": self.stats["misses"],
            "hit_rate": round(hit_rate, 2),
            "sets": self.stats["sets"],
            "deletes": self.stats["deletes"],
            "invalidations": self.stats["invalidations"],
            "total_requests": total_requests
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check cache health."""
        try:
            if not self.redis:
                return {"healthy": False, "error": "Redis not initialized"}
            
            start_time = datetime.now(timezone.utc)
            await self.redis.ping()
            response_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            info = await self.redis.info()
            
            return {
                "healthy": True,
                "response_time_seconds": response_time,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "unknown"),
                "redis_version": info.get("redis_version", "unknown")
            }
            
        except Exception as e:
            return {"healthy": False, "error": str(e)}


def cache_result(
    key_func: Callable,
    ttl: int = CacheConfig.DEFAULT_TTL,
    data_type: Optional[type] = None
):
    """
    Decorator for caching function results.
    
    Args:
        key_func: Function to generate cache key from function args
        ttl: Time to live in seconds
        data_type: Expected return data type
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Assume first argument is self with cache_manager
            self = args[0]
            cache_manager = getattr(self, 'cache_manager', None)
            
            if not cache_manager:
                return await func(*args, **kwargs)
            
            # Generate cache key
            cache_key = key_func(*args, **kwargs)
            
            # Try to get from cache
            cached_result = await cache_manager.get(cache_key, data_type)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            if result is not None:
                await cache_manager.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


# Cache warming functions
async def warm_popular_products(product_service) -> Dict[str, Any]:
    """Warm cache with popular products."""
    try:
        products = await product_service.get_popular_products(limit=50)
        return {"popular_products": products, "cached_at": datetime.now(timezone.utc)}
    except Exception:
        return None


async def warm_low_stock_items(inventory_service) -> List[Dict[str, Any]]:
    """Warm cache with low stock items."""
    try:
        return await inventory_service.get_low_stock_items()
    except Exception:
        return None


async def warm_customer_analytics(analytics_service) -> Dict[str, Any]:
    """Warm cache with customer analytics."""
    try:
        analytics = await analytics_service.get_customer_summary()
        return {"analytics": analytics, "cached_at": datetime.now(timezone.utc)}
    except Exception:
        return None
