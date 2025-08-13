"""
Event Store implementation for Event Sourcing pattern.

This module provides the core event store functionality for persisting
and retrieving domain events from PostgreSQL.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Type

import structlog
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Text,
    UniqueConstraint,
    Index,
    select,
    and_,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import Base, get_db_session
from ...domain.events.base import DomainEvent
from ...domain.aggregates.base import AggregateRoot, ConcurrencyConflictError

logger = structlog.get_logger(__name__)


class EventRecord(Base):
    """SQLAlchemy model for event store records."""
    
    __tablename__ = "events"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Aggregate information
    aggregate_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    aggregate_type = Column(String(100), nullable=False, index=True)
    
    # Event information
    event_type = Column(String(100), nullable=False, index=True)
    event_data = Column(JSONB, nullable=False)
    event_version = Column(Integer, nullable=False, default=1)
    
    # Versioning for optimistic concurrency control
    version = Column(Integer, nullable=False)
    
    # Temporal information
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    # Correlation and causation
    correlation_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    causation_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # User context
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Additional metadata
    event_metadata = Column('metadata', JSONB, nullable=False, default=dict)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('aggregate_id', 'version', name='uq_aggregate_version'),
        Index('ix_events_aggregate_id_version', 'aggregate_id', 'version'),
        Index('ix_events_created_at', 'created_at'),
        Index('ix_events_event_type_created_at', 'event_type', 'created_at'),
    )


class EventStore:
    """
    Event Store implementation for Event Sourcing.
    
    Provides methods to save and load events for aggregates,
    with optimistic concurrency control and event ordering.
    """
    
    def __init__(self):
        self._event_type_registry: Dict[str, Type[DomainEvent]] = {}
        self._register_event_types()
    
    def _register_event_types(self) -> None:
        """Register all domain event types for deserialization."""
        # Import all event modules to register types
        from ...domain.events import order_events
        from ...domain.events import inventory_events
        
        # Register event types from modules
        for module in [order_events, inventory_events]:
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, DomainEvent)
                    and attr != DomainEvent
                ):
                    self._event_type_registry[attr.__name__] = attr
    
    async def save_events(
        self,
        aggregate_id: str,
        events: List[DomainEvent],
        expected_version: int,
    ) -> None:
        """
        Save events to the event store with optimistic concurrency control.
        
        Args:
            aggregate_id: The ID of the aggregate
            events: List of events to save
            expected_version: Expected current version of the aggregate
            
        Raises:
            ConcurrencyConflictError: If there's a version conflict
        """
        if not events:
            return
        
        async with get_db_session() as session:
            # Check current version for concurrency control
            current_version = await self._get_current_version(session, aggregate_id)
            
            if current_version != expected_version:
                raise ConcurrencyConflictError(
                    aggregate_id=aggregate_id,
                    expected_version=expected_version,
                    actual_version=current_version,
                )
            
            # Create event records
            event_records = []
            for i, event in enumerate(events):
                # Use the version from the event itself
                version = event.aggregate_version
                
                # Event should already have correct aggregate and version info
                # (events are frozen and cannot be modified)
                
                event_record = EventRecord(
                    id=uuid.UUID(event.event_id),
                    aggregate_id=uuid.UUID(aggregate_id),
                    aggregate_type=event.aggregate_type,
                    event_type=event.event_type,
                    event_data=event.model_dump(
                        mode='json',
                        exclude={
                            'event_id', 'aggregate_id', 'aggregate_type', 
                            'aggregate_version', 'occurred_at', 'correlation_id', 'causation_id',
                            'user_id', 'tenant_id', 'metadata'
                        }
                    ),
                    event_version=event.event_version,
                    version=version,
                    created_at=event.occurred_at,
                    correlation_id=uuid.UUID(event.correlation_id) if event.correlation_id else None,
                    causation_id=uuid.UUID(event.causation_id) if event.causation_id else None,
                    user_id=uuid.UUID(event.user_id) if event.user_id else None,
                    tenant_id=uuid.UUID(event.tenant_id) if event.tenant_id else None,
                    event_metadata=event.metadata,
                )
                event_records.append(event_record)
            
            # Save all events in a single transaction
            session.add_all(event_records)
            await session.commit()
            
            logger.info(
                "Events saved successfully",
                aggregate_id=aggregate_id,
                event_count=len(events),
                final_version=expected_version + len(events),
            )
    
    async def load_events(
        self,
        aggregate_id: str,
        from_version: int = 0,
        to_version: Optional[int] = None,
    ) -> List[DomainEvent]:
        """
        Load events for an aggregate from the event store.
        
        Args:
            aggregate_id: The ID of the aggregate
            from_version: Starting version (exclusive)
            to_version: Ending version (inclusive), None for all
            
        Returns:
            List of domain events ordered by version
        """
        async with get_db_session() as session:
            query = select(EventRecord).where(
                and_(
                    EventRecord.aggregate_id == uuid.UUID(aggregate_id),
                    EventRecord.version > from_version,
                )
            )
            
            if to_version is not None:
                query = query.where(EventRecord.version <= to_version)
            
            query = query.order_by(EventRecord.version)
            
            result = await session.execute(query)
            event_records = result.scalars().all()
            
            # Convert records to domain events
            events = []
            for record in event_records:
                event = self._deserialize_event(record)
                if event:
                    events.append(event)
            
            logger.debug(
                "Events loaded",
                aggregate_id=aggregate_id,
                from_version=from_version,
                to_version=to_version,
                event_count=len(events),
            )
            
            return events
    
    async def get_aggregate_version(self, aggregate_id: str) -> int:
        """Get the current version of an aggregate."""
        async with get_db_session() as session:
            return await self._get_current_version(session, aggregate_id)
    
    async def aggregate_exists(self, aggregate_id: str) -> bool:
        """Check if an aggregate exists in the event store."""
        version = await self.get_aggregate_version(aggregate_id)
        return version > 0
    
    async def get_events_by_type(
        self,
        event_type: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 1000,
    ) -> List[DomainEvent]:
        """
        Get events by type within a date range.
        
        Useful for building projections or analytics.
        """
        async with get_db_session() as session:
            query = select(EventRecord).where(EventRecord.event_type == event_type)
            
            if from_date:
                query = query.where(EventRecord.created_at >= from_date)
            
            if to_date:
                query = query.where(EventRecord.created_at <= to_date)
            
            query = query.order_by(EventRecord.created_at).limit(limit)
            
            result = await session.execute(query)
            event_records = result.scalars().all()
            
            events = []
            for record in event_records:
                event = self._deserialize_event(record)
                if event:
                    events.append(event)
            
            return events
    
    async def _get_current_version(self, session: AsyncSession, aggregate_id: str) -> int:
        """Get the current version of an aggregate."""
        query = select(EventRecord.version).where(
            EventRecord.aggregate_id == uuid.UUID(aggregate_id)
        ).order_by(EventRecord.version.desc()).limit(1)
        
        result = await session.execute(query)
        version = result.scalar()
        
        return version if version is not None else 0
    
    def _deserialize_event(self, record: EventRecord) -> Optional[DomainEvent]:
        """Deserialize an event record to a domain event."""
        try:
            event_class = self._event_type_registry.get(record.event_type)
            if not event_class:
                logger.warning(
                    "Unknown event type",
                    event_type=record.event_type,
                    event_id=str(record.id),
                )
                return None
            
            # Reconstruct the full event data
            event_data = record.event_data.copy()
            event_data.update({
                'event_id': str(record.id),
                'event_type': record.event_type,
                'event_version': record.event_version,
                'aggregate_id': str(record.aggregate_id),
                'aggregate_type': record.aggregate_type,
                'aggregate_version': record.version,
                'occurred_at': record.created_at,
                'correlation_id': str(record.correlation_id) if record.correlation_id else None,
                'causation_id': str(record.causation_id) if record.causation_id else None,
                'user_id': str(record.user_id) if record.user_id else None,
                'tenant_id': str(record.tenant_id) if record.tenant_id else None,
                'metadata': record.event_metadata,
            })
            
            return event_class.model_validate(event_data)
            
        except Exception as e:
            logger.error(
                "Failed to deserialize event",
                event_type=record.event_type,
                event_id=str(record.id),
                error=str(e),
            )
            return None


class AggregateRepository:
    """
    Repository for loading and saving aggregates using Event Sourcing.
    
    This is the main interface for working with aggregates in an
    event-sourced system.
    """
    
    def __init__(self, event_store: EventStore):
        self.event_store = event_store
    
    async def load(
        self,
        aggregate_class: Type[AggregateRoot],
        aggregate_id: str,
    ) -> Optional[AggregateRoot]:
        """
        Load an aggregate from the event store.
        
        Args:
            aggregate_class: The class of the aggregate to load
            aggregate_id: The ID of the aggregate
            
        Returns:
            The loaded aggregate or None if not found
        """
        events = await self.event_store.load_events(aggregate_id)
        
        if not events:
            return None
        
        # Create aggregate instance and load from history
        aggregate = aggregate_class(aggregate_id)
        aggregate.load_from_history(events)
        
        return aggregate
    
    async def save(self, aggregate: AggregateRoot) -> None:
        """
        Save an aggregate to the event store.
        
        Args:
            aggregate: The aggregate to save
        """
        uncommitted_events = aggregate.uncommitted_events
        
        if not uncommitted_events:
            return
        
        expected_version = aggregate.version - len(uncommitted_events)
        
        await self.event_store.save_events(
            aggregate_id=aggregate.aggregate_id,
            events=uncommitted_events,
            expected_version=expected_version,
        )
        
        # Mark events as committed
        aggregate.mark_events_as_committed()
    
    async def exists(self, aggregate_id: str) -> bool:
        """Check if an aggregate exists."""
        return await self.event_store.aggregate_exists(aggregate_id)

