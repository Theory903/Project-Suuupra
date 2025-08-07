# High-Level Design: Data Flow Architecture

## 1. 🌊 Introduction to Data Flow

This document outlines the data flow patterns and architectures that power the Suuupra platform. Understanding how data moves through our system is crucial for building scalable, resilient, and maintainable services. We will explore user journey data flows, our event-driven architecture, real-time processing pipelines, and the database patterns that support them.

**Key Learning Goals**:
- Understand how to design data flows for a complex, large-scale system.
- Learn about the trade-offs between different communication and consistency patterns.
- Gain insights into event-driven architecture, CQRS, and event sourcing.
- Explore polyglot persistence and data partitioning strategies.

---

## 2. 🔄 End-to-End Data Flow Patterns

Here we analyze the data flow for key user journeys.

### 2.1. User Registration & Authentication Flow

This is a critical flow that needs to be both secure and fast.

```mermaid
sequenceDiagram
    participant U as User
    participant AG as API Gateway
    participant ID as Identity Service
    participant DB as PostgreSQL
    participant R as Redis
    participant K as Kafka

    U->>AG: POST /auth/register (email, password)
    AG->>ID: Validate & Create User
    ID->>DB: Store user profile in PostgreSQL (ACID transaction)
    ID->>R: Cache session token for fast access
    ID->>K: Publish UserRegistered event
    K-->>Analytics: Consume event for tracking
    K-->>Notification: Consume event to send welcome email
    ID-->>AG: Return JWT token
    AG-->>U: Registration successful, return token
```text

**Data Flow Explained**:
1.  The `API Gateway` acts as the single entry point, forwarding the request to the `Identity Service`.
2.  The `Identity Service` is responsible for the core business logic of creating a user. It first performs validation (e.g., checking if the email already exists).
3.  The user profile is stored in **PostgreSQL**, our primary transactional database, chosen for its strong ACID guarantees, which are essential for user data.
4.  A session token is cached in **Redis** for fast lookups during subsequent authenticated requests. This avoids hitting the database for every request.
5.  A `UserRegistered` event is published to a **Kafka** topic. This decouples the registration process from other side effects, such as sending a welcome email or updating analytics. This is a key principle of event-driven architecture.

**Key Learning Points**:
- **Stateless Authentication with JWT**: The server does not need to store session state, making it easy to scale horizontally. The JWT is self-contained.
- **Event-Driven Side Effects**: By publishing an event, the `Identity Service`'s responsibility ends with creating the user. Other services can react to this event independently, making the system more resilient and scalable.
- **Cache-First Strategy**: Using Redis for session data significantly reduces latency for authenticated requests.

### 2.2. Content Discovery & Recommendation Flow

This flow is a hybrid of real-time search and ML-powered recommendations.

```mermaid
graph TD
    A[User Search Query] --> B[API Gateway]
    B --> C[Search Service]
    C --> D[Elasticsearch Index]
    C --> E[ML Recommendation Engine]
    E --> F[Neo4j Graph DB]
    E --> G[Vector Similarity Search]

    H[User Behavior Events] --> I[Kafka Stream]
    I --> J[Real-time Feature Store]
    J --> E

    K[Content Metadata] --> L[Content Service]
    L --> M[MongoDB]
    L --> N[Search Indexing Pipeline]
    N --> D
```text

**Data Flow Explained**:
1.  **Search & Recommendations**: The `Search Service` queries both **Elasticsearch** for keyword-based search results and the `Recommendation Engine` for personalized content.
2.  **Real-time Personalization**: User behavior (clicks, views, etc.) is streamed through **Kafka** to a real-time feature store, which updates the user's profile for the `Recommendation Engine`.
3.  **Graph-Based Recommendations**: The `Recommendation Engine` uses **Neo4j** to find content based on relationships (e.g., "users who watched this also watched...").
4.  **Vector Similarity**: For "more like this" features, we use a vector database to find semantically similar content based on their embeddings.
5.  **Content Indexing**: The `Content Service` stores metadata in **MongoDB** and uses an asynchronous pipeline to update the **Elasticsearch** index.

### 2.3. Payment Processing Data Flow

This flow must be highly reliable and secure, with strong consistency guarantees.

```mermaid
stateDiagram-v2
    [*] --> OrderCreated
    OrderCreated --> PaymentInitiated: User clicks pay
    PaymentInitiated --> UPIValidation: UPI flow
    PaymentInitiated --> CardValidation: Card flow

    UPIValidation --> FraudCheck: VPA validated
    CardValidation --> FraudCheck: Card tokenized

    FraudCheck --> PaymentApproved: ML model approves
    FraudCheck --> PaymentRejected: Fraud detected

    PaymentApproved --> LedgerEntry: Double-entry accounting
    LedgerEntry --> OrderFulfilled: Payment settled
    OrderFulfilled --> [*]

    PaymentRejected --> PaymentFailed
    PaymentFailed --> [*]
```text

**Critical Data Consistency Requirements**:
- **ACID Transactions**: All state changes in the payment process must be atomic. We use **MySQL** for our `Ledger Service` because of its proven reliability for financial transactions.
- **Idempotency**: The system must handle duplicate requests safely (e.g., if a user double-clicks the "pay" button). This is typically handled by using a unique idempotency key for each transaction.
- **Audit Trail**: Every state change is logged for compliance and debugging. This is a perfect use case for **Event Sourcing**.

---

## 3. 📊 Event-Driven Architecture Patterns

### 3.1. Event Sourcing

Instead of storing the current state of our data, we store a sequence of immutable events. This gives us a complete audit log and the ability to replay events to reconstruct state at any point in time.

**Why Event Sourcing?**
- **Auditability**: Provides a full history of what happened to an entity.
- **Debugging**: Makes it easier to understand how an entity reached its current state.
- **Temporal Queries**: We can query the state of an entity at any point in time.
- **Decoupling**: Services can subscribe to event streams and react to them independently.

**Event Processing Patterns**:
- **Command Handler**: Takes a user command, validates it, and if successful, produces one or more events.
- **Projection**: A read-side component that consumes an event stream and builds a denormalized read model (e.g., in a document database or cache) optimized for querying.
- **Saga**: A pattern for managing distributed transactions. A saga is a sequence of local transactions. If one transaction fails, the saga executes compensating transactions to undo the preceding transactions.

### 3.2. Kafka Topic Architecture

We use a domain-oriented approach to structure our Kafka topics.

```text
Domain Topics:
├── user.events
│   ├── user.registered
│   ├── user.updated
│   └── user.deleted
├── content.events
│   ├── content.created
│   ├── content.updated
│   └── content.published
├── commerce.events
│   ├── order.created
│   ├── order.paid
│   └── order.fulfilled
...
```text

**Kafka Configuration for Scale**:
- **Partitioning Strategy**: We partition by `user_id` for user-related events to ensure that all events for a given user go to the same partition, preserving order.
- **Replication Factor**: A replication factor of 3 is standard for production environments to ensure high availability.
- **Retention**: We retain events for 7 days to allow for replayability in case of a consumer failure. For long-term storage, we use a Kafka sink to a data lake.

---

## 4. 🔄 Real-Time Data Processing

### 4.1. Stream Processing with Flink

We use **Apache Flink** for stateful stream processing.

**Why Flink?**
- **Stateful Processing**: Flink has excellent support for managing state, which is crucial for many real-time analytics use cases (e.g., calculating a user's session duration).
- **Event Time Processing**: Flink can process events based on the time they occurred, not the time they were processed, which is important for accurate analytics.
- **High Throughput & Low Latency**: Flink is designed for high-performance stream processing.

**Stream Processing Use Cases**:
- **Real-Time Analytics**: Aggregating user engagement metrics in real-time.
- **Fraud Detection**: Analyzing patterns in payment events to detect fraud as it happens.

---

## 5. 🗃️ Database Design Patterns

### 5.1. Polyglot Persistence

We use different databases for different services based on their specific needs.

- **PostgreSQL**: For services that require strong consistency and complex queries (e.g., `Identity Service`).
- **MongoDB**: For services with flexible data models (e.g., `Content Service`).
- **Neo4j**: For services that model highly connected data (e.g., `Recommendation Service`).
- **ClickHouse**: For high-performance analytical queries (e.g., `Analytics Service`).

### 5.2. Data Partitioning Strategies

- **Horizontal Sharding**: For our largest datasets, like user data, we use sharding to distribute the data across multiple database instances. The `user_id` is a good shard key.
- **Time-based Partitioning**: For time-series data, like analytics events, we partition tables by time (e.g., by month). This makes it easy to archive or delete old data.

---

## 6. 🎯 Consistency Patterns

### 6.1. CAP Theorem in Practice

The CAP theorem states that a distributed system can only provide two of the following three guarantees: Consistency, Availability, and Partition Tolerance. Since network partitions are a fact of life, we must choose between consistency and availability.

- **Strong Consistency (CP)**: For services like `Payments` and `Identity`, we prioritize consistency. A user's password must be correct, and a payment must be processed exactly once. We achieve this with ACID-compliant databases like PostgreSQL and MySQL.
- **Eventual Consistency (AP)**: For services like `Content` and `Analytics`, we prioritize availability. It's acceptable if a new piece of content takes a few seconds to appear in search results. We achieve this through asynchronous replication and event-driven updates.

### 6.2. Distributed Transactions with the Saga Pattern

For long-running business processes that span multiple services, we use the **Saga pattern**. A saga is a sequence of local transactions. Each transaction updates the database and publishes an event to trigger the next transaction. If a transaction fails, the saga executes compensating transactions to undo the preceding work.

**Example: Enrollment Saga**
1.  `Commerce Service`: Creates an `Order` and publishes an `OrderCreated` event.
2.  `Payment Service`: Consumes `OrderCreated`, processes the payment, and publishes a `PaymentCompleted` event.
3.  `Content Service`: Consumes `PaymentCompleted`, enrolls the user in the course, and publishes a `UserEnrolled` event.

If the payment fails, the `Payment Service` publishes a `PaymentFailed` event, and the `Commerce Service` would consume this to cancel the order (a compensating transaction).
