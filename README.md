# 🎓 Suuupra EdTech Super-Platform

A modular, high-scale education and media platform designed for the next billion users — combining live streaming, payments, AI tutoring, analytics, and content delivery into a single, developer-friendly ecosystem.

---

## 🧭 Overview

**🎯 Mission**: Build a fully integrated EdTech + Media ecosystem with in-house capabilities inspired by OpenAI, Hotstar, Zoom, YouTube, and Google-scale infrastructure — optimized for reusability, extensibility, and sustainability.

### 🔧 Core Capabilities
- ⚡ Secure in-house UPI & card payments
- 🎥 Live classrooms + mass video streaming
- 🤖 AI-powered ChatGPT-style tutor with vector search
- 🎬 Netflix-style VOD + YouTube-style creator economy
- 📊 Real-time analytics & dashboards (KPI + learning driven)
- 📍 Uber-like live tracking + logistics optimization
- 🔍 Search engine & crawler for open content indexing

---

## 🧱 Architecture

| Domain        | Service             | Tech Stack           |
|---------------|---------------------|----------------------|
| Gateway       | API Gateway          | Node.js + Express    |
| Identity      | Auth & User          | Java + Spring Boot   |
| Content       | Course Metadata      | Node.js + MongoDB    |
| Commerce      | Orders & Refunds     | Python + FastAPI     |
| Payments      | UPI/Card Gateway     | Go + MySQL           |
| Media         | VOD & Live           | FFmpeg, Go, Node.js  |
| Intelligence  | Recommender, Search  | Python + Neo4j       |
| Tutor AI      | LLM-based Assistant  | Python + vLLM        |
| Analytics     | Stream Insights      | Flink + ClickHouse   |
| Tracking      | GPS/ETA              | Go + Rust + PostGIS  |
| Comm.         | Notifications        | Python + Django      |
| Admin         | Moderation & Ops     | Node.js + React      |

> Full service code lives in `/services/<service-name>`

---

## 📦 Project Layout

```
suuupra-edtech-platform/
├── services/              # All microservices
├── infrastructure/        # Terraform, K8s configs, observability
├── shared/                # Proto files, shared libs, event schemas
├── tools/                 # Scripts, testing, generators
├── docs/                  # Architecture, API specs, runbooks
├── docker-compose.yml     # Local orchestration
└── README.md              # 📘 You're here
```

---

## 🚀 Getting Started

### ✳️ Requirements
- Docker & Docker Compose
- Node.js 18+, Python 3.11+, Go 1.20+, Java 17+
- Bash, Git, Make (optional)

### ⏯️ Local Setup

```
git clone https://github.com/<your-org>/suuupra-edtech-platform.git
cd suuupra-edtech-platform
docker-compose up -d
./tools/scripts/initialize-project.sh
```

---

## 🛠 Development Workflow

### Create a New Service

```
./tools/scripts/generate-service.sh my-service java
```

- Supported stacks: `go`, `java`, `node`, `python`
- Template includes: API Scaffold, Infra, Tests, CI Config

---

## 📡 Communication Patterns

| Type      | Protocols                            |
|-----------|---------------------------------------|
| API       | REST / OpenAPI                        |
| Internal  | gRPC + REST (hybrid microservices)    |
| Events    | Kafka + RabbitMQ                      |
| Realtime  | WebSocket, WebRTC, SSE                |

---

## 📈 Observability

- 🟢 Prometheus: Metrics + Service availability
- 📉 Grafana: Dashboards in `/infrastructure/monitoring/grafana`
- 📍 Jaeger: Distributed tracing via OpenTelemetry
- 🔔 Alerting: Prometheus AlertManager + K8s probes

---

## 🧪 Testing + CI/CD

| Layer        | Tools             |
|--------------|------------------|
| Unit         | JUnit, Jest, Pytest, Go test |
| Integration  | Testcontainers, Postgres/Mongo mock |
| Contracts    | Pact (consumer-driven)        |
| Load Testing | k6 (`/tools/testing/k6`)       |

```
make test
# or per-service:
./services/payments/scripts/test.sh
```

GitHub Actions handle CI/CD, scans, tests, and deploy on commit.

---

## 🔐 Security & Compliance

- OAuth2 / JWT Authentication + MFA
- TLS 1.3, AES-256 encryption, HMAC-signed webhooks
- HashiCorp Vault for secret management
- PCI-DSS readiness, DMCA request handling, GDPR support

---

## 🚦 Module Status

| Service         | Status         |
|------------------|----------------|
| API Gateway      | ✅ Stable       |
| Identity / Auth  | 🛠 In progress  |
| Payments / Ledger| ➕ Incoming     |
| VOD / Streaming  | ⌛ Bootstrapping|
| LLM Tutor        | ⌛ Bootstrapping|

---

## ⚙️ Ops & Deployment

- GitOps with ArgoCD
- Blue-green & canary deployments via Helm
- Multi-environment support (dev/stage/prod)
- Feature toggling + fault injection hooks

---

## 🧑‍💻 Contributor Guide

1. Fork & Clone this repo
2. Launch local services via Docker Compose
3. Add services with `generate-service.sh`
4. Follow `/shared/` integration patterns
5. Submit PR with:
    - Tests ✅
    - Readable commit history 🌿
    - API spec changes 📑
    - CI checks passing ✅

---

## 📚 Documentation Index

| Resource        | Path                       |
|------------------|----------------------------|
| Architecture     | `/docs/architecture/`      |
| API Specs        | `/docs/apis/`              |
| Runbooks         | `/docs/runbooks/`          |
| Per-Service Docs | `/services/<name>/docs/`   |

---

## 📊 Business KPIs

| Metric               | Goal        |
|----------------------|-------------|
| Payment success rate | ≥ 99.99%    |
| API Latency (p99)    | ≤ 300ms     |
| Recommender Result   | ≤ 400ms     |
| Stream RTT           | ≤ 100ms     |
| Day-30 Retention     | ≥ 70%       |

---

## 👤 Contact & Maintainers

- **Lead Engineer**: Abhishek Jha
- Dev Chat: `#edtech-platform-dev`
- Bugs / Feature Requests: Use GitHub Issues

---

## ⚠️ Licensing

> 💡 This is a **Source-Visible Project** — Not Open Source Software.

While contribution is welcomed:
- 📖 Source code is viewable and forkable
- ❌ Commercial use, redistribution, or modification is not permitted without written permission
- ⚖ All rights reserved © 2025 Suuupra EdTech Inc.

For details, see [`LICENSE`](./LICENSE)

---

*Made with 🚀 by educators & engineers from Suuupra EdTech.*
