"""
Order Aggregate for the Commerce Service.

This aggregate manages the complete order lifecycle including creation, updates,
payments, fulfillment, cancellations, and returns. It implements the business
rules and invariants for order management.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID
from enum import Enum

from ..events.order_events import (
    OrderCreatedEvent, OrderUpdatedEvent, OrderCancelledEvent,
    OrderCancellationRequestedEvent, OrderCancellationApprovedEvent,
    OrderCancellationRejectedEvent, OrderRefundInitiatedEvent,
    OrderRefundCompletedEvent, OrderRefundFailedEvent,
    OrderShippedEvent, OrderDeliveredEvent, OrderReturnRequestedEvent,
    OrderReturnApprovedEvent, OrderPaymentAuthorizedEvent,
    OrderPaymentCapturedEvent, OrderPaymentFailedEvent,
    OrderFulfillmentStartedEvent, OrderFulfillmentCompletedEvent,
    OrderInventoryReservedEvent, OrderInventoryReleasedEvent
)
from ..entities.order import Order, OrderStatus, PaymentStatus, FulfillmentStatus
from .base import AggregateRoot


class OrderCancellationPolicy(Enum):
    """Order cancellation policies."""
    IMMEDIATE = "immediate"  # Can be cancelled immediately
    APPROVAL_REQUIRED = "approval_required"  # Requires approval
    NOT_CANCELLABLE = "not_cancellable"  # Cannot be cancelled


class OrderAggregate(AggregateRoot):
    """
    Order Aggregate Root.
    
    Manages the complete order lifecycle and enforces business rules
    for order operations, payments, fulfillment, and cancellations.
    """
    
    def __init__(self, aggregate_id: str):
        super().__init__(aggregate_id)
        self.order: Optional[Order] = None
        self.payment_attempts: List[Dict[str, Any]] = []
        self.cancellation_requests: List[Dict[str, Any]] = []
        self.return_requests: List[Dict[str, Any]] = []
        
    def create_order(
        self,
        customer_id: str,
        items: List[Dict[str, Any]],
        shipping_address: Dict[str, str],
        billing_address: Dict[str, str],
        payment_method: str,
        created_by: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Create a new order.
        
        Args:
            customer_id: ID of the customer placing the order
            items: List of order items with product details
            shipping_address: Shipping address details
            billing_address: Billing address details
            payment_method: Payment method identifier
            created_by: User creating the order
            metadata: Additional order metadata
            
        Returns:
            True if order created successfully
        """
        if self.order is not None:
            return False  # Order already exists
            
        # Calculate total amount
        total_amount = sum(
            Decimal(str(item.get('unit_price', 0))) * item.get('quantity', 0)
            for item in items
        )
        
        if total_amount <= 0:
            return False  # Invalid order total
            
        # Create order entity
        self.order = Order(
            id=UUID(self.aggregate_id),
            customer_id=customer_id,
            items=items,
            total_amount=total_amount,
            currency="USD",
            status=OrderStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            fulfillment_status=FulfillmentStatus.PENDING,
            shipping_address=shipping_address,
            billing_address=billing_address,
            payment_method=payment_method,
            created_by=created_by,
            metadata=metadata or {}
        )
        
        # Raise domain event
        event = OrderCreatedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=customer_id,
            items=items,
            total_amount=total_amount,
            currency="USD",
            shipping_address=shipping_address,
            billing_address=billing_address,
            payment_method=payment_method,
            created_by=created_by
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def update_status(
        self,
        new_status: OrderStatus,
        updated_by: str,
        reason: Optional[str] = None
    ) -> bool:
        """Update order status."""
        if not self.order or not self._can_update_status(new_status):
            return False
            
        previous_status = self.order.status
        changes = {"status": f"{previous_status.value} -> {new_status.value}"}
        
        if reason:
            changes["reason"] = reason
            
        self.order.status = new_status
        self.order.updated_at = datetime.now(timezone.utc)
        self.order.updated_by = updated_by
        
        # Raise domain event
        event = OrderUpdatedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            previous_status=previous_status.value,
            new_status=new_status.value,
            changes=changes,
            updated_by=updated_by,
            reason=reason
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def request_cancellation(
        self,
        cancellation_reason: str,
        requested_by: str
    ) -> bool:
        """
        Request order cancellation.
        
        Args:
            cancellation_reason: Reason for cancellation
            requested_by: User requesting cancellation
            
        Returns:
            True if cancellation request created
        """
        if not self.order or not self._can_request_cancellation():
            return False
            
        policy = self._get_cancellation_policy()
        auto_approve = policy == OrderCancellationPolicy.IMMEDIATE
        
        # Add to cancellation requests
        request = {
            "id": str(uuid.uuid4()),
            "reason": cancellation_reason,
            "requested_by": requested_by,
            "requested_at": datetime.now(timezone.utc),
            "status": "approved" if auto_approve else "pending",
            "auto_approve": auto_approve
        }
        self.cancellation_requests.append(request)
        
        # Raise domain event
        event = OrderCancellationRequestedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            current_status=self.order.status.value,
            cancellation_reason=cancellation_reason,
            requested_by=requested_by,
            auto_approve=auto_approve
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        # Auto-approve if policy allows
        if auto_approve:
            return self._approve_cancellation(request["id"], requested_by)
            
        return True
    
    def approve_cancellation(
        self,
        request_id: str,
        approved_by: str
    ) -> bool:
        """
        Approve order cancellation request.
        
        Args:
            request_id: ID of the cancellation request
            approved_by: User approving the cancellation
            
        Returns:
            True if cancellation approved
        """
        return self._approve_cancellation(request_id, approved_by)
    
    def _approve_cancellation(
        self,
        request_id: str,
        approved_by: str
    ) -> bool:
        """Internal method to approve cancellation."""
        if not self.order:
            return False
            
        # Find the request
        request = None
        for req in self.cancellation_requests:
            if req["id"] == request_id:
                request = req
                break
                
        if not request or request["status"] != "pending":
            return False
            
        # Calculate refund amount
        refund_amount = self._calculate_refund_amount()
        
        # Prepare inventory to release
        inventory_to_release = [
            {
                "product_id": item["product_id"],
                "variant_id": item.get("variant_id"),
                "quantity": item["quantity"],
                "reservation_id": item.get("reservation_id")
            }
            for item in self.order.items
        ]
        
        # Update request status
        request["status"] = "approved"
        request["approved_by"] = approved_by
        request["approved_at"] = datetime.now(timezone.utc)
        
        # Raise domain event
        event = OrderCancellationApprovedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            cancellation_reason=request["reason"],
            approved_by=approved_by,
            refund_amount=refund_amount,
            inventory_to_release=inventory_to_release
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def reject_cancellation(
        self,
        request_id: str,
        rejection_reason: str,
        rejected_by: str
    ) -> bool:
        """
        Reject order cancellation request.
        
        Args:
            request_id: ID of the cancellation request
            rejection_reason: Reason for rejection
            rejected_by: User rejecting the cancellation
            
        Returns:
            True if cancellation rejected
        """
        if not self.order:
            return False
            
        # Find the request
        request = None
        for req in self.cancellation_requests:
            if req["id"] == request_id:
                request = req
                break
                
        if not request or request["status"] != "pending":
            return False
            
        # Update request status
        request["status"] = "rejected"
        request["rejected_by"] = rejected_by
        request["rejected_at"] = datetime.now(timezone.utc)
        request["rejection_reason"] = rejection_reason
        
        # Raise domain event
        event = OrderCancellationRejectedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            cancellation_reason=request["reason"],
            rejection_reason=rejection_reason,
            rejected_by=rejected_by
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def cancel_order(
        self,
        cancellation_reason: str,
        cancelled_by: str
    ) -> bool:
        """
        Cancel the order (final cancellation).
        
        Args:
            cancellation_reason: Reason for cancellation
            cancelled_by: User cancelling the order
            
        Returns:
            True if order cancelled
        """
        if not self.order or not self._can_cancel():
            return False
            
        previous_status = self.order.status
        refund_amount = self._calculate_refund_amount()
        
        # Prepare inventory to release
        inventory_to_release = [
            {
                "product_id": item["product_id"],
                "variant_id": item.get("variant_id"),
                "quantity": item["quantity"],
                "reservation_id": item.get("reservation_id")
            }
            for item in self.order.items
        ]
        
        # Update order status
        self.order.status = OrderStatus.CANCELLED
        self.order.updated_at = datetime.now(timezone.utc)
        self.order.updated_by = cancelled_by
        
        # Raise domain event
        event = OrderCancelledEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            previous_status=previous_status.value,
            cancellation_reason=cancellation_reason,
            cancelled_by=cancelled_by,
            cancelled_at=datetime.now(timezone.utc),
            refund_amount=refund_amount,
            inventory_to_release=inventory_to_release
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def authorize_payment(
        self,
        payment_id: str,
        authorization_id: str,
        amount: Decimal
    ) -> bool:
        """Authorize payment for the order."""
        if not self.order or self.order.payment_status != PaymentStatus.PENDING:
            return False
            
        self.order.payment_status = PaymentStatus.AUTHORIZED
        self.order.updated_at = datetime.now(timezone.utc)
        
        # Track payment attempt
        self.payment_attempts.append({
            "payment_id": payment_id,
            "authorization_id": authorization_id,
            "amount": amount,
            "status": "authorized",
            "timestamp": datetime.now(timezone.utc)
        })
        
        # Raise domain event
        event = OrderPaymentAuthorizedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            payment_id=payment_id,
            authorization_id=authorization_id,
            amount=amount,
            payment_method=self.order.payment_method
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def capture_payment(
        self,
        payment_id: str,
        transaction_id: str,
        amount: Decimal
    ) -> bool:
        """Capture authorized payment."""
        if not self.order or self.order.payment_status != PaymentStatus.AUTHORIZED:
            return False
            
        self.order.payment_status = PaymentStatus.PAID
        self.order.updated_at = datetime.now(timezone.utc)
        
        # Update payment attempt
        for attempt in self.payment_attempts:
            if attempt["payment_id"] == payment_id:
                attempt["status"] = "captured"
                attempt["transaction_id"] = transaction_id
                break
        
        # Raise domain event
        event = OrderPaymentCapturedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            payment_id=payment_id,
            transaction_id=transaction_id,
            amount=amount,
            captured_at=datetime.now(timezone.utc)
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def ship_order(
        self,
        shipment_id: str,
        carrier: str,
        tracking_number: str,
        estimated_delivery: Optional[datetime] = None
    ) -> bool:
        """Mark order as shipped."""
        if not self.order or self.order.fulfillment_status != FulfillmentStatus.PROCESSING:
            return False
            
        self.order.fulfillment_status = FulfillmentStatus.SHIPPED
        self.order.updated_at = datetime.now(timezone.utc)
        
        # Raise domain event
        event = OrderShippedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            shipment_id=shipment_id,
            carrier=carrier,
            tracking_number=tracking_number,
            shipped_at=datetime.now(timezone.utc),
            estimated_delivery=estimated_delivery
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def deliver_order(
        self,
        shipment_id: str,
        delivered_to: str,
        signature: Optional[str] = None
    ) -> bool:
        """Mark order as delivered."""
        if not self.order or self.order.fulfillment_status != FulfillmentStatus.SHIPPED:
            return False
            
        self.order.fulfillment_status = FulfillmentStatus.DELIVERED
        self.order.status = OrderStatus.COMPLETED
        self.order.updated_at = datetime.now(timezone.utc)
        
        # Raise domain event
        event = OrderDeliveredEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="order",
            aggregate_version=self.version + 1,
            order_id=UUID(self.aggregate_id),
            customer_id=self.order.customer_id,
            shipment_id=shipment_id,
            delivered_at=datetime.now(timezone.utc),
            delivered_to=delivered_to,
            signature=signature
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def _can_update_status(self, new_status: OrderStatus) -> bool:
        """Check if status update is allowed."""
        if not self.order:
            return False
            
        current = self.order.status
        
        # Define allowed transitions
        allowed_transitions = {
            OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            OrderStatus.CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            OrderStatus.PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            OrderStatus.SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
            OrderStatus.DELIVERED: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
            OrderStatus.COMPLETED: [OrderStatus.RETURNED],
            OrderStatus.CANCELLED: [],  # Terminal state
            OrderStatus.RETURNED: []  # Terminal state
        }
        
        return new_status in allowed_transitions.get(current, [])
    
    def _can_request_cancellation(self) -> bool:
        """Check if cancellation can be requested."""
        if not self.order:
            return False
            
        # Cannot cancel if already cancelled or completed
        if self.order.status in [OrderStatus.CANCELLED, OrderStatus.COMPLETED, OrderStatus.RETURNED]:
            return False
            
        # Check if there's already a pending request
        for request in self.cancellation_requests:
            if request["status"] == "pending":
                return False
                
        return True
    
    def _can_cancel(self) -> bool:
        """Check if order can be cancelled."""
        if not self.order:
            return False
            
        return self.order.status not in [
            OrderStatus.CANCELLED, 
            OrderStatus.COMPLETED, 
            OrderStatus.RETURNED
        ]
    
    def _get_cancellation_policy(self) -> OrderCancellationPolicy:
        """Determine cancellation policy based on order status."""
        if not self.order:
            return OrderCancellationPolicy.NOT_CANCELLABLE
            
        # Immediate cancellation for pending/confirmed orders
        if self.order.status in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
            return OrderCancellationPolicy.IMMEDIATE
            
        # Approval required for processing orders
        if self.order.status == OrderStatus.PROCESSING:
            return OrderCancellationPolicy.APPROVAL_REQUIRED
            
        # Cannot cancel shipped/delivered orders
        return OrderCancellationPolicy.NOT_CANCELLABLE
    
    def _calculate_refund_amount(self) -> Decimal:
        """Calculate refund amount based on order status."""
        if not self.order:
            return Decimal("0.00")
            
        # Full refund for early stages
        if self.order.status in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
            return self.order.total_amount
            
        # Partial refund for processing (minus processing fee)
        if self.order.status == OrderStatus.PROCESSING:
            processing_fee = self.order.total_amount * Decimal("0.05")  # 5% processing fee
            return max(Decimal("0.00"), self.order.total_amount - processing_fee)
            
        # No refund for shipped/delivered orders
        return Decimal("0.00")
    
    # Event Handlers for State Reconstruction
    
    def on_OrderCreatedEvent(self, event: OrderCreatedEvent) -> None:
        """Handle OrderCreatedEvent during state reconstruction."""
        from ..entities.order import Order, OrderStatus, PaymentStatus, FulfillmentStatus
        
        self.order = Order(
            id=event.order_id,
            customer_id=event.customer_id,
            items=event.items,
            total_amount=event.total_amount,
            currency=event.currency,
            status=OrderStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            fulfillment_status=FulfillmentStatus.PENDING,
            shipping_address=event.shipping_address,
            billing_address=event.billing_address,
            payment_method=event.payment_method,
            created_by=event.created_by,
            created_at=event.occurred_at
        )
    
    def on_OrderUpdatedEvent(self, event: OrderUpdatedEvent) -> None:
        """Handle OrderUpdatedEvent during state reconstruction."""
        if self.order:
            self.order.status = OrderStatus(event.new_status)
            self.order.updated_at = event.occurred_at
    
    def on_OrderCancelledEvent(self, event: OrderCancelledEvent) -> None:
        """Handle OrderCancelledEvent during state reconstruction."""
        if self.order:
            self.order.status = OrderStatus.CANCELLED
            self.order.updated_at = event.occurred_at
    
    def on_OrderCancellationRequestedEvent(self, event: OrderCancellationRequestedEvent) -> None:
        """Handle OrderCancellationRequestedEvent during state reconstruction."""
        request = {
            "id": str(uuid.uuid4()),
            "reason": event.cancellation_reason,
            "requested_by": event.requested_by,
            "requested_at": event.occurred_at,
            "status": "approved" if event.auto_approve else "pending",
            "auto_approve": event.auto_approve
        }
        self.cancellation_requests.append(request)
    
    def on_OrderPaymentAuthorizedEvent(self, event: OrderPaymentAuthorizedEvent) -> None:
        """Handle OrderPaymentAuthorizedEvent during state reconstruction."""
        if self.order:
            self.order.payment_status = PaymentStatus.AUTHORIZED
            
        self.payment_attempts.append({
            "payment_id": event.payment_id,
            "authorization_id": event.authorization_id,
            "amount": event.amount,
            "status": "authorized",
            "timestamp": event.occurred_at
        })
    
    def on_OrderPaymentCapturedEvent(self, event: OrderPaymentCapturedEvent) -> None:
        """Handle OrderPaymentCapturedEvent during state reconstruction."""
        if self.order:
            self.order.payment_status = PaymentStatus.PAID
            
        # Update payment attempt
        for attempt in self.payment_attempts:
            if attempt["payment_id"] == event.payment_id:
                attempt["status"] = "captured"
                attempt["transaction_id"] = event.transaction_id
                break
    
    def on_OrderShippedEvent(self, event: OrderShippedEvent) -> None:
        """Handle OrderShippedEvent during state reconstruction."""
        if self.order:
            self.order.fulfillment_status = FulfillmentStatus.SHIPPED
            self.order.updated_at = event.occurred_at
    
    def on_OrderDeliveredEvent(self, event: OrderDeliveredEvent) -> None:
        """Handle OrderDeliveredEvent during state reconstruction."""
        if self.order:
            self.order.fulfillment_status = FulfillmentStatus.DELIVERED
            self.order.status = OrderStatus.COMPLETED
            self.order.updated_at = event.occurred_at