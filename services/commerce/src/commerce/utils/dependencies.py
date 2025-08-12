"""
FastAPI dependencies for Commerce Service.

Provides dependency injection for common services and authentication.
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..infrastructure.persistence.cart_repository import CartRepository
from ..infrastructure.persistence.event_store import EventStore, AggregateRepository

# Security
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Get current authenticated user from JWT token.
    
    This is a simplified implementation. In production, you would:
    1. Verify JWT signature against JWKS
    2. Validate issuer, audience, expiration
    3. Extract user claims and roles
    """
    # TODO: Implement proper JWT validation
    # For now, return a mock user for development
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Mock user data - replace with actual JWT parsing
    return {
        "sub": "user-123",  # User ID
        "email": "user@example.com",
        "roles": ["customer"],
        "session_id": "session-456",
    }


async def get_current_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current user and verify admin role."""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# Repository Dependencies

def get_cart_repository() -> CartRepository:
    """Get cart repository instance."""
    return CartRepository()


def get_event_store() -> EventStore:
    """Get event store instance."""
    return EventStore()


def get_aggregate_repository() -> AggregateRepository:
    """Get aggregate repository instance."""
    event_store = get_event_store()
    return AggregateRepository(event_store)

