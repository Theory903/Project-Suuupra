"""
Inventory domain entities for the Commerce Service.

This module defines the core business entities for inventory management,
including product inventory, stock reservations, and inventory operations.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, model_validator


class InventoryStatus(str, Enum):
    """Inventory status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DISCONTINUED = "discontinued"
    OUT_OF_STOCK = "out_of_stock"


class ReservationStatus(str, Enum):
    """Reservation status enumeration."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class InventoryItem(BaseModel):
    """
    Represents a product inventory item.
    
    This entity manages stock levels, reservations, and availability
    for a specific product variant.
    """
    
    # Core identification
    id: UUID = Field(default_factory=uuid4, description="Unique inventory item ID")
    product_id: str = Field(description="External product identifier")
    variant_id: Optional[str] = Field(default=None, description="Product variant identifier")
    sku: str = Field(description="Stock Keeping Unit")
    
    # Stock management
    total_quantity: int = Field(ge=0, description="Total available quantity")
    reserved_quantity: int = Field(default=0, ge=0, description="Currently reserved quantity")
    available_quantity: int = Field(default=0, description="Available quantity (computed)")
    
    # Business properties
    unit_price: Decimal = Field(gt=0, description="Unit price")
    cost_price: Optional[Decimal] = Field(default=None, description="Cost price")
    status: InventoryStatus = Field(default=InventoryStatus.ACTIVE)
    
    # Inventory thresholds
    low_stock_threshold: int = Field(default=10, ge=0, description="Low stock alert threshold")
    reorder_point: int = Field(default=5, ge=0, description="Automatic reorder point")
    reorder_quantity: int = Field(default=100, gt=0, description="Reorder quantity")
    
    # Optimistic locking
    version: int = Field(default=1, description="Version for optimistic locking")
    
    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(default=None)
    updated_by: Optional[str] = Field(default=None)
    
    # Metadata
    metadata: Dict[str, str] = Field(default_factory=dict, description="Additional metadata")
    
    @model_validator(mode='after')
    def compute_available_quantity(self):
        """Compute available quantity after validation."""
        self.available_quantity = max(0, self.total_quantity - self.reserved_quantity)
        return self
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: str(v),
        }
    
    def can_reserve(self, quantity: int) -> bool:
        """Check if the specified quantity can be reserved."""
        return (
            self.status == InventoryStatus.ACTIVE and
            self.available_quantity >= quantity and
            quantity > 0
        )
    
    def reserve_stock(self, quantity: int, user_id: Optional[str] = None) -> bool:
        """
        Reserve stock for an order.
        
        Args:
            quantity: Quantity to reserve
            user_id: User making the reservation
            
        Returns:
            True if reservation successful, False otherwise
        """
        if not self.can_reserve(quantity):
            return False
        
        self.reserved_quantity += quantity
        self.available_quantity = max(0, self.total_quantity - self.reserved_quantity)
        self.updated_at = datetime.utcnow()
        self.updated_by = user_id
        self.version += 1
        
        return True
    
    def release_reservation(self, quantity: int, user_id: Optional[str] = None) -> bool:
        """
        Release reserved stock.
        
        Args:
            quantity: Quantity to release
            user_id: User releasing the reservation
            
        Returns:
            True if release successful, False otherwise
        """
        if quantity <= 0 or quantity > self.reserved_quantity:
            return False
        
        self.reserved_quantity -= quantity
        self.available_quantity = max(0, self.total_quantity - self.reserved_quantity)
        self.updated_at = datetime.utcnow()
        self.updated_by = user_id
        self.version += 1
        
        return True
    
    def fulfill_reservation(self, quantity: int, user_id: Optional[str] = None) -> bool:
        """
        Fulfill a reservation by reducing both reserved and total quantity.
        
        Args:
            quantity: Quantity to fulfill
            user_id: User fulfilling the reservation
            
        Returns:
            True if fulfillment successful, False otherwise
        """
        if quantity <= 0 or quantity > self.reserved_quantity:
            return False
        
        self.reserved_quantity -= quantity
        self.total_quantity -= quantity
        self.available_quantity = max(0, self.total_quantity - self.reserved_quantity)
        self.updated_at = datetime.utcnow()
        self.updated_by = user_id
        self.version += 1
        
        # Check if out of stock
        if self.total_quantity == 0:
            self.status = InventoryStatus.OUT_OF_STOCK
        
        return True
    
    def adjust_stock(self, quantity_change: int, reason: str, user_id: Optional[str] = None) -> bool:
        """
        Adjust total stock quantity.
        
        Args:
            quantity_change: Change in quantity (positive for increase, negative for decrease)
            reason: Reason for adjustment
            user_id: User making the adjustment
            
        Returns:
            True if adjustment successful, False otherwise
        """
        new_total = self.total_quantity + quantity_change
        
        if new_total < 0 or new_total < self.reserved_quantity:
            return False
        
        self.total_quantity = new_total
        self.available_quantity = max(0, self.total_quantity - self.reserved_quantity)
        self.updated_at = datetime.utcnow()
        self.updated_by = user_id
        self.version += 1
        
        # Update status based on stock level
        if self.total_quantity == 0:
            self.status = InventoryStatus.OUT_OF_STOCK
        elif self.status == InventoryStatus.OUT_OF_STOCK and self.total_quantity > 0:
            self.status = InventoryStatus.ACTIVE
        
        return True
    
    def is_low_stock(self) -> bool:
        """Check if inventory is below low stock threshold."""
        return self.available_quantity <= self.low_stock_threshold
    
    def needs_reorder(self) -> bool:
        """Check if inventory needs reordering."""
        return self.available_quantity <= self.reorder_point


class StockReservation(BaseModel):
    """
    Represents a stock reservation for an order.
    
    This entity tracks temporary stock allocations before order fulfillment.
    """
    
    # Core identification
    id: UUID = Field(default_factory=uuid4, description="Unique reservation ID")
    inventory_id: UUID = Field(description="Associated inventory item ID")
    order_id: UUID = Field(description="Associated order ID")
    customer_id: str = Field(description="Customer ID")
    
    # Reservation details
    quantity: int = Field(gt=0, description="Reserved quantity")
    unit_price: Decimal = Field(gt=0, description="Unit price at reservation time")
    total_amount: Optional[Decimal] = Field(default=None, description="Total reservation amount")
    
    # Status and lifecycle
    status: ReservationStatus = Field(default=ReservationStatus.PENDING)
    expires_at: datetime = Field(description="Reservation expiration time")
    
    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(default=None)
    
    # Metadata
    metadata: Dict[str, str] = Field(default_factory=dict)
    
    def model_post_init(self, __context) -> None:
        """Compute total amount if not provided."""
        if self.total_amount is None:
            self.total_amount = self.quantity * self.unit_price
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: str(v),
        }
    
    def is_expired(self) -> bool:
        """Check if the reservation has expired."""
        return datetime.utcnow() > self.expires_at
    
    def can_confirm(self) -> bool:
        """Check if the reservation can be confirmed."""
        return (
            self.status == ReservationStatus.PENDING and
            not self.is_expired()
        )
    
    def can_cancel(self) -> bool:
        """Check if the reservation can be cancelled."""
        return self.status in [ReservationStatus.PENDING, ReservationStatus.CONFIRMED]
    
    def confirm(self, user_id: Optional[str] = None) -> bool:
        """Confirm the reservation."""
        if not self.can_confirm():
            return False
        
        self.status = ReservationStatus.CONFIRMED
        self.updated_at = datetime.utcnow()
        return True
    
    def cancel(self, user_id: Optional[str] = None) -> bool:
        """Cancel the reservation."""
        if not self.can_cancel():
            return False
        
        self.status = ReservationStatus.CANCELLED
        self.updated_at = datetime.utcnow()
        return True
    
    def expire(self) -> bool:
        """Mark the reservation as expired."""
        if self.status != ReservationStatus.PENDING:
            return False
        
        self.status = ReservationStatus.EXPIRED
        self.updated_at = datetime.utcnow()
        return True


class InventoryAdjustment(BaseModel):
    """
    Represents an inventory adjustment record.
    
    This entity tracks all changes to inventory levels for audit purposes.
    """
    
    # Core identification
    id: UUID = Field(default_factory=uuid4, description="Unique adjustment ID")
    inventory_id: UUID = Field(description="Associated inventory item ID")
    
    # Adjustment details
    quantity_before: int = Field(description="Quantity before adjustment")
    quantity_after: int = Field(description="Quantity after adjustment")
    quantity_change: int = Field(description="Change in quantity")
    
    # Context
    adjustment_type: str = Field(description="Type of adjustment (e.g., 'restock', 'damage', 'correction')")
    reason: str = Field(description="Reason for adjustment")
    reference_id: Optional[str] = Field(default=None, description="Reference to related entity")
    
    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = Field(description="User who made the adjustment")
    
    # Metadata
    metadata: Dict[str, str] = Field(default_factory=dict)
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
