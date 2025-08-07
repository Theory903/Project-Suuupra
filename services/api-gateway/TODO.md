# **Service PRD: API Gateway**

## 1. 🎯 The Challenge: Problem Statement & Mission

### **Problem Statement**
> As the number of microservices in the Suuupra platform grows, clients (web, mobile) face increasing complexity in consuming them. Each service has its own endpoint, authentication mechanism, and rate-limiting policy. This creates a tight coupling between clients and services, making the system brittle and difficult to evolve. The challenge is to build a unified entry point that decouples clients from services, providing a consistent and secure API for all consumers, while handling the complexities of a distributed system.

### **Mission**
> Provide a robust, secure, and highly performant API Gateway that acts as the single entry point for all client requests, simplifying client-side development and enabling seamless evolution of the microservices architecture.

---

## 2. 🧠 Core Requirements (FR/NFR) & Edge Cases

### Functional Requirements (FRs)
| FR-ID | Feature | Description |
|---|---|---|
| FR-1 | Request Routing | Route incoming requests to the appropriate downstream service based on the request path. |
| FR-2 | Authentication & Authorization | Authenticate and authorize incoming requests (JWT/JWKS, API Keys, scopes). |
| FR-3 | Rate Limiting | Protect downstream services via distributed rate limiting. |
| FR-4 | Service Discovery | Dynamically discover and route to healthy service instances. |
| FR-5 | WebSocket Proxying | Support real-time communication (rooms, heartbeats, auth). |

### Non-Functional Requirements (NFRs)
| NFR-ID | Requirement | Target |
|---|---|---|
| NFR-1 | Latency | p99 < 150ms gateway overhead |
| NFR-2 | Availability | 99.99% |
| NFR-3 | Scalability | 50,000+ RPS horizontally |

### Edge Cases & Failure Scenarios
- Downstream service unavailability → circuit breakers, fallbacks
- Identity provider/JWKS outages → cache, error handling
- Configuration errors → validation, atomic hot reload

---

## 3. 🗺️ Architecture (High-Level)
- Fastify-based HTTP server with config-driven pipeline
- Per-route policies for auth, limits, retries, breakers, AI, security
- Discovery providers + load balancer with health/outlier detection
- Admin API with audit log and hot reload
- Observability via Prometheus and OpenTelemetry

---

## 4. ✅ Feature Status Dashboard

### Routing & Policies
- [x] Request routing and matcher (`routing/match.ts`, `types/gateway.ts`)
- [x] Request/response transforms (`middleware/transforms.ts`)
- [x] Context injection (claims → headers) (`middleware/contextInjection.ts`)

### Authentication & Authorization
- [x] JWT via JWKS with OIDC discovery (per-route issuer/audience) (`middleware/auth.ts`)
- [x] Fallback JWT via `@fastify/jwt` if configured
- [x] API Keys: hashed storage, scopes, rotation (Redis) (`middleware/apiKeys.ts` + Admin API)
- [x] Role/scope checks (per-route)

### Traffic Management & Resilience
- [x] Redis token bucket rate limiter (keys: ip/user/tenant/route) (`middleware/rateLimit.ts`)
- [x] Throttling/backoff hints (429 + `Retry-After`)
- [x] Retries policy + breaker-wrapped proxy (`proxy/circuit.ts`)
- [x] Per-route concurrency caps and queueing for AI endpoints (`pipeline/handle.ts`)

### AI-Aware Features
- [x] SSE/chunked streaming proxy with cancellation (`proxy/streamingProxy.ts`)
- [x] Optional prompt batching for small payloads (`ai/batchProcessor.ts`)
- [x] Model router (weighted + sticky) (`ai/modelRouter.ts`)

### Discovery, Load Balancing, and Health
- [x] Providers (static/DNS/K8s/Consul shapes) + caching (`discovery/providers.ts`)
- [x] LB algorithms (RR/weighted/least-conn/least-RTT/ip-hash) (`discovery/loadBalancer.ts`)
- [x] Active health checks + passive outlier ejection (`discovery/*`)

### Security & Secrets
- [x] IP allow/deny + signed URL validation (`middleware/security.ts`)
- [x] Credential proxying: AWS SigV4, GCP SA tokens (`auth/credentialProxy.ts`)
- [x] Secrets backends: Vault/AWS/GCP/Env with caching (`secrets/manager.ts`)

### Admin & Config
- [x] Admin API: CRUD routes/services/limits/plugins + audit log (`admin/api.ts`)
- [x] Hot reload with atomic swap + validation (`admin/api.ts`)
- [x] Ingress compatibility: Translate K8s Ingress/CRDs/annotations → config (`k8s/ingressController.ts`)
- [x] GitOps sync with drift detection + webhook trigger (`gitops/configSync.ts`)
- [x] Feature flags manager (local/OpenFeature-style) (`features/flagManager.ts`)
- [x] Environment/tenant isolation with namespacing (`config/environmentIsolation.ts`)

### Real-time & Media
- [x] WebSocket session manager (rooms, heartbeats, auth, backpressure) (`websocket/sessionManager.ts`)
- [x] WebRTC SFU routing (regional/least-loaded/balanced/sticky) (`media/webrtcRouter.ts`)
- [x] CDN-aware routing by geo/RTT for media paths (`routing/cdnRouter.ts`)

### DevOps & Platform
- [x] Deployment strategies: blue-green, canary, rolling + SLO gates & auto-rollback (`deployment/strategies.ts`)

### Observability
- [x] Per-route metrics labels + detailed metrics (limiter hits, retries, breaker opens, queue depth) (`observability/metrics.ts`)
- [x] OpenTelemetry tracing for gateway/upstream with W3C context (`observability/tracing.ts`)

---

## 5. 🔜 Remaining Work (Concise, Non-Redundant)
- Security hardening
  - [ ] TLS termination + internal mTLS (SPIFFE/SPIRE)
  - [ ] WAF integration (ModSecurity/Coraza) – detect/block modes
  - [ ] Append-only audit sink with hash chaining (persisted)
- Admin & Access
  - [ ] Admin API authentication/authorization hardening (RBAC + scopes)
- Ops & SRE
  - [ ] Production dashboards (Grafana) + alert rules (latency, error, breaker, limits)
  - [ ] Load tests/k6 profiles + baseline SLO report
  - [ ] Operational runbooks (breaker tuning, rate limit keys, GitOps conflicts)
- Config & Safety
  - [ ] Schema validation expansion + migration compatibility tests
  - [ ] End-to-end integration tests (auth paths, streaming, retries, GitOps)

---

## 6. 🧪 Testing & Quality Strategy (Updated)
| Test Type | Scope |
|---|---|
| Unit | Transforms, security checks, batching/model router, LB selection |
| Integration | Full pipeline (auth → limits → discovery → breaker → proxy) |
| Load | Rate limiter behavior, breaker open/close, SSE stability |
| Config | Admin CRUD, hot reload, GitOps drift detection |

---

## 7. 🔭 Observability Targets
- Metrics: request latency histograms, error rates, limiter hits, retries, breaker opens, AI queue depth
- Tracing: gateway + upstream spans with routeId/service labels
- Dashboards/Alerts: p99 > 150ms; 5xx > 1%; persistent breaker opens; limiter saturation

---

## 8. 📓 Notes
- This status dashboard supersedes older duplicated backlogs. New items should be added under “Remaining Work” only.
- For teacher-style docs and deep dives, see `docs/apis/api-gateway.md`. 
