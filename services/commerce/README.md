# Commerce Service

A production-grade microservice implementing **CQRS**, **Event Sourcing**, and **Saga Pattern** for distributed order management and commerce operations.

## 🏗️ Architecture

The Commerce Service follows Domain-Driven Design (DDD) principles with:

- **CQRS (Command Query Responsibility Segregation)**: Separate read and write models
- **Event Sourcing**: Store all changes as a sequence of events
- **Saga Pattern**: Orchestrate distributed transactions across microservices
- **Domain Events**: Communicate state changes between bounded contexts

```mermaid
graph TB
    Client[Client] --> API[FastAPI REST API]
    API --> Commands[Command Handlers]
    API --> Queries[Query Handlers]
    
    Commands --> Aggregates[Domain Aggregates]
    Aggregates --> EventStore[(Event Store<br/>PostgreSQL)]
    Aggregates --> EventBus[Event Bus<br/>Redis Streams]
    
    EventBus --> Sagas[Saga Orchestrators]
    EventBus --> Projections[Read Model Projections]
    
    Queries --> ReadModels[(Read Models<br/>PostgreSQL)]
    
    Sagas --> ExternalServices[External Services<br/>Payment, Inventory, Shipping]
    
    ShoppingCart[Shopping Cart] --> Redis[(Redis)]
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ (for local development)
- Make (optional, for convenience commands)

### 1. Clone and Setup

```bash
cd services/commerce
cp .env.example .env
make quick-start
```

This will:
- Start all services (PostgreSQL, Redis, Commerce API, Prometheus, Grafana, Jaeger)
- Initialize the database
- Set up monitoring dashboards

### 2. Access Services

- **API Documentation**: http://localhost:8084/docs
- **Health Check**: http://localhost:8084/health
- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Jaeger Tracing**: http://localhost:16686
- **Prometheus**: http://localhost:9091

### 3. Test the API

```bash
# Create a shopping cart
curl -X POST "http://localhost:8084/api/v1/cart/" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json"

# Add item to cart
curl -X POST "http://localhost:8084/api/v1/cart/{cart_id}/items" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "product-123",
    "product_name": "Sample Product",
    "quantity": 2,
    "unit_price": "29.99"
  }'
```

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies
make install

# Start development environment
make dev

# Run tests
make test

# Check code quality
make lint
make format

# View logs
make dev-logs
```

### Project Structure

```
src/commerce/
├── api/                    # FastAPI routes and API layer
│   └── v1/
│       ├── routes/         # API route handlers
│       └── router.py       # Main API router
├── config/                 # Configuration management
├── domain/                 # Domain layer (DDD)
│   ├── aggregates/         # Domain aggregates
│   ├── entities/           # Domain entities
│   └── events/             # Domain events
├── infrastructure/         # Infrastructure layer
│   ├── messaging/          # Event bus and messaging
│   └── persistence/        # Data persistence
└── utils/                  # Utilities and cross-cutting concerns
```

### Key Components

#### 1. Shopping Cart (Redis-based)

```python
# Create cart
cart = await cart_repo.create_cart(customer_id="user-123")

# Add items
cart.add_item(
    product_id="prod-456",
    product_name="Widget",
    quantity=2,
    unit_price=Decimal("19.99")
)

# Save with TTL
await cart_repo.save(cart)
```

#### 2. Order Aggregate (Event Sourcing)

```python
# Create order from cart
order = OrderAggregate()
order.create_order(
    customer_id="user-123",
    items=cart_items,
    payment_method=PaymentMethod.CREDIT_CARD,
    shipping_address=address
)

# Events are automatically generated
events = order.uncommitted_events  # [OrderCreatedEvent, ...]

# Persist to event store
await aggregate_repo.save(order)
```

#### 3. Saga Orchestration

```python
# Order fulfillment saga coordinates:
# 1. Payment authorization
# 2. Inventory reservation
# 3. Shipping arrangement
# 4. Order confirmation
# + Compensating transactions if any step fails
```

## 🧪 Testing

### Unit Tests

```bash
make test
```

Tests domain logic, aggregates, and business rules without external dependencies.

### Integration Tests

```bash
make test-integration
```

Tests API endpoints, database interactions, and service integration using Testcontainers.

### Load Tests

```bash
make test-load
```

Performance testing using Locust to simulate concurrent users and high traffic scenarios.

## 📊 Monitoring & Observability

### Metrics (Prometheus)

Key metrics tracked:
- HTTP request rates and latency
- Cart operations and abandonment rates
- Order processing times and success rates
- Saga execution metrics
- Event store performance

### Tracing (Jaeger)

Distributed tracing for:
- End-to-end request flows
- Cross-service communication
- Saga step execution
- Database and Redis operations

### Logging (Structured JSON)

All logs include:
- Request correlation IDs
- User context
- Business context (cart ID, order ID, etc.)
- Performance metrics

## 🔒 Security

### Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- Resource-level permissions
- API rate limiting

### Data Protection

- Input validation with Pydantic
- SQL injection prevention
- Sensitive data encryption
- GDPR compliance features

## 🚢 Deployment

### Docker

```bash
# Build image
make docker-build

# Run container
make docker-run
```

### Production Environment

```bash
# Start production stack
make prod

# View production logs
make prod-logs
```

### Environment Variables

Key configuration options:

```bash
# Application
ENVIRONMENT=production
PORT=8084

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0

# External Services
PAYMENT_SERVICE_URL=http://payment-service:8086
INVENTORY_SERVICE_URL=http://inventory-service:8087

# Observability
JAEGER_ENDPOINT=http://jaeger:14268
ENABLE_TRACING=true
```

## 📚 API Documentation

### Shopping Cart Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/cart/` | Create new cart |
| GET | `/api/v1/cart/active` | Get active cart |
| POST | `/api/v1/cart/{id}/items` | Add item to cart |
| PUT | `/api/v1/cart/{id}/items/{product_id}` | Update item quantity |
| DELETE | `/api/v1/cart/{id}/items/{product_id}` | Remove item |
| DELETE | `/api/v1/cart/{id}` | Delete cart |

### Order Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/orders/` | Create order from cart |
| GET | `/api/v1/orders/` | List customer orders |
| GET | `/api/v1/orders/{id}` | Get order details |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/sagas` | List saga instances |
| POST | `/api/v1/admin/sagas/{id}/retry` | Retry failed saga |
| GET | `/api/v1/admin/analytics/carts` | Cart analytics |

## 🔧 Configuration

### Feature Flags

```bash
ENABLE_SAGA_ORCHESTRATION=true    # Enable saga pattern
ENABLE_EVENT_SOURCING=true        # Enable event sourcing
ENABLE_CQRS=true                  # Enable CQRS pattern
ENABLE_OPTIMISTIC_LOCKING=true    # Enable optimistic concurrency
```

### Business Rules

```bash
CART_TTL_HOURS=24                 # Cart expiration time
ORDER_TIMEOUT_MINUTES=30          # Order processing timeout
SAGA_RETRY_ATTEMPTS=3             # Max saga retry attempts
SAGA_RETRY_DELAY_SECONDS=5        # Saga retry delay
```

## 🤝 Contributing

1. Follow the existing code structure and patterns
2. Write tests for new features
3. Update documentation
4. Ensure all checks pass: `make lint test`

## 📄 License

This project is part of the Suuupra platform and is proprietary software.

## 🆘 Support

For issues and questions:
- Check the API documentation at `/docs`
- Review logs: `make logs`
- Check service health: `make health`
- Open an issue in the repository

---

**Built with ❤️ using FastAPI, PostgreSQL, Redis, and modern Python practices.**
