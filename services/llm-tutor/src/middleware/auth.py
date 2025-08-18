"""
Authentication middleware for LLM Tutor service
Handles JWT token validation and user context injection
"""

import logging
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import structlog

from ..config.settings import settings
from ..core.database import get_db
from ..models.user import User

logger = structlog.get_logger(__name__)

security = HTTPBearer()


class AuthMiddleware:
    """Authentication middleware for FastAPI"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        # This would implement ASGI middleware for global auth
        # For now, we'll use dependency injection
        await self.app(scope, receive, send)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user
    Validates JWT token and returns user object
    """
    
    try:
        # Decode JWT token
        token = credentials.credentials
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Get user ID from token
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from database
        stmt = select(User).where(User.external_id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user.is_active:
            raise HTTPException(status_code=401, detail="User is inactive")
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error("Authentication failed", error=str(e))
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    """
    Dependency to get current user if authenticated, None otherwise
    Used for optional authentication endpoints
    """
    
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None
