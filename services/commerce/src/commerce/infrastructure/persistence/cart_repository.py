"""
Redis-based shopping cart repository.

Provides persistence for shopping carts with TTL and atomic operations.
"""

import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import structlog
from redis.asyncio import Redis

from ..redis import get_redis_client
from ...domain.entities.cart import ShoppingCart, CartStatus
from ...config.settings import get_settings

logger = structlog.get_logger(__name__)


class CartRepository:
    """
    Redis-based repository for shopping cart persistence.
    
    Provides CRUD operations for shopping carts with automatic expiration
    and efficient storage using Redis hashes and JSON serialization.
    """
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis = redis_client or get_redis_client()
        self.settings = get_settings()
        
        # Redis key prefixes
        self.cart_key_prefix = "cart:"
        self.customer_carts_key_prefix = "customer_carts:"
        self.abandoned_carts_key = "abandoned_carts"
        
        # TTL settings
        self.cart_ttl_seconds = self.settings.cart_ttl_hours * 3600
    
    def _get_cart_key(self, cart_id: str) -> str:
        """Get Redis key for a cart."""
        return f"{self.cart_key_prefix}{cart_id}"
    
    def _get_customer_carts_key(self, customer_id: str) -> str:
        """Get Redis key for customer's cart list."""
        return f"{self.customer_carts_key_prefix}{customer_id}"
    
    async def save(self, cart: ShoppingCart) -> None:
        """
        Save a shopping cart to Redis with TTL.
        
        Args:
            cart: The shopping cart to save
        """
        cart_key = self._get_cart_key(cart.cart_id)
        customer_carts_key = self._get_customer_carts_key(cart.customer_id)
        
        # Update cart timestamp
        cart.updated_at = datetime.now(timezone.utc)
        
        # Set expiration if not already set
        if not cart.expires_at:
            cart.expires_at = datetime.now(timezone.utc) + timedelta(hours=self.settings.cart_ttl_hours)
        
        # Serialize cart data
        cart_data = cart.to_dict()
        
        # Use pipeline for atomic operations
        async with self.redis.pipeline() as pipe:
            # Save cart data as JSON
            await pipe.set(cart_key, json.dumps(cart_data), ex=self.cart_ttl_seconds)
            
            # Add cart ID to customer's cart list
            await pipe.sadd(customer_carts_key, cart.cart_id)
            await pipe.expire(customer_carts_key, self.cart_ttl_seconds)
            
            # If cart is abandoned, add to abandoned carts set for analytics
            if cart.status == CartStatus.ABANDONED:
                await pipe.zadd(
                    self.abandoned_carts_key,
                    {cart.cart_id: cart.updated_at.timestamp()}
                )
            
            await pipe.execute()
        
        logger.debug(
            "Cart saved",
            cart_id=cart.cart_id,
            customer_id=cart.customer_id,
            item_count=cart.get_item_count(),
            total_amount=str(cart.total_amount),
        )
    
    async def get(self, cart_id: str) -> Optional[ShoppingCart]:
        """
        Get a shopping cart by ID.
        
        Args:
            cart_id: The cart identifier
            
        Returns:
            The shopping cart or None if not found
        """
        cart_key = self._get_cart_key(cart_id)
        
        cart_data_json = await self.redis.get(cart_key)
        if not cart_data_json:
            return None
        
        try:
            cart_data = json.loads(cart_data_json)
            cart = ShoppingCart.from_dict(cart_data)
            
            # Check if cart has expired
            if cart.is_expired():
                await self.delete(cart_id)
                return None
            
            return cart
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(
                "Failed to deserialize cart",
                cart_id=cart_id,
                error=str(e),
            )
            return None
    
    async def delete(self, cart_id: str) -> bool:
        """
        Delete a shopping cart.
        
        Args:
            cart_id: The cart identifier
            
        Returns:
            True if cart was deleted, False if not found
        """
        # First get the cart to find customer_id
        cart = await self.get(cart_id)
        if not cart:
            return False
        
        cart_key = self._get_cart_key(cart_id)
        customer_carts_key = self._get_customer_carts_key(cart.customer_id)
        
        # Use pipeline for atomic operations
        async with self.redis.pipeline() as pipe:
            # Delete cart data
            await pipe.delete(cart_key)
            
            # Remove cart ID from customer's cart list
            await pipe.srem(customer_carts_key, cart_id)
            
            # Remove from abandoned carts if present
            await pipe.zrem(self.abandoned_carts_key, cart_id)
            
            result = await pipe.execute()
        
        deleted = result[0] > 0  # First command (delete) returns count
        
        if deleted:
            logger.debug("Cart deleted", cart_id=cart_id, customer_id=cart.customer_id)
        
        return deleted
    
    async def get_customer_carts(self, customer_id: str) -> List[ShoppingCart]:
        """
        Get all carts for a customer.
        
        Args:
            customer_id: The customer identifier
            
        Returns:
            List of shopping carts for the customer
        """
        customer_carts_key = self._get_customer_carts_key(customer_id)
        
        # Get cart IDs for customer
        cart_ids = await self.redis.smembers(customer_carts_key)
        
        if not cart_ids:
            return []
        
        # Get all carts
        carts = []
        for cart_id in cart_ids:
            cart = await self.get(cart_id)
            if cart:
                carts.append(cart)
        
        # Sort by updated_at descending
        carts.sort(key=lambda c: c.updated_at, reverse=True)
        
        return carts
    
    async def get_active_cart(self, customer_id: str) -> Optional[ShoppingCart]:
        """
        Get the active cart for a customer.
        
        Args:
            customer_id: The customer identifier
            
        Returns:
            The active cart or None if not found
        """
        carts = await self.get_customer_carts(customer_id)
        
        # Return the most recently updated active cart
        for cart in carts:
            if cart.status == CartStatus.ACTIVE and not cart.is_empty():
                return cart
        
        return None
    
    async def create_cart(self, customer_id: str, **kwargs) -> ShoppingCart:
        """
        Create a new shopping cart for a customer.
        
        Args:
            customer_id: The customer identifier
            **kwargs: Additional cart metadata
            
        Returns:
            The created shopping cart
        """
        cart = ShoppingCart(
            customer_id=customer_id,
            **kwargs
        )
        
        await self.save(cart)
        
        logger.info(
            "Cart created",
            cart_id=cart.cart_id,
            customer_id=customer_id,
        )
        
        return cart
    
    async def mark_as_abandoned(self, cart_id: str) -> bool:
        """
        Mark a cart as abandoned.
        
        Args:
            cart_id: The cart identifier
            
        Returns:
            True if cart was marked as abandoned, False if not found
        """
        cart = await self.get(cart_id)
        if not cart:
            return False
        
        cart.mark_as_abandoned()
        await self.save(cart)
        
        logger.info("Cart marked as abandoned", cart_id=cart_id)
        return True
    
    async def convert_to_order(self, cart_id: str, order_id: str) -> bool:
        """
        Mark a cart as converted to an order.
        
        Args:
            cart_id: The cart identifier
            order_id: The order identifier
            
        Returns:
            True if cart was converted, False if not found
        """
        cart = await self.get(cart_id)
        if not cart:
            return False
        
        cart.mark_as_converted(order_id)
        await self.save(cart)
        
        logger.info(
            "Cart converted to order",
            cart_id=cart_id,
            order_id=order_id,
        )
        return True
    
    async def cleanup_expired_carts(self) -> int:
        """
        Clean up expired carts from Redis.
        
        Returns:
            Number of carts cleaned up
        """
        # This would typically be run as a background job
        # For now, we'll implement a simple cleanup
        
        # Get all cart keys
        cart_keys = await self.redis.keys(f"{self.cart_key_prefix}*")
        
        cleaned_count = 0
        
        for cart_key in cart_keys:
            cart_id = cart_key.replace(self.cart_key_prefix, "")
            cart = await self.get(cart_id)  # This will auto-delete if expired
            if not cart:
                cleaned_count += 1
        
        if cleaned_count > 0:
            logger.info("Cleaned up expired carts", count=cleaned_count)
        
        return cleaned_count
    
    async def get_abandoned_carts(
        self,
        hours_ago: int = 24,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get abandoned carts for analytics.
        
        Args:
            hours_ago: How many hours ago to look for abandoned carts
            limit: Maximum number of carts to return
            
        Returns:
            List of abandoned cart summaries
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        
        # Get abandoned cart IDs from sorted set
        cart_ids = await self.redis.zrangebyscore(
            self.abandoned_carts_key,
            cutoff_time.timestamp(),
            "+inf",
            start=0,
            num=limit
        )
        
        abandoned_carts = []
        for cart_id in cart_ids:
            cart = await self.get(cart_id)
            if cart and cart.status == CartStatus.ABANDONED:
                abandoned_carts.append(cart.get_summary())
        
        return abandoned_carts
    
    async def get_cart_analytics(self) -> Dict[str, Any]:
        """
        Get cart analytics data.
        
        Returns:
            Dictionary with cart analytics
        """
        # This is a simplified implementation
        # In production, you'd want more sophisticated analytics
        
        total_carts = await self.redis.dbsize()  # Rough estimate
        abandoned_count = await self.redis.zcard(self.abandoned_carts_key)
        
        return {
            "total_carts": total_carts,
            "abandoned_carts": abandoned_count,
            "abandonment_rate": abandoned_count / max(total_carts, 1),
        }

