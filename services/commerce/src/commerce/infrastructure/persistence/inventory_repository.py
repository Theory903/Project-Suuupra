"""
Inventory repository for the Commerce Service.

This module provides persistence operations for inventory aggregates,
including optimistic locking and conflict resolution.
"""

import json
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import Column, String, Integer, DateTime, Text, DECIMAL, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import declarative_base

from ...domain.aggregates.inventory import InventoryAggregate
from ...domain.entities.inventory import InventoryItem, InventoryStatus, StockReservation, ReservationStatus
from .event_store import EventStore


Base = declarative_base()


class InventoryItemRecord(Base):
    """Database record for inventory items."""
    
    __tablename__ = "inventory_items"
    
    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True)
    
    # Business identifiers
    product_id = Column(String(255), nullable=False, index=True)
    variant_id = Column(String(255), nullable=True, index=True)
    sku = Column(String(100), nullable=False, unique=True, index=True)
    
    # Stock levels
    total_quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    available_quantity = Column(Integer, nullable=False, default=0)
    
    # Pricing
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    cost_price = Column(DECIMAL(10, 2), nullable=True)
    
    # Status and thresholds
    status = Column(String(50), nullable=False, default="active")
    low_stock_threshold = Column(Integer, nullable=False, default=10)
    reorder_point = Column(Integer, nullable=False, default=5)
    reorder_quantity = Column(Integer, nullable=False, default=100)
    
    # Optimistic locking
    version = Column(Integer, nullable=False, default=1)
    
    # Audit fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)
    
    # Metadata
    item_metadata = Column('metadata', JSONB, nullable=False, default=dict)
    
    # Soft delete
    is_deleted = Column(Boolean, nullable=False, default=False)


class StockReservationRecord(Base):
    """Database record for stock reservations."""
    
    __tablename__ = "stock_reservations"
    
    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True)
    
    # Foreign keys
    inventory_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(String(255), nullable=False, index=True)
    
    # Reservation details
    quantity = Column(Integer, nullable=False)
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    total_amount = Column(DECIMAL(10, 2), nullable=False)
    
    # Status and lifecycle
    status = Column(String(50), nullable=False, default="pending")
    expires_at = Column(DateTime, nullable=False)
    
    # Audit fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(String(255), nullable=True)
    
    # Metadata
    reservation_metadata = Column('metadata', JSONB, nullable=False, default=dict)


class InventoryAdjustmentRecord(Base):
    """Database record for inventory adjustments."""
    
    __tablename__ = "inventory_adjustments"
    
    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True)
    
    # Foreign key
    inventory_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    
    # Adjustment details
    quantity_before = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)
    quantity_change = Column(Integer, nullable=False)
    
    # Context
    adjustment_type = Column(String(100), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    reference_id = Column(String(255), nullable=True, index=True)
    
    # Audit fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(String(255), nullable=False)
    
    # Metadata
    adjustment_metadata = Column('metadata', JSONB, nullable=False, default=dict)


class InventoryRepository:
    """
    Repository for inventory aggregates with optimistic locking.
    
    This repository provides CRUD operations for inventory aggregates
    and handles optimistic concurrency control.
    """
    
    def __init__(self, db_session: AsyncSession, event_store: EventStore):
        self.db_session = db_session
        self.event_store = event_store
    
    async def get_by_id(self, inventory_id: UUID) -> Optional[InventoryAggregate]:
        """
        Get an inventory aggregate by ID.
        
        Args:
            inventory_id: Inventory ID
            
        Returns:
            InventoryAggregate if found, None otherwise
        """
        # Load from event store
        aggregate = InventoryAggregate(str(inventory_id))
        events = await self.event_store.load_events(str(inventory_id))
        
        if events:
            aggregate.load_from_history(events)
            return aggregate
        
        # Fallback: build from read model if events not yet available
        query = select(InventoryItemRecord).where(InventoryItemRecord.id == inventory_id)
        result = await self.db_session.execute(query)
        record = result.scalar_one_or_none()
        if not record:
            return None
        
        # Construct minimal aggregate state from read model
        from ...domain.entities.inventory import InventoryItem, InventoryStatus, StockReservation
        item = InventoryItem(
            id=record.id,
            product_id=record.product_id,
            variant_id=record.variant_id,
            sku=record.sku,
            total_quantity=record.total_quantity,
            unit_price=record.unit_price,
            cost_price=record.cost_price,
            low_stock_threshold=record.low_stock_threshold,
            reorder_point=record.reorder_point,
            reorder_quantity=record.reorder_quantity,
            created_by=record.created_by,
            metadata=record.item_metadata or {},
        )
        aggregate.inventory_item = item
        
        # Load active reservations
        reservation_query = select(StockReservationRecord).where(
            StockReservationRecord.inventory_id == record.id,
            StockReservationRecord.status.in_(["pending", "confirmed"])
        )
        reservation_result = await self.db_session.execute(reservation_query)
        reservation_records = reservation_result.scalars().all()
        
        for res_record in reservation_records:
            from ...domain.entities.inventory import ReservationStatus
            reservation = StockReservation(
                id=res_record.id,
                inventory_id=res_record.inventory_id,
                order_id=res_record.order_id,
                customer_id=res_record.customer_id,
                quantity=res_record.quantity,
                unit_price=res_record.unit_price,
                total_amount=res_record.total_amount,
                status=ReservationStatus(res_record.status),
                expires_at=res_record.expires_at,
                created_at=res_record.created_at,
                updated_at=res_record.updated_at,
                created_by=res_record.created_by,
                metadata=res_record.reservation_metadata or {}
            )
            aggregate.reservations[res_record.id] = reservation
        
        # Set the correct version from the read model
        aggregate._version = record.version
        return aggregate
    
    async def get_by_sku(self, sku: str) -> Optional[InventoryAggregate]:
        """
        Get an inventory aggregate by SKU.
        
        Args:
            sku: Stock Keeping Unit
            
        Returns:
            InventoryAggregate if found, None otherwise
        """
        # First find the inventory ID by SKU
        query = select(InventoryItemRecord.id).where(
            InventoryItemRecord.sku == sku,
            InventoryItemRecord.is_deleted == False
        )
        result = await self.db_session.execute(query)
        inventory_id = result.scalar_one_or_none()
        
        if not inventory_id:
            return None
        
        return await self.get_by_id(inventory_id)
    
    async def get_by_product_id(self, product_id: str, variant_id: Optional[str] = None) -> Optional[InventoryAggregate]:
        """
        Get an inventory aggregate by product ID and variant.
        
        Args:
            product_id: External product identifier
            variant_id: Product variant identifier
            
        Returns:
            InventoryAggregate if found, None otherwise
        """
        query = select(InventoryItemRecord.id).where(
            InventoryItemRecord.product_id == product_id,
            InventoryItemRecord.is_deleted == False
        )
        
        if variant_id:
            query = query.where(InventoryItemRecord.variant_id == variant_id)
        else:
            query = query.where(InventoryItemRecord.variant_id.is_(None))
        
        result = await self.db_session.execute(query)
        inventory_id = result.scalar_one_or_none()
        
        if not inventory_id:
            return None
        
        return await self.get_by_id(inventory_id)
    
    async def save(self, aggregate: InventoryAggregate) -> bool:
        """
        Save an inventory aggregate.
        
        Args:
            aggregate: Inventory aggregate to save
            
        Returns:
            True if save successful, False if optimistic locking conflict
        """
        # Save events to event store
        uncommitted_events = aggregate.uncommitted_events
        if uncommitted_events:
            # The expected version is the version before applying the new events
            expected_version = aggregate.version - len(uncommitted_events)
            await self.event_store.save_events(aggregate.aggregate_id, uncommitted_events, expected_version)
        
        # Update read model
        await self._update_read_model(aggregate)
        
        # Commit read model changes
        await self.db_session.commit()
        
        # Do not mark events as committed here; the service does it after publishing
        
        return True
    
    async def _update_read_model(self, aggregate: InventoryAggregate) -> None:
        """Update the read model from the aggregate state."""
        if not aggregate.inventory_item:
            return
        
        # Check if record exists
        query = select(InventoryItemRecord).where(InventoryItemRecord.id == UUID(aggregate.aggregate_id))
        result = await self.db_session.execute(query)
        record = result.scalar_one_or_none()
        
        if record:
            # Update existing record
            record.total_quantity = aggregate.inventory_item.total_quantity
            record.reserved_quantity = aggregate.inventory_item.reserved_quantity
            record.available_quantity = aggregate.inventory_item.available_quantity
            record.unit_price = aggregate.inventory_item.unit_price
            record.cost_price = aggregate.inventory_item.cost_price
            record.status = aggregate.inventory_item.status.value
            record.low_stock_threshold = aggregate.inventory_item.low_stock_threshold
            record.reorder_point = aggregate.inventory_item.reorder_point
            record.reorder_quantity = aggregate.inventory_item.reorder_quantity
            record.version = aggregate.inventory_item.version
            record.updated_at = aggregate.inventory_item.updated_at
            record.updated_by = aggregate.inventory_item.updated_by
            record.item_metadata = aggregate.inventory_item.metadata
        else:
            # Create new record
            record = InventoryItemRecord(
                id=aggregate.inventory_item.id,
                product_id=aggregate.inventory_item.product_id,
                variant_id=aggregate.inventory_item.variant_id,
                sku=aggregate.inventory_item.sku,
                total_quantity=aggregate.inventory_item.total_quantity,
                reserved_quantity=aggregate.inventory_item.reserved_quantity,
                available_quantity=aggregate.inventory_item.available_quantity,
                unit_price=aggregate.inventory_item.unit_price,
                cost_price=aggregate.inventory_item.cost_price,
                status=aggregate.inventory_item.status.value,
                low_stock_threshold=aggregate.inventory_item.low_stock_threshold,
                reorder_point=aggregate.inventory_item.reorder_point,
                reorder_quantity=aggregate.inventory_item.reorder_quantity,
                version=aggregate.inventory_item.version,
                created_at=aggregate.inventory_item.created_at,
                updated_at=aggregate.inventory_item.updated_at,
                created_by=aggregate.inventory_item.created_by,
                updated_by=aggregate.inventory_item.updated_by,
                item_metadata=aggregate.inventory_item.metadata
            )
            self.db_session.add(record)
        
        # Update reservations
        await self._update_reservations(aggregate)
        
        # Update adjustments
        await self._update_adjustments(aggregate)
    
    async def _update_reservations(self, aggregate: InventoryAggregate) -> None:
        """Update stock reservations in the read model."""
        for reservation in aggregate.reservations.values():
            # Check if record exists
            query = select(StockReservationRecord).where(StockReservationRecord.id == reservation.id)
            result = await self.db_session.execute(query)
            record = result.scalar_one_or_none()
            
            if record:
                # Update existing record
                record.status = reservation.status.value
                record.updated_at = reservation.updated_at
            else:
                # Create new record
                record = StockReservationRecord(
                    id=reservation.id,
                    inventory_id=reservation.inventory_id,
                    order_id=reservation.order_id,
                    customer_id=reservation.customer_id,
                    quantity=reservation.quantity,
                    unit_price=reservation.unit_price,
                    total_amount=reservation.total_amount,
                    status=reservation.status.value if hasattr(reservation.status, 'value') else str(reservation.status),
                    expires_at=reservation.expires_at,
                    created_at=reservation.created_at,
                    updated_at=reservation.updated_at,
                    created_by=reservation.created_by,
                    reservation_metadata=reservation.metadata
                )
                self.db_session.add(record)
    
    async def _update_adjustments(self, aggregate: InventoryAggregate) -> None:
        """Update inventory adjustments in the read model."""
        for adjustment in aggregate.adjustments:
            # Check if record exists
            query = select(InventoryAdjustmentRecord).where(InventoryAdjustmentRecord.id == adjustment.id)
            result = await self.db_session.execute(query)
            existing = result.scalar_one_or_none()
            
            if not existing:
                # Create new record
                record = InventoryAdjustmentRecord(
                    id=adjustment.id,
                    inventory_id=adjustment.inventory_id,
                    quantity_before=adjustment.quantity_before,
                    quantity_after=adjustment.quantity_after,
                    quantity_change=adjustment.quantity_change,
                    adjustment_type=adjustment.adjustment_type,
                    reason=adjustment.reason,
                    reference_id=adjustment.reference_id,
                    created_at=adjustment.created_at,
                    created_by=adjustment.created_by,
                    adjustment_metadata=adjustment.metadata
                )
                self.db_session.add(record)
    
    async def find_low_stock_items(self, limit: int = 100) -> List[Dict]:
        """
        Find inventory items with low stock.
        
        Args:
            limit: Maximum number of items to return
            
        Returns:
            List of low stock items
        """
        query = select(InventoryItemRecord).where(
            InventoryItemRecord.available_quantity <= InventoryItemRecord.low_stock_threshold,
            InventoryItemRecord.status == "active",
            InventoryItemRecord.is_deleted == False
        ).limit(limit)
        
        result = await self.db_session.execute(query)
        records = result.scalars().all()
        
        return [
            {
                "inventory_id": str(record.id),
                "product_id": record.product_id,
                "sku": record.sku,
                "available_quantity": record.available_quantity,
                "low_stock_threshold": record.low_stock_threshold,
                "reorder_point": record.reorder_point,
                "reorder_quantity": record.reorder_quantity
            }
            for record in records
        ]
    
    async def find_items_needing_reorder(self, limit: int = 100) -> List[Dict]:
        """
        Find inventory items that need reordering.
        
        Args:
            limit: Maximum number of items to return
            
        Returns:
            List of items needing reorder
        """
        query = select(InventoryItemRecord).where(
            InventoryItemRecord.available_quantity <= InventoryItemRecord.reorder_point,
            InventoryItemRecord.status == "active",
            InventoryItemRecord.is_deleted == False
        ).limit(limit)
        
        result = await self.db_session.execute(query)
        records = result.scalars().all()
        
        return [
            {
                "inventory_id": str(record.id),
                "product_id": record.product_id,
                "sku": record.sku,
                "available_quantity": record.available_quantity,
                "low_stock_threshold": record.low_stock_threshold,
                "reorder_point": record.reorder_point,
                "reorder_quantity": record.reorder_quantity
            }
            for record in records
        ]
    
    async def find_expired_reservations(self, limit: int = 1000) -> List[Dict]:
        """
        Find expired reservations that need to be cleaned up.
        
        Args:
            limit: Maximum number of reservations to return
            
        Returns:
            List of expired reservations
        """
        query = select(StockReservationRecord).where(
            StockReservationRecord.status == "pending",
            StockReservationRecord.expires_at <= datetime.utcnow()
        ).limit(limit)
        
        result = await self.db_session.execute(query)
        records = result.scalars().all()
        
        return [
            {
                "reservation_id": str(record.id),
                "inventory_id": str(record.inventory_id),
                "order_id": str(record.order_id),
                "quantity": record.quantity,
                "expires_at": record.expires_at.isoformat()
            }
            for record in records
        ]
    
    async def get_inventory_summary(self) -> Dict:
        """
        Get inventory summary statistics.
        
        Returns:
            Dictionary with inventory statistics
        """
        # Total items
        total_query = select(InventoryItemRecord.id).where(
            InventoryItemRecord.is_deleted == False
        )
        total_result = await self.db_session.execute(total_query)
        total_items = len(total_result.scalars().all())
        
        # Active items
        active_query = select(InventoryItemRecord.id).where(
            InventoryItemRecord.status == "active",
            InventoryItemRecord.is_deleted == False
        )
        active_result = await self.db_session.execute(active_query)
        active_items = len(active_result.scalars().all())
        
        # Low stock items
        low_stock_query = select(InventoryItemRecord.id).where(
            InventoryItemRecord.available_quantity <= InventoryItemRecord.low_stock_threshold,
            InventoryItemRecord.status == "active",
            InventoryItemRecord.is_deleted == False
        )
        low_stock_result = await self.db_session.execute(low_stock_query)
        low_stock_items = len(low_stock_result.scalars().all())
        
        # Out of stock items
        out_of_stock_query = select(InventoryItemRecord.id).where(
            InventoryItemRecord.available_quantity == 0,
            InventoryItemRecord.status == "active",
            InventoryItemRecord.is_deleted == False
        )
        out_of_stock_result = await self.db_session.execute(out_of_stock_query)
        out_of_stock_items = len(out_of_stock_result.scalars().all())
        
        # Active reservations
        active_reservations_query = select(StockReservationRecord.id).where(
            StockReservationRecord.status.in_(["pending", "confirmed"])
        )
        reservations_result = await self.db_session.execute(active_reservations_query)
        active_reservations = len(reservations_result.scalars().all())
        
        return {
            "total_items": total_items,
            "active_items": active_items,
            "low_stock_items": low_stock_items,
            "out_of_stock_items": out_of_stock_items,
            "active_reservations": active_reservations,
            "last_updated": datetime.utcnow().isoformat()
        }
