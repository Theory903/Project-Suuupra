"""
Order domain entities for the Commerce Service.

These entities represent the core business objects related to orders,
including order details, status management, and business rules.
"""

from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator


class OrderStatus(Enum):
    """Order status enumeration."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class PaymentStatus(Enum):
    """Payment status enumeration."""
    PENDING = "pending"
    AUTHORIZED = "authorized"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class FulfillmentStatus(Enum):
    """Fulfillment status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    RETURNED = "returned"


class OrderItem(BaseModel):
    """Order item entity."""
    
    product_id: str = Field(..., description="Product identifier")
    variant_id: Optional[str] = Field(None, description="Product variant identifier")
    sku: str = Field(..., description="Stock keeping unit")
    name: str = Field(..., description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    quantity: int = Field(..., gt=0, description="Quantity ordered")
    unit_price: Decimal = Field(..., ge=0, description="Unit price")
    total_price: Decimal = Field(..., ge=0, description="Total price for this item")
    
    # Inventory tracking
    reservation_id: Optional[str] = Field(None, description="Inventory reservation ID")
    fulfilled_quantity: int = Field(default=0, ge=0, description="Quantity fulfilled")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional item metadata")
    
    @validator('total_price', always=True)
    def calculate_total_price(cls, v, values):
        """Calculate total price from quantity and unit price."""
        if 'quantity' in values and 'unit_price' in values:
            return Decimal(str(values['quantity'])) * values['unit_price']
        return v
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
        }


class Address(BaseModel):
    """Address entity."""
    
    street_line1: str = Field(..., description="Street address line 1")
    street_line2: Optional[str] = Field(None, description="Street address line 2")
    city: str = Field(..., description="City")
    state: str = Field(..., description="State/Province")
    postal_code: str = Field(..., description="Postal/ZIP code")
    country: str = Field(..., description="Country code (ISO 3166-1)")
    
    class Config:
        """Pydantic configuration."""
        frozen = True


class PaymentMethod(BaseModel):
    """Payment method entity."""
    
    type: str = Field(..., description="Payment method type (card, bank, wallet, etc.)")
    provider: str = Field(..., description="Payment provider")
    identifier: str = Field(..., description="Payment method identifier")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Payment method metadata")
    
    class Config:
        """Pydantic configuration."""
        frozen = True


# Type aliases for convenience
ShippingAddress = Address
BillingAddress = Address


class Order(BaseModel):
    """
    Order entity representing a customer order.
    
    This is the main order entity that contains all order details,
    status information, and business rules.
    """
    
    # Core identifiers
    id: UUID = Field(..., description="Order unique identifier")
    customer_id: str = Field(..., description="Customer identifier")
    
    # Order details
    items: List[Dict[str, Any]] = Field(..., description="Order items")
    total_amount: Decimal = Field(..., ge=0, description="Total order amount")
    currency: str = Field(default="USD", description="Currency code")
    
    # Status tracking
    status: OrderStatus = Field(default=OrderStatus.PENDING, description="Order status")
    payment_status: PaymentStatus = Field(default=PaymentStatus.PENDING, description="Payment status")
    fulfillment_status: FulfillmentStatus = Field(default=FulfillmentStatus.PENDING, description="Fulfillment status")
    
    # Addresses
    shipping_address: Dict[str, str] = Field(..., description="Shipping address")
    billing_address: Dict[str, str] = Field(..., description="Billing address")
    
    # Payment
    payment_method: str = Field(..., description="Payment method identifier")
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Creation timestamp")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Last update timestamp")
    
    # Audit
    created_by: str = Field(..., description="User who created the order")
    updated_by: Optional[str] = Field(None, description="User who last updated the order")
    version: int = Field(default=1, description="Version for optimistic locking")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional order metadata")
    
    def can_be_cancelled(self) -> bool:
        """Check if order can be cancelled."""
        return self.status not in [
            OrderStatus.CANCELLED,
            OrderStatus.COMPLETED,
            OrderStatus.RETURNED
        ]
    
    def can_be_modified(self) -> bool:
        """Check if order can be modified."""
        return self.status in [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED
        ]
    
    def is_paid(self) -> bool:
        """Check if order is fully paid."""
        return self.payment_status == PaymentStatus.PAID
    
    def is_fulfillable(self) -> bool:
        """Check if order can be fulfilled."""
        return (
            self.status in [OrderStatus.CONFIRMED, OrderStatus.PROCESSING] and
            self.payment_status == PaymentStatus.PAID
        )
    
    def is_shippable(self) -> bool:
        """Check if order can be shipped."""
        return (
            self.status == OrderStatus.PROCESSING and
            self.fulfillment_status == FulfillmentStatus.PROCESSING
        )
    
    def calculate_total(self) -> Decimal:
        """Calculate total order amount from items."""
        total = Decimal("0.00")
        for item in self.items:
            quantity = item.get("quantity", 0)
            unit_price = Decimal(str(item.get("unit_price", 0)))
            total += quantity * unit_price
        return total
    
    def get_item_count(self) -> int:
        """Get total number of items in the order."""
        return sum(item.get("quantity", 0) for item in self.items)
    
    def get_unfulfilled_items(self) -> List[Dict[str, Any]]:
        """Get list of unfulfilled items."""
        unfulfilled = []
        for item in self.items:
            quantity = item.get("quantity", 0)
            fulfilled = item.get("fulfilled_quantity", 0)
            if fulfilled < quantity:
                unfulfilled_item = item.copy()
                unfulfilled_item["remaining_quantity"] = quantity - fulfilled
                unfulfilled.append(unfulfilled_item)
        return unfulfilled
    
    def mark_item_fulfilled(self, product_id: str, variant_id: Optional[str], quantity: int) -> bool:
        """Mark specified quantity of an item as fulfilled."""
        for item in self.items:
            if (item.get("product_id") == product_id and 
                item.get("variant_id") == variant_id):
                
                current_fulfilled = item.get("fulfilled_quantity", 0)
                total_quantity = item.get("quantity", 0)
                
                if current_fulfilled + quantity <= total_quantity:
                    item["fulfilled_quantity"] = current_fulfilled + quantity
                    return True
        return False
    
    def is_fully_fulfilled(self) -> bool:
        """Check if all items are fully fulfilled."""
        for item in self.items:
            quantity = item.get("quantity", 0)
            fulfilled = item.get("fulfilled_quantity", 0)
            if fulfilled < quantity:
                return False
        return True
    
    def update_status(self, new_status: OrderStatus, updated_by: str) -> None:
        """Update order status with audit trail."""
        self.status = new_status
        self.updated_at = datetime.now(timezone.utc)
        self.updated_by = updated_by
        self.version += 1
    
    def update_payment_status(self, new_status: PaymentStatus) -> None:
        """Update payment status."""
        self.payment_status = new_status
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
    
    def update_fulfillment_status(self, new_status: FulfillmentStatus) -> None:
        """Update fulfillment status."""
        self.fulfillment_status = new_status
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
            UUID: str
        }


class OrderCancellation(BaseModel):
    """Order cancellation request entity."""
    
    id: str = Field(..., description="Cancellation request ID")
    order_id: UUID = Field(..., description="Order ID")
    customer_id: str = Field(..., description="Customer ID")
    reason: str = Field(..., description="Cancellation reason")
    status: str = Field(default="pending", description="Cancellation status")
    
    # Timestamps
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = Field(None)
    
    # Audit
    requested_by: str = Field(..., description="User who requested cancellation")
    processed_by: Optional[str] = Field(None, description="User who processed cancellation")
    
    # Financial
    refund_amount: Optional[Decimal] = Field(None, description="Refund amount")
    refund_id: Optional[str] = Field(None, description="Refund transaction ID")
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
            UUID: str
        }


class OrderReturn(BaseModel):
    """Order return request entity."""
    
    id: str = Field(..., description="Return request ID")
    order_id: UUID = Field(..., description="Order ID")
    customer_id: str = Field(..., description="Customer ID")
    items_to_return: List[Dict[str, Any]] = Field(..., description="Items to return")
    reason: str = Field(..., description="Return reason")
    status: str = Field(default="pending", description="Return status")
    
    # Timestamps
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = Field(None)
    
    # Audit
    requested_by: str = Field(..., description="User who requested return")
    processed_by: Optional[str] = Field(None, description="User who processed return")
    
    # Financial
    refund_amount: Optional[Decimal] = Field(None, description="Refund amount")
    refund_id: Optional[str] = Field(None, description="Refund transaction ID")
    
    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
            UUID: str
        }
