"""
Inventory API routes for the Commerce Service.

This module provides REST API endpoints for inventory management including
stock operations, reservations, adjustments, and monitoring.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ....application.inventory_service import (
    InventoryService,
    InventoryConflictError,
    InsufficientStockError,
    OptimisticLockingError
)
from ....domain.entities.inventory import InventoryStatus
from ....utils.dependencies import (
    get_current_user,
    get_current_admin_user,
    get_inventory_service
)


router = APIRouter(prefix="/inventory", tags=["inventory"])


# Request/Response Models
class CreateInventoryItemRequest(BaseModel):
    """Request model for creating an inventory item."""
    
    product_id: str = Field(description="External product identifier")
    sku: str = Field(description="Stock Keeping Unit (must be unique)")
    variant_id: Optional[str] = Field(default=None, description="Product variant identifier")
    total_quantity: int = Field(ge=0, description="Initial total quantity")
    unit_price: Decimal = Field(gt=0, description="Unit price")
    cost_price: Optional[Decimal] = Field(default=None, ge=0, description="Cost price")
    low_stock_threshold: int = Field(default=10, ge=0, description="Low stock alert threshold")
    reorder_point: int = Field(default=5, ge=0, description="Automatic reorder point")
    reorder_quantity: int = Field(default=100, gt=0, description="Reorder quantity")
    metadata: Optional[Dict[str, str]] = Field(default=None, description="Additional metadata")


class UpdateInventoryItemRequest(BaseModel):
    """Request model for updating an inventory item."""
    
    unit_price: Optional[Decimal] = Field(default=None, gt=0, description="New unit price")
    cost_price: Optional[Decimal] = Field(default=None, ge=0, description="New cost price")
    low_stock_threshold: Optional[int] = Field(default=None, ge=0, description="New low stock threshold")
    reorder_point: Optional[int] = Field(default=None, ge=0, description="New reorder point")
    reorder_quantity: Optional[int] = Field(default=None, gt=0, description="New reorder quantity")
    status: Optional[InventoryStatus] = Field(default=None, description="New status")
    expected_version: Optional[int] = Field(default=None, description="Expected version for optimistic locking")


class StockReservationRequest(BaseModel):
    """Request model for stock reservation."""
    
    product_id: str = Field(description="External product identifier")
    variant_id: Optional[str] = Field(default=None, description="Product variant identifier")
    order_id: UUID = Field(description="Associated order ID")
    customer_id: str = Field(description="Customer ID")
    quantity: int = Field(gt=0, description="Quantity to reserve")
    reservation_duration_minutes: int = Field(default=30, ge=1, le=1440, description="Reservation duration in minutes")


class StockReservationBySKURequest(BaseModel):
    """Request model for stock reservation by SKU."""
    
    sku: str = Field(description="Stock Keeping Unit")
    order_id: UUID = Field(description="Associated order ID")
    customer_id: str = Field(description="Customer ID")
    quantity: int = Field(gt=0, description="Quantity to reserve")
    reservation_duration_minutes: int = Field(default=30, ge=1, le=1440, description="Reservation duration in minutes")


class StockAdjustmentRequest(BaseModel):
    """Request model for stock adjustment."""
    
    quantity_change: int = Field(description="Change in quantity (+ for increase, - for decrease)")
    adjustment_type: str = Field(description="Type of adjustment (e.g., 'restock', 'damage', 'correction')")
    reason: str = Field(description="Reason for adjustment")
    reference_id: Optional[str] = Field(default=None, description="Reference to related entity")


class PhysicalCountRequest(BaseModel):
    """Request model for physical inventory count."""
    
    physical_quantity: int = Field(ge=0, description="Physical count quantity")
    notes: Optional[str] = Field(default=None, description="Additional notes")
    auto_adjust: bool = Field(default=True, description="Whether to automatically adjust inventory")


class InventoryItemResponse(BaseModel):
    """Response model for inventory item details."""
    
    inventory_id: str
    product_id: str
    variant_id: Optional[str]
    sku: str
    total_quantity: int
    reserved_quantity: int
    available_quantity: int
    unit_price: str
    cost_price: Optional[str]
    status: str
    low_stock_threshold: int
    reorder_point: int
    reorder_quantity: int
    version: int
    created_at: str
    updated_at: str
    created_by: Optional[str]
    updated_by: Optional[str]
    metadata: Dict[str, str]
    is_low_stock: bool
    needs_reorder: bool
    active_reservations: int


class StockReservationResponse(BaseModel):
    """Response model for stock reservation."""
    
    reservation_id: str
    inventory_id: str
    order_id: str
    customer_id: str
    quantity: int
    unit_price: str
    total_amount: str
    status: str
    expires_at: str
    created_at: str


class LowStockItemResponse(BaseModel):
    """Response model for low stock items."""
    
    inventory_id: str
    product_id: str
    sku: str
    available_quantity: int
    low_stock_threshold: int
    reorder_point: int
    reorder_quantity: int


class InventorySummaryResponse(BaseModel):
    """Response model for inventory summary."""
    
    total_items: int
    active_items: int
    low_stock_items: int
    out_of_stock_items: int
    active_reservations: int
    last_updated: str


# API Endpoints
@router.post(
    "/items",
    response_model=Dict[str, str],
    status_code=status.HTTP_201_CREATED,
    summary="Create inventory item",
    description="Create a new inventory item with initial stock levels"
)
async def create_inventory_item(
    request: CreateInventoryItemRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Create a new inventory item."""
    try:
        inventory_id = await inventory_service.create_inventory_item(
            product_id=request.product_id,
            sku=request.sku,
            total_quantity=request.total_quantity,
            unit_price=request.unit_price,
            variant_id=request.variant_id,
            cost_price=request.cost_price,
            low_stock_threshold=request.low_stock_threshold,
            reorder_point=request.reorder_point,
            reorder_quantity=request.reorder_quantity,
            created_by=current_user.get("sub"),
            metadata=request.metadata
        )
        
        return {
            "inventory_id": str(inventory_id),
            "message": "Inventory item created successfully"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/items/{inventory_id}",
    response_model=InventoryItemResponse,
    summary="Get inventory item",
    description="Get detailed information about an inventory item"
)
async def get_inventory_item(
    inventory_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> InventoryItemResponse:
    """Get inventory item details."""
    item = await inventory_service.get_inventory_item(inventory_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item {inventory_id} not found"
        )
    
    return InventoryItemResponse(**item)


@router.get(
    "/items/sku/{sku}",
    response_model=InventoryItemResponse,
    summary="Get inventory item by SKU",
    description="Get detailed information about an inventory item by SKU"
)
async def get_inventory_item_by_sku(
    sku: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> InventoryItemResponse:
    """Get inventory item details by SKU."""
    item = await inventory_service.get_inventory_item_by_sku(sku)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item with SKU {sku} not found"
        )
    
    return InventoryItemResponse(**item)


@router.put(
    "/items/{inventory_id}",
    response_model=Dict[str, str],
    summary="Update inventory item",
    description="Update inventory item properties with optimistic locking"
)
async def update_inventory_item(
    inventory_id: UUID,
    request: UpdateInventoryItemRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Update inventory item properties."""
    try:
        await inventory_service.update_inventory_item(
            inventory_id=inventory_id,
            unit_price=request.unit_price,
            cost_price=request.cost_price,
            low_stock_threshold=request.low_stock_threshold,
            reorder_point=request.reorder_point,
            reorder_quantity=request.reorder_quantity,
            status=request.status,
            updated_by=current_user.get("sub"),
            expected_version=request.expected_version
        )
        
        return {"message": "Inventory item updated successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except OptimisticLockingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Version conflict occurred. Please refresh and try again."
        )


@router.post(
    "/reservations",
    response_model=Dict[str, str],
    status_code=status.HTTP_201_CREATED,
    summary="Reserve stock",
    description="Reserve stock for an order"
)
async def reserve_stock(
    request: StockReservationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Reserve stock for an order."""
    try:
        reservation_id = await inventory_service.reserve_stock(
            product_id=request.product_id,
            variant_id=request.variant_id,
            order_id=request.order_id,
            customer_id=request.customer_id,
            quantity=request.quantity,
            reservation_duration_minutes=request.reservation_duration_minutes,
            reserved_by=current_user.get("sub")
        )
        
        return {
            "reservation_id": str(reservation_id),
            "message": "Stock reserved successfully"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except InsufficientStockError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except InventoryConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )


@router.post(
    "/reservations/by-sku",
    response_model=Dict[str, str],
    status_code=status.HTTP_201_CREATED,
    summary="Reserve stock by SKU",
    description="Reserve stock for an order using SKU"
)
async def reserve_stock_by_sku(
    request: StockReservationBySKURequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Reserve stock for an order using SKU."""
    try:
        reservation_id = await inventory_service.reserve_stock_by_sku(
            sku=request.sku,
            order_id=request.order_id,
            customer_id=request.customer_id,
            quantity=request.quantity,
            reservation_duration_minutes=request.reservation_duration_minutes,
            reserved_by=current_user.get("sub").get("sub")
        )
        
        return {
            "reservation_id": str(reservation_id),
            "message": "Stock reserved successfully"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except InsufficientStockError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )


@router.put(
    "/reservations/{inventory_id}/{reservation_id}/confirm",
    response_model=Dict[str, str],
    summary="Confirm reservation",
    description="Confirm a stock reservation"
)
async def confirm_reservation(
    inventory_id: UUID,
    reservation_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Confirm a stock reservation."""
    try:
        await inventory_service.confirm_reservation(
            inventory_id=inventory_id,
            reservation_id=reservation_id,
            confirmed_by=current_user.get("sub")
        )
        
        return {"message": "Reservation confirmed successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/reservations/{inventory_id}/{reservation_id}",
    response_model=Dict[str, str],
    summary="Cancel reservation",
    description="Cancel a stock reservation"
)
async def cancel_reservation(
    inventory_id: UUID,
    reservation_id: UUID,
    reason: str = Query(default="Cancelled by user", description="Cancellation reason"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Cancel a stock reservation."""
    try:
        await inventory_service.cancel_reservation(
            inventory_id=inventory_id,
            reservation_id=reservation_id,
            reason=reason,
            cancelled_by=current_user
        )
        
        return {"message": "Reservation cancelled successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put(
    "/reservations/{inventory_id}/{reservation_id}/fulfill",
    response_model=Dict[str, str],
    summary="Fulfill reservation",
    description="Fulfill a stock reservation (ship the order)"
)
async def fulfill_reservation(
    inventory_id: UUID,
    reservation_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Fulfill a stock reservation."""
    try:
        await inventory_service.fulfill_reservation(
            inventory_id=inventory_id,
            reservation_id=reservation_id,
            fulfilled_by=current_user.get("sub")
        )
        
        return {"message": "Reservation fulfilled successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/items/{inventory_id}/adjustments",
    response_model=Dict[str, str],
    status_code=status.HTTP_201_CREATED,
    summary="Adjust stock",
    description="Manually adjust stock levels"
)
async def adjust_stock(
    inventory_id: UUID,
    request: StockAdjustmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Manually adjust stock levels."""
    try:
        await inventory_service.adjust_stock(
            inventory_id=inventory_id,
            quantity_change=request.quantity_change,
            adjustment_type=request.adjustment_type,
            reason=request.reason,
            reference_id=request.reference_id,
            adjusted_by=current_user
        )
        
        return {"message": "Stock adjusted successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/items/{inventory_id}/physical-count",
    response_model=Dict[str, str],
    status_code=status.HTTP_201_CREATED,
    summary="Record physical count",
    description="Record a physical inventory count"
)
async def record_physical_count(
    inventory_id: UUID,
    request: PhysicalCountRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, str]:
    """Record a physical inventory count."""
    try:
        await inventory_service.record_physical_count(
            inventory_id=inventory_id,
            physical_quantity=request.physical_quantity,
            counted_by=current_user.get("sub"),
            notes=request.notes,
            auto_adjust=request.auto_adjust
        )
        
        return {"message": "Physical count recorded successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/low-stock",
    response_model=List[LowStockItemResponse],
    summary="Get low stock items",
    description="Get inventory items with low stock levels"
)
async def get_low_stock_items(
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum number of items to return"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> List[LowStockItemResponse]:
    """Get inventory items with low stock."""
    items = await inventory_service.get_low_stock_items(limit)
    return [LowStockItemResponse(**item) for item in items]


@router.get(
    "/reorder-needed",
    response_model=List[LowStockItemResponse],
    summary="Get items needing reorder",
    description="Get inventory items that need reordering"
)
async def get_items_needing_reorder(
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum number of items to return"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> List[LowStockItemResponse]:
    """Get inventory items that need reordering."""
    items = await inventory_service.get_items_needing_reorder(limit)
    return [LowStockItemResponse(**item) for item in items]


@router.get(
    "/summary",
    response_model=InventorySummaryResponse,
    summary="Get inventory summary",
    description="Get inventory summary statistics"
)
async def get_inventory_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> InventorySummaryResponse:
    """Get inventory summary statistics."""
    summary = await inventory_service.get_inventory_summary()
    return InventorySummaryResponse(**summary)


@router.post(
    "/maintenance/expire-reservations",
    response_model=Dict[str, int],
    summary="Expire reservations",
    description="Expire reservations that have passed their expiration time"
)
async def expire_reservations(
    limit: int = Query(default=1000, ge=1, le=10000, description="Maximum number of reservations to process"),
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
    inventory_service: InventoryService = Depends(get_inventory_service)
) -> Dict[str, int]:
    """Expire reservations that have passed their expiration time."""
    expired_count = await inventory_service.expire_reservations_batch(limit)
    return {
        "expired_count": expired_count,
        "message": f"Expired {expired_count} reservations"
    }
