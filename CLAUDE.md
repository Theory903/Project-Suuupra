# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Suuupra**, a next-generation EdTech + Media super-platform that integrates ALL major digital services in-house. Built as a comprehensive microservices architecture targeting billions of users with enterprise-grade reliability.

**Core Mission**: Build an integrated ecosystem combining:
- Payment Gateway (UPI Clone + Juspay-like flows)
- Live Video Streaming (Zoom-like classes + Hotstar-scale mass streaming)
- Live Tracking & Recommendations (Uber-like logistics + personalized learning)
- Netflix-style VOD (course catalog + personalized recommendations)
- Web Crawlers (Google-like content discovery and indexing)
- LLM Tutor (OpenAI ChatGPT-like, open source)
- YouTube-like Creator Platform (video uploads + analytics + monetization)
- Real-time Analytics (learning insights + business intelligence)

**Target Scale**: Billion-user scale with 99.99% payment success rate, <300ms API latency, 1M+ concurrent streams.

## Development Environment

**Required Versions:**
- Node.js: 22.18.0 (managed via nvm)
- Python: 3.13.5 (managed via pyenv)
- Go: Latest stable (managed via gvm)
- Java: 17+
- Rust: Latest stable (for Live Tracking hybrid service)

**Essential Tools:**
- Docker & Docker Compose for local development
- kubectl for Kubernetes interaction
- terraform for infrastructure management
- FFmpeg for media processing
- k6 for load testing
- ArgoCD CLI for GitOps deployments

## Common Commands

**Per-Service Operations:**
Each service has standardized scripts (currently empty but should be implemented):
```bash
# In any service directory (e.g., services/api-gateway/)
./build.sh      # Build the service
./test.sh       # Run all tests
./deploy.sh     # Deploy to environments
./migrate.sh    # Run database migrations (for data services)
```

**Testing:**
- Unit tests: Service-specific frameworks (Jest, Pytest, JUnit, Go test)
- Integration tests: Using Testcontainers for database mocking
- Contract tests: Pact framework for API contracts
- Load tests: k6 framework in `/tools/testing/`

**Infrastructure:**
```bash
# From infrastructure/ directory
terraform plan -var-file="environments/dev.tfvars"
terraform apply -var-file="environments/dev.tfvars"

# Kubernetes deployments
kubectl apply -k infrastructure/kubernetes/overlays/dev
```

## Architecture Overview

**Service Architecture Matrix:**

| Domain | Service | Tech Stack | Database | Core Features | DSA Focus |
|--------|---------|------------|----------|---------------|----------|
| Gateway | API Gateway | Node.js + Express | Redis | JWT auth, rate limiting, routing | Token bucket, consistent hashing |
| Identity | User Service | Java + Spring Boot | PostgreSQL | Authentication, RBAC, profiles | Trie (permissions), union-find (roles) |
| Content | Course/Content | Node.js + Express | MongoDB + Elasticsearch | Content management, search, metadata | Inverted index, BM25 ranking |
| Commerce | Order Service | Python + FastAPI | PostgreSQL + Redis | Order processing, CQRS, events | Saga pattern, event ordering |
| Payments | Payment Gateway | Go + Gin | MySQL | UPI, cards, wallets, fraud detection | Double-entry ledger, idempotency |
| Payments | Ledger Service | Java + Spring Batch | MySQL | Reconciliation, settlement | Merkle trees, windowed aggregation |
| Media | Live Classes | WebRTC SFU + Node.js | Redis + S3 | Zoom-like classes, recording, chat | Jitter buffers, priority queues |
| Media | VOD Service | Node.js + FFmpeg | S3 + CDN | Transcoding, adaptive bitrate, DRM | Dynamic programming (encoding) |
| Media | Mass Live Stream | Go + FFmpeg | S3 + Multi-CDN | Hotstar-scale streaming, LL-HLS | Consistent hashing, segment scheduling |
| Media | Creator Studio | Node.js + React | S3 + MongoDB | Uploads, analytics, monetization | Sharded counters, min-heap (top-K) |
| Intelligence | Recommendation | Python + FastAPI | Neo4j + Vector DB | Collaborative filtering, graph ML | PageRank, ANN search, UCB bandits |
| Intelligence | Search & Crawler | Go + Python | Elasticsearch + MinIO | Web crawling, content discovery | Priority queues, PageRank, SimHash |
| Intelligence | LLM Tutor | Python + vLLM | Vector DB + S3 | RAG, Q&A, personalized tutoring | Vector similarity, query expansion |
| Analytics | Analytics Service | Python + Flink | ClickHouse + Kafka | Real-time analytics, dashboards | Stream processing, HyperLogLog |
| Analytics | Counter Service | Redis Cluster | Redis + ClickHouse | View counters, engagement stats | CRDT counters, reservoir sampling |
| Logistics | Live Tracking | Go + Rust | PostGIS + Redis | GPS tracking, ETA, route optimization | Geohash, A* pathfinding, k-NN |
| Communication | Notification | Python + Django | Redis + SES/FCM | Push, email, SMS, WebSocket | Priority queues, bloom filters |
| Operations | Admin Service | Node.js + React | PostgreSQL | Content moderation, user management | DAG evaluation, Merkle logs |

**Communication Patterns:**
- External APIs: REST with OpenAPI specifications
- Internal services: Hybrid REST + gRPC
- Events: Kafka + RabbitMQ for async messaging
- Real-time: WebSocket, WebRTC, Server-Sent Events

**Data Architecture:**
- **PostgreSQL**: Primary databases for most services (Identity, Commerce, Admin)
- **MySQL**: Payments and Ledger services with ACID compliance
- **MongoDB**: Content metadata with Elasticsearch integration
- **Neo4j**: Graph-based recommendations and social connections
- **Vector DB**: LLM embeddings and similarity search
- **PostGIS**: Geospatial data for Live Tracking with spatial indexing
- **ClickHouse**: Analytics time-series data with columnar storage
- **Redis**: Caching, sessions, real-time counters, and pub/sub
- **MinIO/S3**: Object storage for media files and static assets
- **Kafka**: Event streaming and message queues
- **Elasticsearch**: Full-text search and content indexing

## Key Directories

```
services/           # 19 microservices with domain separation
├── api-gateway/    # Central routing and authentication
├── identity/       # User management and auth (Java/Spring)
├── commerce/       # Orders, refunds (Python/FastAPI)
├── payments/       # Payment processing (Go)
├── llm-tutor/      # AI tutoring service (Python/vLLM)
└── live-tracking/  # GPS/location services (Go/Rust)

infrastructure/     # Complete K8s and Terraform setup
├── kubernetes/     # Manifests with Kustomize overlays
├── terraform/      # AWS infrastructure modules
├── monitoring/     # Prometheus, Grafana, Jaeger
└── security/       # Certificates and policies

shared/            # Cross-service contracts and libraries
├── libs/          # Language-specific shared code
├── proto/         # gRPC protocol definitions
└── templates/     # Service scaffolding templates
```

## Development Workflow

**Service Development:**
1. Services follow domain-driven design with clear bounded contexts
2. Each service has dedicated test directories: `tests/{unit,integration,load}/`
3. Configuration is environment-driven with separate configs for dev/staging/prod
4. All services should implement health checks at `/health` and `/ready`

**Infrastructure:**
- Kubernetes-first deployment with Istio service mesh
- GitOps workflow using ArgoCD and Helm
- Environment promotion through Kustomize overlays
- Terraform modules for AWS resources (EKS, RDS, VPC)

**Observability:**
- OpenTelemetry for distributed tracing
- Prometheus metrics with custom Grafana dashboards
- Centralized logging (structure ready but not implemented)
- Service mesh metrics via Istio

## Important Conventions

**API Standards:**
- REST APIs must have OpenAPI specifications
- gRPC services use Protocol Buffers in `/shared/proto/`
- Consistent error response formats across services
- API versioning through URL paths (e.g., `/api/v1/`)

**Security:**
- OAuth2/JWT for authentication (handled by Identity service)
- TLS 1.3 for all service communication
- Secrets management via HashiCorp Vault
- Network policies for service-to-service communication

**Performance & Scalability Targets:**

| Service | Latency (p99) | Throughput | Availability | Error Rate |
|---------|---------------|------------|-------------|------------|
| API Gateway | 150ms | 50k RPS | 99.9% | < 0.1% |
| User Service | 200ms | 20k RPS | 99.95% | < 0.05% |
| Payment Gateway | 500ms | 10k TPS | 99.99% | < 0.01% |
| Live Streaming | 100ms RTT | 1M viewers | 99.9% | < 0.5% |
| Search Service | 300ms | 15k QPS | 99.5% | < 1% |
| Recommendation | 400ms | 25k RPS | 99% | < 2% |

**Testing Strategy:**
- Contract-first development with consumer-driven testing
- Integration tests use Testcontainers for database dependencies
- Load testing with k6 for performance requirements
- Contract tests with Pact framework for API contracts
- Chaos engineering for fault tolerance validation

## Learning Objectives & Implementation Phases

**Core Computer Science Concepts by Domain:**

**Payment Gateway & Financial Systems:**
- Double-entry Ledger: Implement financial correctness with atomic transactions
- Idempotency: Hash-based deduplication for exactly-once processing
- Fraud Detection: Sliding window algorithms, anomaly detection patterns
- Settlement & Reconciliation: Merkle tree verification, windowed aggregations

**Live Streaming & Media Processing:**
- Adaptive Bitrate Streaming: Dynamic programming for encoding optimization
- Jitter Buffers: Priority queues for smooth video playback
- CDN Distribution: Consistent hashing for load distribution
- Segment Scheduling: Graph algorithms for optimal content delivery

**Search & Content Discovery:**
- Web Crawling: Priority queues for frontier management, robots.txt parsing
- Inverted Indexing: Efficient text search with BM25 relevance scoring
- Duplicate Detection: SimHash, Bloom filters for content deduplication
- PageRank: Graph algorithms for content authority ranking

**AI & Machine Learning Integration:**
- Vector Similarity Search: Approximate nearest neighbor (ANN) algorithms
- Graph Neural Networks: Personalized PageRank for recommendations
- Retrieval Augmented Generation (RAG): Hybrid search for LLM knowledge
- Online Learning: Multi-armed bandits for recommendation optimization

## Current State & Development Approach

This is a **comprehensive EdTech super-platform** designed to integrate all major digital services. The architecture supports learning from basic CRUD operations to advanced distributed systems, AI integration, and billion-user scale engineering challenges.

**Implementation Priority:**
1. **Foundation & Core Services**: Infrastructure, Gateway, Identity, Content
2. **Payment Gateway & Live Streaming**: UPI flows, WebRTC, VOD processing
3. **AI & Intelligence Services**: Search, Recommendations, LLM Integration
4. **Scale & Advanced Features**: Mass streaming, Creator economy, Analytics

**Key Development Principles:**
- Contract-first API development with OpenAPI specifications
- Event-driven architecture with CQRS and Event Sourcing patterns
- Multi-level caching strategies (Application, Redis, CDN)
- Comprehensive observability from day one
- Security-first approach with OAuth2/JWT and TLS 1.3