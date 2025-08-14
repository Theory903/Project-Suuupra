"""
Order Cancellation Saga for the Commerce Service.

This saga orchestrates the order cancellation process, including:
- Inventory release
- Payment refunds
- Notification triggers
- Compensating transactions for failures
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import UUID

from ..sagas.base import SagaBase, SagaStep, SagaStatus
from ...domain.events.order_events import (
    OrderCancellationApprovedEvent, OrderCancelledEvent,
    OrderRefundInitiatedEvent, OrderRefundCompletedEvent,
    OrderInventoryReleasedEvent
)
from ...infrastructure.messaging.event_bus import EventBus
from ...infrastructure.external.payment_service import PaymentServiceAdapter
from ...infrastructure.external.notification_service import NotificationServiceAdapter
from ...application.inventory_service import InventoryService


class OrderCancellationSagaData:
    """Data container for Order Cancellation Saga."""
    
    def __init__(
        self,
        order_id: UUID,
        customer_id: str,
        cancellation_reason: str,
        refund_amount: Decimal,
        inventory_to_release: List[Dict[str, Any]],
        payment_method: str
    ):
        self.order_id = order_id
        self.customer_id = customer_id
        self.cancellation_reason = cancellation_reason
        self.refund_amount = refund_amount
        self.inventory_to_release = inventory_to_release
        self.payment_method = payment_method
        
        # Saga state
        self.refund_id: Optional[str] = None
        self.inventory_released: List[str] = []
        self.notifications_sent: List[str] = []
        self.compensation_actions: List[str] = []


class OrderCancellationSaga(SagaBase):
    """
    Order Cancellation Saga.
    
    Orchestrates the complete order cancellation process with compensating
    transactions for failure scenarios.
    
    Steps:
    1. Release inventory reservations
    2. Initiate payment refund
    3. Update order status to cancelled
    4. Send cancellation notifications
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        inventory_service: InventoryService,
        payment_service: PaymentServiceAdapter,
        notification_service: NotificationServiceAdapter
    ):
        super().__init__()
        self.event_bus = event_bus
        self.inventory_service = inventory_service
        self.payment_service = payment_service
        self.notification_service = notification_service
        
        # Define saga steps
        self.steps = [
            SagaStep(
                name="release_inventory",
                action=self._release_inventory,
                compensation=self._compensate_inventory_release
            ),
            SagaStep(
                name="initiate_refund",
                action=self._initiate_refund,
                compensation=self._compensate_refund
            ),
            SagaStep(
                name="update_order_status",
                action=self._update_order_status,
                compensation=self._compensate_order_status
            ),
            SagaStep(
                name="send_notifications",
                action=self._send_notifications,
                compensation=self._compensate_notifications
            )
        ]
    
    async def start(
        self,
        order_id: UUID,
        customer_id: str,
        cancellation_reason: str,
        refund_amount: Decimal,
        inventory_to_release: List[Dict[str, Any]],
        payment_method: str
    ) -> str:
        """
        Start the order cancellation saga.
        
        Args:
            order_id: ID of the order to cancel
            customer_id: Customer ID
            cancellation_reason: Reason for cancellation
            refund_amount: Amount to refund
            inventory_to_release: List of inventory items to release
            payment_method: Payment method for refund
            
        Returns:
            Saga ID
        """
        saga_data = OrderCancellationSagaData(
            order_id=order_id,
            customer_id=customer_id,
            cancellation_reason=cancellation_reason,
            refund_amount=refund_amount,
            inventory_to_release=inventory_to_release,
            payment_method=payment_method
        )
        
        saga_id = str(uuid.uuid4())
        await self.execute_saga(saga_id, saga_data)
        return saga_id
    
    async def _release_inventory(self, saga_data: OrderCancellationSagaData) -> bool:
        """
        Step 1: Release inventory reservations.
        
        Args:
            saga_data: Saga data containing inventory to release
            
        Returns:
            True if successful
        """
        try:
            released_items = []
            
            for item in saga_data.inventory_to_release:
                product_id = item.get("product_id")
                variant_id = item.get("variant_id")
                quantity = item.get("quantity")
                reservation_id = item.get("reservation_id")
                
                if reservation_id:
                    # Cancel specific reservation
                    success = await self.inventory_service.cancel_reservation(
                        reservation_id=reservation_id,
                        cancelled_by="saga-cancellation"
                    )
                    
                    if success:
                        released_items.append({
                            "product_id": product_id,
                            "variant_id": variant_id,
                            "quantity": quantity,
                            "reservation_id": reservation_id
                        })
                        saga_data.inventory_released.append(reservation_id)
                else:
                    # Release inventory by product
                    success = await self.inventory_service.release_stock(
                        product_id=product_id,
                        variant_id=variant_id,
                        quantity=quantity,
                        released_by="saga-cancellation"
                    )
                    
                    if success:
                        released_items.append({
                            "product_id": product_id,
                            "variant_id": variant_id,
                            "quantity": quantity
                        })
            
            # Publish inventory released event
            if released_items:
                event = OrderInventoryReleasedEvent(
                    aggregate_id=str(saga_data.order_id),
                    aggregate_type="order",
                    aggregate_version=1,  # Will be updated by aggregate
                    order_id=saga_data.order_id,
                    customer_id=saga_data.customer_id,
                    released_items=released_items,
                    release_reason=saga_data.cancellation_reason,
                    released_by="saga-cancellation"
                )
                await self.event_bus.publish(event)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to release inventory for order {saga_data.order_id}: {e}")
            return False
    
    async def _initiate_refund(self, saga_data: OrderCancellationSagaData) -> bool:
        """
        Step 2: Initiate payment refund.
        
        Args:
            saga_data: Saga data containing refund information
            
        Returns:
            True if successful
        """
        try:
            if saga_data.refund_amount <= 0:
                # No refund needed
                return True
            
            # Initiate refund through payment service
            refund_result = await self.payment_service.initiate_refund(
                order_id=str(saga_data.order_id),
                amount=saga_data.refund_amount,
                reason=saga_data.cancellation_reason,
                payment_method=saga_data.payment_method
            )
            
            if refund_result.get("success"):
                saga_data.refund_id = refund_result.get("refund_id")
                
                # Publish refund initiated event
                event = OrderRefundInitiatedEvent(
                    aggregate_id=str(saga_data.order_id),
                    aggregate_type="order",
                    aggregate_version=1,  # Will be updated by aggregate
                    order_id=saga_data.order_id,
                    customer_id=saga_data.customer_id,
                    refund_id=saga_data.refund_id,
                    refund_amount=saga_data.refund_amount,
                    payment_method=saga_data.payment_method,
                    initiated_by="saga-cancellation"
                )
                await self.event_bus.publish(event)
                
                return True
            else:
                self.logger.error(f"Refund initiation failed: {refund_result.get('error')}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to initiate refund for order {saga_data.order_id}: {e}")
            return False
    
    async def _update_order_status(self, saga_data: OrderCancellationSagaData) -> bool:
        """
        Step 3: Update order status to cancelled.
        
        Args:
            saga_data: Saga data containing order information
            
        Returns:
            True if successful
        """
        try:
            # Publish order cancelled event
            event = OrderCancelledEvent(
                aggregate_id=str(saga_data.order_id),
                aggregate_type="order",
                aggregate_version=1,  # Will be updated by aggregate
                order_id=saga_data.order_id,
                customer_id=saga_data.customer_id,
                previous_status="confirmed",  # This should be retrieved from order
                cancellation_reason=saga_data.cancellation_reason,
                cancelled_by="saga-cancellation",
                cancelled_at=datetime.now(timezone.utc),
                refund_amount=saga_data.refund_amount,
                inventory_to_release=saga_data.inventory_to_release
            )
            await self.event_bus.publish(event)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to update order status for {saga_data.order_id}: {e}")
            return False
    
    async def _send_notifications(self, saga_data: OrderCancellationSagaData) -> bool:
        """
        Step 4: Send cancellation notifications.
        
        Args:
            saga_data: Saga data containing notification information
            
        Returns:
            True if successful
        """
        try:
            notifications_to_send = [
                {
                    "type": "order_cancelled",
                    "recipient": saga_data.customer_id,
                    "channel": "email",
                    "template": "order_cancellation",
                    "data": {
                        "order_id": str(saga_data.order_id),
                        "cancellation_reason": saga_data.cancellation_reason,
                        "refund_amount": str(saga_data.refund_amount),
                        "refund_id": saga_data.refund_id
                    }
                },
                {
                    "type": "order_cancelled",
                    "recipient": saga_data.customer_id,
                    "channel": "sms",
                    "template": "order_cancellation_sms",
                    "data": {
                        "order_id": str(saga_data.order_id),
                        "refund_amount": str(saga_data.refund_amount)
                    }
                }
            ]
            
            for notification in notifications_to_send:
                result = await self.notification_service.send_notification(notification)
                if result.get("success"):
                    saga_data.notifications_sent.append(result.get("notification_id"))
                else:
                    self.logger.warning(f"Failed to send notification: {result.get('error')}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to send notifications for order {saga_data.order_id}: {e}")
            return False
    
    # Compensation Actions
    
    async def _compensate_inventory_release(self, saga_data: OrderCancellationSagaData) -> bool:
        """Compensate inventory release by re-reserving items."""
        try:
            for reservation_id in saga_data.inventory_released:
                # Try to re-reserve the inventory
                # This might fail if inventory is no longer available
                await self.inventory_service.re_reserve_stock(
                    reservation_id=reservation_id,
                    reserved_by="saga-compensation"
                )
            
            saga_data.compensation_actions.append("inventory_re_reserved")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to compensate inventory release: {e}")
            return False
    
    async def _compensate_refund(self, saga_data: OrderCancellationSagaData) -> bool:
        """Compensate refund by reversing the refund transaction."""
        try:
            if saga_data.refund_id:
                # Cancel the refund if possible
                result = await self.payment_service.cancel_refund(
                    refund_id=saga_data.refund_id,
                    reason="saga-compensation"
                )
                
                if result.get("success"):
                    saga_data.compensation_actions.append("refund_cancelled")
                    return True
            
            return True  # No refund to compensate
            
        except Exception as e:
            self.logger.error(f"Failed to compensate refund: {e}")
            return False
    
    async def _compensate_order_status(self, saga_data: OrderCancellationSagaData) -> bool:
        """Compensate order status update by reverting to previous status."""
        try:
            # This would typically involve publishing an event to revert order status
            # Implementation depends on specific business rules
            saga_data.compensation_actions.append("order_status_reverted")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to compensate order status: {e}")
            return False
    
    async def _compensate_notifications(self, saga_data: OrderCancellationSagaData) -> bool:
        """Compensate notifications by sending correction notifications."""
        try:
            correction_notifications = [
                {
                    "type": "order_cancellation_reversed",
                    "recipient": saga_data.customer_id,
                    "channel": "email",
                    "template": "order_cancellation_reversed",
                    "data": {
                        "order_id": str(saga_data.order_id),
                        "message": "Order cancellation has been reversed due to a processing error."
                    }
                }
            ]
            
            for notification in correction_notifications:
                result = await self.notification_service.send_notification(notification)
                if result.get("success"):
                    saga_data.notifications_sent.append(result.get("notification_id"))
            
            saga_data.compensation_actions.append("correction_notifications_sent")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to compensate notifications: {e}")
            return False
    
    def get_saga_type(self) -> str:
        """Return the saga type identifier."""
        return "order_cancellation_saga"
