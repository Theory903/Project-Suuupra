"""
Orders API routes.

Provides endpoints for order management including creation, status updates,
and order history with CQRS pattern.
"""

from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from ....utils.dependencies import get_current_user, get_order_service
from ....application.order_service import OrderService

router = APIRouter()


# Request/Response Models

class CreateOrderRequest(BaseModel):
    """Request model for creating orders."""
    cart_id: str = Field(description="Shopping cart ID to convert to order")
    payment_method: str = Field(description="Payment method (credit_card, debit_card, paypal)")
    shipping_address: Dict[str, str] = Field(description="Shipping address details")
    idempotency_key: Optional[str] = Field(default=None, description="Idempotency key")


class CancelOrderRequest(BaseModel):
    """Request model for canceling orders."""
    reason: str = Field(description="Cancellation reason")


class OrderItemResponse(BaseModel):
    """Response model for order items."""
    product_id: str
    product_name: str
    quantity: int
    unit_price: str  # Decimal as string
    total_price: str  # Decimal as string


class OrderResponse(BaseModel):
    """Response model for orders."""
    order_id: str
    customer_id: str
    status: str
    items: List[OrderItemResponse]
    subtotal: str  # Decimal as string
    tax_amount: str  # Decimal as string
    shipping_amount: str  # Decimal as string
    total_amount: str  # Decimal as string
    currency: str
    payment_method: Optional[str] = None
    shipping_address: Optional[Dict[str, str]] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    created_at: Optional[str] = None  # ISO format
    updated_at: Optional[str] = None  # ISO format
    confirmed_at: Optional[str] = None  # ISO format
    shipped_at: Optional[str] = None  # ISO format
    delivered_at: Optional[str] = None  # ISO format


class OrderCreationResponse(BaseModel):
    """Response model for order creation."""
    order_id: str
    saga_id: str
    status: str
    total_amount: str
    currency: str
    created_at: Optional[str] = None


# API Endpoints

@router.post("/", response_model=OrderCreationResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    request: CreateOrderRequest,
    current_user: dict = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service),
) -> OrderCreationResponse:
    """Create a new order from a shopping cart."""
    try:
        result = await order_service.create_order_from_cart(
            cart_id=request.cart_id,
            customer_id=current_user["sub"],
            payment_method=request.payment_method,
            shipping_address=request.shipping_address,
            idempotency_key=request.idempotency_key,
        )
        
        return OrderCreationResponse(**result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )


@router.get("/", response_model=List[OrderResponse])
async def get_orders(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service),
) -> List[OrderResponse]:
    """Get orders for the current customer."""
    try:
        orders = await order_service.get_customer_orders(
            customer_id=current_user["sub"],
            limit=limit,
            offset=offset,
        )
        
        return [OrderResponse(**order) for order in orders]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get orders: {str(e)}"
        )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    """Get a specific order by ID."""
    try:
        order = await order_service.get_order(
            order_id=order_id,
            customer_id=current_user["sub"],
        )
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Convert items to response format
        order_items = []
        for item in order.get("items", []):
            order_items.append(OrderItemResponse(
                product_id=item["product_id"],
                product_name=item["product_name"],
                quantity=item["quantity"],
                unit_price=str(item["unit_price"]),
                total_price=str(item["total_price"]),
            ))
        
        return OrderResponse(
            order_id=order["order_id"],
            customer_id=order["customer_id"],
            status=order["status"],
            items=order_items,
            subtotal=order["subtotal"],
            tax_amount=order["tax_amount"],
            shipping_amount=order["shipping_amount"],
            total_amount=order["total_amount"],
            currency=order["currency"],
            payment_method=order.get("payment_method"),
            shipping_address=order.get("shipping_address"),
            tracking_number=order.get("tracking_number"),
            carrier=order.get("carrier"),
            created_at=order.get("created_at"),
            updated_at=order.get("updated_at"),
            confirmed_at=order.get("confirmed_at"),
            shipped_at=order.get("shipped_at"),
            delivered_at=order.get("delivered_at"),
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get order: {str(e)}"
        )


@router.post("/{order_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_order(
    order_id: str,
    request: CancelOrderRequest,
    current_user: dict = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service),
) -> Dict[str, Any]:
    """Cancel an order."""
    try:
        result = await order_service.cancel_order(
            order_id=order_id,
            customer_id=current_user["sub"],
            reason=request.reason,
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel order: {str(e)}"
        )

