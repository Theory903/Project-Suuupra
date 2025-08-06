# Low-Level Design: Commerce Service

## 1. 🎯 Overview

This document provides the low-level design for the **Commerce Service**. This service is responsible for managing orders, inventory, and the shopping cart.

### 1.1. Learning Objectives

-   Implement the CQRS and Event Sourcing patterns.
-   Use the Saga pattern for distributed transactions.
-   Design and implement a state machine for order fulfillment.

---

## 2. 🏗️ Architecture

We use the **CQRS (Command Query Responsibility Segregation)** pattern to separate our write and read operations.

-   **Command Side**: Handles commands like `CreateOrder`, `AddItemToCart`, etc. This side is optimized for consistency.
-   **Query Side**: Handles queries for reading data. This side is optimized for performance with denormalized read models.

We use **Event Sourcing** to persist the state of our aggregates. Instead of storing the current state, we store a sequence of events.

---

## 3. 🗄️ Database Schema (PostgreSQL)

```sql
-- Event Store
CREATE TABLE events (
    id UUID PRIMARY KEY,
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
```

---

## 4. 🚀 Saga Pattern for Order Fulfillment

We use the **Saga pattern** to manage the long-running order fulfillment process, which involves multiple services.

**Saga Steps**:
1.  Reserve inventory.
2.  Process payment.
3.  Create shipment.
4.  Send confirmation email.

If any step fails, the saga executes compensating transactions to undo the previous steps.
