# Commerce Service

## Overview

Production-grade Commerce Service implementing CQRS, Event Sourcing, and Saga patterns for order management, shopping cart, and inventory with 100% data consistency.

## Quick Start

```bash
cd services/commerce
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
make dev

# Health check
curl localhost:8084/health
```

## Architecture Patterns

### CQRS (Command Query Responsibility Segregation)
- **Commands**: Write operations (CreateOrder, AddToCart)
- **Queries**: Read operations (GetOrder, ListOrders)
- **Separation**: Optimized write/read models

### Event Sourcing
- **Event Store**: Immutable sequence of domain events
- **State Reconstruction**: Replay events to build current state
- **Audit Trail**: Complete history of all changes

### Saga Pattern
- **Orchestration**: Manage distributed transactions
- **Compensation**: Rollback on failures
- **Long-running**: Handle multi-step business processes

## Core Features

### Order Management
- Order creation with saga orchestration
- Multi-step fulfillment process
- Compensating transactions on failures
- Order status tracking and history

### Shopping Cart
- Redis-based persistent cart
- Atomic add/remove operations
- TTL-based expiration
- Cart abandonment tracking

### Inventory Management
- Optimistic locking for concurrency
- Real-time stock tracking
- Reservation and release mechanisms
- Conflict resolution strategies

## API Endpoints

### Shopping Cart
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/cart` | Create cart |
| GET | `/api/v1/cart/{id}` | Get cart |
| PUT | `/api/v1/cart/{id}/items` | Add/update items |
| DELETE | `/api/v1/cart/{id}/items/{productId}` | Remove item |
| POST | `/api/v1/cart/{id}/checkout` | Checkout cart |

### Order Management
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/orders` | Create order (triggers saga) |
| GET | `/api/v1/orders/{id}` | Get order details |
| GET | `/api/v1/orders` | List orders |
| POST | `/api/v1/orders/{id}/cancel` | Cancel order |
| GET | `/api/v1/orders/{id}/events` | Get order event history |

### Inventory
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/inventory/{productId}` | Get stock status |
| POST | `/api/v1/inventory/{productId}/reserve` | Reserve inventory |
| POST | `/api/v1/inventory/{productId}/release` | Release reservation |

### Admin Operations
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/admin/sagas` | List saga instances |
| POST | `/api/v1/admin/sagas/{id}/retry` | Retry failed saga |
| POST | `/api/v1/admin/sagas/{id}/compensate` | Trigger compensation |
| GET | `/api/v1/admin/events` | Query event store |

## Data Models

### Order Aggregate
```python
@dataclass
class Order:
    id: OrderId
    customer_id: CustomerId
    items: List[OrderItem]
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    version: int
    
    def apply_event(self, event: DomainEvent) -> None:
        """Apply domain event to update aggregate state"""
```

### Domain Events
```python
@dataclass
class OrderCreatedEvent(DomainEvent):
    order_id: OrderId
    customer_id: CustomerId
    items: List[OrderItem]
    total_amount: Decimal

@dataclass
class PaymentProcessedEvent(DomainEvent):
    order_id: OrderId
    payment_id: PaymentId
    amount: Decimal
```

### Saga State
```python
@dataclass
class OrderFulfillmentSaga:
    saga_id: SagaId
    order_id: OrderId
    current_step: SagaStep
    compensation_steps: List[CompensationStep]
    data: Dict[str, Any]
    status: SagaStatus
```

## Event Store Schema

```sql
-- Event Store
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(aggregate_id, version)
);

-- Read Model: Orders
CREATE TABLE order_views (
    order_id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- Saga State
CREATE TABLE sagas (
    saga_id UUID PRIMARY KEY,
    saga_type VARCHAR(100) NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    saga_data JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Order Fulfillment Saga

### Saga Steps
1. **Reserve Inventory** → Inventory Service
2. **Process Payment** → Payment Service
3. **Create Shipment** → Shipping Service
4. **Confirm Order** → Update order status

### Compensation Steps
1. **Release Inventory** ← Inventory Service
2. **Refund Payment** ← Payment Service
3. **Cancel Shipment** ← Shipping Service
4. **Cancel Order** ← Update order status

```python
class OrderFulfillmentSaga:
    async def execute(self, saga_data: SagaData) -> None:
        try:
            # Step 1: Reserve Inventory
            await self.reserve_inventory(saga_data)
            
            # Step 2: Process Payment
            await self.process_payment(saga_data)
            
            # Step 3: Create Shipment
            await self.create_shipment(saga_data)
            
            # Step 4: Confirm Order
            await self.confirm_order(saga_data)
            
        except SagaExecutionError as e:
            await self.compensate(saga_data, e.failed_step)
```

## Shopping Cart Implementation

### Redis Data Structure
```python
# Cart structure in Redis
cart_key = f"cart:{user_id}"
cart_data = {
    "items": {
        "product_1": {"quantity": 2, "price": 29.99},
        "product_2": {"quantity": 1, "price": 49.99}
    },
    "total": 109.97,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:35:00Z"
}
```

### Cart Operations
```python
class CartService:
    async def add_item(self, user_id: str, item: CartItem) -> Cart:
        cart_key = f"cart:{user_id}"
        async with self.redis.pipeline() as pipe:
            await pipe.hset(cart_key, item.product_id, item.to_json())
            await pipe.expire(cart_key, self.ttl_seconds)
            await pipe.execute()
```

## Inventory Management

### Optimistic Locking
```python
class InventoryAggregate:
    def reserve_items(self, items: List[CartItem]) -> List[DomainEvent]:
        events = []
        for item in items:
            current_stock = self.get_stock(item.product_id)
            
            # Check availability
            if current_stock.quantity < item.quantity:
                raise InsufficientStockError(item.product_id)
            
            # Check version for optimistic locking
            if current_stock.version != item.expected_version:
                raise ConcurrencyConflictError(item.product_id)
            
            events.append(InventoryReservedEvent(
                product_id=item.product_id,
                quantity=item.quantity,
                reservation_id=uuid4()
            ))
        
        return events
```

## Configuration

### Database Settings
```yaml
database:
  postgresql:
    host: localhost
    port: 5432
    database: commerce
    user: commerce
    password: commerce
    pool_size: 10

redis:
  host: localhost
  port: 6379
  db: 0
  max_connections: 20
```

### Saga Configuration
```yaml
sagas:
  order_fulfillment:
    timeout: 300  # 5 minutes
    retry_attempts: 3
    retry_delay: 5  # seconds
    compensation_timeout: 60  # 1 minute
```

## Monitoring

### Key Metrics
- `commerce_orders_total` - Order counter by status
- `commerce_saga_duration_seconds` - Saga execution time
- `commerce_inventory_conflicts_total` - Optimistic locking conflicts
- `commerce_cart_operations_total` - Cart operation counter

### Business KPIs
- Orders per hour
- Cart abandonment rate
- Inventory turnover
- Saga success rate

### Health Checks
- PostgreSQL connectivity
- Redis connectivity
- Event store integrity
- Saga execution status

## Error Handling

### Saga Failures
```python
class SagaCompensationHandler:
    async def handle_payment_failure(self, saga_data: SagaData) -> None:
        # Release reserved inventory
        await self.inventory_service.release_reservation(
            saga_data.inventory_reservation_id
        )
        
        # Update order status
        await self.order_service.mark_as_failed(
            saga_data.order_id,
            reason="Payment processing failed"
        )
```

### Inventory Conflicts
```python
@retry(max_attempts=3, backoff=ExponentialBackoff())
async def reserve_inventory(self, items: List[CartItem]) -> ReservationResult:
    try:
        return await self.inventory_service.reserve(items)
    except ConcurrencyConflictError:
        # Refresh item versions and retry
        refreshed_items = await self.refresh_item_versions(items)
        return await self.inventory_service.reserve(refreshed_items)
```

## Development

### Local Setup
```bash
# Prerequisites
python >= 3.11
postgresql >= 15
redis >= 7

# Virtual environment
python -m venv venv
source venv/bin/activate

# Dependencies
pip install -r requirements.txt

# Database setup
make db-migrate

# Start services
make dev
```

### Testing
```bash
pytest tests/unit/           # Unit tests
pytest tests/integration/    # Integration tests
pytest tests/load/          # Load tests
```

### Event Sourcing Testing
```python
def test_order_creation_saga():
    # Given
    saga = OrderFulfillmentSaga()
    order_data = create_test_order_data()
    
    # When
    events = saga.execute(order_data)
    
    # Then
    assert len(events) == 4
    assert events[0].event_type == "InventoryReserved"
    assert events[1].event_type == "PaymentProcessed"
    assert events[2].event_type == "ShipmentCreated"
    assert events[3].event_type == "OrderConfirmed"
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Saga timeout | Long-running external service call | Increase timeout or implement async processing |
| Inventory conflict | High concurrency on popular items | Implement retry with exponential backoff |
| Event store corruption | Database integrity issue | Run event store validation and repair |
| Cart not found | Redis eviction or expiry | Implement cart recovery from order history |
