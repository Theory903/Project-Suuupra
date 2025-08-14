# Beyond‑UPI Core — Engineering Backlog

Authoritative UPI‑compatible switch with cryptographic verification, routing, VPA resolution, settlement, and eventing.

## Global SLOs & KPIs

- Core RPC p95 ≤ 100 ms (ProcessTransaction excluding downstream bank latency)
- Switch success ≥ 99.99% p50 day; duplicate route ≤ 1 in 10M
- Deterministic reversals on partial failures; exactly‑once event emission

## Milestone A — Foundations [Weeks 1‑3] ✅ **Infrastructure Complete**

- [x] **Database & Configuration** ✅ **COMPLETED**
  - [x] PostgreSQL database connection with proper timeout handling
  - [x] Environment variable configuration with defaults and validation
  - [x] Database health checks and connection pooling
  - [x] Proper error handling and logging for database operations
  - Acceptance: ✅ Service starts reliably, maintains stable DB connections

- [x] **Service Infrastructure** ✅ **COMPLETED**  
  - [x] Go service with gRPC and HTTP servers running concurrently
  - [x] Docker containerization with proper health checks
  - [x] Service discovery and port configuration (gRPC: 50052, HTTP: 8081)
  - [x] Graceful shutdown and signal handling
  - Acceptance: ✅ Both servers operational, health endpoints responding

- [ ] Protocol and schemas
  - [x] Basic `upi_core.proto` structure established
  - [ ] Finalize versioning and comprehensive error model
  - [ ] Correlation IDs, dedupe keys, idempotency tokens
  - Acceptance: Same request + same features ⇒ same response

- [ ] Crypto & Security
  - [ ] RSA‑SHA256 signatures; mTLS; key rotation
  - [ ] Request canonicalization and signature verification libs
  - Acceptance: invalid signature rejection path and audit

- [ ] Storage and state
  - [x] Basic database schema foundation established
  - [ ] Complete transactions, VPAs, banks, settlements schema and indices
  - [ ] Redis caches for VPA and bank health; distributed locking for idempotency
  - Acceptance: failover without duplicate commit

## Milestone B — Routing & Execution [Weeks 3‑6]

- [ ] Routing Engine
  - [ ] Policy‑aware routing: bank availability, health SLOs, MCC rules
  - [ ] Circuit breakers; moving averages; brownout and blackout handling
  - Acceptance: simulated brownout keeps success drop < 0.3%

- [ ] Transaction State Machine
  - [ ] PENDING→SUCCESS|FAILED|TIMEOUT|REVERSED transitions
  - [ ] Debit→Credit choreography; reversal on partial failure
  - Acceptance: no orphan debits; invariant checks pass in soak

## Milestone C — Settlement & Reconciliation [Weeks 6‑9]

- [ ] Settlement batches and netting windows
  - [ ] Daily and intra‑day windows; bank reports; consistency checks
  - [ ] Deterministic IDs; resumable processors; DLQ
  - Acceptance: missed windows 0; reconciliation mismatch ≤ 1 ppm

- [ ] Events & Outbox
  - [ ] Exactly‑once event emission to Kafka via outbox pattern
  - [ ] Topics: upi.transactions, upi.settlements; partitioning strategy
  - Acceptance: duplicate processing tests green under failover

## Milestone D — Health & Tooling [Weeks 9‑11]

- [ ] Bank health monitors and admin RPCs
  - [ ] Register/Update bank, heartbeats, success/latency gauges
  - [ ] Manual circuit controls for incidents
  - Acceptance: admin tooling changes routing within 1 min

- [ ] Observability
  - [ ] RED metrics, detailed traces; structured logs
  - [ ] SLO dashboards; alert rules
  - Acceptance: golden signals in dashboards for all RPCs

## Testing Strategy

- Contract tests for `upi_core.proto` (backward compatible)
- Deterministic replay suite for routing decisions
- Chaos: bank timeouts/errors; ensure reversals and circuiting
- Performance: p95 budget compliance with 10k TPS synthetic


