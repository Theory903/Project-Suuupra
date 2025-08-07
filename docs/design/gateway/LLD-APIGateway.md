# Low-Level Design: API Gateway Service

## 1. Purpose

This document defines the comprehensive capability set for the custom API Gateway and explains the why/how/what behind each feature. It also proposes a phased delivery plan aligned with platform priorities.

## 2. Scope & Non-Goals

- Scope: Edge gateway for request routing, authn/z, traffic management, AI-aware proxying, cloud-native integration, observability, and admin UX.
- Non-goals: Full-featured WAF implementation, full CDN implementation, or building a general-purpose mesh. The gateway integrates with these, not replaces them.

## 3. Architecture Overview

- Core: Fastify/Node.js, with `http/https` proxying, `opossum` for circuit breaking, Redis for rate limiting and quotas, optional Kafka for traffic replay, OpenTelemetry for tracing, Prometheus for metrics.
- Extensibility: Plugin/middleware hooks that can be hot-loaded; Admin API to CRUD routes/services.
- Deployment: Kubernetes-native; compatible with Ingress; supports GitOps config sync.

## 4. Feature Matrix (What + Why + How)

### 4.1 Core Gateway Capabilities

- Request Routing
  - Why: Direct traffic to correct microservice by path/host/method/headers; enables clean domain boundaries.
  - How: Rule engine that maps incoming requests → service target with priority matching; config in Admin API/GitOps.
  - What: Path prefixes (e.g., `/vod`, `/payments`), host-based routing, header-based A/B.

- Protocol Support (HTTP/1.1, HTTP/2, WebSocket, gRPC)
  - Why: Serve diverse clients and upstreams; support streaming and bi-directional traffic.
  - How: Node HTTP/2 server for h2, ws upgrade handling, grpc-web/grpc proxy modes.
  - What: Negotiate protocols; upgrade requests; pass through frames safely.

- Request/Response Transformation
  - Why: Normalize cross-service contracts; hide internal headers; apply tenant/region context.
  - How: Declarative per-route transform rules (headers/query/body) with allowlists.
  - What: Add/remove/rename headers, inject correlation ID, sanitize responses.

- CORS Handling
  - Why: Secure cross-origin access for frontend apps.
  - How: Declarative origin/method/header lists; preflight cache.
  - What: Per-route/per-tenant CORS configs.

- Static Asset Proxy
  - Why: Unified edge for S3/CDN assets, fallback to signed URLs.
  - How: Conditional proxy with origin selection and signature helpers.
  - What: Direct proxy or redirect with signed URL generation.

### 4.2 Authentication & Authorization

- JWT Verification
  - Why: Stateless, scalable auth.
  - How: JWKS/RSA public keys, clock skew tolerance, audience/issuer checks.
  - What: Per-route requirement with role/claim extraction.

- OAuth2/OIDC Integration
  - Why: SSO and token lifecycle via Identity service.
  - How: Introspection for opaque tokens; discovery for OIDC; refresh handling optionally at client.
  - What: Support auth code with PKCE; service-to-service client credentials.

- Session Management (optional)
  - Why: Sliding expiries when needed.
  - How: Redis-backed session store keyed by token/session ID.
  - What: Idle timeout refresh; logout revocation list.

- RBAC
  - Why: Principle of least privilege by route.
  - How: Role claim validation; policy rules in Admin API.
  - What: `admin`, `creator`, `student`, custom roles.

- API Keys
  - Why: Service/3P integrations without JWT.
  - How: Hashed storage, prefix-based lookup, per-key limits/scopes.
  - What: Rotatable keys via Admin API.

- Multi-Tenant Awareness
  - Why: Isolation for schools/brands/clients.
  - How: Tenant ID from host/header/token; tenant-scoped limits and routing.
  - What: Separate quotas, analytics, and error budgets.

### 4.3 Traffic Management & Resilience

- Rate Limiting
  - Why: Protect upstreams and ensure fair usage.
  - How: Redis token bucket/leaky bucket; keys by user/tenant/route.
  - What: 429 with Retry-After; headers for remaining quota.

- Throttling/Backoff
  - Why: Smooth spikes to avoid cascading failures.
  - How: Queue or delay responses when thresholds exceeded.
  - What: Gradual backoff strategies per client.

- Retries & Failover
  - Why: Improve success rates on transient errors.
  - How: Idempotent methods only by default; jittered exponential backoff; health-based endpoint selection.
  - What: Respect `Retry-After` and upstream idempotency keys.

- Timeouts per Route
  - Why: Bound resource usage; align to SLOs.
  - How: Configurable connect/read/write timeouts.
  - What: Sensible defaults with overrides.

- Circuit Breakers
  - Why: Fail fast, prevent storms; already partially implemented with `opossum`.
  - How: Error thresholds, half-open probes, fallbacks.
  - What: 503 with JSON error body and retry hints.

- Request Queuing (AI)
  - Why: Protect LLM services with controlled concurrency.
  - How: Per-tenant queues with max concurrency; optional FIFO.
  - What: Queue depth metrics and timeouts.

### 4.4 AI-Aware Features

- Streaming Proxy
  - Why: Token streaming UX for chat/completions.
  - How: Server-sent events / chunked transfer passthrough.
  - What: Backpressure-aware piping with cancellation.

- Batching Gateway (optional)
  - Why: Improve throughput for small LLM requests.
  - How: Aggregate within small windows; split responses.
  - What: Opt-in per route/model.

- Model Routing
  - Why: Route by cost/latency/quality or AB testing.
  - How: Policy-based selection using SLOs and feature flags.
  - What: Weighted routes and sticky sessions.

- Context Injection
  - Why: Personalization and safety.
  - How: Inject user/session/tenant metadata headers; PII-safe.
  - What: Declarative mapping from claims to headers.

### 4.5 Cloud-Native Integration

- Service Discovery
  - Why: Dynamic target management.
  - How: K8s headless services, Consul catalog, DNS SRV.
  - What: Health-aware endpoint pool.

- Health Checks & Auto-Removal
  - Why: Remove bad instances quickly.
  - How: Active and passive checks; ejection and probation.
  - What: Outlier detection thresholds.

- Multi-CDN Routing
  - Why: Global performance and resilience.
  - How: Geo/IP and RTT-based decisions; CDN health.
  - What: Override per-tenant or content type.

- Credential Proxying
  - Why: Access to cloud APIs without exposing secrets.
  - How: AWS SigV4 signing or GCP SA tokens injected server-side.
  - What: Least-privilege roles bound to routes.

- Kubernetes Ingress Compatibility
  - Why: Hybrid deployments and portability.
  - How: CRDs or annotation mapping to internal route config.
  - What: Sync controller watches cluster resources.

### 4.6 Observability & Debugging

- Prometheus Metrics
  - Why: Operability and capacity planning.
  - How: Export latency histograms, RPS, error rates, rate-limit hits, queue depths.
  - What: Service/route/tenant labels.

- Structured Logging
  - Why: Effective troubleshooting.
  - How: JSON logs with correlation IDs and user/tenant (no PII).
  - What: Log levels and sampling for high-traffic routes.

- OpenTelemetry Tracing
  - Why: End-to-end latency and dependency visibility.
  - How: W3C trace-context; spans for gateway and upstream calls.
  - What: Jaeger/Tempo backend.

- Real-time Debug Dashboard
  - Why: Fast incident response.
  - How: Small admin UI fed by metrics and Admin API.
  - What: Live route tables, upstream health, latency charts.

- Traffic Replay
  - Why: Reproduce hard bugs safely.
  - How: Capture sanitized request envelopes; replay into sandboxes.
  - What: Guardrails and redaction policies.

### 4.7 Admin + Developer UX

- Admin API
  - Why: Self-serve and automation.
  - How: Authenticated CRUD for services/routes/limits/plugins.
  - What: Audited changes with versioning.

- Hot Reloading Config
  - Why: Zero-downtime updates.
  - How: Watchers or Admin API triggers.
  - What: Atomic swaps with validation.

- Secrets Management
  - Why: Security and rotation.
  - How: Vault/AWS SM; dynamic mounts into runtime.
  - What: Lease renewal and revocation hooks.

- Plugin System / Middleware Hooks
  - Why: Extensibility without forking gateway.
  - How: Sandbox execution with capability limits.
  - What: Typed hooks: request, response, error, stream.

- Dashboard (Optional)
  - Why: Visibility for ops/dev.
  - How: Read-only view backed by Admin API + metrics.
  - What: RBAC-gated access.

### 4.8 Security & Compliance

- TLS Termination + mTLS
  - Why: Encrypt external and internal traffic.
  - How: Cert-manager integration, SPIFFE/SPIRE for mTLS.
  - What: Per-route TLS policies.

- IP Whitelisting/Blacklisting
  - Why: Defense-in-depth and partner controls.
  - How: CIDR lists per route or tenant.
  - What: 403 on denied ranges.

- WAF / Input Filtering
  - Why: OWASP Top 10 protections at edge.
  - How: Integrate with ModSecurity/Coraza or cloud WAF.
  - What: Mode: detect/block; rules per route.

- Signed URL Proxy
  - Why: Protect DRM/VOD content links.
  - How: Verify signatures and TTLs; re-sign for upstream.
  - What: Watermark headers support.

- Audit Logging
  - Why: Compliance and forensics.
  - How: Append-only sink with tamper-evident hashing.
  - What: Sensitive route access trails.

### 4.9 Content & Media Controls

- WebSocket Session Manager
  - Why: Real-time class sessions and chat.
  - How: Gateway session registry with heartbeats.
  - What: Hooks for identity/roles and room limits.

- DRM Header Handling
  - Why: Traceability and leak deterrence.
  - How: Inject watermark/timestamp headers.
  - What: Per-tenant templates.

- Whiteboard Proxy / WebRTC SFU Routing
  - Why: Low-latency collaboration.
  - How: Route by region and room; QoS-aware.
  - What: Token auth and congestion signals.

- Bandwidth-Aware Routing
  - Why: Better QoE for VOD/live.
  - How: Client network hints and CDN telemetry.
  - What: Quality tiers per region.

### 4.10 DevOps & Platform

- Blue-Green Deployments
  - Why: Safe upgrades.
  - How: Dual stacks with instant switch.
  - What: Health + metric gates.

- Canary Routing
  - Why: Reduce blast radius of changes.
  - How: Weighted routing by % with guardrails.
  - What: Auto rollback on SLO breach.

- Feature Flags
  - Why: Progressive delivery.
  - How: Flag service (e.g., OpenFeature) integrated into hooks.
  - What: Route/user/role-based toggles.

- Dynamic Route Updates via GitOps
  - Why: Auditability and review workflows.
  - How: Controller syncs configs from Git; validates and applies.
  - What: Drift detection and alerts.

- Multi-Environment Awareness
  - Why: Separation of concerns and secrets.
  - How: Namespaced configs, secret stores per env.
  - What: Env-specific routing tables.

## 5. Phased Delivery Plan (Suggested)

- Phase 1 (MVP): Routing, JWT Auth, Rate Limiting, Service Discovery, Metrics.
- Phase 2: Circuit Breakers, Retries, OAuth2, AI Proxy Streaming, Admin API.
- Phase 3: AI Model Router, Cloud Credential Proxy, CDN-aware routing.
- Phase 4: Canary Deploys, Plugin System, Traffic Replay, Feature Flags.
- Phase 5: Content Security, Multi-Tenant Isolation, Audit Logs.

## 6. Operational Considerations

- SLOs: p99 latency budgets per route; error budgets by tenant.
- Capacity: Redis sizing for limiter/queue; HA pairs; persistence.
- Security: Secrets rotation policy; key management for JWT/API keys.
- Testing: Contract tests per route; chaos tests for breakers/retries; replay sandbox.

## 7. Interfaces & Types (Implementation Hints)

See `services/api-gateway/src/services.ts` for phase and feature flag scaffolding to map runtime capabilities with the design above.
