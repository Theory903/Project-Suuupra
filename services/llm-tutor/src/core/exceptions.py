"""
Exception handlers and custom exceptions for the LLM Tutor service
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import structlog
import traceback
from typing import Dict, Any

logger = structlog.get_logger(__name__)


class LLMTutorException(Exception):
    """Base exception for LLM Tutor service"""
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        self.message = message
        self.error_code = error_code or "INTERNAL_ERROR"
        self.details = details or {}
        super().__init__(self.message)


class ModelNotAvailableError(LLMTutorException):
    """Raised when a required model is not available"""
    def __init__(self, model_name: str):
        super().__init__(
            message=f"Model '{model_name}' is not available",
            error_code="MODEL_NOT_AVAILABLE",
            details={"model_name": model_name}
        )


class SafetyViolationError(LLMTutorException):
    """Raised when content violates safety policies"""
    def __init__(self, violation_type: str, confidence: float = None):
        super().__init__(
            message=f"Content violates safety policy: {violation_type}",
            error_code="SAFETY_VIOLATION",
            details={"violation_type": violation_type, "confidence": confidence}
        )


class RateLimitExceededError(LLMTutorException):
    """Raised when rate limit is exceeded"""
    def __init__(self, limit: int, window: str):
        super().__init__(
            message=f"Rate limit exceeded: {limit} requests per {window}",
            error_code="RATE_LIMIT_EXCEEDED",
            details={"limit": limit, "window": window}
        )


class ConversationNotFoundError(LLMTutorException):
    """Raised when a conversation is not found"""
    def __init__(self, conversation_id: str):
        super().__init__(
            message=f"Conversation '{conversation_id}' not found",
            error_code="CONVERSATION_NOT_FOUND",
            details={"conversation_id": conversation_id}
        )


class UserNotAuthorizedError(LLMTutorException):
    """Raised when user is not authorized for an action"""
    def __init__(self, action: str, resource: str = None):
        super().__init__(
            message=f"User not authorized for action: {action}" + (f" on {resource}" if resource else ""),
            error_code="USER_NOT_AUTHORIZED",
            details={"action": action, "resource": resource}
        )


class VoiceProcessingError(LLMTutorException):
    """Raised when voice processing fails"""
    def __init__(self, operation: str, reason: str):
        super().__init__(
            message=f"Voice {operation} failed: {reason}",
            error_code="VOICE_PROCESSING_ERROR",
            details={"operation": operation, "reason": reason}
        )


async def llm_tutor_exception_handler(request: Request, exc: LLMTutorException):
    """Handle custom LLM Tutor exceptions"""
    logger.error(
        "LLM Tutor exception occurred",
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
        path=request.url.path,
        method=request.method
    )
    
    # Map error codes to HTTP status codes
    status_code_map = {
        "MODEL_NOT_AVAILABLE": 503,
        "SAFETY_VIOLATION": 400,
        "RATE_LIMIT_EXCEEDED": 429,
        "CONVERSATION_NOT_FOUND": 404,
        "USER_NOT_AUTHORIZED": 403,
        "VOICE_PROCESSING_ERROR": 422,
        "INTERNAL_ERROR": 500,
    }
    
    status_code = status_code_map.get(exc.error_code, 500)
    
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions"""
    logger.warning(
        "HTTP exception occurred",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "details": {}
            }
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    logger.warning(
        "Request validation failed",
        errors=exc.errors(),
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {
                    "validation_errors": exc.errors()
                }
            }
        }
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(
        "Unexpected exception occurred",
        error=str(exc),
        traceback=traceback.format_exc(),
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {}
            }
        }
    )


def setup_exception_handlers(app: FastAPI):
    """Setup all exception handlers"""
    app.add_exception_handler(LLMTutorException, llm_tutor_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
