"""
Rate limiting middleware for the LLM Tutor service
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
import structlog
from typing import Dict, Optional
import hashlib

from ..core.redis import get_redis
from ..core.exceptions import RateLimitExceededError
from ..config.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using Redis for distributed rate limiting"""
    
    def __init__(self, app):
        super().__init__(app)
        self.default_limits = {
            "requests_per_minute": settings.RATE_LIMIT_REQUESTS_PER_MINUTE,
            "burst": settings.RATE_LIMIT_BURST
        }
        
        # Different limits for different user tiers
        self.tier_limits = {
            "free": {"requests_per_minute": 30, "burst": 5},
            "premium": {"requests_per_minute": 120, "burst": 20},
            "admin": {"requests_per_minute": 1000, "burst": 100}
        }
        
        # Different limits for different endpoints
        self.endpoint_limits = {
            "/api/v1/conversations/*/messages/voice": {"requests_per_minute": 10, "burst": 2},
            "/api/v1/conversations/*/messages": {"requests_per_minute": 60, "burst": 10},
            "/api/v1/conversations": {"requests_per_minute": 20, "burst": 5}
        }

    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting"""
        
        # Skip rate limiting for health checks and metrics
        if request.url.path in ["/health", "/ready", "/metrics"]:
            return await call_next(request)
        
        # Get client identifier
        client_id = await self._get_client_identifier(request)
        
        # Get user tier if authenticated
        user_tier = await self._get_user_tier(request)
        
        # Get rate limit configuration
        limits = self._get_limits_for_request(request, user_tier)
        
        # Check rate limit
        allowed, rate_limit_info = await self._check_rate_limit(
            client_id, 
            request.url.path,
            limits["requests_per_minute"],
            limits["burst"]
        )
        
        if not allowed:
            logger.warning(
                "Rate limit exceeded",
                client_id=client_id,
                path=request.url.path,
                rate_limit_info=rate_limit_info
            )
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded: {limits['requests_per_minute']} requests per minute",
                        "details": {
                            "limit": limits["requests_per_minute"],
                            "window": "minute",
                            "retry_after": rate_limit_info.get("retry_after", 60)
                        }
                    }
                },
                headers={
                    "X-RateLimit-Limit": str(limits["requests_per_minute"]),
                    "X-RateLimit-Remaining": str(rate_limit_info.get("remaining", 0)),
                    "X-RateLimit-Reset": str(rate_limit_info.get("reset_time", int(time.time()) + 60)),
                    "Retry-After": str(rate_limit_info.get("retry_after", 60))
                }
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limits["requests_per_minute"])
        response.headers["X-RateLimit-Remaining"] = str(rate_limit_info.get("remaining", 0))
        response.headers["X-RateLimit-Reset"] = str(rate_limit_info.get("reset_time", int(time.time()) + 60))
        
        return response

    async def _get_client_identifier(self, request: Request) -> str:
        """Get unique client identifier for rate limiting"""
        # Try to get user ID from authentication
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        return f"ip:{client_ip}"

    async def _get_user_tier(self, request: Request) -> str:
        """Get user tier for rate limiting"""
        # This would typically come from the authentication middleware
        user_tier = getattr(request.state, "user_tier", None)
        return user_tier or "free"

    def _get_limits_for_request(self, request: Request, user_tier: str) -> Dict[str, int]:
        """Get rate limits for the specific request"""
        # Check endpoint-specific limits first
        for pattern, limits in self.endpoint_limits.items():
            if self._matches_pattern(request.url.path, pattern):
                return limits
        
        # Use tier-specific limits
        return self.tier_limits.get(user_tier, self.default_limits)

    def _matches_pattern(self, path: str, pattern: str) -> bool:
        """Check if path matches pattern (simple wildcard matching)"""
        if "*" not in pattern:
            return path == pattern
        
        # Simple wildcard matching
        pattern_parts = pattern.split("*")
        if len(pattern_parts) == 2:
            return path.startswith(pattern_parts[0]) and path.endswith(pattern_parts[1])
        
        return False

    async def _check_rate_limit(
        self, 
        client_id: str, 
        endpoint: str, 
        limit: int, 
        burst: int
    ) -> tuple[bool, Dict]:
        """Check rate limit using sliding window algorithm"""
        try:
            redis = await get_redis()
            current_time = int(time.time())
            window_start = current_time - 60  # 1 minute window
            
            # Create keys
            key = f"rate_limit:{client_id}:{endpoint}"
            burst_key = f"rate_limit_burst:{client_id}:{endpoint}"
            
            # Use Redis pipeline for atomic operations
            pipe = redis.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(key)
            
            # Get burst count
            pipe.get(burst_key)
            
            results = await pipe.execute()
            current_count = results[1]
            burst_count = int(results[2] or 0)
            
            # Check burst limit first
            if burst_count >= burst:
                # Check if burst window has expired
                burst_ttl = await redis.ttl(burst_key)
                if burst_ttl > 0:
                    return False, {
                        "remaining": 0,
                        "reset_time": current_time + burst_ttl,
                        "retry_after": burst_ttl
                    }
            
            # Check main rate limit
            if current_count >= limit:
                return False, {
                    "remaining": 0,
                    "reset_time": current_time + 60,
                    "retry_after": 60
                }
            
            # Record this request
            pipe = redis.pipeline()
            pipe.zadd(key, {str(current_time): current_time})
            pipe.expire(key, 60)
            
            # Update burst counter
            pipe.incr(burst_key)
            pipe.expire(burst_key, 10)  # 10 second burst window
            
            await pipe.execute()
            
            return True, {
                "remaining": limit - current_count - 1,
                "reset_time": current_time + 60,
                "retry_after": 0
            }
            
        except Exception as e:
            logger.error("Rate limit check failed", error=str(e))
            # Fail open - allow request if Redis is unavailable
            return True, {"remaining": limit, "reset_time": current_time + 60, "retry_after": 0}
