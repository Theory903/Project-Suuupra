"""
Kafka Producer with Avro schema support for Commerce Service.

Handles publishing order events to Kafka topics with schema registry integration.
"""

import json
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

import structlog
from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
import fastavro

from ...domain.events.base import DomainEvent
from ...config.settings import get_settings

logger = structlog.get_logger(__name__)


class KafkaAvroProducer:
    """
    Kafka producer with Avro schema support for order events.
    
    Publishes domain events to Kafka topics with automatic schema validation
    and registry integration for backward/forward compatibility.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.producer: Optional[AIOKafkaProducer] = None
        self.schema_registry_client: Optional[SchemaRegistryClient] = None
        self.serializers: Dict[str, AvroSerializer] = {}
        self.schemas: Dict[str, Dict[str, Any]] = {}
        self._setup_schemas()
    
    def _setup_schemas(self):
        """Define Avro schemas for different event types."""
        
        # Order Created Event Schema
        self.schemas['order.created'] = {
            "type": "record",
            "name": "OrderCreatedEvent",
            "namespace": "com.suuupra.commerce.events",
            "fields": [
                {"name": "event_id", "type": "string"},
                {"name": "event_type", "type": "string"},
                {"name": "aggregate_id", "type": "string"},
                {"name": "aggregate_type", "type": "string"},
                {"name": "occurred_at", "type": "string"},
                {"name": "version", "type": "int", "default": 1},
                {"name": "order_id", "type": "string"},
                {"name": "customer_id", "type": "string"},
                {"name": "total_amount", "type": "string"},
                {"name": "currency", "type": "string"},
                {"name": "status", "type": "string"},
                {"name": "payment_method", "type": "string"},
                {"name": "items", "type": {
                    "type": "array",
                    "items": {
                        "type": "record",
                        "name": "OrderItem",
                        "fields": [
                            {"name": "product_id", "type": "string"},
                            {"name": "product_name", "type": "string"},
                            {"name": "quantity", "type": "int"},
                            {"name": "unit_price", "type": "string"}
                        ]
                    }
                }},
                {"name": "shipping_address", "type": {
                    "type": "record",
                    "name": "ShippingAddress",
                    "fields": [
                        {"name": "recipient_name", "type": "string"},
                        {"name": "street", "type": "string"},
                        {"name": "city", "type": "string"},
                        {"name": "state", "type": "string"},
                        {"name": "postal_code", "type": "string"},
                        {"name": "country", "type": "string"}
                    ]
                }},
                {"name": "metadata", "type": {
                    "type": "map",
                    "values": "string"
                }, "default": {}}
            ]
        }
        
        # Order Updated Event Schema
        self.schemas['order.updated'] = {
            "type": "record",
            "name": "OrderUpdatedEvent",
            "namespace": "com.suuupra.commerce.events",
            "fields": [
                {"name": "event_id", "type": "string"},
                {"name": "event_type", "type": "string"},
                {"name": "aggregate_id", "type": "string"},
                {"name": "aggregate_type", "type": "string"},
                {"name": "occurred_at", "type": "string"},
                {"name": "version", "type": "int", "default": 1},
                {"name": "order_id", "type": "string"},
                {"name": "customer_id", "type": "string"},
                {"name": "previous_status", "type": "string"},
                {"name": "new_status", "type": "string"},
                {"name": "updated_by", "type": "string"},
                {"name": "reason", "type": ["null", "string"], "default": None},
                {"name": "changes", "type": {
                    "type": "map",
                    "values": "string"
                }, "default": {}},
                {"name": "metadata", "type": {
                    "type": "map",
                    "values": "string"
                }, "default": {}}
            ]
        }
        
        # Order Cancelled Event Schema
        self.schemas['order.cancelled'] = {
            "type": "record",
            "name": "OrderCancelledEvent",
            "namespace": "com.suuupra.commerce.events",
            "fields": [
                {"name": "event_id", "type": "string"},
                {"name": "event_type", "type": "string"},
                {"name": "aggregate_id", "type": "string"},
                {"name": "aggregate_type", "type": "string"},
                {"name": "occurred_at", "type": "string"},
                {"name": "version", "type": "int", "default": 1},
                {"name": "order_id", "type": "string"},
                {"name": "customer_id", "type": "string"},
                {"name": "previous_status", "type": "string"},
                {"name": "cancellation_reason", "type": "string"},
                {"name": "cancelled_by", "type": "string"},
                {"name": "refund_amount", "type": "string"},
                {"name": "inventory_to_release", "type": {
                    "type": "array",
                    "items": {
                        "type": "record",
                        "name": "InventoryItem",
                        "fields": [
                            {"name": "product_id", "type": "string"},
                            {"name": "quantity", "type": "int"}
                        ]
                    }
                }},
                {"name": "metadata", "type": {
                    "type": "map",
                    "values": "string"
                }, "default": {}}
            ]
        }
    
    async def start(self):
        """Initialize Kafka producer and schema registry client."""
        try:
            # Initialize Kafka producer
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.settings.kafka_bootstrap_servers,
                value_serializer=None,  # We'll handle serialization manually
                key_serializer=lambda x: x.encode('utf-8') if x else None,
                acks='all',  # Wait for all replicas to acknowledge
                retries=3,
                retry_backoff_ms=100,
                request_timeout_ms=30000,
                enable_idempotence=True,  # Ensure exactly-once semantics
                compression_type='snappy'
            )
            
            await self.producer.start()
            
            # Initialize Schema Registry client
            if self.settings.schema_registry_url:
                self.schema_registry_client = SchemaRegistryClient({
                    'url': self.settings.schema_registry_url
                })
                
                # Register schemas and create serializers
                for event_type, schema in self.schemas.items():
                    subject = f"commerce-{event_type}-value"
                    try:
                        # Register schema
                        schema_id = self.schema_registry_client.register_schema(
                            subject, fastavro.parse_schema(schema)
                        )
                        
                        # Create serializer
                        self.serializers[event_type] = AvroSerializer(
                            self.schema_registry_client,
                            json.dumps(schema)
                        )
                        
                        logger.info(
                            "Schema registered successfully",
                            event_type=event_type,
                            subject=subject,
                            schema_id=schema_id
                        )
                        
                    except Exception as e:
                        logger.warning(
                            "Failed to register schema",
                            event_type=event_type,
                            subject=subject,
                            error=str(e)
                        )
            
            logger.info("Kafka Avro producer started successfully")
            
        except Exception as e:
            logger.error("Failed to start Kafka producer", error=str(e))
            raise
    
    async def stop(self):
        """Stop the Kafka producer."""
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka producer stopped")
    
    async def publish_event(self, event: DomainEvent, topic: Optional[str] = None) -> bool:
        """
        Publish a domain event to Kafka with Avro serialization.
        
        Args:
            event: The domain event to publish
            topic: Optional topic override (defaults to event-type-based topic)
            
        Returns:
            True if published successfully, False otherwise
        """
        if not self.producer:
            logger.error("Kafka producer not initialized")
            return False
        
        event_type = event.event_type
        topic_name = topic or f"commerce.{event_type.replace('.', '-')}"
        
        try:
            # Prepare event data
            event_data = self._prepare_event_data(event)
            
            # Serialize with Avro if schema registry is available
            if event_type in self.serializers:
                serialized_value = self.serializers[event_type](event_data, None)
            else:
                # Fallback to JSON serialization
                serialized_value = json.dumps(event_data).encode('utf-8')
                logger.warning(
                    "No Avro serializer found, using JSON",
                    event_type=event_type
                )
            
            # Publish to Kafka
            await self.producer.send_and_wait(
                topic_name,
                value=serialized_value,
                key=event.aggregate_id,
                headers={
                    'event_type': event_type.encode('utf-8'),
                    'aggregate_type': event.aggregate_type.encode('utf-8'),
                    'event_id': event.event_id.encode('utf-8'),
                    'correlation_id': getattr(event, 'correlation_id', '').encode('utf-8'),
                    'producer_service': 'commerce'.encode('utf-8'),
                    'schema_version': '1'.encode('utf-8')
                }
            )
            
            logger.info(
                "Event published successfully",
                event_type=event_type,
                aggregate_id=event.aggregate_id,
                topic=topic_name,
                event_id=event.event_id
            )
            
            return True
            
        except KafkaError as e:
            logger.error(
                "Kafka error publishing event",
                event_type=event_type,
                aggregate_id=event.aggregate_id,
                topic=topic_name,
                error=str(e)
            )
            return False
            
        except Exception as e:
            logger.error(
                "Unexpected error publishing event",
                event_type=event_type,
                aggregate_id=event.aggregate_id,
                topic=topic_name,
                error=str(e)
            )
            return False
    
    def _prepare_event_data(self, event: DomainEvent) -> Dict[str, Any]:
        """
        Prepare event data for serialization.
        
        Args:
            event: The domain event
            
        Returns:
            Dictionary with event data
        """
        # Get base event data
        event_dict = event.model_dump(mode='json')
        
        # Add required fields
        event_dict.update({
            'event_id': event.event_id,
            'event_type': event.event_type,
            'aggregate_id': event.aggregate_id,
            'aggregate_type': event.aggregate_type,
            'occurred_at': event.occurred_at.isoformat(),
            'version': 1
        })
        
        # Add metadata
        event_dict['metadata'] = {
            'service': 'commerce',
            'environment': self.settings.environment,
            'correlation_id': getattr(event, 'correlation_id', ''),
            'causation_id': getattr(event, 'causation_id', ''),
        }
        
        return event_dict


# Global producer instance
_kafka_producer: Optional[KafkaAvroProducer] = None


async def init_kafka_producer() -> None:
    """Initialize the global Kafka producer."""
    global _kafka_producer
    _kafka_producer = KafkaAvroProducer()
    await _kafka_producer.start()
    logger.info("Kafka producer initialized")


async def close_kafka_producer() -> None:
    """Close the global Kafka producer."""
    global _kafka_producer
    if _kafka_producer:
        await _kafka_producer.stop()
        _kafka_producer = None
        logger.info("Kafka producer closed")


def get_kafka_producer() -> KafkaAvroProducer:
    """Get the global Kafka producer instance."""
    if _kafka_producer is None:
        raise RuntimeError("Kafka producer not initialized. Call init_kafka_producer() first.")
    return _kafka_producer