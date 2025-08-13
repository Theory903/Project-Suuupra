"""
Main API router for Commerce Service v1.

Combines all route modules into a single router.
"""

from fastapi import APIRouter

from .routes.cart import router as cart_router
from .routes.orders import router as orders_router
from .routes.admin import router as admin_router
from .routes.inventory import router as inventory_router

api_router = APIRouter()

# Include route modules
api_router.include_router(cart_router, prefix="/cart", tags=["Shopping Cart"])
api_router.include_router(orders_router, prefix="/orders", tags=["Orders"])
api_router.include_router(admin_router, prefix="/admin", tags=["Administration"])
api_router.include_router(inventory_router, tags=["Inventory Management"])

