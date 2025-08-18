"""
Request logging middleware for the LLM Tutor service
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import structlog
import uuid
from typing import Dict, Any
import json

logger = structlog.get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for comprehensive request/response logging"""
    
    def __init__(self, app):
        super().__init__(app)
        self.sensitive_headers = {
            "authorization", "x-api-key", "cookie", "x-auth-token"
        }
        self.sensitive_paths = {
            "/api/v1/auth/login", "/api/v1/auth/register"
        }

    async def dispatch(self, request: Request, call_next):
        """Process request with comprehensive logging"""
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Log request
        await self._log_request(request, request_id)
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log response
            await self._log_response(request, response, request_id, duration)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Log error
            duration = time.time() - start_time
            await self._log_error(request, e, request_id, duration)
            raise

    async def _log_request(self, request: Request, request_id: str):
        """Log incoming request details"""
        
        # Get client information
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        # Get user information if available
        user_id = getattr(request.state, "user_id", None)
        user_tier = getattr(request.state, "user_tier", None)
        
        # Sanitize headers
        headers = self._sanitize_headers(dict(request.headers))
        
        # Get request body size
        body_size = 0
        if hasattr(request, "_body"):
            body_size = len(request._body) if request._body else 0
        
        logger.info(
            "Request received",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            query_params=dict(request.query_params),
            client_ip=client_ip,
            user_agent=request.headers.get("User-Agent"),
            user_id=user_id,
            user_tier=user_tier,
            headers=headers,
            body_size=body_size,
            content_type=request.headers.get("Content-Type")
        )

    async def _log_response(
        self, 
        request: Request, 
        response: Response, 
        request_id: str, 
        duration: float
    ):
        """Log response details"""
        
        # Get response body size if available
        body_size = 0
        if hasattr(response, "body"):
            body_size = len(response.body) if response.body else 0
        
        # Determine log level based on status code
        if response.status_code >= 500:
            log_func = logger.error
        elif response.status_code >= 400:
            log_func = logger.warning
        else:
            log_func = logger.info
        
        log_func(
            "Request completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration * 1000, 2),
            response_size=body_size,
            content_type=response.headers.get("Content-Type")
        )

    async def _log_error(
        self, 
        request: Request, 
        error: Exception, 
        request_id: str, 
        duration: float
    ):
        """Log request error"""
        
        logger.error(
            "Request failed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            error=str(error),
            error_type=type(error).__name__,
            duration_ms=round(duration * 1000, 2)
        )

    def _sanitize_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Remove sensitive information from headers"""
        sanitized = {}
        
        for key, value in headers.items():
            key_lower = key.lower()
            if key_lower in self.sensitive_headers:
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = value
        
        return sanitized

    def _should_log_body(self, request: Request) -> bool:
        """Determine if request body should be logged"""
        
        # Don't log sensitive endpoints
        if request.url.path in self.sensitive_paths:
            return False
        
        # Don't log large bodies
        if hasattr(request, "_body") and request._body:
            if len(request._body) > 10000:  # 10KB limit
                return False
        
        # Don't log file uploads
        content_type = request.headers.get("Content-Type", "")
        if "multipart/form-data" in content_type:
            return False
        
        return True
