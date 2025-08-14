"""
Order domain events for the Commerce Service.

These events capture all significant business events related to order lifecycle,
including creation, updates, payments, fulfillment, and cancellations.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from .base import DomainEvent


class OrderCreatedEvent(DomainEvent):
    """Event raised when a new order is created."""
    
    order_id: UUID
    customer_id: str
    items: List[Dict[str, Any]]
    total_amount: Decimal
    currency: str
    shipping_address: Dict[str, Any]
    billing_address: Dict[str, Any]
    payment_method: str
    created_by: str


class OrderUpdatedEvent(DomainEvent):
    """Event raised when an order is updated."""
    
    order_id: UUID
    previous_status: str
    new_status: str
    changes: Dict[str, Any]
    updated_by: str
    reason: Optional[str] = None


class OrderCancelledEvent(DomainEvent):
    """Event raised when an order is cancelled."""
    
    order_id: UUID
    customer_id: str
    previous_status: str
    cancellation_reason: str
    cancelled_by: str
    cancelled_at: datetime
    refund_amount: Decimal
    inventory_to_release: List[Dict[str, Any]]
    
    
class OrderCancellationRequestedEvent(DomainEvent):
    """Event raised when order cancellation is requested."""
    
    order_id: UUID
    customer_id: str
    current_status: str
    cancellation_reason: str
    requested_by: str
    auto_approve: bool = False


class OrderCancellationApprovedEvent(DomainEvent):
    """Event raised when order cancellation is approved."""
    
    order_id: UUID
    customer_id: str
    cancellation_reason: str
    approved_by: str
    refund_amount: Decimal
    inventory_to_release: List[Dict[str, Any]]


class OrderCancellationRejectedEvent(DomainEvent):
    """Event raised when order cancellation is rejected."""
    
    order_id: UUID
    customer_id: str
    cancellation_reason: str
    rejection_reason: str
    rejected_by: str


class OrderRefundInitiatedEvent(DomainEvent):
    """Event raised when order refund is initiated."""
    
    order_id: UUID
    customer_id: str
    refund_id: str
    refund_amount: Decimal
    payment_method: str
    initiated_by: str


class OrderRefundCompletedEvent(DomainEvent):
    """Event raised when order refund is completed."""
    
    order_id: UUID
    customer_id: str
    refund_id: str
    refund_amount: Decimal
    completed_at: datetime
    transaction_id: str


class OrderRefundFailedEvent(DomainEvent):
    """Event raised when order refund fails."""
    
    order_id: UUID
    customer_id: str
    refund_id: str
    refund_amount: Decimal
    failure_reason: str
    retry_count: int


class OrderShippedEvent(DomainEvent):
    """Event raised when order is shipped."""
    
    order_id: UUID
    customer_id: str
    shipment_id: str
    carrier: str
    tracking_number: str
    shipped_at: datetime
    estimated_delivery: Optional[datetime] = None


class OrderDeliveredEvent(DomainEvent):
    """Event raised when order is delivered."""
    
    order_id: UUID
    customer_id: str
    shipment_id: str
    delivered_at: datetime
    delivered_to: str
    signature: Optional[str] = None


class OrderReturnRequestedEvent(DomainEvent):
    """Event raised when order return is requested."""
    
    order_id: UUID
    customer_id: str
    items_to_return: List[Dict[str, Any]]
    return_reason: str
    requested_by: str


class OrderReturnApprovedEvent(DomainEvent):
    """Event raised when order return is approved."""
    
    order_id: UUID
    customer_id: str
    return_id: str
    items_to_return: List[Dict[str, Any]]
    refund_amount: Decimal
    approved_by: str


class OrderPaymentAuthorizedEvent(DomainEvent):
    """Event raised when order payment is authorized."""
    
    order_id: UUID
    customer_id: str
    payment_id: str
    authorization_id: str
    amount: Decimal
    payment_method: str


class OrderPaymentCapturedEvent(DomainEvent):
    """Event raised when order payment is captured."""
    
    order_id: UUID
    customer_id: str
    payment_id: str
    transaction_id: str
    amount: Decimal
    captured_at: datetime


class OrderPaymentFailedEvent(DomainEvent):
    """Event raised when order payment fails."""
    
    order_id: UUID
    customer_id: str
    payment_id: str
    amount: Decimal
    failure_reason: str
    failure_code: str
    retry_count: int


class OrderFulfillmentStartedEvent(DomainEvent):
    """Event raised when order fulfillment starts."""
    
    order_id: UUID
    customer_id: str
    fulfillment_center: str
    estimated_ship_date: datetime
    started_by: str


class OrderFulfillmentCompletedEvent(DomainEvent):
    """Event raised when order fulfillment is completed."""
    
    order_id: UUID
    customer_id: str
    fulfillment_center: str
    completed_at: datetime
    completed_by: str


class OrderInventoryReservedEvent(DomainEvent):
    """Event raised when inventory is reserved for order."""
    
    order_id: UUID
    customer_id: str
    reservations: List[Dict[str, Any]]
    reserved_until: datetime


class OrderInventoryReleasedEvent(DomainEvent):
    """Event raised when inventory is released from order."""
    
    order_id: UUID
    customer_id: str
    released_items: List[Dict[str, Any]]
    release_reason: str
    released_by: str


# Additional events needed by sagas
class PaymentAuthorizedEvent(DomainEvent):
    """Event raised when payment is authorized."""
    
    order_id: UUID
    customer_id: str
    payment_id: str
    authorization_id: str
    amount: Decimal
    payment_method: str


class InventoryReservedEvent(DomainEvent):
    """Event raised when inventory is reserved."""
    
    order_id: UUID
    customer_id: str
    reservations: List[Dict[str, Any]]
    reserved_until: datetime


class OrderConfirmedEvent(DomainEvent):
    """Event raised when order is confirmed."""
    
    order_id: UUID
    customer_id: str
    confirmed_at: datetime
    confirmed_by: str