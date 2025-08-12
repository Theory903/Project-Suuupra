"""
Order-related domain events for the Commerce Service.

These events represent all the important business events that can happen
to an order during its lifecycle.
"""

from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from pydantic import BaseModel, Field

from .base import DomainEvent


class OrderStatus(str, Enum):
    """Order status enumeration."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    """Payment method enumeration."""
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    PAYPAL = "paypal"
    BANK_TRANSFER = "bank_transfer"
    CRYPTO = "crypto"


class OrderItem(BaseModel):
    """Order item data structure."""
    product_id: str = Field(description="Product identifier")
    product_name: str = Field(description="Product name at time of order")
    quantity: int = Field(gt=0, description="Quantity ordered")
    unit_price: Decimal = Field(ge=0, description="Unit price at time of order")
    total_price: Decimal = Field(ge=0, description="Total price for this item")
    
    class Config:
        frozen = True


class ShippingAddress(BaseModel):
    """Shipping address data structure."""
    recipient_name: str = Field(description="Recipient full name")
    street: str = Field(description="Street address")
    city: str = Field(description="City")
    state: str = Field(description="State or province")
    postal_code: str = Field(description="Postal or ZIP code")
    country: str = Field(description="Country")
    
    class Config:
        frozen = True


# Order Lifecycle Events

class OrderCreatedEvent(DomainEvent):
    """Event fired when a new order is created."""
    
    customer_id: str = Field(description="Customer who placed the order")
    items: List[OrderItem] = Field(description="Items in the order")
    subtotal: Decimal = Field(ge=0, description="Subtotal before taxes and fees")
    tax_amount: Decimal = Field(ge=0, description="Tax amount")
    shipping_amount: Decimal = Field(ge=0, description="Shipping cost")
    total_amount: Decimal = Field(ge=0, description="Total order amount")
    currency: str = Field(default="USD", description="Currency code")
    payment_method: PaymentMethod = Field(description="Selected payment method")
    shipping_address: ShippingAddress = Field(description="Shipping address")
    idempotency_key: Optional[str] = Field(default=None, description="Idempotency key")


class OrderConfirmedEvent(DomainEvent):
    """Event fired when an order is confirmed (payment authorized)."""
    
    payment_transaction_id: str = Field(description="Payment transaction identifier")
    confirmed_at: datetime = Field(description="When the order was confirmed")


class OrderProcessingStartedEvent(DomainEvent):
    """Event fired when order processing begins."""
    
    processing_started_at: datetime = Field(description="When processing started")
    estimated_ship_date: Optional[datetime] = Field(default=None, description="Estimated shipping date")


class OrderShippedEvent(DomainEvent):
    """Event fired when an order is shipped."""
    
    tracking_number: str = Field(description="Shipping tracking number")
    carrier: str = Field(description="Shipping carrier")
    shipped_at: datetime = Field(description="When the order was shipped")
    estimated_delivery_date: Optional[datetime] = Field(default=None, description="Estimated delivery date")


class OrderDeliveredEvent(DomainEvent):
    """Event fired when an order is delivered."""
    
    delivered_at: datetime = Field(description="When the order was delivered")
    delivery_confirmation: Optional[str] = Field(default=None, description="Delivery confirmation details")


class OrderCancelledEvent(DomainEvent):
    """Event fired when an order is cancelled."""
    
    reason: str = Field(description="Cancellation reason")
    cancelled_by: str = Field(description="Who cancelled the order (customer, system, admin)")
    cancelled_at: datetime = Field(description="When the order was cancelled")
    refund_amount: Optional[Decimal] = Field(default=None, description="Amount to be refunded")


class OrderRefundedEvent(DomainEvent):
    """Event fired when an order is refunded."""
    
    refund_amount: Decimal = Field(ge=0, description="Amount refunded")
    refund_transaction_id: str = Field(description="Refund transaction identifier")
    refunded_at: datetime = Field(description="When the refund was processed")
    reason: Optional[str] = Field(default=None, description="Refund reason")


# Order Modification Events

class OrderItemAddedEvent(DomainEvent):
    """Event fired when an item is added to an existing order."""
    
    item: OrderItem = Field(description="Item that was added")
    new_total_amount: Decimal = Field(ge=0, description="New total after adding item")


class OrderItemRemovedEvent(DomainEvent):
    """Event fired when an item is removed from an order."""
    
    product_id: str = Field(description="Product ID of removed item")
    quantity_removed: int = Field(gt=0, description="Quantity removed")
    new_total_amount: Decimal = Field(ge=0, description="New total after removing item")


class OrderItemQuantityUpdatedEvent(DomainEvent):
    """Event fired when item quantity is updated."""
    
    product_id: str = Field(description="Product ID of updated item")
    old_quantity: int = Field(ge=0, description="Previous quantity")
    new_quantity: int = Field(ge=0, description="New quantity")
    new_total_amount: Decimal = Field(ge=0, description="New total after quantity update")


# Payment Events

class PaymentAuthorizedEvent(DomainEvent):
    """Event fired when payment is authorized."""
    
    payment_transaction_id: str = Field(description="Payment transaction identifier")
    amount: Decimal = Field(gt=0, description="Authorized amount")
    payment_method: PaymentMethod = Field(description="Payment method used")
    authorization_code: Optional[str] = Field(default=None, description="Authorization code from payment processor")


class PaymentCapturedEvent(DomainEvent):
    """Event fired when payment is captured."""
    
    payment_transaction_id: str = Field(description="Payment transaction identifier")
    amount: Decimal = Field(gt=0, description="Captured amount")
    captured_at: datetime = Field(description="When payment was captured")


class PaymentFailedEvent(DomainEvent):
    """Event fired when payment fails."""
    
    payment_transaction_id: Optional[str] = Field(default=None, description="Payment transaction identifier")
    failure_reason: str = Field(description="Why the payment failed")
    error_code: Optional[str] = Field(default=None, description="Payment processor error code")
    retry_allowed: bool = Field(default=True, description="Whether payment can be retried")


# Inventory Events

class InventoryReservedEvent(DomainEvent):
    """Event fired when inventory is reserved for an order."""
    
    reservations: List[Dict[str, any]] = Field(description="List of inventory reservations")
    reservation_id: str = Field(description="Reservation identifier")


class InventoryReleasedEvent(DomainEvent):
    """Event fired when reserved inventory is released."""
    
    reservation_id: str = Field(description="Reservation identifier that was released")
    reason: str = Field(description="Why inventory was released")


class InventoryAllocationFailedEvent(DomainEvent):
    """Event fired when inventory allocation fails."""
    
    product_id: str = Field(description="Product that couldn't be allocated")
    requested_quantity: int = Field(gt=0, description="Requested quantity")
    available_quantity: int = Field(ge=0, description="Available quantity")
    reason: str = Field(description="Why allocation failed")
