"""
Order Service - Handles order creation and management.

Coordinates cart-to-order conversion, aggregate persistence,
saga orchestration, and Kafka event publishing for order fulfillment.
"""

from typing import Dict, Any, Optional, List
from decimal import Decimal
import structlog

from ..domain.aggregates.order import OrderAggregate
from ..domain.entities.cart import ShoppingCart
from ..domain.entities.order import PaymentMethod, ShippingAddress
from ..infrastructure.persistence.event_store import AggregateRepository
from ..infrastructure.persistence.cart_repository import CartRepository
from ..infrastructure.messaging.kafka_producer import get_kafka_producer
from ..domain.events.order_events import OrderCreatedEvent, OrderUpdatedEvent, OrderCancelledEvent
from .saga_orchestrator import SagaOrchestrator

logger = structlog.get_logger(__name__)


class OrderService:
    """
    Application service for order management.
    
    Handles the business process of creating orders from shopping carts
    and orchestrating the order fulfillment workflow.
    """
    
    def __init__(
        self,
        aggregate_repo: Optional[AggregateRepository] = None,
        cart_repo: Optional[CartRepository] = None,
        saga_orchestrator: Optional[SagaOrchestrator] = None,
    ):
        self.aggregate_repo = aggregate_repo or AggregateRepository()
        self.cart_repo = cart_repo or CartRepository()
        self.saga_orchestrator = saga_orchestrator or SagaOrchestrator()
        self.kafka_producer = None
        
    async def _get_kafka_producer(self):
        """Get Kafka producer with error handling."""
        if self.kafka_producer is None:
            try:
                self.kafka_producer = get_kafka_producer()
            except RuntimeError:
                logger.warning("Kafka producer not available, events will not be published")
                return None
        return self.kafka_producer
    
    async def create_order_from_cart(
        self,
        cart_id: str,
        customer_id: str,
        payment_method: str,
        shipping_address: Dict[str, str],
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create an order from a shopping cart and start fulfillment saga.
        
        Args:
            cart_id: Shopping cart identifier
            customer_id: Customer identifier
            payment_method: Payment method selected
            shipping_address: Shipping address details
            idempotency_key: Optional idempotency key
            
        Returns:
            Dictionary with order details and saga information
        """
        logger.info(
            "Creating order from cart",
            cart_id=cart_id,
            customer_id=customer_id,
            payment_method=payment_method,
        )
        
        # 1. Get and validate cart
        cart = await self.cart_repo.get(cart_id)
        if not cart:
            raise ValueError(f"Cart {cart_id} not found")
        
        if cart.customer_id != customer_id:
            raise ValueError("Cart does not belong to customer")
        
        if cart.is_empty():
            raise ValueError("Cannot create order from empty cart")
        
        if cart.is_expired():
            raise ValueError("Cart has expired")
        
        # 2. Create order aggregate
        order = OrderAggregate()
        
        # Convert cart items to order format
        order_items = []
        for cart_item in cart.items:
            order_items.append({
                "product_id": cart_item.product_id,
                "product_name": cart_item.product_name,
                "quantity": cart_item.quantity,
                "unit_price": cart_item.unit_price,
            })
        
        # Convert shipping address
        shipping_addr = {
            "recipient_name": shipping_address.get("recipient_name", ""),
            "street": shipping_address.get("street", ""),
            "city": shipping_address.get("city", ""),
            "state": shipping_address.get("state", ""),
            "postal_code": shipping_address.get("postal_code", ""),
            "country": shipping_address.get("country", "USA"),
        }
        
        # Create the order
        order.create_order(
            customer_id=customer_id,
            items=order_items,
            payment_method=PaymentMethod(payment_method),
            shipping_address=shipping_addr,
            idempotency_key=idempotency_key,
        )
        
        # 3. Persist order aggregate (this will save events)
        await self.aggregate_repo.save(order)
        
        # 4. Publish order.created event to Kafka
        await self._publish_order_created_event(order, order_items, shipping_addr)
        
        # 5. Mark cart as converted
        await self.cart_repo.convert_to_order(cart_id, order.aggregate_id)
        
        # 6. Start order fulfillment saga
        saga_context = {
            "order_id": order.aggregate_id,
            "customer_id": customer_id,
            "items": order_items,
            "payment_method": payment_method,
            "total_amount": str(cart.total_amount),
            "currency": cart.currency,
            "shipping_address": shipping_addr,
        }
        
        saga_id = await self.saga_orchestrator.start_saga(
            saga_type="order_fulfillment",
            correlation_id=order.aggregate_id,
            context_data=saga_context,
        )
        
        logger.info(
            "Order created and fulfillment saga started",
            order_id=order.aggregate_id,
            cart_id=cart_id,
            saga_id=saga_id,
            total_amount=str(cart.total_amount),
        )
        
        return {
            "order_id": order.aggregate_id,
            "saga_id": saga_id,
            "status": order.status.value,
            "total_amount": str(cart.total_amount),
            "currency": cart.currency,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": order_items,
            "shipping_address": shipping_addr,
        }
    
    async def get_order(self, order_id: str, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Get order details by ID.
        
        Args:
            order_id: Order identifier
            customer_id: Customer identifier for authorization
            
        Returns:
            Order details or None if not found
        """
        order = await self.aggregate_repo.load(OrderAggregate, order_id)
        
        if not order:
            return None
        
        # Verify customer ownership
        if order.customer_id != customer_id:
            raise ValueError("Order does not belong to customer")
        
        return {
            "order_id": order.aggregate_id,
            "customer_id": order.customer_id,
            "status": order.status.value,
            "items": [item.model_dump() for item in order.items],
            "subtotal": str(order.subtotal),
            "tax_amount": str(order.tax_amount),
            "shipping_amount": str(order.shipping_amount),
            "total_amount": str(order.total_amount),
            "currency": order.currency,
            "payment_method": order.payment_method.value if order.payment_method else None,
            "shipping_address": order.shipping_address.model_dump() if order.shipping_address else None,
            "tracking_number": order.tracking_number,
            "carrier": order.carrier,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "confirmed_at": order.confirmed_at.isoformat() if order.confirmed_at else None,
            "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
            "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        }
    
    async def cancel_order(
        self,
        order_id: str,
        customer_id: str,
        reason: str,
    ) -> Dict[str, Any]:
        """
        Cancel an order.
        
        Args:
            order_id: Order identifier
            customer_id: Customer identifier for authorization
            reason: Cancellation reason
            
        Returns:
            Updated order details
        """
        order = await self.aggregate_repo.load(OrderAggregate, order_id)
        
        if not order:
            raise ValueError(f"Order {order_id} not found")
        
        # Verify customer ownership
        if order.customer_id != customer_id:
            raise ValueError("Order does not belong to customer")
        
        # Cancel the order
        order.cancel_order(
            reason=reason,
            cancelled_by=customer_id,
            refund_amount=order.total_amount,  # Full refund
        )
        
        # Persist changes
        await self.aggregate_repo.save(order)
        
        # Publish order.cancelled event to Kafka
        await self._publish_order_cancelled_event(order, reason, customer_id)
        
        logger.info(
            "Order cancelled",
            order_id=order_id,
            customer_id=customer_id,
            reason=reason,
        )
        
        return {
            "order_id": order.aggregate_id,
            "status": order.status.value,
            "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
            "cancellation_reason": order.cancellation_reason,
        }
    
    async def get_customer_orders(
        self,
        customer_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Get orders for a customer.
        
        Args:
            customer_id: Customer identifier
            limit: Maximum number of orders to return
            offset: Number of orders to skip
            
        Returns:
            List of order summaries
        """
        # Implement with read models for better performance
        import asyncpg
        import os
        from typing import List, Dict, Any
        
        logger.info(
            "Getting customer orders",
            customer_id=customer_id,
            limit=limit,
            offset=offset,
        )
        
        try:
            # Connect to read replica database for better performance
            read_db_url = os.getenv('READ_DATABASE_URL', os.getenv('DATABASE_URL'))
            
            async with asyncpg.connect(read_db_url) as conn:
                # Query order summaries with optimized read model
                query = """
                    SELECT 
                        o.order_id,
                        o.customer_id,
                        o.status,
                        o.total_amount,
                        o.currency,
                        o.created_at,
                        o.updated_at,
                        COUNT(oi.item_id) as item_count,
                        p.status as payment_status
                    FROM orders o
                    LEFT JOIN order_items oi ON o.order_id = oi.order_id
                    LEFT JOIN payments p ON o.payment_id = p.payment_id
                    WHERE o.customer_id = $1
                    GROUP BY o.order_id, o.customer_id, o.status, o.total_amount, 
                             o.currency, o.created_at, o.updated_at, p.status
                    ORDER BY o.created_at DESC
                    LIMIT $2 OFFSET $3
                """
                
                rows = await conn.fetch(query, customer_id, limit, offset)
                
                orders = []
                for row in rows:
                    order_summary = {
                        "order_id": str(row['order_id']),
                        "customer_id": str(row['customer_id']),
                        "status": row['status'],
                        "total_amount": float(row['total_amount']),
                        "currency": row['currency'],
                        "item_count": row['item_count'],
                        "payment_status": row['payment_status'],
                        "created_at": row['created_at'].isoformat(),
                        "updated_at": row['updated_at'].isoformat(),
                    }
                    orders.append(order_summary)
                
                # Get total count for pagination
                count_query = "SELECT COUNT(*) FROM orders WHERE customer_id = $1"
                total_count = await conn.fetchval(count_query, customer_id)
                
                return {
                    "orders": orders,
                    "total_count": total_count,
                    "page_info": {
                        "limit": limit,
                        "offset": offset,
                        "has_more": (offset + limit) < total_count
                    }
                }
                
        except Exception as e:
            logger.error(
                "Failed to get customer orders",
                customer_id=customer_id,
                error=str(e)
            )
            # Return empty result on error
            return {
                "orders": [],
                "total_count": 0,
                "page_info": {"limit": limit, "offset": offset, "has_more": False}
            }
        return []
    
    async def _publish_order_created_event(
        self,
        order: OrderAggregate,
        order_items: List[Dict[str, Any]],
        shipping_address: Dict[str, Any]
    ) -> None:
        """
        Publish order.created event to Kafka.
        
        Args:
            order: The order aggregate
            order_items: List of order items
            shipping_address: Shipping address details
        """
        try:
            kafka_producer = await self._get_kafka_producer()
            if not kafka_producer:
                return
            
            # Create order created event
            event = OrderCreatedEvent(
                order_id=order.aggregate_id,
                customer_id=order.customer_id,
                items=order_items,
                total_amount=order.total_amount,
                currency=order.currency,
                shipping_address=shipping_address,
                billing_address=shipping_address,  # Assuming same for simplicity
                payment_method=order.payment_method.value if order.payment_method else "",
                created_by=order.customer_id
            )
            
            # Set aggregate information for the event
            event.aggregate_id = order.aggregate_id
            event.aggregate_type = "order"
            
            # Publish to Kafka
            success = await kafka_producer.publish_event(event)
            
            if success:
                logger.info(
                    "Order created event published successfully",
                    order_id=order.aggregate_id,
                    customer_id=order.customer_id,
                    event_id=event.event_id
                )
            else:
                logger.error(
                    "Failed to publish order created event",
                    order_id=order.aggregate_id,
                    customer_id=order.customer_id
                )
                
        except Exception as e:
            logger.error(
                "Error publishing order created event",
                order_id=order.aggregate_id,
                customer_id=order.customer_id,
                error=str(e)
            )
    
    async def _publish_order_cancelled_event(
        self,
        order: OrderAggregate,
        reason: str,
        cancelled_by: str
    ) -> None:
        """
        Publish order.cancelled event to Kafka.
        
        Args:
            order: The order aggregate
            reason: Cancellation reason
            cancelled_by: Who cancelled the order
        """
        try:
            kafka_producer = await self._get_kafka_producer()
            if not kafka_producer:
                return
            
            # Prepare inventory items to release
            inventory_to_release = [
                {
                    "product_id": item.product_id,
                    "quantity": item.quantity
                }
                for item in order.items
            ]
            
            # Create order cancelled event
            event = OrderCancelledEvent(
                order_id=order.aggregate_id,
                customer_id=order.customer_id,
                previous_status=order.status.value,
                cancellation_reason=reason,
                cancelled_by=cancelled_by,
                cancelled_at=order.cancelled_at or order.updated_at,
                refund_amount=order.total_amount,
                inventory_to_release=inventory_to_release
            )
            
            # Set aggregate information for the event
            event.aggregate_id = order.aggregate_id
            event.aggregate_type = "order"
            
            # Publish to Kafka
            success = await kafka_producer.publish_event(event)
            
            if success:
                logger.info(
                    "Order cancelled event published successfully",
                    order_id=order.aggregate_id,
                    customer_id=order.customer_id,
                    event_id=event.event_id
                )
            else:
                logger.error(
                    "Failed to publish order cancelled event",
                    order_id=order.aggregate_id,
                    customer_id=order.customer_id
                )
                
        except Exception as e:
            logger.error(
                "Error publishing order cancelled event",
                order_id=order.aggregate_id,
                customer_id=order.customer_id,
                error=str(e)
            )
