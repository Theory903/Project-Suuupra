"""
Shopping cart API routes.

Provides endpoints for cart management including CRUD operations,
item management, and cart analytics.
"""

from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from ....infrastructure.persistence.cart_repository import CartRepository
from ....domain.entities.cart import ShoppingCart, CartItem
from ....utils.dependencies import get_current_user, get_cart_repository

router = APIRouter()


# Request/Response Models

class AddItemRequest(BaseModel):
    """Request model for adding items to cart."""
    product_id: str = Field(description="Product identifier")
    product_name: str = Field(description="Product name")
    quantity: int = Field(gt=0, description="Quantity to add")
    unit_price: Decimal = Field(ge=0, description="Unit price")
    sku: Optional[str] = Field(default=None, description="Product SKU")
    category: Optional[str] = Field(default=None, description="Product category")
    image_url: Optional[str] = Field(default=None, description="Product image URL")


class UpdateItemRequest(BaseModel):
    """Request model for updating item quantity."""
    quantity: int = Field(ge=0, description="New quantity (0 to remove)")


class CartItemResponse(BaseModel):
    """Response model for cart items."""
    product_id: str
    product_name: str
    quantity: int
    unit_price: str  # Decimal as string
    total_price: str  # Decimal as string
    sku: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    added_at: str  # ISO format
    updated_at: str  # ISO format


class CartResponse(BaseModel):
    """Response model for shopping cart."""
    cart_id: str
    customer_id: str
    status: str
    items: List[CartItemResponse]
    subtotal: str  # Decimal as string
    tax_amount: str  # Decimal as string
    shipping_estimate: str  # Decimal as string
    total_amount: str  # Decimal as string
    currency: str
    item_count: int
    created_at: str  # ISO format
    updated_at: str  # ISO format
    expires_at: Optional[str] = None  # ISO format


class CartSummaryResponse(BaseModel):
    """Response model for cart summary."""
    cart_id: str
    customer_id: str
    status: str
    item_count: int
    subtotal: str
    tax_amount: str
    shipping_estimate: str
    total_amount: str
    currency: str
    created_at: str
    updated_at: str
    expires_at: Optional[str] = None


# Helper functions

def _cart_to_response(cart: ShoppingCart) -> CartResponse:
    """Convert domain cart to API response."""
    return CartResponse(
        cart_id=cart.cart_id,
        customer_id=cart.customer_id,
        status=cart.status.value,
        items=[
            CartItemResponse(
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=str(item.unit_price),
                total_price=str(item.total_price),
                sku=item.sku,
                category=item.category,
                image_url=item.image_url,
                added_at=item.added_at.isoformat(),
                updated_at=item.updated_at.isoformat(),
            )
            for item in cart.items
        ],
        subtotal=str(cart.subtotal),
        tax_amount=str(cart.tax_amount),
        shipping_estimate=str(cart.shipping_estimate),
        total_amount=str(cart.total_amount),
        currency=cart.currency,
        item_count=cart.get_item_count(),
        created_at=cart.created_at.isoformat(),
        updated_at=cart.updated_at.isoformat(),
        expires_at=cart.expires_at.isoformat() if cart.expires_at else None,
    )


# API Endpoints

@router.post("/", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
async def create_cart(
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> CartResponse:
    """
    Create a new shopping cart for the current user.
    
    Returns the created cart with empty items list.
    """
    try:
        cart = await cart_repo.create_cart(
            customer_id=current_user["sub"],
            session_id=current_user.get("session_id"),
        )
        return _cart_to_response(cart)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create cart: {str(e)}"
        )


@router.get("/", response_model=List[CartSummaryResponse])
async def get_customer_carts(
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> List[CartSummaryResponse]:
    """
    Get all carts for the current customer.
    
    Returns a list of cart summaries ordered by most recently updated.
    """
    try:
        carts = await cart_repo.get_customer_carts(current_user["sub"])
        return [
            CartSummaryResponse(**cart.get_summary())
            for cart in carts
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get carts: {str(e)}"
        )


@router.get("/active", response_model=Optional[CartResponse])
async def get_active_cart(
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> Optional[CartResponse]:
    """
    Get the active cart for the current customer.
    
    Returns the most recently updated active cart or null if none exists.
    """
    try:
        cart = await cart_repo.get_active_cart(current_user["sub"])
        return _cart_to_response(cart) if cart else None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get active cart: {str(e)}"
        )


@router.get("/{cart_id}", response_model=CartResponse)
async def get_cart(
    cart_id: str,
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> CartResponse:
    """
    Get a specific cart by ID.
    
    Only returns carts owned by the current customer.
    """
    try:
        cart = await cart_repo.get(cart_id)
        
        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart not found"
            )
        
        # Verify cart ownership
        if cart.customer_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return _cart_to_response(cart)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get cart: {str(e)}"
        )


@router.post("/{cart_id}/items", response_model=CartResponse)
async def add_item_to_cart(
    cart_id: str,
    request: AddItemRequest,
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> CartResponse:
    """
    Add an item to the cart or update quantity if item already exists.
    """
    try:
        cart = await cart_repo.get(cart_id)
        
        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart not found"
            )
        
        # Verify cart ownership
        if cart.customer_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Add item to cart
        cart.add_item(
            product_id=request.product_id,
            product_name=request.product_name,
            quantity=request.quantity,
            unit_price=request.unit_price,
            sku=request.sku,
            category=request.category,
            image_url=request.image_url,
        )
        
        # Save updated cart
        await cart_repo.save(cart)
        
        return _cart_to_response(cart)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add item to cart: {str(e)}"
        )


@router.put("/{cart_id}/items/{product_id}", response_model=CartResponse)
async def update_cart_item(
    cart_id: str,
    product_id: str,
    request: UpdateItemRequest,
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> CartResponse:
    """
    Update the quantity of an item in the cart.
    
    Set quantity to 0 to remove the item.
    """
    try:
        cart = await cart_repo.get(cart_id)
        
        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart not found"
            )
        
        # Verify cart ownership
        if cart.customer_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Update item quantity
        cart.update_item_quantity(product_id, request.quantity)
        
        # Save updated cart
        await cart_repo.save(cart)
        
        return _cart_to_response(cart)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update cart item: {str(e)}"
        )


@router.delete("/{cart_id}/items/{product_id}", response_model=CartResponse)
async def remove_cart_item(
    cart_id: str,
    product_id: str,
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> CartResponse:
    """Remove an item from the cart."""
    try:
        cart = await cart_repo.get(cart_id)
        
        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart not found"
            )
        
        # Verify cart ownership
        if cart.customer_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Remove item from cart
        cart.remove_item(product_id)
        
        # Save updated cart
        await cart_repo.save(cart)
        
        return _cart_to_response(cart)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove cart item: {str(e)}"
        )


@router.delete("/{cart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cart(
    cart_id: str,
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> None:
    """Delete a cart."""
    try:
        cart = await cart_repo.get(cart_id)
        
        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart not found"
            )
        
        # Verify cart ownership
        if cart.customer_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        await cart_repo.delete(cart_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete cart: {str(e)}"
        )


@router.post("/{cart_id}/clear", response_model=CartResponse)
async def clear_cart(
    cart_id: str,
    current_user: dict = Depends(get_current_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> CartResponse:
    """Clear all items from a cart."""
    try:
        cart = await cart_repo.get(cart_id)
        
        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart not found"
            )
        
        # Verify cart ownership
        if cart.customer_id != current_user["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Clear cart
        cart.clear()
        
        # Save updated cart
        await cart_repo.save(cart)
        
        return _cart_to_response(cart)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cart: {str(e)}"
        )

