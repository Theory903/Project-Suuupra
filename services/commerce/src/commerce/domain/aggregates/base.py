"""
Base aggregate class for Event Sourcing pattern.

Aggregates are the consistency boundaries in DDD and the source of domain events
in Event Sourcing. They encapsulate business logic and maintain invariants.
"""

import uuid
from abc import ABC, abstractmethod
from typing import List, Type, Dict, Any, Optional

from ..events.base import DomainEvent


class AggregateRoot(ABC):
    """
    Base class for all aggregates in the Commerce Service.
    
    Implements the Event Sourcing pattern where state changes are captured
    as domain events rather than direct state mutations.
    """
    
    def __init__(self, aggregate_id: Optional[str] = None):
        self._aggregate_id = aggregate_id or str(uuid.uuid4())
        self._version = 0
        self._uncommitted_events: List[DomainEvent] = []
        self._event_handlers: Dict[Type[DomainEvent], str] = {}
        
        # Register event handlers automatically
        self._register_event_handlers()
    
    @property
    def aggregate_id(self) -> str:
        """Get the aggregate identifier."""
        return self._aggregate_id
    
    @property
    def version(self) -> int:
        """Get the current version of the aggregate."""
        return self._version
    
    @property
    def uncommitted_events(self) -> List[DomainEvent]:
        """Get the list of uncommitted events."""
        return self._uncommitted_events.copy()
    
    def mark_events_as_committed(self) -> None:
        """Mark all uncommitted events as committed."""
        self._uncommitted_events.clear()
    
    def load_from_history(self, events: List[DomainEvent]) -> None:
        """
        Reconstruct aggregate state from historical events.
        
        This is the core of Event Sourcing - rebuilding current state
        from the sequence of events that led to it.
        """
        for event in events:
            self._apply_event(event, is_new=False)
            self._version = event.aggregate_version
    
    def _apply_event(self, event: DomainEvent, is_new: bool = True) -> None:
        """
        Apply an event to the aggregate.
        
        Args:
            event: The domain event to apply
            is_new: Whether this is a new event (should be added to uncommitted)
        """
        # Find and call the appropriate event handler
        event_type = type(event)
        handler_name = self._event_handlers.get(event_type)
        
        if handler_name:
            handler = getattr(self, handler_name)
            handler(event)
        else:
            # Log warning but don't fail - allows for event schema evolution
            print(f"Warning: No handler found for event {event_type.__name__}")
        
        if is_new:
            self._uncommitted_events.append(event)
    
    def _raise_event(self, event: DomainEvent) -> None:
        """
        Raise a new domain event.
        
        This is how aggregates communicate state changes to the outside world.
        """
        # Set aggregate metadata on the event
        event.aggregate_id = self._aggregate_id
        event.aggregate_type = self.__class__.__name__.replace("Aggregate", "").lower()
        event.aggregate_version = self._version + 1
        
        # Apply the event to update aggregate state
        self._apply_event(event, is_new=True)
        self._version += 1
    
    def _register_event_handlers(self) -> None:
        """
        Automatically register event handlers based on method naming convention.
        
        Methods named 'on_{EventName}' will be registered as handlers for that event.
        """
        for attr_name in dir(self):
            if attr_name.startswith('on_') and callable(getattr(self, attr_name)):
                # Convert method name to event class name
                event_name = attr_name[3:]  # Remove 'on_' prefix
                
                # Try to find the corresponding event class
                # This is a simplified approach - in practice, you might want
                # a more sophisticated event type registry
                try:
                    # Import all event modules to ensure classes are available
                    from ..events import order_events
                    from ..events import inventory_events
                    
                    # Look for the event class in the events modules
                    for module in [order_events, inventory_events]:
                        if hasattr(module, event_name):
                            event_class = getattr(module, event_name)
                            if issubclass(event_class, DomainEvent):
                                self._event_handlers[event_class] = attr_name

                                break
                except ImportError:
                    # Handle case where event modules don't exist yet
                    pass
    
    @abstractmethod
    def get_snapshot(self) -> Dict[str, Any]:
        """
        Get a snapshot of the current aggregate state.
        
        Snapshots are used to optimize event sourcing by avoiding
        replaying all events from the beginning.
        """
        pass
    
    @abstractmethod
    def load_from_snapshot(self, snapshot: Dict[str, Any]) -> None:
        """
        Load aggregate state from a snapshot.
        
        Args:
            snapshot: The snapshot data to load from
        """
        pass


class AggregateNotFoundError(Exception):
    """Raised when an aggregate cannot be found."""
    
    def __init__(self, aggregate_id: str, aggregate_type: str):
        self.aggregate_id = aggregate_id
        self.aggregate_type = aggregate_type
        super().__init__(f"{aggregate_type} with ID {aggregate_id} not found")


class ConcurrencyConflictError(Exception):
    """Raised when there's a concurrency conflict during aggregate updates."""
    
    def __init__(self, aggregate_id: str, expected_version: int, actual_version: int):
        self.aggregate_id = aggregate_id
        self.expected_version = expected_version
        self.actual_version = actual_version
        super().__init__(
            f"Concurrency conflict for aggregate {aggregate_id}: "
            f"expected version {expected_version}, but actual version is {actual_version}"
        )

