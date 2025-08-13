"""
Inventory domain events for the Commerce Service.

This module defines all domain events related to inventory management,
stock reservations, and inventory adjustments.
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional
from uuid import UUID

from pydantic import Field

from .base import DomainEvent


class InventoryItemCreatedEvent(DomainEvent):
    """Event raised when a new inventory item is created."""
    
    product_id: str = Field(description="External product identifier")
    variant_id: Optional[str] = Field(description="Product variant identifier")
    sku: str = Field(description="Stock Keeping Unit")
    total_quantity: int = Field(description="Initial total quantity")
    unit_price: Decimal = Field(description="Unit price")
    cost_price: Optional[Decimal] = Field(description="Cost price")
    low_stock_threshold: int = Field(description="Low stock threshold")
    reorder_point: int = Field(description="Reorder point")
    reorder_quantity: int = Field(description="Reorder quantity")
    created_by: Optional[str] = Field(description="User who created the item")


class InventoryItemUpdatedEvent(DomainEvent):
    """Event raised when an inventory item is updated."""
    
    product_id: str = Field(description="External product identifier")
    changes: Dict[str, str] = Field(description="Fields that were changed")
    previous_version: int = Field(description="Previous version number")
    new_version: int = Field(description="New version number")
    updated_by: Optional[str] = Field(description="User who updated the item")


class StockReservedEvent(DomainEvent):
    """Event raised when stock is reserved for an order."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    reservation_id: UUID = Field(description="Reservation ID")
    order_id: UUID = Field(description="Associated order ID")
    customer_id: str = Field(description="Customer ID")
    quantity: int = Field(description="Reserved quantity")
    unit_price: Decimal = Field(description="Unit price at reservation time")
    total_amount: Decimal = Field(description="Total reservation amount")
    expires_at: datetime = Field(description="Reservation expiration time")
    reserved_by: Optional[str] = Field(description="User who made the reservation")


class StockReservationConfirmedEvent(DomainEvent):
    """Event raised when a stock reservation is confirmed."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    reservation_id: UUID = Field(description="Reservation ID")
    order_id: UUID = Field(description="Associated order ID")
    quantity: int = Field(description="Confirmed quantity")
    confirmed_by: Optional[str] = Field(description="User who confirmed the reservation")


class StockReservationCancelledEvent(DomainEvent):
    """Event raised when a stock reservation is cancelled."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    reservation_id: UUID = Field(description="Reservation ID")
    order_id: UUID = Field(description="Associated order ID")
    quantity: int = Field(description="Cancelled quantity")
    reason: str = Field(description="Cancellation reason")
    cancelled_by: Optional[str] = Field(description="User who cancelled the reservation")


class StockReservationExpiredEvent(DomainEvent):
    """Event raised when a stock reservation expires."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    reservation_id: UUID = Field(description="Reservation ID")
    order_id: UUID = Field(description="Associated order ID")
    quantity: int = Field(description="Expired quantity")
    expired_at: datetime = Field(description="Expiration timestamp")


class StockFulfilledEvent(DomainEvent):
    """Event raised when reserved stock is fulfilled (shipped)."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    reservation_id: UUID = Field(description="Reservation ID")
    order_id: UUID = Field(description="Associated order ID")
    quantity: int = Field(description="Fulfilled quantity")
    unit_price: Decimal = Field(description="Unit price")
    total_amount: Decimal = Field(description="Total fulfilled amount")
    fulfilled_by: Optional[str] = Field(description="User who fulfilled the order")


class InventoryAdjustedEvent(DomainEvent):
    """Event raised when inventory levels are manually adjusted."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    adjustment_id: UUID = Field(description="Adjustment record ID")
    quantity_before: int = Field(description="Quantity before adjustment")
    quantity_after: int = Field(description="Quantity after adjustment")
    quantity_change: int = Field(description="Change in quantity")
    adjustment_type: str = Field(description="Type of adjustment")
    reason: str = Field(description="Reason for adjustment")
    reference_id: Optional[str] = Field(description="Reference to related entity")
    adjusted_by: str = Field(description="User who made the adjustment")


class LowStockAlertEvent(DomainEvent):
    """Event raised when inventory falls below low stock threshold."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    product_id: str = Field(description="External product identifier")
    sku: str = Field(description="Stock Keeping Unit")
    current_quantity: int = Field(description="Current available quantity")
    low_stock_threshold: int = Field(description="Low stock threshold")
    reorder_point: int = Field(description="Reorder point")
    reorder_quantity: int = Field(description="Recommended reorder quantity")


class ReorderRequiredEvent(DomainEvent):
    """Event raised when inventory falls below reorder point."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    product_id: str = Field(description="External product identifier")
    sku: str = Field(description="Stock Keeping Unit")
    current_quantity: int = Field(description="Current available quantity")
    reorder_point: int = Field(description="Reorder point")
    reorder_quantity: int = Field(description="Recommended reorder quantity")
    supplier_info: Optional[Dict[str, str]] = Field(default=None, description="Supplier information")


class InventoryStatusChangedEvent(DomainEvent):
    """Event raised when inventory status changes."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    product_id: str = Field(description="External product identifier")
    previous_status: str = Field(description="Previous status")
    new_status: str = Field(description="New status")
    reason: str = Field(description="Reason for status change")
    changed_by: Optional[str] = Field(description="User who changed the status")


class InventoryCountDiscrepancyEvent(DomainEvent):
    """Event raised when physical inventory count doesn't match system records."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    product_id: str = Field(description="External product identifier")
    sku: str = Field(description="Stock Keeping Unit")
    system_quantity: int = Field(description="System recorded quantity")
    physical_quantity: int = Field(description="Physical count quantity")
    discrepancy: int = Field(description="Difference (physical - system)")
    count_date: datetime = Field(description="Date of physical count")
    counted_by: str = Field(description="User who performed the count")
    notes: Optional[str] = Field(description="Additional notes")


class StockMovementEvent(DomainEvent):
    """Event raised for any stock movement (in/out/transfer)."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    movement_type: str = Field(description="Type of movement (inbound/outbound/transfer)")
    quantity: int = Field(description="Quantity moved")
    from_location: Optional[str] = Field(description="Source location")
    to_location: Optional[str] = Field(description="Destination location")
    reference_type: str = Field(description="Reference type (order/adjustment/transfer)")
    reference_id: str = Field(description="Reference ID")
    unit_cost: Optional[Decimal] = Field(description="Unit cost for valuation")
    moved_by: Optional[str] = Field(description="User who initiated the movement")


class InventoryValuationChangedEvent(DomainEvent):
    """Event raised when inventory valuation changes."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    product_id: str = Field(description="External product identifier")
    previous_unit_price: Decimal = Field(description="Previous unit price")
    new_unit_price: Decimal = Field(description="New unit price")
    previous_cost_price: Optional[Decimal] = Field(description="Previous cost price")
    new_cost_price: Optional[Decimal] = Field(description="New cost price")
    quantity_on_hand: int = Field(description="Quantity on hand at time of change")
    valuation_impact: Decimal = Field(description="Impact on total inventory value")
    changed_by: Optional[str] = Field(description="User who changed the valuation")
    reason: str = Field(description="Reason for valuation change")


class InventoryReservationConflictEvent(DomainEvent):
    """Event raised when there's a conflict in inventory reservations."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    conflicting_reservations: list = Field(description="List of conflicting reservation IDs")
    requested_quantity: int = Field(description="Requested quantity that caused conflict")
    available_quantity: int = Field(description="Available quantity at time of conflict")
    resolution_strategy: str = Field(description="Strategy used to resolve conflict")
    resolved_by: Optional[str] = Field(description="User who resolved the conflict")


class InventorySyncEvent(DomainEvent):
    """Event raised when inventory is synchronized with external systems."""
    
    inventory_id: UUID = Field(description="Inventory item ID")
    external_system: str = Field(description="External system name")
    sync_type: str = Field(description="Type of sync (full/partial/delta)")
    changes_detected: Dict[str, str] = Field(description="Changes detected during sync")
    sync_status: str = Field(description="Sync status (success/failed/partial)")
    error_details: Optional[str] = Field(description="Error details if sync failed")
    synced_by: Optional[str] = Field(description="User or system that initiated sync")
