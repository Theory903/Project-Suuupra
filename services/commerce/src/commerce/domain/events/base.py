"""
Base domain event classes for Event Sourcing pattern.

All domain events inherit from DomainEvent to ensure consistent structure
and metadata for event store persistence and replay.
"""

import uuid
from abc import ABC
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class DomainEvent(BaseModel, ABC):
    """
    Base class for all domain events in the Commerce Service.
    
    Events are immutable records of something that happened in the domain.
    They contain all necessary information to reconstruct aggregate state.
    """
    
    # Event metadata
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique event identifier")
    event_type: str = Field(description="Event type name")
    event_version: int = Field(default=1, description="Event schema version for evolution")
    
    # Aggregate information
    aggregate_id: str = Field(description="ID of the aggregate that produced this event")
    aggregate_type: str = Field(description="Type of the aggregate")
    aggregate_version: int = Field(description="Version of the aggregate after this event")
    
    # Temporal information
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="When the event occurred")
    
    # Correlation and causation
    correlation_id: Optional[str] = Field(default=None, description="ID to correlate related events")
    causation_id: Optional[str] = Field(default=None, description="ID of the event that caused this event")
    
    # User context
    user_id: Optional[str] = Field(default=None, description="ID of the user who triggered this event")
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID for multi-tenancy")
    
    # Additional metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional event metadata")
    
    def __init__(self, **data):
        # Auto-set event_type from class name if not provided
        if "event_type" not in data:
            data["event_type"] = self.__class__.__name__
        
        # Auto-set aggregate_type from aggregate_id prefix if not provided
        if "aggregate_type" not in data and "aggregate_id" in data:
            # Assume format like "order-uuid" or "inventory-uuid"
            parts = data["aggregate_id"].split("-", 1)
            if len(parts) > 1:
                data["aggregate_type"] = parts[0]
        
        super().__init__(**data)
    
    class Config:
        """Pydantic configuration."""
        frozen = True  # Events are immutable
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary for storage."""
        return self.model_dump(mode="json")
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DomainEvent":
        """Create event from dictionary."""
        return cls.model_validate(data)


class EventMetadata(BaseModel):
    """Metadata associated with domain events."""
    
    # Request context
    request_id: Optional[str] = None
    session_id: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    
    # Business context
    channel: Optional[str] = None  # web, mobile, api, etc.
    source: Optional[str] = None   # service that originated the event
    
    # Technical context
    service_version: Optional[str] = None
    environment: Optional[str] = None
    
    class Config:
        """Pydantic configuration."""
        frozen = True

