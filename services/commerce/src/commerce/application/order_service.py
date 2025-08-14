"""
Order Service - Handles order creation and management.

Coordinates cart-to-order conversion, aggregate persistence,
and saga orchestration for order fulfillment.
"""

from typing import Dict, Any, Optional, List
from decimal import Decimal
import structlog

from ..domain.aggregates.order import OrderAggregate
from ..domain.entities.cart import ShoppingCart
from ..domain.entities.order import PaymentMethod, ShippingAddress
from ..infrastructure.persistence.event_store import AggregateRepository
from ..infrastructure.persistence.cart_repository import CartRepository
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
        
        # 4. Mark cart as converted
        await self.cart_repo.convert_to_order(cart_id, order.aggregate_id)
        
        # 5. Start order fulfillment saga
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
        # TODO: Implement with read models for better performance
        # For now, this is a placeholder that would need a proper query implementation
        
        logger.info(
            "Getting customer orders",
            customer_id=customer_id,
            limit=limit,
            offset=offset,
        )
        
        # This would typically query a read model/projection
        # For now, return empty list
        return []
