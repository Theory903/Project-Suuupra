"""
Inventory aggregate for the Commerce Service.

This module defines the inventory aggregate root that manages inventory items,
stock reservations, and all inventory-related business operations.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from ..entities.inventory import (
    InventoryItem,
    InventoryStatus,
    StockReservation,
    ReservationStatus,
    InventoryAdjustment
)
from ..events.inventory_events import (
    InventoryItemCreatedEvent,
    InventoryItemUpdatedEvent,
    StockReservedEvent,
    StockReservationConfirmedEvent,
    StockReservationCancelledEvent,
    StockReservationExpiredEvent,
    StockFulfilledEvent,
    InventoryAdjustedEvent,
    LowStockAlertEvent,
    ReorderRequiredEvent,
    InventoryStatusChangedEvent,
    InventoryCountDiscrepancyEvent,
    StockMovementEvent,
    InventoryValuationChangedEvent,
    InventoryReservationConflictEvent
)
from .base import AggregateRoot


class InventoryAggregate(AggregateRoot):
    """
    Inventory aggregate root managing inventory items and reservations.
    
    This aggregate ensures consistency for all inventory operations including
    stock reservations, fulfillment, adjustments, and status changes.
    """
    
    def __init__(self, inventory_id: UUID):
        super().__init__(inventory_id)
        
        # Core inventory item
        self.inventory_item: Optional[InventoryItem] = None
        
        # Active reservations
        self.reservations: Dict[UUID, StockReservation] = {}
        
        # Adjustment history (for this session)
        self.adjustments: List[InventoryAdjustment] = []
        
        # State tracking
        self.is_deleted = False
    
    def create_inventory_item(
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
    ) -> bool:
        """
        Create a new inventory item.
        
        Args:
            product_id: External product identifier
            sku: Stock Keeping Unit
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
            True if creation successful
        """
        if self.inventory_item is not None:
            return False  # Already exists
        
        # Create the inventory item
        self.inventory_item = InventoryItem(
            id=UUID(self.aggregate_id),
            product_id=product_id,
            variant_id=variant_id,
            sku=sku,
            total_quantity=total_quantity,
            unit_price=unit_price,
            cost_price=cost_price,
            low_stock_threshold=low_stock_threshold,
            reorder_point=reorder_point,
            reorder_quantity=reorder_quantity,
            created_by=created_by,
            metadata=metadata or {}
        )
        
        # Raise domain event
        event = InventoryItemCreatedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="inventory",
            aggregate_version=self.version + 1,
            product_id=product_id,
            variant_id=variant_id,
            sku=sku,
            total_quantity=total_quantity,
            unit_price=unit_price,
            cost_price=cost_price,
            low_stock_threshold=low_stock_threshold,
            reorder_point=reorder_point,
            reorder_quantity=reorder_quantity,
            created_by=created_by
        )
        # Apply the event directly since it's already properly constructed
        self._apply_event(event, is_new=True)
        self._version += 1
        
        # Check if we need to raise alerts
        self._check_stock_levels()
        
        return True
    
    def update_inventory_item(
        self,
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
        """
        if not self.inventory_item:
            return False
        
        # Check optimistic locking
        if expected_version is not None and self.inventory_item.version != expected_version:
            return False
        
        changes = {}
        previous_version = self.inventory_item.version
        
        # Track price changes for valuation events
        price_changed = False
        previous_unit_price = self.inventory_item.unit_price
        previous_cost_price = self.inventory_item.cost_price
        
        # Apply updates
        if unit_price is not None and unit_price != self.inventory_item.unit_price:
            changes['unit_price'] = f"{self.inventory_item.unit_price} -> {unit_price}"
            self.inventory_item.unit_price = unit_price
            price_changed = True
        
        if cost_price is not None and cost_price != self.inventory_item.cost_price:
            changes['cost_price'] = f"{self.inventory_item.cost_price} -> {cost_price}"
            self.inventory_item.cost_price = cost_price
            price_changed = True
        
        if low_stock_threshold is not None:
            changes['low_stock_threshold'] = f"{self.inventory_item.low_stock_threshold} -> {low_stock_threshold}"
            self.inventory_item.low_stock_threshold = low_stock_threshold
        
        if reorder_point is not None:
            changes['reorder_point'] = f"{self.inventory_item.reorder_point} -> {reorder_point}"
            self.inventory_item.reorder_point = reorder_point
        
        if reorder_quantity is not None:
            changes['reorder_quantity'] = f"{self.inventory_item.reorder_quantity} -> {reorder_quantity}"
            self.inventory_item.reorder_quantity = reorder_quantity
        
        if status is not None and status != self.inventory_item.status:
            previous_status = self.inventory_item.status
            changes['status'] = f"{previous_status} -> {status}"
            self.inventory_item.status = status
            
            # Raise status change event
            status_event = InventoryStatusChangedEvent(
                aggregate_id=self.aggregate_id,
                aggregate_type="inventory",
                aggregate_version=self.version + 1,
                inventory_id=UUID(self.aggregate_id),
                product_id=self.inventory_item.product_id,
                previous_status=previous_status.value,
                new_status=status.value,
                reason="Manual update",
                changed_by=updated_by
            )
            self._apply_event(status_event, is_new=True)
            self._version += 1
        
        if changes:
            self.inventory_item.updated_at = datetime.utcnow()
            self.inventory_item.updated_by = updated_by
            self.inventory_item.version += 1
            
            # Raise update event
            event = InventoryItemUpdatedEvent(
                aggregate_id=self.aggregate_id,
                aggregate_type="inventory",
                aggregate_version=self.version + 1,
                product_id=self.inventory_item.product_id,
                changes=changes,
                previous_version=previous_version,
                new_version=self.inventory_item.version,
                updated_by=updated_by
            )
            self._apply_event(event, is_new=True)
            self._version += 1
            
            # Raise valuation change event if prices changed
            if price_changed:
                valuation_impact = (
                    (self.inventory_item.unit_price - previous_unit_price) * 
                    self.inventory_item.total_quantity
                )
                
                valuation_event = InventoryValuationChangedEvent(
                    aggregate_id=self.aggregate_id,
                    inventory_id=UUID(self.aggregate_id),
                    product_id=self.inventory_item.product_id,
                    previous_unit_price=previous_unit_price,
                    new_unit_price=self.inventory_item.unit_price,
                    previous_cost_price=previous_cost_price,
                    new_cost_price=self.inventory_item.cost_price,
                    quantity_on_hand=self.inventory_item.total_quantity,
                    valuation_impact=valuation_impact,
                    changed_by=updated_by,
                    reason="Manual price update"
                )
                self.apply_event(valuation_event)
            
            # Check stock levels after update
            self._check_stock_levels()
        
        return True
    
    def reserve_stock(
        self,
        order_id: UUID,
        customer_id: str,
        quantity: int,
        reservation_duration_minutes: int = 30,
        reserved_by: Optional[str] = None
    ) -> Optional[UUID]:
        """
        Reserve stock for an order.
        
        Args:
            order_id: Associated order ID
            customer_id: Customer ID
            quantity: Quantity to reserve
            reservation_duration_minutes: How long to hold the reservation
            reserved_by: User making the reservation
            
        Returns:
            Reservation ID if successful, None otherwise
        """
        if not self.inventory_item or not self.inventory_item.can_reserve(quantity):
            return None
        
        # Check for existing reservation conflicts
        total_requested = sum(
            res.quantity for res in self.reservations.values()
            if res.status in [ReservationStatus.PENDING, ReservationStatus.CONFIRMED]
        ) + quantity
        
        if total_requested > self.inventory_item.available_quantity:
            # Raise conflict event
            conflict_event = InventoryReservationConflictEvent(
                aggregate_id=self.aggregate_id,
                inventory_id=UUID(self.aggregate_id),
                conflicting_reservations=[str(res.id) for res in self.reservations.values()],
                requested_quantity=quantity,
                available_quantity=self.inventory_item.available_quantity,
                resolution_strategy="rejected",
                resolved_by=reserved_by
            )
            self.apply_event(conflict_event)
            return None
        
        # Create reservation
        reservation_id = uuid4()
        expires_at = datetime.utcnow() + timedelta(minutes=reservation_duration_minutes)
        
        reservation = StockReservation(
            id=reservation_id,
            inventory_id=UUID(self.aggregate_id),
            order_id=order_id,
            customer_id=customer_id,
            quantity=quantity,
            unit_price=self.inventory_item.unit_price,
            expires_at=expires_at,
            created_by=reserved_by
        )
        
        # Reserve stock in inventory item
        if self.inventory_item.reserve_stock(quantity, reserved_by):
            self.reservations[reservation_id] = reservation
            
            # Raise domain event
            event = StockReservedEvent(
                aggregate_id=self.aggregate_id,
                aggregate_type="inventory",
                aggregate_version=self.version + 1,
                inventory_id=UUID(self.aggregate_id),
                reservation_id=reservation_id,
                order_id=order_id,
                customer_id=customer_id,
                quantity=quantity,
                unit_price=self.inventory_item.unit_price,
                total_amount=reservation.total_amount,
                expires_at=expires_at,
                reserved_by=reserved_by
            )
            self._apply_event(event, is_new=True)
            self._version += 1
            
            # Check stock levels
            self._check_stock_levels()
            
            return reservation_id
        
        return None
    
    def confirm_reservation(
        self,
        reservation_id: UUID,
        confirmed_by: Optional[str] = None
    ) -> bool:
        """
        Confirm a stock reservation.
        
        Args:
            reservation_id: Reservation to confirm
            confirmed_by: User confirming the reservation
            
        Returns:
            True if confirmation successful
        """
        reservation = self.reservations.get(reservation_id)
        if not reservation or not reservation.can_confirm():
            return False
        
        reservation.confirm(confirmed_by)
        
        # Raise domain event
        event = StockReservationConfirmedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="inventory",
            aggregate_version=self.version + 1,
            inventory_id=UUID(self.aggregate_id),
            reservation_id=reservation_id,
            order_id=reservation.order_id,
            quantity=reservation.quantity,
            confirmed_by=confirmed_by
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def cancel_reservation(
        self,
        reservation_id: UUID,
        reason: str = "Cancelled by user",
        cancelled_by: Optional[str] = None
    ) -> bool:
        """
        Cancel a stock reservation.
        
        Args:
            reservation_id: Reservation to cancel
            reason: Cancellation reason
            cancelled_by: User cancelling the reservation
            
        Returns:
            True if cancellation successful
        """
        reservation = self.reservations.get(reservation_id)
        if not reservation or not reservation.can_cancel():
            return False
        
        # Release the reserved stock
        if self.inventory_item:
            self.inventory_item.release_reservation(reservation.quantity, cancelled_by)
        
        reservation.cancel(cancelled_by)
        
        # Raise domain event
        event = StockReservationCancelledEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="inventory",
            aggregate_version=self.version + 1,
            inventory_id=UUID(self.aggregate_id),
            reservation_id=reservation_id,
            order_id=reservation.order_id,
            quantity=reservation.quantity,
            reason=reason,
            cancelled_by=cancelled_by
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        return True
    
    def fulfill_reservation(
        self,
        reservation_id: UUID,
        fulfilled_by: Optional[str] = None
    ) -> bool:
        """
        Fulfill a reservation (ship the order).
        
        Args:
            reservation_id: Reservation to fulfill
            fulfilled_by: User fulfilling the reservation
            
        Returns:
            True if fulfillment successful
        """
        reservation = self.reservations.get(reservation_id)
        if not reservation or reservation.status != ReservationStatus.CONFIRMED:
            return False
        
        # Check if we can fulfill the reservation
        if not self.inventory_item or reservation.quantity > self.inventory_item.reserved_quantity:
            return False
        
        # Remove the reservation
        del self.reservations[reservation_id]
        
        # Raise domain event
        event = StockFulfilledEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="inventory",
            aggregate_version=self.version + 1,
            inventory_id=UUID(self.aggregate_id),
            reservation_id=reservation_id,
            order_id=reservation.order_id,
            quantity=reservation.quantity,
            unit_price=reservation.unit_price,
            total_amount=reservation.total_amount,
            fulfilled_by=fulfilled_by
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        # Raise stock movement event
        movement_event = StockMovementEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="inventory",
            aggregate_version=self.version + 1,
            inventory_id=UUID(self.aggregate_id),
            movement_type="outbound",
            quantity=reservation.quantity,
            from_location="warehouse",
            to_location="shipped",
            reference_type="order",
            reference_id=str(reservation.order_id),
            unit_cost=self.inventory_item.cost_price,
            moved_by=fulfilled_by
        )
        self._apply_event(movement_event, is_new=True)
        self._version += 1
        
        # Check stock levels
        self._check_stock_levels()
        
        return True
    
    def adjust_stock(
        self,
        quantity_change: int,
        adjustment_type: str,
        reason: str,
        reference_id: Optional[str] = None,
        adjusted_by: Optional[str] = None
    ) -> bool:
        """
        Manually adjust stock levels.
        
        Args:
            quantity_change: Change in quantity (+ for increase, - for decrease)
            adjustment_type: Type of adjustment (e.g., 'restock', 'damage', 'correction')
            reason: Reason for adjustment
            reference_id: Reference to related entity
            adjusted_by: User making the adjustment
            
        Returns:
            True if adjustment successful
        """
        if not self.inventory_item:
            return False
        
        quantity_before = self.inventory_item.total_quantity
        
        # Apply the adjustment
        if not self.inventory_item.adjust_stock(quantity_change, reason, adjusted_by):
            return False
        
        quantity_after = self.inventory_item.total_quantity
        
        # Create adjustment record
        adjustment_id = uuid4()
        adjustment = InventoryAdjustment(
            id=adjustment_id,
            inventory_id=UUID(self.aggregate_id),
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            quantity_change=quantity_change,
            adjustment_type=adjustment_type,
            reason=reason,
            reference_id=reference_id,
            created_by=adjusted_by or "system"
        )
        self.adjustments.append(adjustment)
        
        # Raise domain event
        event = InventoryAdjustedEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="inventory",
            aggregate_version=self.version + 1,
            inventory_id=UUID(self.aggregate_id),
            adjustment_id=adjustment_id,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            quantity_change=quantity_change,
            adjustment_type=adjustment_type,
            reason=reason,
            reference_id=reference_id,
            adjusted_by=adjusted_by or "system"
        )
        self._apply_event(event, is_new=True)
        self._version += 1
        
        # Raise stock movement event
        movement_type = "inbound" if quantity_change > 0 else "outbound"
        movement_event = StockMovementEvent(
            aggregate_id=self.aggregate_id,
            aggregate_type="inventory",
            aggregate_version=self.version + 1,
            inventory_id=UUID(self.aggregate_id),
            movement_type=movement_type,
            quantity=abs(quantity_change),
            from_location="warehouse" if movement_type == "outbound" else "supplier",
            to_location="warehouse" if movement_type == "inbound" else "adjustment",
            reference_type="adjustment",
            reference_id=str(adjustment_id),
            unit_cost=self.inventory_item.cost_price,
            moved_by=adjusted_by
        )
        self._apply_event(movement_event, is_new=True)
        self._version += 1
        
        # Check stock levels
        self._check_stock_levels()
        
        return True
    
    def record_physical_count(
        self,
        physical_quantity: int,
        counted_by: str,
        notes: Optional[str] = None,
        auto_adjust: bool = True
    ) -> bool:
        """
        Record a physical inventory count.
        
        Args:
            physical_quantity: Physical count quantity
            counted_by: User who performed the count
            notes: Additional notes
            auto_adjust: Whether to automatically adjust inventory
            
        Returns:
            True if count recorded successfully
        """
        if not self.inventory_item:
            return False
        
        system_quantity = self.inventory_item.total_quantity
        discrepancy = physical_quantity - system_quantity
        
        # Always raise discrepancy event for audit
        discrepancy_event = InventoryCountDiscrepancyEvent(
            aggregate_id=self.aggregate_id,
            inventory_id=UUID(self.aggregate_id),
            product_id=self.inventory_item.product_id,
            sku=self.inventory_item.sku,
            system_quantity=system_quantity,
            physical_quantity=physical_quantity,
            discrepancy=discrepancy,
            count_date=datetime.utcnow(),
            counted_by=counted_by,
            notes=notes
        )
        self.apply_event(discrepancy_event)
        
        # Auto-adjust if requested and there's a discrepancy
        if auto_adjust and discrepancy != 0:
            return self.adjust_stock(
                quantity_change=discrepancy,
                adjustment_type="physical_count",
                reason=f"Physical count adjustment: {notes or 'No notes'}",
                adjusted_by=counted_by
            )
        
        return True
    
    def expire_reservations(self) -> List[UUID]:
        """
        Expire any reservations that have passed their expiration time.
        
        Returns:
            List of expired reservation IDs
        """
        expired_reservations = []
        current_time = datetime.utcnow()
        
        for reservation_id, reservation in list(self.reservations.items()):
            if (reservation.status == ReservationStatus.PENDING and 
                reservation.expires_at <= current_time):
                
                # Release the reserved stock
                if self.inventory_item:
                    self.inventory_item.release_reservation(
                        reservation.quantity, "system"
                    )
                
                reservation.expire()
                expired_reservations.append(reservation_id)
                
                # Raise domain event
                event = StockReservationExpiredEvent(
                    aggregate_id=self.aggregate_id,
                    aggregate_type="inventory",
                    aggregate_version=self.version + 1,
                    inventory_id=UUID(self.aggregate_id),
                    reservation_id=reservation_id,
                    order_id=reservation.order_id,
                    quantity=reservation.quantity,
                    expired_at=current_time
                )
                self._apply_event(event, is_new=True)
                self._version += 1
        
        return expired_reservations
    
    def _check_stock_levels(self) -> None:
        """Check stock levels and raise alerts if needed."""
        if not self.inventory_item:
            return
        
        # Check for low stock alert
        if self.inventory_item.is_low_stock():
            alert_event = LowStockAlertEvent(
                aggregate_id=self.aggregate_id,
                aggregate_type="inventory",
                aggregate_version=self.version + 1,
                inventory_id=UUID(self.aggregate_id),
                product_id=self.inventory_item.product_id,
                sku=self.inventory_item.sku,
                current_quantity=self.inventory_item.available_quantity,
                low_stock_threshold=self.inventory_item.low_stock_threshold,
                reorder_point=self.inventory_item.reorder_point,
                reorder_quantity=self.inventory_item.reorder_quantity
            )
            self._apply_event(alert_event, is_new=True)
            self._version += 1
        
        # Check for reorder requirement
        if self.inventory_item.needs_reorder():
            reorder_event = ReorderRequiredEvent(
                aggregate_id=self.aggregate_id,
                aggregate_type="inventory",
                aggregate_version=self.version + 1,
                inventory_id=UUID(self.aggregate_id),
                product_id=self.inventory_item.product_id,
                sku=self.inventory_item.sku,
                current_quantity=self.inventory_item.available_quantity,
                reorder_point=self.inventory_item.reorder_point,
                reorder_quantity=self.inventory_item.reorder_quantity
            )
            self._apply_event(reorder_event, is_new=True)
            self._version += 1
    
    # Event handlers for rebuilding state from events
    def _apply_inventory_item_created_event(self, event: InventoryItemCreatedEvent) -> None:
        """Apply InventoryItemCreatedEvent to rebuild state."""
        self.inventory_item = InventoryItem(
            id=UUID(event.aggregate_id),
            product_id=event.product_id,
            variant_id=event.variant_id,
            sku=event.sku,
            total_quantity=event.total_quantity,
            unit_price=event.unit_price,
            cost_price=event.cost_price,
            low_stock_threshold=event.low_stock_threshold,
            reorder_point=event.reorder_point,
            reorder_quantity=event.reorder_quantity,
            created_by=event.created_by
        )
    
    def _apply_stock_reserved_event(self, event: StockReservedEvent) -> None:
        """Apply StockReservedEvent to rebuild state."""
        if self.inventory_item:
            self.inventory_item.reserve_stock(event.quantity)
            
            reservation = StockReservation(
                id=event.reservation_id,
                inventory_id=event.inventory_id,
                order_id=event.order_id,
                customer_id=event.customer_id,
                quantity=event.quantity,
                unit_price=event.unit_price,
                expires_at=event.expires_at
            )
            self.reservations[event.reservation_id] = reservation
    
    def _apply_stock_reservation_cancelled_event(self, event: StockReservationCancelledEvent) -> None:
        """Apply StockReservationCancelledEvent to rebuild state."""
        if self.inventory_item:
            self.inventory_item.release_reservation(event.quantity)
            
        if event.reservation_id in self.reservations:
            self.reservations[event.reservation_id].cancel()
    
    def _apply_stock_fulfilled_event(self, event: StockFulfilledEvent) -> None:
        """Apply StockFulfilledEvent to rebuild state."""
        if self.inventory_item:
            self.inventory_item.fulfill_reservation(event.quantity)
            
        # Remove fulfilled reservation
        if event.reservation_id in self.reservations:
            del self.reservations[event.reservation_id]
    
    def on_StockReservedEvent(self, event) -> None:
        """Apply StockReservedEvent to rebuild state."""
        from ...domain.entities.inventory import StockReservation, ReservationStatus
        reservation = StockReservation(
            id=event.reservation_id,
            inventory_id=event.inventory_id,
            order_id=event.order_id,
            customer_id=event.customer_id,
            quantity=event.quantity,
            unit_price=event.unit_price,
            total_amount=event.total_amount,
            status=ReservationStatus.PENDING,
            expires_at=event.expires_at,
            created_by=event.reserved_by
        )
        self.reservations[event.reservation_id] = reservation
        
        # Update inventory item reserved quantity
        if self.inventory_item:
            self.inventory_item.reserved_quantity += event.quantity
            self.inventory_item.available_quantity = max(0, 
                self.inventory_item.total_quantity - self.inventory_item.reserved_quantity)

    def on_StockReservationConfirmedEvent(self, event) -> None:
        """Apply StockReservationConfirmedEvent to rebuild state."""
        reservation = self.reservations.get(event.reservation_id)
        if reservation:
            reservation.confirm(event.confirmed_by)

    def on_StockReservationCancelledEvent(self, event) -> None:
        """Apply StockReservationCancelledEvent to rebuild state."""
        reservation = self.reservations.get(event.reservation_id)
        if reservation:
            reservation.cancel(event.cancelled_by)
            # Release reserved quantity
            if self.inventory_item:
                self.inventory_item.reserved_quantity -= event.quantity
                self.inventory_item.available_quantity = max(0, 
                    self.inventory_item.total_quantity - self.inventory_item.reserved_quantity)

    def on_StockFulfilledEvent(self, event) -> None:
        """Apply StockFulfilledEvent to rebuild state."""
        # Remove the fulfilled reservation
        if event.reservation_id in self.reservations:
            del self.reservations[event.reservation_id]
        # Update inventory quantities (both reserved and total are reduced)
        if self.inventory_item:
            self.inventory_item.reserved_quantity -= event.quantity
            self.inventory_item.total_quantity -= event.quantity
            self.inventory_item.available_quantity = max(0, 
                self.inventory_item.total_quantity - self.inventory_item.reserved_quantity)

    def on_StockReservationExpiredEvent(self, event) -> None:
        """Apply StockReservationExpiredEvent to rebuild state."""
        reservation = self.reservations.get(event.reservation_id)
        if reservation:
            reservation.expire()
            # Release reserved quantity
            if self.inventory_item:
                self.inventory_item.reserved_quantity -= event.quantity
                self.inventory_item.available_quantity = max(0, 
                    self.inventory_item.total_quantity - self.inventory_item.reserved_quantity)

    def on_InventoryItemCreatedEvent(self, event: InventoryItemCreatedEvent) -> None:
        """Event handler when rebuilding state from InventoryItemCreatedEvent."""
        self.inventory_item = InventoryItem(
            id=UUID(self.aggregate_id),
            product_id=event.product_id,
            variant_id=event.variant_id,
            sku=event.sku,
            total_quantity=event.total_quantity,
            unit_price=event.unit_price,
            cost_price=event.cost_price,
            low_stock_threshold=event.low_stock_threshold,
            reorder_point=event.reorder_point,
            reorder_quantity=event.reorder_quantity,
            created_by=event.user_id,
            metadata={}
        )

    def get_snapshot(self) -> Dict[str, str]:
        """Get a snapshot of the current aggregate state."""
        snapshot = {
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "is_deleted": self.is_deleted
        }
        
        if self.inventory_item:
            snapshot.update({
                "inventory_item": {
                    "id": str(self.inventory_item.id),
                    "product_id": self.inventory_item.product_id,
                    "variant_id": self.inventory_item.variant_id,
                    "sku": self.inventory_item.sku,
                    "total_quantity": self.inventory_item.total_quantity,
                    "reserved_quantity": self.inventory_item.reserved_quantity,
                    "available_quantity": self.inventory_item.available_quantity,
                    "unit_price": str(self.inventory_item.unit_price),
                    "cost_price": str(self.inventory_item.cost_price) if self.inventory_item.cost_price else None,
                    "status": self.inventory_item.status.value,
                    "low_stock_threshold": self.inventory_item.low_stock_threshold,
                    "reorder_point": self.inventory_item.reorder_point,
                    "reorder_quantity": self.inventory_item.reorder_quantity,
                    "version": self.inventory_item.version,
                    "created_at": self.inventory_item.created_at.isoformat(),
                    "updated_at": self.inventory_item.updated_at.isoformat(),
                    "created_by": self.inventory_item.created_by,
                    "updated_by": self.inventory_item.updated_by,
                    "metadata": self.inventory_item.metadata
                }
            })
        
        if self.reservations:
            snapshot["reservations"] = {
                str(res_id): {
                    "id": str(reservation.id),
                    "inventory_id": str(reservation.inventory_id),
                    "order_id": str(reservation.order_id),
                    "customer_id": reservation.customer_id,
                    "quantity": reservation.quantity,
                    "unit_price": str(reservation.unit_price),
                    "total_amount": str(reservation.total_amount),
                    "status": reservation.status.value,
                    "expires_at": reservation.expires_at.isoformat(),
                    "created_at": reservation.created_at.isoformat(),
                    "updated_at": reservation.updated_at.isoformat(),
                    "created_by": reservation.created_by,
                    "metadata": reservation.metadata
                }
                for res_id, reservation in self.reservations.items()
            }
        
        return snapshot
    
    def load_from_snapshot(self, snapshot: Dict[str, str]) -> None:
        """Load aggregate state from a snapshot."""
        from decimal import Decimal
        from datetime import datetime
        
        self._version = snapshot.get("version", 0)
        self.is_deleted = snapshot.get("is_deleted", False)
        
        # Load inventory item
        if "inventory_item" in snapshot:
            item_data = snapshot["inventory_item"]
            self.inventory_item = InventoryItem(
                id=UUID(item_data["id"]),
                product_id=item_data["product_id"],
                variant_id=item_data.get("variant_id"),
                sku=item_data["sku"],
                total_quantity=item_data["total_quantity"],
                reserved_quantity=item_data["reserved_quantity"],
                available_quantity=item_data["available_quantity"],
                unit_price=Decimal(item_data["unit_price"]),
                cost_price=Decimal(item_data["cost_price"]) if item_data.get("cost_price") else None,
                status=InventoryStatus(item_data["status"]),
                low_stock_threshold=item_data["low_stock_threshold"],
                reorder_point=item_data["reorder_point"],
                reorder_quantity=item_data["reorder_quantity"],
                version=item_data["version"],
                created_at=datetime.fromisoformat(item_data["created_at"]),
                updated_at=datetime.fromisoformat(item_data["updated_at"]),
                created_by=item_data.get("created_by"),
                updated_by=item_data.get("updated_by"),
                metadata=item_data.get("metadata", {})
            )
        
        # Load reservations
        if "reservations" in snapshot:
            self.reservations = {}
            for res_id, res_data in snapshot["reservations"].items():
                reservation = StockReservation(
                    id=UUID(res_data["id"]),
                    inventory_id=UUID(res_data["inventory_id"]),
                    order_id=UUID(res_data["order_id"]),
                    customer_id=res_data["customer_id"],
                    quantity=res_data["quantity"],
                    unit_price=Decimal(res_data["unit_price"]),
                    total_amount=Decimal(res_data["total_amount"]),
                    status=ReservationStatus(res_data["status"]),
                    expires_at=datetime.fromisoformat(res_data["expires_at"]),
                    created_at=datetime.fromisoformat(res_data["created_at"]),
                    updated_at=datetime.fromisoformat(res_data["updated_at"]),
                    created_by=res_data.get("created_by"),
                    metadata=res_data.get("metadata", {})
                )
                self.reservations[UUID(res_id)] = reservation
