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
        "roles": ["customer", "admin"],
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

