# Commerce Service - Comprehensive TODO

## 1. 🎯 Overview & Learning Objectives

The **Commerce Service** is the backbone of all monetization on the Suuupra platform. It's a sophisticated order management system that handles everything from shopping carts to complex, multi-service order fulfillment. This service is an excellent opportunity to learn about advanced distributed systems patterns.

### **Why this stack?**

*   **Python/FastAPI**: FastAPI's asynchronous nature and high performance make it a great choice for an I/O-bound service like this. Python's readability and rich ecosystem are also a plus.
*   **PostgreSQL**: For its strong ACID guarantees and reliability, which are non-negotiable for an order management system.
*   **Redis**: Used for caching and for managing the user's shopping cart, where speed is critical.

### **Learning Focus**:

*   **CQRS (Command Query Responsibility Segregation)**: Learn to separate the write-side (commands) of your application from the read-side (queries) to optimize both.
*   **Event Sourcing**: Instead of storing the current state, you'll learn to store a sequence of events, providing a complete audit trail and enabling powerful features like time-travel debugging.
*   **Saga Pattern**: Master the saga pattern for managing long-running, distributed transactions that span multiple microservices.
*   **State Machines**: Design and implement state machines to manage the lifecycle of an order.

---

## 2. 🚀 Implementation Plan (4 Weeks)

### **Week 1: CQRS & Event Sourcing Foundation**

*   **Goal**: Lay the foundation for the service with CQRS and Event Sourcing.

*   **Tasks**:
    *   [ ] **CQRS Setup**: Design the separation between command and query models. Implement command handlers and a command dispatcher.
    *   [ ] **Event Sourcing**: Design the event store schema in PostgreSQL. Implement an `Aggregate` base class and the logic for storing and replaying events.
    *   [ ] **Order Aggregate**: Implement the `Order` aggregate with its business logic and associated events (`OrderCreated`, `OrderItemAdded`, etc.).

### **Week 2: Saga Pattern & State Machines**

*   **Goal**: Implement the order fulfillment process using sagas and state machines.

*   **Tasks**:
    *   [ ] **Order Fulfillment Saga**: Design the saga for order fulfillment, which will orchestrate the `Inventory`, `Payment`, and `Notification` services.
    *   [ ] **Saga Orchestrator**: Implement the saga orchestrator, which manages the state of the saga and executes the steps and compensations.
    *   [ ] **Order State Machine**: Design and implement a state machine for the order lifecycle (e.g., `DRAFT` -> `CONFIRMED` -> `PAID` -> `SHIPPED`).

### **Week 3: Shopping Cart & Inventory**

*   **Goal**: Build the shopping cart and inventory management features.

*   **Tasks**:
    *   [ ] **Redis Shopping Cart**: Implement a Redis-based shopping cart for fast reads and writes.
    *   [ ] **Inventory Service**: Build an inventory service with optimistic locking to prevent race conditions when multiple users try to reserve the same item.

### **Week 4: API, Testing & Deployment**

*   **Goal**: Expose the service via an API, write comprehensive tests, and prepare for deployment.

*   **Tasks**:
    *   [ ] **API Endpoints**: Implement the command and query API endpoints.
    *   [ ] **Testing**: Write unit tests for aggregates and sagas, and integration tests for the API endpoints.
    *   [ ] **Deployment**: Dockerize the service and write Kubernetes manifests.

---

## 3. 🗄️ Database & Cache Schema

### **PostgreSQL Schema**:

```sql
-- Event Store for Event Sourcing
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

-- Read model for orders
CREATE TABLE order_views (
    order_id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- Saga state persistence
CREATE TABLE saga_instances (
    saga_id UUID PRIMARY KEY,
    saga_type VARCHAR(100) NOT NULL,
    correlation_id UUID NOT NULL,
    current_step INTEGER NOT NULL,
    saga_data JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Redis Schema**:

```redis
# Shopping Cart (Hash)
HSET cart:{session_id} {product_id} {quantity}

# Inventory Cache (String)
SET inventory:{product_id} {available_quantity}
```