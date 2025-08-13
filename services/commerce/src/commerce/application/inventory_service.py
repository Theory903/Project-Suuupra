"""
Inventory application service for the Commerce Service.

This module provides high-level inventory operations including stock management,
reservations, adjustments, and monitoring.
"""

import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from uuid import UUID, uuid4

import structlog

from ..domain.aggregates.inventory import InventoryAggregate
from ..domain.entities.inventory import InventoryStatus
from ..infrastructure.persistence.inventory_repository import InventoryRepository
from ..infrastructure.messaging.event_bus import EventBus


logger = structlog.get_logger(__name__)


class InventoryConflictError(Exception):
    """Raised when there's a conflict in inventory operations."""
    pass


class InsufficientStockError(Exception):
    """Raised when there's insufficient stock for an operation."""
    pass


class OptimisticLockingError(Exception):
    """Raised when optimistic locking fails."""
    pass


class InventoryService:
    """
    Application service for inventory management.
    
    This service orchestrates inventory operations, handles business rules,
    and ensures data consistency across inventory operations.
    """
    
    def __init__(
        self,
        inventory_repository: InventoryRepository,
        event_bus: EventBus
    ):
        self.inventory_repository = inventory_repository
        self.event_bus = event_bus
        self.logger = logger.bind(service="inventory_service")
    
    async def create_inventory_item(
        self,
        product_id: str,
        sku: str,
        total_quantity: int,
        unit_price: Decimal,
        variant_id: Optional[str] = None,
        cost_price: Optional[Decimal] = None,
        low_stock_threshold: int = 10,
        reorder_point: int = 5,
        reorder_quantity: int = 100,
        created_by: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> UUID:
        """
        Create a new inventory item.
        
        Args:
            product_id: External product identifier
            sku: Stock Keeping Unit (must be unique)
            total_quantity: Initial total quantity
            unit_price: Unit price
            variant_id: Product variant identifier
            cost_price: Cost price
            low_stock_threshold: Low stock alert threshold
            reorder_point: Automatic reorder point
            reorder_quantity: Reorder quantity
            created_by: User creating the item
            metadata: Additional metadata
            
        Returns:
            Inventory ID of the created item
            
        Raises:
            ValueError: If SKU already exists or invalid parameters
        """
        self.logger.info(
            "Creating inventory item",
            product_id=product_id,
            sku=sku,
            total_quantity=total_quantity,
            created_by=created_by
        )
        
        # Check if SKU already exists
        existing = await self.inventory_repository.get_by_sku(sku)
        if existing:
            raise ValueError(f"SKU '{sku}' already exists")
        
        # Validate parameters
        if total_quantity < 0:
            raise ValueError("Total quantity cannot be negative")
        if unit_price <= 0:
            raise ValueError("Unit price must be positive")
        if cost_price is not None and cost_price < 0:
            raise ValueError("Cost price cannot be negative")
        
        # Create new aggregate
        inventory_id = uuid4()
        aggregate = InventoryAggregate(str(inventory_id))
        
        success = aggregate.create_inventory_item(
            product_id=product_id,
            sku=sku,
            total_quantity=total_quantity,
            unit_price=unit_price,
            variant_id=variant_id,
            cost_price=cost_price,
            low_stock_threshold=low_stock_threshold,
            reorder_point=reorder_point,
            reorder_quantity=reorder_quantity,
            created_by=created_by.get("sub") if isinstance(created_by, dict) else created_by,
            metadata=metadata
        )
        
        if not success:
            raise ValueError("Failed to create inventory item")
        
        # Save the aggregate
        await self.inventory_repository.save(aggregate)
        
        # Publish events
        await self._publish_events(aggregate)
        
        self.logger.info(
            "Inventory item created successfully",
            inventory_id=str(inventory_id),
            product_id=product_id,
            sku=sku
        )
        
        return inventory_id
    
    async def update_inventory_item(
        self,
        inventory_id: UUID,
        unit_price: Optional[Decimal] = None,
        cost_price: Optional[Decimal] = None,
        low_stock_threshold: Optional[int] = None,
        reorder_point: Optional[int] = None,
        reorder_quantity: Optional[int] = None,
        status: Optional[InventoryStatus] = None,
        updated_by: Optional[str] = None,
        expected_version: Optional[int] = None
    ) -> bool:
        """
        Update inventory item properties.
        
        Args:
            inventory_id: Inventory ID
            unit_price: New unit price
            cost_price: New cost price
            low_stock_threshold: New low stock threshold
            reorder_point: New reorder point
            reorder_quantity: New reorder quantity
            status: New status
            updated_by: User making the update
            expected_version: Expected version for optimistic locking
            
        Returns:
            True if update successful
            
        Raises:
            ValueError: If inventory not found or invalid parameters
            OptimisticLockingError: If version conflict occurs
        """
        self.logger.info(
            "Updating inventory item",
            inventory_id=str(inventory_id),
            updated_by=updated_by,
            expected_version=expected_version
        )
        
        aggregate = await self.inventory_repository.get_by_id(inventory_id)
        if not aggregate:
            raise ValueError(f"Inventory item {inventory_id} not found")
        
        # Validate parameters
        if unit_price is not None and unit_price <= 0:
            raise ValueError("Unit price must be positive")
        if cost_price is not None and cost_price < 0:
            raise ValueError("Cost price cannot be negative")
        
        success = aggregate.update_inventory_item(
            unit_price=unit_price,
            cost_price=cost_price,
            low_stock_threshold=low_stock_threshold,
            reorder_point=reorder_point,
            reorder_quantity=reorder_quantity,
            status=status,
            updated_by=updated_by,
            expected_version=expected_version
        )
        
        if not success:
            if expected_version is not None:
                raise OptimisticLockingError("Version conflict occurred")
            raise ValueError("Failed to update inventory item")
        
        # Save the aggregate
        await self.inventory_repository.save(aggregate)
        
        # Publish events
        await self._publish_events(aggregate)
        
        self.logger.info(
            "Inventory item updated successfully",
            inventory_id=str(inventory_id)
        )
        
        return True
    
    async def reserve_stock(
        self,
        product_id: str,
        variant_id: Optional[str],
        order_id: UUID,
        customer_id: str,
        quantity: int,
        reservation_duration_minutes: int = 30,
        reserved_by: Optional[str] = None
    ) -> UUID:
        """
        Reserve stock for an order.
        
        Args:
            product_id: External product identifier
            variant_id: Product variant identifier
            order_id: Associated order ID
            customer_id: Customer ID
            quantity: Quantity to reserve
            reservation_duration_minutes: How long to hold the reservation
            reserved_by: User making the reservation
            
        Returns:
            Reservation ID
            
        Raises:
            ValueError: If product not found
            InsufficientStockError: If insufficient stock available
        """
        self.logger.info(
            "Reserving stock",
            product_id=product_id,
            variant_id=variant_id,
            order_id=str(order_id),
            quantity=quantity,
            reserved_by=reserved_by
        )
        
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        # Find inventory item
        aggregate = await self.inventory_repository.get_by_product_id(product_id, variant_id)
        if not aggregate:
            raise ValueError(f"Product {product_id} (variant: {variant_id}) not found in inventory")
        
        # Attempt reservation with retry logic for optimistic locking
        max_retries = 3
        for attempt in range(max_retries):
            try:
                reservation_id = aggregate.reserve_stock(
                    order_id=order_id,
                    customer_id=customer_id,
                    quantity=quantity,
                    reservation_duration_minutes=reservation_duration_minutes,
                    reserved_by=reserved_by
                )
                
                if not reservation_id:
                    raise InsufficientStockError(
                        f"Insufficient stock for product {product_id}. "
                        f"Requested: {quantity}, Available: {aggregate.inventory_item.available_quantity}"
                    )
                
                # Save the aggregate
                await self.inventory_repository.save(aggregate)
                
                # Publish events
                await self._publish_events(aggregate)
                
                self.logger.info(
                    "Stock reserved successfully",
                    reservation_id=str(reservation_id),
                    product_id=product_id,
                    quantity=quantity
                )
                
                return reservation_id
                
            except OptimisticLockingError:
                if attempt == max_retries - 1:
                    raise
                
                # Reload aggregate and retry
                aggregate = await self.inventory_repository.get_by_product_id(product_id, variant_id)
                if not aggregate:
                    raise ValueError(f"Product {product_id} not found")
                
                await asyncio.sleep(0.1 * (attempt + 1))  # Exponential backoff
        
        raise InventoryConflictError("Failed to reserve stock after multiple attempts")
    
    async def reserve_stock_by_sku(
        self,
        sku: str,
        order_id: UUID,
        customer_id: str,
        quantity: int,
        reservation_duration_minutes: int = 30,
        reserved_by: Optional[str] = None
    ) -> UUID:
        """
        Reserve stock for an order using SKU.
        
        Args:
            sku: Stock Keeping Unit
            order_id: Associated order ID
            customer_id: Customer ID
            quantity: Quantity to reserve
            reservation_duration_minutes: How long to hold the reservation
            reserved_by: User making the reservation
            
        Returns:
            Reservation ID
            
        Raises:
            ValueError: If SKU not found
            InsufficientStockError: If insufficient stock available
        """
        aggregate = await self.inventory_repository.get_by_sku(sku)
        if not aggregate:
            raise ValueError(f"SKU {sku} not found in inventory")
        
        return await self.reserve_stock(
            product_id=aggregate.inventory_item.product_id,
            variant_id=aggregate.inventory_item.variant_id,
            order_id=order_id,
            customer_id=customer_id,
            quantity=quantity,
            reservation_duration_minutes=reservation_duration_minutes,
            reserved_by=reserved_by
        )
    
    async def confirm_reservation(
        self,
        inventory_id: UUID,
        reservation_id: UUID,
        confirmed_by: Optional[str] = None
    ) -> bool:
        """
        Confirm a stock reservation.
        
        Args:
            inventory_id: Inventory ID
            reservation_id: Reservation to confirm
            confirmed_by: User confirming the reservation
            
        Returns:
            True if confirmation successful
            
        Raises:
            ValueError: If inventory or reservation not found
        """
        self.logger.info(
            "Confirming stock reservation",
            inventory_id=str(inventory_id),
            reservation_id=str(reservation_id),
            confirmed_by=confirmed_by
        )
        
        aggregate = await self.inventory_repository.get_by_id(inventory_id)
        if not aggregate:
            raise ValueError(f"Inventory {inventory_id} not found")
        
        success = aggregate.confirm_reservation(reservation_id, confirmed_by)
        if not success:
            raise ValueError(f"Failed to confirm reservation {reservation_id}")
        
        # Save the aggregate
        await self.inventory_repository.save(aggregate)
        
        # Publish events
        await self._publish_events(aggregate)
        
        self.logger.info(
            "Stock reservation confirmed successfully",
            reservation_id=str(reservation_id)
        )
        
        return True
    
    async def cancel_reservation(
        self,
        inventory_id: UUID,
        reservation_id: UUID,
        reason: str = "Cancelled by user",
        cancelled_by: Optional[str] = None
    ) -> bool:
        """
        Cancel a stock reservation.
        
        Args:
            inventory_id: Inventory ID
            reservation_id: Reservation to cancel
            reason: Cancellation reason
            cancelled_by: User cancelling the reservation
            
        Returns:
            True if cancellation successful
            
        Raises:
            ValueError: If inventory or reservation not found
        """
        self.logger.info(
            "Cancelling stock reservation",
            inventory_id=str(inventory_id),
            reservation_id=str(reservation_id),
            reason=reason,
            cancelled_by=cancelled_by
        )
        
        aggregate = await self.inventory_repository.get_by_id(inventory_id)
        if not aggregate:
            raise ValueError(f"Inventory {inventory_id} not found")
        
        success = aggregate.cancel_reservation(reservation_id, reason, cancelled_by)
        if not success:
            raise ValueError(f"Failed to cancel reservation {reservation_id}")
        
        # Save the aggregate
        await self.inventory_repository.save(aggregate)
        
        # Publish events
        await self._publish_events(aggregate)
        
        self.logger.info(
            "Stock reservation cancelled successfully",
            reservation_id=str(reservation_id)
        )
        
        return True
    
    async def fulfill_reservation(
        self,
        inventory_id: UUID,
        reservation_id: UUID,
        fulfilled_by: Optional[str] = None
    ) -> bool:
        """
        Fulfill a reservation (ship the order).
        
        Args:
            inventory_id: Inventory ID
            reservation_id: Reservation to fulfill
            fulfilled_by: User fulfilling the reservation
            
        Returns:
            True if fulfillment successful
            
        Raises:
            ValueError: If inventory or reservation not found
        """
        self.logger.info(
            "Fulfilling stock reservation",
            inventory_id=str(inventory_id),
            reservation_id=str(reservation_id),
            fulfilled_by=fulfilled_by
        )
        
        aggregate = await self.inventory_repository.get_by_id(inventory_id)
        if not aggregate:
            raise ValueError(f"Inventory {inventory_id} not found")
        
        success = aggregate.fulfill_reservation(reservation_id, fulfilled_by)
        if not success:
            raise ValueError(f"Failed to fulfill reservation {reservation_id}")
        
        # Save the aggregate
        await self.inventory_repository.save(aggregate)
        
        # Publish events
        await self._publish_events(aggregate)
        
        self.logger.info(
            "Stock reservation fulfilled successfully",
            reservation_id=str(reservation_id)
        )
        
        return True
    
    async def adjust_stock(
        self,
        inventory_id: UUID,
        quantity_change: int,
        adjustment_type: str,
        reason: str,
        reference_id: Optional[str] = None,
        adjusted_by: Optional[str] = None
    ) -> bool:
        """
        Manually adjust stock levels.
        
        Args:
            inventory_id: Inventory ID
            quantity_change: Change in quantity (+ for increase, - for decrease)
            adjustment_type: Type of adjustment (e.g., 'restock', 'damage', 'correction')
            reason: Reason for adjustment
            reference_id: Reference to related entity
            adjusted_by: User making the adjustment
            
        Returns:
            True if adjustment successful
            
        Raises:
            ValueError: If inventory not found or invalid adjustment
        """
        self.logger.info(
            "Adjusting stock levels",
            inventory_id=str(inventory_id),
            quantity_change=quantity_change,
            adjustment_type=adjustment_type,
            reason=reason,
            adjusted_by=adjusted_by
        )
        
        aggregate = await self.inventory_repository.get_by_id(inventory_id)
        if not aggregate:
            raise ValueError(f"Inventory {inventory_id} not found")
        
        success = aggregate.adjust_stock(
            quantity_change=quantity_change,
            adjustment_type=adjustment_type,
            reason=reason,
            reference_id=reference_id,
            adjusted_by=adjusted_by
        )
        
        if not success:
            raise ValueError(f"Failed to adjust stock: {reason}")
        
        # Save the aggregate
        await self.inventory_repository.save(aggregate)
        
        # Publish events
        await self._publish_events(aggregate)
        
        self.logger.info(
            "Stock levels adjusted successfully",
            inventory_id=str(inventory_id),
            quantity_change=quantity_change
        )
        
        return True
    
    async def record_physical_count(
        self,
        inventory_id: UUID,
        physical_quantity: int,
        counted_by: str,
        notes: Optional[str] = None,
        auto_adjust: bool = True
    ) -> bool:
        """
        Record a physical inventory count.
        
        Args:
            inventory_id: Inventory ID
            physical_quantity: Physical count quantity
            counted_by: User who performed the count
            notes: Additional notes
            auto_adjust: Whether to automatically adjust inventory
            
        Returns:
            True if count recorded successfully
            
        Raises:
            ValueError: If inventory not found
        """
        self.logger.info(
            "Recording physical inventory count",
            inventory_id=str(inventory_id),
            physical_quantity=physical_quantity,
            counted_by=counted_by,
            auto_adjust=auto_adjust
        )
        
        aggregate = await self.inventory_repository.get_by_id(inventory_id)
        if not aggregate:
            raise ValueError(f"Inventory {inventory_id} not found")
        
        success = aggregate.record_physical_count(
            physical_quantity=physical_quantity,
            counted_by=counted_by,
            notes=notes,
            auto_adjust=auto_adjust
        )
        
        if not success:
            raise ValueError("Failed to record physical count")
        
        # Save the aggregate
        await self.inventory_repository.save(aggregate)
        
        # Publish events
        await self._publish_events(aggregate)
        
        self.logger.info(
            "Physical inventory count recorded successfully",
            inventory_id=str(inventory_id),
            physical_quantity=physical_quantity
        )
        
        return True
    
    async def expire_reservations_batch(self, limit: int = 1000) -> int:
        """
        Expire reservations that have passed their expiration time.
        
        Args:
            limit: Maximum number of reservations to process
            
        Returns:
            Number of reservations expired
        """
        self.logger.info("Starting reservation expiration batch job", limit=limit)
        
        # Find expired reservations
        expired_reservations = await self.inventory_repository.find_expired_reservations(limit)
        
        expired_count = 0
        for reservation_data in expired_reservations:
            try:
                inventory_id = UUID(reservation_data["inventory_id"])
                aggregate = await self.inventory_repository.get_by_id(inventory_id)
                
                if aggregate:
                    expired_ids = aggregate.expire_reservations()
                    if expired_ids:
                        await self.inventory_repository.save(aggregate)
                        await self._publish_events(aggregate)
                        expired_count += len(expired_ids)
                        
            except Exception as e:
                self.logger.error(
                    "Failed to expire reservation",
                    reservation_id=reservation_data["reservation_id"],
                    error=str(e)
                )
        
        self.logger.info(
            "Reservation expiration batch job completed",
            expired_count=expired_count
        )
        
        return expired_count
    
    async def get_low_stock_items(self, limit: int = 100) -> List[Dict]:
        """
        Get inventory items with low stock.
        
        Args:
            limit: Maximum number of items to return
            
        Returns:
            List of low stock items
        """
        return await self.inventory_repository.find_low_stock_items(limit)
    
    async def get_items_needing_reorder(self, limit: int = 100) -> List[Dict]:
        """
        Get inventory items that need reordering.
        
        Args:
            limit: Maximum number of items to return
            
        Returns:
            List of items needing reorder
        """
        return await self.inventory_repository.find_items_needing_reorder(limit)
    
    async def get_inventory_summary(self) -> Dict:
        """
        Get inventory summary statistics.
        
        Returns:
            Dictionary with inventory statistics
        """
        return await self.inventory_repository.get_inventory_summary()
    
    async def get_inventory_item(self, inventory_id: UUID) -> Optional[Dict]:
        """
        Get inventory item details.
        
        Args:
            inventory_id: Inventory ID
            
        Returns:
            Dictionary with inventory details or None if not found
        """
        aggregate = await self.inventory_repository.get_by_id(inventory_id)
        if not aggregate or not aggregate.inventory_item:
            return None
        
        item = aggregate.inventory_item
        return {
            "inventory_id": str(item.id),
            "product_id": item.product_id,
            "variant_id": item.variant_id,
            "sku": item.sku,
            "total_quantity": item.total_quantity,
            "reserved_quantity": item.reserved_quantity,
            "available_quantity": item.available_quantity,
            "unit_price": str(item.unit_price),
            "cost_price": str(item.cost_price) if item.cost_price else None,
            "status": item.status.value,
            "low_stock_threshold": item.low_stock_threshold,
            "reorder_point": item.reorder_point,
            "reorder_quantity": item.reorder_quantity,
            "version": item.version,
            "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat(),
            "created_by": item.created_by,
            "updated_by": item.updated_by,
            "metadata": item.metadata,
            "is_low_stock": item.is_low_stock(),
            "needs_reorder": item.needs_reorder(),
            "active_reservations": len([
                r for r in aggregate.reservations.values()
                if r.status.value in ["pending", "confirmed"]
            ])
        }
    
    async def get_inventory_item_by_sku(self, sku: str) -> Optional[Dict]:
        """
        Get inventory item details by SKU.
        
        Args:
            sku: Stock Keeping Unit
            
        Returns:
            Dictionary with inventory details or None if not found
        """
        aggregate = await self.inventory_repository.get_by_sku(sku)
        if not aggregate:
            return None
        
        return await self.get_inventory_item(aggregate.id)
    
    async def _publish_events(self, aggregate: InventoryAggregate) -> None:
        """Publish domain events from the aggregate."""
        events = aggregate.uncommitted_events
        for event in events:
            try:
                await self.event_bus.publish(event)
            except Exception as e:
                self.logger.error(
                    "Failed to publish event",
                    event_type=type(event).__name__,
                    aggregate_id=str(aggregate.aggregate_id),
                    error=str(e)
                )
        # Mark events as committed after publishing
        aggregate.mark_events_as_committed()
