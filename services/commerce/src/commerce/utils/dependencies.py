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
    
    Validates JWT token with Identity Service and extracts user claims.
    """
    import httpx
    import os
    
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Get JWT secret from environment
        jwt_secret = os.getenv('JWT_SECRET', 'dev_jwt_secret_key_change_in_production')
        
        # Validate JWT token using python-jose
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(
            token, 
            jwt_secret, 
            algorithms=['HS256']
        )
        
        # Validate with Identity Service
        identity_service_url = os.getenv('IDENTITY_SERVICE_URL', 'http://localhost:8081')
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    f"{identity_service_url}/api/v1/users/{payload['sub']}/validate",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token validation failed with Identity Service"
                    )
            except httpx.RequestError:
                # If Identity Service is down, proceed with JWT validation only
                # This provides graceful degradation
                pass
        
        return {
            "sub": payload.get("sub"),
            "email": payload.get("email"),
            "roles": payload.get("roles", []),
            "session_id": payload.get("sid"),
            "mfa_level": payload.get("mfa_level", 0),
        }
        
    except jose_jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jose_jwt.JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


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


# Service Dependencies

def get_order_service():
    """Get order service instance."""
    from ..application.order_service import OrderService
    from ..infrastructure.persistence.saga_repository import SagaRepository
    
    saga_repo = SagaRepository()
    saga_orchestrator = SagaOrchestrator(saga_repo)
    
    return OrderService(
        aggregate_repo=get_aggregate_repository(),
        cart_repo=get_cart_repository(),
        saga_orchestrator=saga_orchestrator,
    )


def get_saga_orchestrator():
    """Get saga orchestrator instance."""
    from ..application.saga_orchestrator import SagaOrchestrator
    from ..infrastructure.persistence.saga_repository import SagaRepository
    
    saga_repo = SagaRepository()
    return SagaOrchestrator(saga_repo)


def get_inventory_service():
    """Get inventory service instance."""
    from ..application.inventory_service import InventoryService
    from ..infrastructure.persistence.inventory_repository import InventoryRepository
    
    # Create dependencies inline for now
    from ..infrastructure.database import get_session_factory
    from ..infrastructure.messaging.event_bus import EventBus
    
    session_factory = get_session_factory()
    db_session = session_factory()
    
    event_store = get_event_store()
    event_bus = EventBus()
    
    inventory_repo = InventoryRepository(db_session, event_store)
    return InventoryService(inventory_repo, event_bus)

