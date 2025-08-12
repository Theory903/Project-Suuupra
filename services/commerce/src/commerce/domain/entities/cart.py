"""
Shopping Cart domain entity.

The shopping cart is a transient entity that holds items before order creation.
It's persisted in Redis for performance and automatic expiration.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field, validator


class CartStatus(str, Enum):
    """Shopping cart status."""
    ACTIVE = "active"
    ABANDONED = "abandoned"
    CONVERTED = "converted"  # Converted to order
    EXPIRED = "expired"


class CartItem(BaseModel):
    """Individual item in shopping cart."""
    
    product_id: str = Field(description="Product identifier")
    product_name: str = Field(description="Product name")
    quantity: int = Field(gt=0, description="Quantity in cart")
    unit_price: Decimal = Field(ge=0, description="Unit price")
    total_price: Decimal = Field(ge=0, description="Total price for this item")
    
    # Product metadata
    sku: Optional[str] = Field(default=None, description="Product SKU")
    category: Optional[str] = Field(default=None, description="Product category")
    image_url: Optional[str] = Field(default=None, description="Product image URL")
    
    # Cart-specific metadata
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('total_price', always=True)
    def calculate_total_price(cls, v, values):
        """Auto-calculate total price from quantity and unit price."""
        if 'quantity' in values and 'unit_price' in values:
            return Decimal(str(values['quantity'])) * values['unit_price']
        return v
    
    class Config:
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
        }


class ShoppingCart(BaseModel):
    """
    Shopping cart entity representing a customer's current selection.
    
    The cart is a temporary container for items before order creation.
    It includes business logic for item management and pricing calculations.
    """
    
    cart_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str = Field(description="Customer who owns this cart")
    status: CartStatus = Field(default=CartStatus.ACTIVE)
    
    # Items and pricing
    items: List[CartItem] = Field(default_factory=list)
    subtotal: Decimal = Field(default=Decimal('0.00'), description="Subtotal before taxes")
    tax_amount: Decimal = Field(default=Decimal('0.00'), description="Calculated tax")
    shipping_estimate: Decimal = Field(default=Decimal('0.00'), description="Estimated shipping")
    total_amount: Decimal = Field(default=Decimal('0.00'), description="Total cart value")
    
    # Cart metadata
    currency: str = Field(default="USD", description="Currency code")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = Field(default=None, description="Cart expiration time")
    
    # Session and tracking
    session_id: Optional[str] = Field(default=None, description="Session identifier")
    user_agent: Optional[str] = Field(default=None, description="User agent string")
    ip_address: Optional[str] = Field(default=None, description="Client IP address")
    
    # Conversion tracking
    converted_to_order_id: Optional[str] = Field(default=None, description="Order ID if converted")
    conversion_date: Optional[datetime] = Field(default=None, description="When cart was converted")
    
    class Config:
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
        }
    
    def add_item(
        self,
        product_id: str,
        product_name: str,
        quantity: int,
        unit_price: Decimal,
        **kwargs
    ) -> None:
        """
        Add an item to the cart or update quantity if item already exists.
        
        Args:
            product_id: Product identifier
            product_name: Product name
            quantity: Quantity to add
            unit_price: Unit price
            **kwargs: Additional item metadata
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if unit_price < 0:
            raise ValueError("Unit price cannot be negative")
        
        # Check if item already exists
        existing_item = self.get_item(product_id)
        
        if existing_item:
            # Update existing item
            existing_item.quantity += quantity
            existing_item.unit_price = unit_price  # Update price in case it changed
            existing_item.total_price = existing_item.quantity * existing_item.unit_price
            existing_item.updated_at = datetime.now(timezone.utc)
        else:
            # Add new item
            new_item = CartItem(
                product_id=product_id,
                product_name=product_name,
                quantity=quantity,
                unit_price=unit_price,
                **kwargs
            )
            self.items.append(new_item)
        
        self._recalculate_totals()
        self.updated_at = datetime.now(timezone.utc)
    
    def update_item_quantity(self, product_id: str, quantity: int) -> None:
        """
        Update the quantity of an item in the cart.
        
        Args:
            product_id: Product identifier
            quantity: New quantity (0 to remove item)
        """
        if quantity < 0:
            raise ValueError("Quantity cannot be negative")
        
        item = self.get_item(product_id)
        if not item:
            raise ValueError(f"Item {product_id} not found in cart")
        
        if quantity == 0:
            self.remove_item(product_id)
        else:
            item.quantity = quantity
            item.total_price = item.quantity * item.unit_price
            item.updated_at = datetime.now(timezone.utc)
            self._recalculate_totals()
            self.updated_at = datetime.now(timezone.utc)
    
    def remove_item(self, product_id: str) -> None:
        """
        Remove an item from the cart.
        
        Args:
            product_id: Product identifier to remove
        """
        self.items = [item for item in self.items if item.product_id != product_id]
        self._recalculate_totals()
        self.updated_at = datetime.now(timezone.utc)
    
    def clear(self) -> None:
        """Remove all items from the cart."""
        self.items.clear()
        self._recalculate_totals()
        self.updated_at = datetime.now(timezone.utc)
    
    def get_item(self, product_id: str) -> Optional[CartItem]:
        """Get a specific item from the cart."""
        for item in self.items:
            if item.product_id == product_id:
                return item
        return None
    
    def get_item_count(self) -> int:
        """Get total number of items in cart."""
        return sum(item.quantity for item in self.items)
    
    def is_empty(self) -> bool:
        """Check if cart is empty."""
        return len(self.items) == 0
    
    def is_expired(self) -> bool:
        """Check if cart has expired."""
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) > self.expires_at
    
    def mark_as_converted(self, order_id: str) -> None:
        """Mark cart as converted to an order."""
        self.status = CartStatus.CONVERTED
        self.converted_to_order_id = order_id
        self.conversion_date = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
    
    def mark_as_abandoned(self) -> None:
        """Mark cart as abandoned."""
        self.status = CartStatus.ABANDONED
        self.updated_at = datetime.now(timezone.utc)
    
    def _recalculate_totals(self) -> None:
        """Recalculate cart totals based on current items."""
        self.subtotal = sum(item.total_price for item in self.items)
        
        # Calculate tax (simplified - 8% tax rate)
        self.tax_amount = self.subtotal * Decimal('0.08')
        
        # Calculate shipping estimate (simplified - flat rate)
        if self.subtotal > Decimal('50.00'):
            self.shipping_estimate = Decimal('0.00')  # Free shipping over $50
        else:
            self.shipping_estimate = Decimal('10.00')  # Flat $10 shipping
        
        self.total_amount = self.subtotal + self.tax_amount + self.shipping_estimate
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert cart to dictionary for Redis storage."""
        return self.model_dump(mode='json')
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ShoppingCart':
        """Create cart from dictionary (from Redis)."""
        return cls.model_validate(data)
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of the cart for API responses."""
        return {
            "cart_id": self.cart_id,
            "customer_id": self.customer_id,
            "status": self.status,
            "item_count": self.get_item_count(),
            "subtotal": str(self.subtotal),
            "tax_amount": str(self.tax_amount),
            "shipping_estimate": str(self.shipping_estimate),
            "total_amount": str(self.total_amount),
            "currency": self.currency,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }

