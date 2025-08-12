# **Service PRD: Commerce Service**

## 1. 🎯 The Challenge: Problem Statement & Mission

### **Problem Statement**

> As the Suuupra platform grows, managing orders and ensuring data consistency across multiple services becomes a significant challenge. A simple monolithic approach to order management will not scale and will lead to a tightly coupled and brittle system. The challenge is to build a highly available, scalable, and resilient order management system that can handle complex, multi-service order fulfillment while maintaining data consistency.

### **Mission**

> To build a sophisticated order management system that serves as the backbone of all monetization on the Suuupra platform, enabling seamless and reliable e-commerce experiences.

---

## 2. 🧠 The Gauntlet: Core Requirements & Edge Cases

### **Core Functional Requirements (FRs)**

| FR-ID | Feature                 | Description |
|-------|------------------------|-------------|
| FR-1  | **Order Management**    | The system can create, read, update, and delete orders. |
| FR-2  | **Shopping Cart**       | The system provides a persistent shopping cart for users. |
| FR-3  | **Inventory Management**| The system manages inventory for all products. |
| FR-4  | **Distributed Transactions** | The system can manage long-running, distributed transactions that span multiple microservices. |

### **Non-Functional Requirements (NFRs)**

| NFR-ID | Requirement       | Target          | Justification & Key Challenges |
|--------|------------------|----------------|--------------------------------|
| NFR-1  | **Data Consistency** | 100%            | The system must maintain data consistency across all services. Challenge: Implementing the Saga pattern for distributed transactions. |
| NFR-2  | **Scalability**      | 1000 orders/sec | The system must handle a high volume of orders. Challenge: Designing a scalable architecture with CQRS and Event Sourcing. |
| NFR-3  | **Availability**     | 99.99%          | The order management system is critical and must be highly available. Challenge: Implementing a fault-tolerant and resilient architecture. |

### **Edge Cases & Failure Scenarios**

- **Payment Failure:** If payment fails, the Saga triggers a compensating transaction to release the inventory.
- **Inventory Unavailability:** If out of stock, the system prevents the order and notifies the user.
- **Concurrent Updates:** Use optimistic locking to prevent race conditions when multiple users try to buy the last item.

---

## 3. 🗺️ The Blueprint: Architecture & Design

### **3.1. System Architecture Diagram**

```mermaid
graph TD
    A[API Gateway] --> B(Commerce Service)
    B --> C[(PostgreSQL)]
    B --> D[(Redis)]
    B --> E[Inventory Service]
    B --> F[Payment Service]
    B --> G[Notification Service]
    ```mermaid

3.2. Tech Stack Deep Dive

Component	Technology	Version	Justification & Key Considerations
Language/Framework	Python, FastAPI	3.11, 0.104	High-performance async framework for I/O-bound services.
Database	PostgreSQL, Redis	15, 7+	PostgreSQL for ACID transactions; Redis for caching and shopping carts.

3.3. Database Schema

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


⸻

4. 🚀 The Quest: Implementation Plan & Milestones

Phase 1: CQRS & Event Sourcing Foundation (Week 1)

Objective: Lay the foundation with CQRS and Event Sourcing.
Key Results:
	•	Service stores and replays events.
	•	Order aggregate implemented.

Tasks:
	•	CQRS Setup: Design separation between command and query models.
	•	Event Sourcing: Implement event store schema and Aggregate base class.
	•	Order Aggregate: Implement business logic and events.

⸻

Phase 2: Saga Pattern & State Machines (Week 2)

Objective: Implement order fulfillment with sagas and state machines.
Key Results:
	•	Order fulfillment saga orchestrates other services.
	•	Order state machine manages lifecycle.

Tasks:
	•	Order Fulfillment Saga: Design saga flow.
	•	Saga Orchestrator: Implement orchestrator.
	•	Order State Machine: Implement lifecycle states.

⸻

Phase 3: Shopping Cart & Inventory (Week 3)

Objective: Build cart and inventory management.
Key Results:
	•	Persistent shopping cart.
	•	Inventory management prevents overselling.

Tasks:
	•	Redis Cart: Implement Redis-based cart.
	•	Inventory Service: Implement with optimistic locking.

⸻

Phase 4: API, Testing & Deployment (Week 4)

Objective: Expose API, test, deploy.
Key Results:
	•	REST API ready.
	•	Fully tested and deployed.

Tasks:
	•	API Endpoints: Implement commands and queries.
	•	Testing: Unit, integration, end-to-end.
	•	Deployment: Dockerize and create Kubernetes manifests.

⸻

5. 🧪 Testing & Quality Strategy

Test Type	Tools	Coverage & Scenarios
Unit Tests	pytest	>90% coverage of aggregates, sagas, services.
Integration Tests	Testcontainers	Full order fulfillment process.
Load Tests	k6	High-volume order simulation.


⸻

6. 🔭 The Observatory: Monitoring & Alerting

KPIs:
	•	Technical: Order Processing Time, Saga Execution Time, Inventory Update Latency.
	•	Business: Orders per Hour, Conversion Rate, Cart Abandonment Rate.

Dashboards & Alerts:
	•	Grafana Dashboard: Real-time KPIs with drill-downs.
	•	Prometheus Alerts:
	•	HighOrderFailureRate: Trigger >1% failure.
	•	SagaFailure: Saga fails and needs manual fix.
	•	InventoryMismatch: Cached vs actual mismatch.

⸻

7. 📚 Learning & Knowledge Base

Key Concepts: CQRS, Event Sourcing, Saga Pattern, State Machines, Optimistic Locking.

Resources:
•CQRS Journey by Microsoft
•Saga Pattern
