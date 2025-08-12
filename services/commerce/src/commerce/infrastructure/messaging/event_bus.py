"""
Event bus implementation for Commerce Service.

Provides event publishing and subscription capabilities using Redis Streams.
"""

import json
import asyncio
from typing import Dict, List, Callable, Any, Optional
from datetime import datetime, timezone

import structlog
from redis.asyncio import Redis

from ..redis import get_redis_client
from ...domain.events.base import DomainEvent

logger = structlog.get_logger(__name__)


class EventBus:
    """
    Redis Streams-based event bus for publishing and consuming domain events.
    
    Supports event publishing, subscription, and consumer groups for
    distributed event processing.
    """
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis = redis_client or get_redis_client()
        self.subscribers: Dict[str, List[Callable]] = {}
        self.consumer_tasks: List[asyncio.Task] = []
        self.stream_prefix = "commerce:events:"
        self.consumer_group = "commerce-service"
    
    async def publish(self, event: DomainEvent) -> None:
        """
        Publish a domain event to the event stream.
        
        Args:
            event: The domain event to publish
        """
        stream_name = f"{self.stream_prefix}{event.aggregate_type}"
        
        # Serialize event data
        event_data = {
            "event_id": event.event_id,
            "event_type": event.event_type,
            "aggregate_id": event.aggregate_id,
            "aggregate_type": event.aggregate_type,
            "data": json.dumps(event.model_dump()),
            "timestamp": event.occurred_at.isoformat(),
        }
        
        try:
            # Add to Redis stream
            message_id = await self.redis.xadd(stream_name, event_data)
            
            logger.debug(
                "Event published",
                event_type=event.event_type,
                aggregate_id=event.aggregate_id,
                stream=stream_name,
                message_id=message_id,
            )
            
        except Exception as e:
            logger.error(
                "Failed to publish event",
                event_type=event.event_type,
                aggregate_id=event.aggregate_id,
                error=str(e),
            )
            raise
    
    async def subscribe(
        self,
        event_type: str,
        handler: Callable[[DomainEvent], None],
        consumer_name: Optional[str] = None,
    ) -> None:
        """
        Subscribe to events of a specific type.
        
        Args:
            event_type: The event type to subscribe to
            handler: The handler function to call for each event
            consumer_name: Optional consumer name for tracking
        """
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        
        self.subscribers[event_type].append(handler)
        
        logger.info(
            "Event handler registered",
            event_type=event_type,
            handler=handler.__name__,
            consumer_name=consumer_name,
        )
    
    async def start_consuming(self) -> None:
        """Start consuming events from all subscribed streams."""
        if not self.subscribers:
            logger.info("No event subscribers configured")
            return
        
        # Create consumer tasks for each event type
        for event_type in self.subscribers.keys():
            task = asyncio.create_task(
                self._consume_stream(event_type),
                name=f"consume-{event_type}"
            )
            self.consumer_tasks.append(task)
        
        logger.info(
            "Event consumption started",
            event_types=list(self.subscribers.keys()),
            consumer_count=len(self.consumer_tasks),
        )
    
    async def stop_consuming(self) -> None:
        """Stop consuming events and clean up tasks."""
        logger.info("Stopping event consumption")
        
        # Cancel all consumer tasks
        for task in self.consumer_tasks:
            if not task.done():
                task.cancel()
        
        # Wait for tasks to complete
        if self.consumer_tasks:
            await asyncio.gather(*self.consumer_tasks, return_exceptions=True)
        
        self.consumer_tasks.clear()
        logger.info("Event consumption stopped")
    
    async def _consume_stream(self, event_type: str) -> None:
        """
        Consume events from a specific stream.
        
        Args:
            event_type: The event type to consume
        """
        # For simplicity, we'll derive stream name from event type
        # In practice, you might want a more sophisticated mapping
        stream_name = f"{self.stream_prefix}order"  # Simplified for demo
        consumer_name = f"{self.consumer_group}-{event_type}"
        
        try:
            # Create consumer group if it doesn't exist
            try:
                await self.redis.xgroup_create(
                    stream_name,
                    self.consumer_group,
                    id="0",
                    mkstream=True
                )
            except Exception:
                # Group might already exist
                pass
            
            logger.info(
                "Starting event stream consumption",
                stream=stream_name,
                consumer=consumer_name,
                event_type=event_type,
            )
            
            while True:
                try:
                    # Read from stream
                    messages = await self.redis.xreadgroup(
                        self.consumer_group,
                        consumer_name,
                        {stream_name: ">"},
                        count=10,
                        block=1000,  # 1 second timeout
                    )
                    
                    for stream, msgs in messages:
                        for msg_id, fields in msgs:
                            await self._process_message(
                                event_type,
                                stream.decode(),
                                msg_id.decode(),
                                fields,
                            )
                            
                            # Acknowledge message
                            await self.redis.xack(
                                stream_name,
                                self.consumer_group,
                                msg_id
                            )
                
                except asyncio.CancelledError:
                    logger.info("Event consumption cancelled", event_type=event_type)
                    break
                except Exception as e:
                    logger.error(
                        "Error consuming events",
                        event_type=event_type,
                        error=str(e),
                    )
                    # Wait before retrying
                    await asyncio.sleep(5)
        
        except Exception as e:
            logger.error(
                "Fatal error in event consumption",
                event_type=event_type,
                error=str(e),
            )
    
    async def _process_message(
        self,
        event_type: str,
        stream_name: str,
        message_id: str,
        fields: Dict[bytes, bytes],
    ) -> None:
        """
        Process a single event message.
        
        Args:
            event_type: The event type being processed
            stream_name: The stream name
            message_id: The message ID
            fields: The message fields
        """
        try:
            # Decode fields
            decoded_fields = {
                k.decode(): v.decode() for k, v in fields.items()
            }
            
            # Check if this is the event type we're looking for
            if decoded_fields.get("event_type") != event_type:
                return
            
            # Deserialize event data
            event_data = json.loads(decoded_fields["data"])
            
            # Create event instance (simplified - in practice you'd use a registry)
            # For now, we'll just pass the raw data to handlers
            
            # Call all handlers for this event type
            handlers = self.subscribers.get(event_type, [])
            for handler in handlers:
                try:
                    await handler(event_data)
                except Exception as e:
                    logger.error(
                        "Event handler failed",
                        event_type=event_type,
                        handler=handler.__name__,
                        message_id=message_id,
                        error=str(e),
                    )
            
            logger.debug(
                "Event processed",
                event_type=event_type,
                message_id=message_id,
                handler_count=len(handlers),
            )
        
        except Exception as e:
            logger.error(
                "Failed to process event message",
                event_type=event_type,
                message_id=message_id,
                error=str(e),
            )


# Global event bus instance
_event_bus: Optional[EventBus] = None


async def init_event_bus() -> None:
    """Initialize the global event bus."""
    global _event_bus
    _event_bus = EventBus()
    logger.info("Event bus initialized")


async def close_event_bus() -> None:
    """Close the global event bus."""
    global _event_bus
    if _event_bus:
        await _event_bus.stop_consuming()
        _event_bus = None
        logger.info("Event bus closed")


def get_event_bus() -> EventBus:
    """Get the global event bus instance."""
    if _event_bus is None:
        raise RuntimeError("Event bus not initialized. Call init_event_bus() first.")
    return _event_bus

