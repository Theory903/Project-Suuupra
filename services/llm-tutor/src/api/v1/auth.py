"""
Authentication API endpoints for the LLM Tutor service
"""

from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import structlog
from datetime import datetime, timedelta

from ...core.database import get_db_session
from ...core.exceptions import UserNotAuthorizedError
from ...security.auth_security import AuthenticationManager, AuthContext, UserRole
from ...models.user import User
from ... import schemas

logger = structlog.get_logger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)

# Initialize authentication manager
auth_manager = None

def get_auth_manager():
    global auth_manager
    if not auth_manager:
        from ...config.settings import get_settings
        settings = get_settings()
        auth_manager = AuthenticationManager(settings.JWT_SECRET_KEY)
    return auth_manager

@router.post("/login", response_model=schemas.AuthResponse)
async def login(
    credentials: schemas.LoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Authenticate user and return JWT tokens"""
    
    try:
        auth_mgr = get_auth_manager()
        
        # Authenticate user
        auth_context = await auth_mgr.authenticate_password(
            credentials.username,
            credentials.password,
            credentials.ip_address or "unknown",
            credentials.user_agent or "unknown"
        )
        
        if not auth_context:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Create token pair
        access_token, refresh_token = await auth_mgr.create_token_pair(auth_context)
        
        logger.info(
            "User logged in",
            user_id=auth_context.user_id,
            username=auth_context.username
        )
        
        return schemas.AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=1800,  # 30 minutes
            user=schemas.UserInfo(
                id=auth_context.user_id,
                username=auth_context.username,
                roles=[role.value for role in auth_context.roles]
            )
        )
        
    except Exception as e:
        logger.error("Login failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

@router.post("/refresh", response_model=schemas.TokenResponse)
async def refresh_token(
    request: schemas.RefreshTokenRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Refresh access token using refresh token"""
    
    try:
        auth_mgr = get_auth_manager()
        
        # Refresh tokens
        new_access_token, new_refresh_token = await auth_mgr.refresh_access_token(
            request.refresh_token
        )
        
        if not new_access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        return schemas.TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=1800
        )
        
    except Exception as e:
        logger.error("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session)
):
    """Logout user and invalidate tokens"""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication token provided"
        )
    
    try:
        auth_mgr = get_auth_manager()
        
        # Validate and get auth context
        auth_context = await auth_mgr.authenticate_token(
            credentials.credentials,
            "unknown",
            "unknown"
        )
        
        if auth_context:
            # Logout user (invalidate sessions)
            await auth_mgr.logout(auth_context)
            
            logger.info(
                "User logged out",
                user_id=auth_context.user_id,
                username=auth_context.username
            )
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        logger.error("Logout failed", error=str(e))
        # Return success even if logout fails to avoid information leakage
        return {"message": "Logged out successfully"}

@router.get("/me", response_model=schemas.UserProfile)
async def get_current_user_profile(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session)
):
    """Get current user profile"""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication token provided"
        )
    
    try:
        auth_mgr = get_auth_manager()
        
        # Validate token and get user context
        auth_context = await auth_mgr.authenticate_token(
            credentials.credentials,
            "unknown",
            "unknown"
        )
        
        if not auth_context:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        # Get user from database
        from sqlalchemy import select
        result = await db.execute(
            select(User).where(User.external_id == auth_context.user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return schemas.UserProfile(
            id=str(user.id),
            external_id=user.external_id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_premium=user.is_premium,
            created_at=user.created_at,
            last_login_at=user.last_login_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user profile", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile"
        )

@router.post("/verify-token")
async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify if token is valid"""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication token provided"
        )
    
    try:
        auth_mgr = get_auth_manager()
        
        # Validate token
        auth_context = await auth_mgr.authenticate_token(
            credentials.credentials,
            "unknown",
            "unknown"
        )
        
        if not auth_context:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return {
            "valid": True,
            "user_id": auth_context.user_id,
            "username": auth_context.username,
            "expires_at": auth_context.expires_at.isoformat(),
            "roles": [role.value for role in auth_context.roles]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Token verification failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed"
        )

@router.post("/change-password")
async def change_password(
    request: schemas.ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session)
):
    """Change user password"""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication token provided"
        )
    
    try:
        auth_mgr = get_auth_manager()
        
        # Validate current token
        auth_context = await auth_mgr.authenticate_token(
            credentials.credentials,
            "unknown",
            "unknown"
        )
        
        if not auth_context:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Verify current password
        current_auth = await auth_mgr.authenticate_password(
            auth_context.username,
            request.current_password,
            "unknown",
            "unknown"
        )
        
        if not current_auth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Update password in database
        import bcrypt
        from sqlalchemy import update
        from ...infrastructure.database import get_session
        from ...domain.models.user import User
        
        # Hash new password
        salt = bcrypt.gensalt()
        hashed_new_password = bcrypt.hashpw(request.new_password.encode('utf-8'), salt)
        
        # Update password in database
        async with get_session() as session:
            try:
                # Update user password
                stmt = update(User).where(
                    User.user_id == auth_context.user_id
                ).values(
                    password_hash=hashed_new_password.decode('utf-8'),
                    password_changed_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                result = await session.execute(stmt)
                await session.commit()
                
                if result.rowcount == 0:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User not found"
                    )
                
                # Log security event
                await session.execute(
                    """
                    INSERT INTO security_events (
                        user_id, event_type, event_data, ip_address, user_agent, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    [
                        auth_context.user_id,
                        'password_changed',
                        json.dumps({"method": "api", "timestamp": datetime.utcnow().isoformat()}),
                        request.headers.get('x-forwarded-for', request.client.host),
                        request.headers.get('user-agent'),
                        datetime.utcnow()
                    ]
                )
                await session.commit()
                
            except HTTPException:
                await session.rollback()
                raise
            except Exception as e:
                await session.rollback()
                logger.error("Database error during password update", error=str(e))
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update password"
                )
        
        logger.info(
            "Password changed",
            user_id=auth_context.user_id,
            username=auth_context.username
        )
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Password change failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )
