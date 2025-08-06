# Counter Service - Comprehensive TODO

## 1. 🎯 Overview & Learning Objectives

The **Counter Service** is a specialized, high-performance service designed for a single purpose: to count things at massive scale. It handles view counts, likes, and other engagement statistics with extremely low latency and high throughput.

### **Why this stack?**

*   **Go**: Its concurrency model (goroutines and channels) and performance make it a perfect fit for a high-throughput service like this.
*   **Redis**: An in-memory data store that provides the speed needed for real-time counters.
*   **ClickHouse**: A columnar database that is optimized for analytics and can be used for long-term storage of counter data.

### **Learning Focus**:

*   **High-Performance Go**: Learn how to write highly concurrent and performant Go services.
*   **Distributed Counters**: Implement counters that can be scaled across multiple machines.
*   **Probabilistic Data Structures**: Use data structures like HyperLogLog to efficiently count unique items.
*   **CRDTs (Conflict-free Replicated Data Types)**: Learn about CRDTs for building eventually consistent distributed systems.

---

## 2. 🚀 Implementation Plan (3 Weeks)

### **Week 1: Core Counter Infrastructure**

*   **Goal**: Set up the basic infrastructure and a simple counter.

*   **Tasks**:
    *   [ ] **Project Setup**: Initialize a Go project and set up a Redis Cluster with Docker.
    *   [ ] **Basic Counter**: Implement a basic counter using the Redis `INCR` command. Create API endpoints for incrementing and getting counter values.
    *   [ ] **Batching**: Implement a batching mechanism to group multiple increment operations into a single Redis command to reduce network overhead.

### **Week 2: Distributed & Probabilistic Counters**

*   **Goal**: Implement more advanced counter types.

*   **Tasks**:
    *   [ ] **CRDT G-Counter**: Implement a G-Counter (Grow-Only Counter), which is a CRDT that can be used to build an eventually consistent distributed counter.
    *   [ ] **HyperLogLog for Unique Counts**: Use the Redis `PFADD` and `PFCOUNT` commands to implement a probabilistic counter for unique items (e.g., unique viewers).

### **Week 3: Persistence & Optimization**

*   **Goal**: Persist counter data for long-term analysis and optimize the service for performance.

*   **Tasks**:
    *   [ ] **Data Persistence**: Create a background Go routine to periodically flush counter data from Redis to ClickHouse.
    *   [ ] **Sharding**: Implement a sharding strategy to distribute counters across the Redis cluster.
    *   [ ] **Reservoir Sampling**: Use Reservoir Sampling to get a statistically representative sample of items (e.g., a sample of users who liked a video).

---

## 3. 🗄️ Redis Schema

```redis
# Simple counter for an item of type 'content' with id '123'
INCR counter:content:123

# CRDT G-Counter for the same item, with 3 replicas
HINCRBY crdt_counter:content:123 replica_1 1
HINCRBY crdt_counter:content:123 replica_2 1

# HyperLogLog for unique views of the same item
PFADD hll:content_views:123 user_id_1 user_id_2

# Buffer for flushing to ClickHouse (Sorted Set)
ZADD counter_buffer:views 1672531200 "content_id_1,user_id_1"
```

---

## 4. 🔌 API Design (REST/gRPC)

-   `POST /v1/counter/{type}/{id}/increment`: Increment a counter.
-   `GET /v1/counter/{type}/{id}`: Get the value of a counter.
-   `GET /v1/counter/{type}/{id}/unique`: Get the unique count for an item.
