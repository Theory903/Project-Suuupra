"""
Saga Repository for persisting and managing saga instances.

Provides CRUD operations for saga instances with PostgreSQL storage
and supports saga recovery and monitoring.
"""

import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID

import structlog
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db_session
from ...domain.sagas.base import SagaInstance, SagaStatus, SagaStep
from ...infrastructure.database import Base
from sqlalchemy import Column, String, Integer, DateTime, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB

logger = structlog.get_logger(__name__)


class SagaInstanceRecord(Base):
    """SQLAlchemy model for saga instances."""
    
    __tablename__ = "saga_instances"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True)
    saga_type = Column(String(100), nullable=False, index=True)
    status = Column(
        SQLEnum(SagaStatus, name="saga_status"),
        nullable=False,
        default=SagaStatus.RUNNING,
        index=True
    )
    correlation_id = Column(String(255), nullable=False, index=True)
    context_data = Column(JSONB, nullable=False, default=dict)
    saga_data = Column(JSONB, nullable=False, default=dict)
    current_step_index = Column(Integer, nullable=False, default=0)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    error_message = Column(Text, nullable=True)


class SagaRepository:
    """
    Repository for managing saga instances with PostgreSQL persistence.
    
    Provides operations for creating, updating, and querying saga instances
    with proper concurrency control and error handling.
    """
    
    async def save(self, saga_instance: SagaInstance) -> None:
        """
        Save or update a saga instance.
        
        Args:
            saga_instance: The saga instance to save
        """
        async with get_db_session() as session:
            # Check if saga already exists
            existing = await session.get(SagaInstanceRecord, UUID(saga_instance.saga_id))
            
            if existing:
                # Update existing saga
                existing.status = saga_instance.status
                existing.context_data = saga_instance.context_data
                existing.saga_data = saga_instance.model_dump(exclude={"saga_id"})
                existing.current_step_index = saga_instance.current_step_index
                existing.updated_at = datetime.now(timezone.utc)
                
                if saga_instance.completed_at:
                    existing.completed_at = saga_instance.completed_at
                if saga_instance.error_message:
                    existing.error_message = saga_instance.error_message
                
                logger.debug(
                    "Saga instance updated",
                    saga_id=saga_instance.saga_id,
                    status=saga_instance.status,
                    step_index=saga_instance.current_step_index,
                )
            else:
                # Create new saga
                record = SagaInstanceRecord(
                    id=UUID(saga_instance.saga_id),
                    saga_type=saga_instance.saga_type,
                    status=saga_instance.status,
                    correlation_id=saga_instance.correlation_id,
                    context_data=saga_instance.context_data,
                    saga_data=saga_instance.model_dump(exclude={"saga_id"}),
                    current_step_index=saga_instance.current_step_index,
                    started_at=saga_instance.started_at,
                    completed_at=saga_instance.completed_at,
                    error_message=saga_instance.error_message,
                )
                session.add(record)
                
                logger.info(
                    "Saga instance created",
                    saga_id=saga_instance.saga_id,
                    saga_type=saga_instance.saga_type,
                    correlation_id=saga_instance.correlation_id,
                )
            
            await session.commit()
    
    async def get(self, saga_id: str) -> Optional[SagaInstance]:
        """
        Get a saga instance by ID.
        
        Args:
            saga_id: The saga identifier
            
        Returns:
            The saga instance or None if not found
        """
        async with get_db_session() as session:
            record = await session.get(SagaInstanceRecord, UUID(saga_id))
            
            if not record:
                return None
            
            return self._record_to_saga_instance(record)
    
    async def get_by_correlation_id(self, correlation_id: str) -> List[SagaInstance]:
        """
        Get saga instances by correlation ID.
        
        Args:
            correlation_id: The correlation identifier
            
        Returns:
            List of saga instances with the given correlation ID
        """
        async with get_db_session() as session:
            query = select(SagaInstanceRecord).where(
                SagaInstanceRecord.correlation_id == correlation_id
            ).order_by(SagaInstanceRecord.created_at.desc())
            
            result = await session.execute(query)
            records = result.scalars().all()
            
            return [self._record_to_saga_instance(record) for record in records]
    
    async def get_running_sagas(
        self,
        saga_type: Optional[str] = None,
        limit: int = 100
    ) -> List[SagaInstance]:
        """
        Get running saga instances.
        
        Args:
            saga_type: Optional saga type filter
            limit: Maximum number of sagas to return
            
        Returns:
            List of running saga instances
        """
        async with get_db_session() as session:
            query = select(SagaInstanceRecord).where(
                SagaInstanceRecord.status == SagaStatus.RUNNING
            )
            
            if saga_type:
                query = query.where(SagaInstanceRecord.saga_type == saga_type)
            
            query = query.order_by(SagaInstanceRecord.created_at).limit(limit)
            
            result = await session.execute(query)
            records = result.scalars().all()
            
            return [self._record_to_saga_instance(record) for record in records]
    
    async def get_failed_sagas(
        self,
        saga_type: Optional[str] = None,
        limit: int = 100
    ) -> List[SagaInstance]:
        """
        Get failed saga instances that might need retry or compensation.
        
        Args:
            saga_type: Optional saga type filter
            limit: Maximum number of sagas to return
            
        Returns:
            List of failed saga instances
        """
        async with get_db_session() as session:
            query = select(SagaInstanceRecord).where(
                SagaInstanceRecord.status.in_([SagaStatus.FAILED, SagaStatus.COMPENSATING])
            )
            
            if saga_type:
                query = query.where(SagaInstanceRecord.saga_type == saga_type)
            
            query = query.order_by(SagaInstanceRecord.updated_at.desc()).limit(limit)
            
            result = await session.execute(query)
            records = result.scalars().all()
            
            return [self._record_to_saga_instance(record) for record in records]
    
    async def get_saga_statistics(self) -> Dict[str, Any]:
        """
        Get saga execution statistics.
        
        Returns:
            Dictionary with saga statistics
        """
        async with get_db_session() as session:
            # Count sagas by status
            from sqlalchemy import func
            
            query = select(
                SagaInstanceRecord.status,
                func.count(SagaInstanceRecord.id).label('count')
            ).group_by(SagaInstanceRecord.status)
            
            result = await session.execute(query)
            status_counts = {row.status.value: row.count for row in result}
            
            # Count sagas by type
            query = select(
                SagaInstanceRecord.saga_type,
                func.count(SagaInstanceRecord.id).label('count')
            ).group_by(SagaInstanceRecord.saga_type)
            
            result = await session.execute(query)
            type_counts = {row.saga_type: row.count for row in result}
            
            return {
                "by_status": status_counts,
                "by_type": type_counts,
                "total": sum(status_counts.values()),
            }
    
    async def delete(self, saga_id: str) -> bool:
        """
        Delete a saga instance.
        
        Args:
            saga_id: The saga identifier
            
        Returns:
            True if saga was deleted, False if not found
        """
        async with get_db_session() as session:
            record = await session.get(SagaInstanceRecord, UUID(saga_id))
            
            if not record:
                return False
            
            await session.delete(record)
            await session.commit()
            
            logger.info("Saga instance deleted", saga_id=saga_id)
            return True
    
    def _record_to_saga_instance(self, record: SagaInstanceRecord) -> SagaInstance:
        """Convert database record to saga instance."""
        try:
            saga_data = record.saga_data
            
            # Reconstruct saga instance
            instance = SagaInstance(
                saga_id=str(record.id),
                saga_type=record.saga_type,
                status=record.status,
                correlation_id=record.correlation_id,
                context_data=record.context_data,
                current_step_index=record.current_step_index,
                created_at=record.created_at,
                started_at=record.started_at,
                completed_at=record.completed_at,
                error_message=record.error_message,
            )
            
            # Reconstruct steps
            if "steps" in saga_data:
                steps = []
                for step_data in saga_data["steps"]:
                    step = SagaStep.model_validate(step_data)
                    steps.append(step)
                instance.steps = steps
            
            return instance
            
        except Exception as e:
            logger.error(
                "Failed to deserialize saga instance",
                saga_id=str(record.id),
                error=str(e),
            )
            raise
