"""
Order Aggregate - Core business entity for order management.

The Order aggregate encapsulates all business logic related to orders,
including creation, modification, payment processing, and fulfillment.
"""

from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from enum import Enum

from .base import AggregateRoot
from ..events.order_events import (
    OrderCreatedEvent,
    OrderConfirmedEvent,
    OrderProcessingStartedEvent,
    OrderShippedEvent,
    OrderDeliveredEvent,
    OrderCancelledEvent,
    OrderRefundedEvent,
    PaymentAuthorizedEvent,
    PaymentCapturedEvent,
    PaymentFailedEvent,
    InventoryReservedEvent,
    InventoryReleasedEvent,
    OrderStatus,
    PaymentMethod,
    OrderItem,
    ShippingAddress,
)


class OrderState(str, Enum):
    """Internal order state for business logic."""
    DRAFT = "draft"
    PENDING_PAYMENT = "pending_payment"
    PAYMENT_AUTHORIZED = "payment_authorized"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentState(str, Enum):
    """Payment state tracking."""
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"


class OrderAggregate(AggregateRoot):
    """
    Order aggregate root implementing business logic for order management.
    
    This aggregate ensures that all order operations maintain business invariants
    and generates appropriate domain events for external systems to react to.
    """
    
    def __init__(self, aggregate_id: Optional[str] = None):
        super().__init__(aggregate_id)
        
        # Order basic information
        self.customer_id: Optional[str] = None
        self.status: OrderState = OrderState.DRAFT
        self.created_at: Optional[datetime] = None
        self.updated_at: Optional[datetime] = None
        
        # Order items and pricing
        self.items: List[OrderItem] = []
        self.subtotal: Decimal = Decimal('0.00')
        self.tax_amount: Decimal = Decimal('0.00')
        self.shipping_amount: Decimal = Decimal('0.00')
        self.total_amount: Decimal = Decimal('0.00')
        self.currency: str = "USD"
        
        # Payment information
        self.payment_method: Optional[PaymentMethod] = None
        self.payment_state: PaymentState = PaymentState.PENDING
        self.payment_transaction_id: Optional[str] = None
        
        # Shipping information
        self.shipping_address: Optional[ShippingAddress] = None
        self.tracking_number: Optional[str] = None
        self.carrier: Optional[str] = None
        
        # Fulfillment tracking
        self.confirmed_at: Optional[datetime] = None
        self.processing_started_at: Optional[datetime] = None
        self.shipped_at: Optional[datetime] = None
        self.delivered_at: Optional[datetime] = None
        
        # Cancellation/Refund
        self.cancelled_at: Optional[datetime] = None
        self.cancellation_reason: Optional[str] = None
        self.refunded_at: Optional[datetime] = None
        self.refund_amount: Optional[Decimal] = None
        
        # Business metadata
        self.idempotency_key: Optional[str] = None
        self.reservation_id: Optional[str] = None
    
    def create_order(
        self,
        customer_id: str,
        items: List[Dict[str, Any]],
        payment_method: PaymentMethod,
        shipping_address: Dict[str, str],
        idempotency_key: Optional[str] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> None:
        """
        Create a new order with the given parameters.
        
        Business Rules:
        - Order must have at least one item
        - All items must have positive quantity and price
        - Customer ID must be provided
        - Shipping address must be complete
        """
        # Validate business rules
        if not items:
            raise ValueError("Order must contain at least one item")
        
        if not customer_id:
            raise ValueError("Customer ID is required")
        
        if self.status != OrderState.DRAFT:
            raise ValueError("Cannot create order that is not in draft state")
        
        # Convert items to OrderItem objects and calculate totals
        order_items = []
        subtotal = Decimal('0.00')
        
        for item_data in items:
            if item_data['quantity'] <= 0:
                raise ValueError(f"Item {item_data['product_id']} must have positive quantity")
            
            if item_data['unit_price'] < 0:
                raise ValueError(f"Item {item_data['product_id']} must have non-negative price")
            
            total_price = Decimal(str(item_data['unit_price'])) * item_data['quantity']
            
            order_item = OrderItem(
                product_id=item_data['product_id'],
                product_name=item_data['product_name'],
                quantity=item_data['quantity'],
                unit_price=Decimal(str(item_data['unit_price'])),
                total_price=total_price,
            )
            order_items.append(order_item)
            subtotal += total_price
        
        # Calculate tax and shipping (simplified - in real system this would be more complex)
        tax_amount = subtotal * Decimal('0.08')  # 8% tax
        shipping_amount = Decimal('10.00')  # Flat shipping
        total_amount = subtotal + tax_amount + shipping_amount
        
        # Create shipping address object
        shipping_addr = ShippingAddress(**shipping_address)
        
        # Raise the domain event
        event = OrderCreatedEvent(
            aggregate_id=self.aggregate_id,
            customer_id=customer_id,
            items=order_items,
            subtotal=subtotal,
            tax_amount=tax_amount,
            shipping_amount=shipping_amount,
            total_amount=total_amount,
            payment_method=payment_method,
            shipping_address=shipping_addr,
            idempotency_key=idempotency_key,
            user_id=user_id,
            tenant_id=tenant_id,
        )
        
        self._raise_event(event)
    
    def authorize_payment(
        self,
        payment_transaction_id: str,
        amount: Decimal,
        authorization_code: Optional[str] = None,
    ) -> None:
        """Authorize payment for the order."""
        if self.status != OrderState.PENDING_PAYMENT:
            raise ValueError("Can only authorize payment for orders pending payment")
        
        if amount != self.total_amount:
            raise ValueError("Payment amount must match order total")
        
        event = PaymentAuthorizedEvent(
            aggregate_id=self.aggregate_id,
            payment_transaction_id=payment_transaction_id,
            amount=amount,
            payment_method=self.payment_method,
            authorization_code=authorization_code,
        )
        
        self._raise_event(event)
    
    def confirm_order(self, payment_transaction_id: str) -> None:
        """Confirm the order after successful payment authorization."""
        if self.payment_state != PaymentState.AUTHORIZED:
            raise ValueError("Cannot confirm order without authorized payment")
        
        event = OrderConfirmedEvent(
            aggregate_id=self.aggregate_id,
            payment_transaction_id=payment_transaction_id,
            confirmed_at=datetime.now(timezone.utc),
        )
        
        self._raise_event(event)
    
    def start_processing(self, estimated_ship_date: Optional[datetime] = None) -> None:
        """Start processing the order for fulfillment."""
        if self.status != OrderState.CONFIRMED:
            raise ValueError("Can only start processing confirmed orders")
        
        event = OrderProcessingStartedEvent(
            aggregate_id=self.aggregate_id,
            processing_started_at=datetime.now(timezone.utc),
            estimated_ship_date=estimated_ship_date,
        )
        
        self._raise_event(event)
    
    def ship_order(
        self,
        tracking_number: str,
        carrier: str,
        estimated_delivery_date: Optional[datetime] = None,
    ) -> None:
        """Mark the order as shipped."""
        if self.status != OrderState.PROCESSING:
            raise ValueError("Can only ship orders that are being processed")
        
        event = OrderShippedEvent(
            aggregate_id=self.aggregate_id,
            tracking_number=tracking_number,
            carrier=carrier,
            shipped_at=datetime.now(timezone.utc),
            estimated_delivery_date=estimated_delivery_date,
        )
        
        self._raise_event(event)
    
    def deliver_order(self, delivery_confirmation: Optional[str] = None) -> None:
        """Mark the order as delivered."""
        if self.status != OrderState.SHIPPED:
            raise ValueError("Can only deliver orders that have been shipped")
        
        event = OrderDeliveredEvent(
            aggregate_id=self.aggregate_id,
            delivered_at=datetime.now(timezone.utc),
            delivery_confirmation=delivery_confirmation,
        )
        
        self._raise_event(event)
    
    def cancel_order(
        self,
        reason: str,
        cancelled_by: str,
        refund_amount: Optional[Decimal] = None,
    ) -> None:
        """Cancel the order."""
        if self.status in [OrderState.DELIVERED, OrderState.CANCELLED, OrderState.REFUNDED]:
            raise ValueError(f"Cannot cancel order in {self.status} state")
        
        event = OrderCancelledEvent(
            aggregate_id=self.aggregate_id,
            reason=reason,
            cancelled_by=cancelled_by,
            cancelled_at=datetime.now(timezone.utc),
            refund_amount=refund_amount,
        )
        
        self._raise_event(event)
    
    def process_refund(
        self,
        refund_amount: Decimal,
        refund_transaction_id: str,
        reason: Optional[str] = None,
    ) -> None:
        """Process a refund for the order."""
        if self.status != OrderState.CANCELLED:
            raise ValueError("Can only refund cancelled orders")
        
        if refund_amount > self.total_amount:
            raise ValueError("Refund amount cannot exceed order total")
        
        event = OrderRefundedEvent(
            aggregate_id=self.aggregate_id,
            refund_amount=refund_amount,
            refund_transaction_id=refund_transaction_id,
            refunded_at=datetime.now(timezone.utc),
            reason=reason,
        )
        
        self._raise_event(event)
    
    # Event Handlers - These methods apply events to aggregate state
    
    def on_OrderCreatedEvent(self, event: OrderCreatedEvent) -> None:
        """Handle OrderCreatedEvent."""
        self.customer_id = event.customer_id
        self.items = event.items
        self.subtotal = event.subtotal
        self.tax_amount = event.tax_amount
        self.shipping_amount = event.shipping_amount
        self.total_amount = event.total_amount
        self.currency = event.currency
        self.payment_method = event.payment_method
        self.shipping_address = event.shipping_address
        self.idempotency_key = event.idempotency_key
        self.status = OrderState.PENDING_PAYMENT
        self.created_at = event.occurred_at
        self.updated_at = event.occurred_at
    
    def on_PaymentAuthorizedEvent(self, event: PaymentAuthorizedEvent) -> None:
        """Handle PaymentAuthorizedEvent."""
        self.payment_transaction_id = event.payment_transaction_id
        self.payment_state = PaymentState.AUTHORIZED
        self.status = OrderState.PAYMENT_AUTHORIZED
        self.updated_at = event.occurred_at
    
    def on_OrderConfirmedEvent(self, event: OrderConfirmedEvent) -> None:
        """Handle OrderConfirmedEvent."""
        self.status = OrderState.CONFIRMED
        self.confirmed_at = event.confirmed_at
        self.updated_at = event.occurred_at
    
    def on_OrderProcessingStartedEvent(self, event: OrderProcessingStartedEvent) -> None:
        """Handle OrderProcessingStartedEvent."""
        self.status = OrderState.PROCESSING
        self.processing_started_at = event.processing_started_at
        self.updated_at = event.occurred_at
    
    def on_OrderShippedEvent(self, event: OrderShippedEvent) -> None:
        """Handle OrderShippedEvent."""
        self.status = OrderState.SHIPPED
        self.tracking_number = event.tracking_number
        self.carrier = event.carrier
        self.shipped_at = event.shipped_at
        self.updated_at = event.occurred_at
    
    def on_OrderDeliveredEvent(self, event: OrderDeliveredEvent) -> None:
        """Handle OrderDeliveredEvent."""
        self.status = OrderState.DELIVERED
        self.delivered_at = event.delivered_at
        self.updated_at = event.occurred_at
    
    def on_OrderCancelledEvent(self, event: OrderCancelledEvent) -> None:
        """Handle OrderCancelledEvent."""
        self.status = OrderState.CANCELLED
        self.cancelled_at = event.cancelled_at
        self.cancellation_reason = event.reason
        self.updated_at = event.occurred_at
    
    def on_OrderRefundedEvent(self, event: OrderRefundedEvent) -> None:
        """Handle OrderRefundedEvent."""
        self.status = OrderState.REFUNDED
        self.refunded_at = event.refunded_at
        self.refund_amount = event.refund_amount
        self.updated_at = event.occurred_at
    
    def get_snapshot(self) -> Dict[str, Any]:
        """Get a snapshot of the current order state."""
        return {
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "customer_id": self.customer_id,
            "status": self.status.value if self.status else None,
            "items": [item.model_dump() for item in self.items],
            "subtotal": str(self.subtotal),
            "tax_amount": str(self.tax_amount),
            "shipping_amount": str(self.shipping_amount),
            "total_amount": str(self.total_amount),
            "currency": self.currency,
            "payment_method": self.payment_method.value if self.payment_method else None,
            "payment_state": self.payment_state.value,
            "payment_transaction_id": self.payment_transaction_id,
            "shipping_address": self.shipping_address.model_dump() if self.shipping_address else None,
            "tracking_number": self.tracking_number,
            "carrier": self.carrier,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "shipped_at": self.shipped_at.isoformat() if self.shipped_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "refunded_at": self.refunded_at.isoformat() if self.refunded_at else None,
            "idempotency_key": self.idempotency_key,
            "reservation_id": self.reservation_id,
        }
    
    def load_from_snapshot(self, snapshot: Dict[str, Any]) -> None:
        """Load order state from a snapshot."""
        self._aggregate_id = snapshot["aggregate_id"]
        self._version = snapshot["version"]
        self.customer_id = snapshot["customer_id"]
        self.status = OrderState(snapshot["status"]) if snapshot["status"] else OrderState.DRAFT
        
        # Reconstruct items
        self.items = [OrderItem.model_validate(item) for item in snapshot["items"]]
        
        # Reconstruct monetary values
        self.subtotal = Decimal(snapshot["subtotal"])
        self.tax_amount = Decimal(snapshot["tax_amount"])
        self.shipping_amount = Decimal(snapshot["shipping_amount"])
        self.total_amount = Decimal(snapshot["total_amount"])
        self.currency = snapshot["currency"]
        
        # Reconstruct payment info
        self.payment_method = PaymentMethod(snapshot["payment_method"]) if snapshot["payment_method"] else None
        self.payment_state = PaymentState(snapshot["payment_state"])
        self.payment_transaction_id = snapshot["payment_transaction_id"]
        
        # Reconstruct shipping info
        if snapshot["shipping_address"]:
            self.shipping_address = ShippingAddress.model_validate(snapshot["shipping_address"])
        self.tracking_number = snapshot["tracking_number"]
        self.carrier = snapshot["carrier"]
        
        # Reconstruct timestamps
        self.created_at = datetime.fromisoformat(snapshot["created_at"]) if snapshot["created_at"] else None
        self.updated_at = datetime.fromisoformat(snapshot["updated_at"]) if snapshot["updated_at"] else None
        self.confirmed_at = datetime.fromisoformat(snapshot["confirmed_at"]) if snapshot["confirmed_at"] else None
        self.shipped_at = datetime.fromisoformat(snapshot["shipped_at"]) if snapshot["shipped_at"] else None
        self.delivered_at = datetime.fromisoformat(snapshot["delivered_at"]) if snapshot["delivered_at"] else None
        self.cancelled_at = datetime.fromisoformat(snapshot["cancelled_at"]) if snapshot["cancelled_at"] else None
        self.refunded_at = datetime.fromisoformat(snapshot["refunded_at"]) if snapshot["refunded_at"] else None
        
        # Reconstruct metadata
        self.idempotency_key = snapshot["idempotency_key"]
        self.reservation_id = snapshot["reservation_id"]

