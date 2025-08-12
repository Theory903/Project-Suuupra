# Payments Service — Beyond‑UPI Backlog

This is the actionable, industry‑grade backlog mapping the Master PRD to engineering epics, milestones, and acceptance criteria. Timeboxes are indicative; sequence respects cross‑feature dependencies.

## Global KPIs & NFRs (apply to all epics)

- Success rate ≥ 99.9% p50 day, ≥ 99.5% p95 day
- Confirm→success latency p50 ≤ 300 ms; p95 ≤ 800 ms (online rails)
- Duplicate rate ≤ 1 in 10M money‑moving calls
- Observability: traces + RED metrics per endpoint; per‑bank SLOs & circuit breakers
- Idempotency on all unsafe APIs; event‑sourced ledger + outbox/CDC; exactly‑once postings

## Milestone 0 — Foundational (Ledger, Idempotency, Webhooks) [Weeks 1‑3]

- [ ] Event‑sourced ledger MVP
  - [ ] Append‑only postings; double‑entry with consistency checks
  - [ ] Outbox table + CDC publisher (Kafka) for exactly‑once
  - [ ] Idempotency keys middleware (body hash + header) with TTL index
  - Acceptance: concurrent duplicate POST returns same result; no double‑posting in ledger

- [ ] Webhooks subsystem
  - [ ] Endpoint mgmt: register/rotate secrets; HMAC signatures, versioned events
  - [ ] Ordered, at‑least‑once delivery with exponential backoff; dead‑letter topic/table
  - [ ] Replay API; consumer idempotency guide and examples
  - Acceptance: delivery p95 ≤ 2 s; replay preserves order by aggregate

## Milestone 1 — MVP Rail (Payments, Refunds) [Weeks 3‑6]

- [ ] Payment Intents + Payment capture
  - [ ] API: `POST /intents`, `POST /payments`
  - [ ] Integrate `upi-core` for UPI auth/capture; stub card/netbanking adapters
  - [ ] Routing scaffold and risk hook points
  - Acceptance: p95 latency ≤ 800 ms online; success ≥ 99.5% p95 day on sandbox rails

- [ ] Deterministic Refunds
  - [ ] Refund object; link to original txn; lock to prevent double refund
  - [ ] ERP webhook with signature; idempotent processing contract
  - Acceptance: refund p95 ≤ 15 min end‑to‑end

## Milestone 2 — Privacy & Safety (Aliases, Risk, Device) [Weeks 6‑9]

- [ ] Private Tokenized Handles (Aliases)
  - [ ] Lifecycle: CREATE→ACTIVATE→ROTATE→REVOKE; scopes (per‑counterparty/merchant/one‑time/time‑boxed)
  - [ ] Name‑match preview; back‑compat for raw VPA; resolver at payment time only
  - Acceptance: rotation doesn’t break saved beneficiaries; >80% alias use after 90d (metric hooks)

- [ ] Dynamic Risk‑Based Authentication
  - [ ] `POST /risk/assess` integrating device, velocity, amount, MCC, graph, new‑payee features
  - [ ] Policy thresholds per segment (MINI stricter); PASS|CHALLENGE|BLOCK
  - [ ] Persist explainability snapshot; idempotent decisions
  - Acceptance: challenge rate ≤ 8% P2M with fraud ≤ targets

- [ ] Device Linking & Session Handoff (surface + policy)
  - [ ] APIs: `/devices/link|revoke`, `/session/handoff`; passkey support; SMS number attest hooks
  - Acceptance: linking requires possession + biometric/passkey; unauthorized link ≈ 0

## Milestone 3 — Money Programming (Hold/Escrow/Streams) [Weeks 9‑12]

- [ ] Escrow / Hold & Capture
  - [ ] Single‑block‑multiple‑debit semantics; TTL & auto‑release; milestones
  - [ ] Idempotent release; failure rollback; invariant: no orphan debits
  - Acceptance: hold leakage 0; expired holds auto‑release

- [ ] Streaming Payments
  - [ ] APIs: create, start/pause/resume/close; rate and cap; metering ticks
  - Acceptance: drift < 1 increment per 10k ticks

## Milestone 4 — Tiers & Social (MAX, MINI, Delegations, Groups) [Weeks 12‑16]

- [ ] UPI MAX (Business Tier)
  - [ ] Invoices (GST aware, itemization, tips); selectable settlement windows (T+0/T+1)
  - [ ] Instant refunds/ERP webhooks; subscriptions/mandates scaffold
  - Acceptance: reconciliation mismatches ≤ 1 ppm; refund p95 ≤ 15 min

- [ ] UPI MINI (Minors)
  - [ ] Guardian link; policies (deny age‑restricted MCCs, allowlists); low offline caps
  - [ ] Weekly digest; real‑time guardian notifications
  - Acceptance: policy violation capture ≥ 99.99%; clear block reasons + override path

- [ ] Delegated Pay
  - [ ] Link lifecycle; policy engine (caps, category/time/geo, trusted merchants)
  - [ ] Partial mode real‑time approvals; Full mode caps enforcement
  - Acceptance: approval latency p95 ≤ 2 s; policy bypass 0; “Paid by A via B” labeling

- [ ] Group Commit & Split
  - [ ] Group entity, quorum; itemized or equal splits; escrow per participant
  - [ ] All‑or‑nothing capture with pro‑rata fallback (merchant opt‑in)
  - Acceptance: 100% consistency or full rollback; “3 of 5 paid” status API

## Milestone 5 — Routing, Limits, Settlements, Statements [Weeks 16‑20]

- [ ] Multi‑Rail Routing & Rail Health
  - [ ] Probes per bank/PSP; moving averages; SLO‑aware circuit breakers
  - [ ] Route planner with policy: “prefer UPI”, fee caps, consented fallback
  - Acceptance: outage success drop < 0.3%; false‑positive reroutes < 0.1%

- [ ] Limits & Controls
  - [ ] Aggregations per unit time; MCC/geo/device gates; allow/deny lists
  - Acceptance: policy eval p95 ≤ 10 ms; zero bypass with audit reasons

- [ ] Statement Builder (Services surface)
  - [ ] Unified ledger views and exports (CSV/XLSX/PDF signed, GSTR JSON)
  - [ ] AA consent artifacts storage and purge on revoke
  - Acceptance: first unified view < 2 min; auto‑classification ≥ 90%

- [ ] Settlement Windows, SLAs & Banners
  - [ ] Window scheduler, netting, reports; merchant‑visible countdown
  - [ ] Incident banners in payer/merchant APIs
  - Acceptance: missed windows 0; ETA accuracy ±2 min

## Milestone 6 — Offline & Cross‑Border [Weeks 20‑24]

- [ ] Offline Payments (Voucher/TEE/USSD/QR)
  - [ ] Voucher issue: device‑bound, counter, amount cap; redemption (offline envelope)
  - [ ] Sync & settle: first‑seen wins; duplicates rejected deterministically
  - Acceptance: double‑spend ≤ 5 ppm; PoS redemption ≤ 2 s

- [ ] Cross‑Border & FX (Phase 2)
  - [ ] ISO 20022 mapping; /fx quotes/locks; corridor configs; compliance checks
  - Acceptance: quote acceptance > 80%; slippage 0 (locked)

## Cross‑Feature Dependencies

- Ledger & Outbox before refunds/escrow/groups
- Risk before dynamic auth & MINI/MAX go‑live
- Alias & device linking before delegated pay
- Statement Builder depends on AA integrations & normalization

## Testing & Quality Gates

- Unit: ≥ 80% line, ≥ 90% critical modules (ledger, idempotency, routing)
- Integration: payments/refunds/escrow/groups end‑to‑end with `upi-core` sandbox
- Chaos: rail brownouts, Kafka partitions, DB failover; ensure circuit breakers and idempotency
- Load: k6 scenarios for p50/p95 targets; soak tests 24h without drift or duplicates

## Observability Tasks

- Traces: intent → risk → route → rail → ledger, with correlation IDs
- Metrics: RED, rail health gauges, idempotency hit rates, challenge rates, alias adoption
- Alerts: High failure rate, duplicate suspicion, rail degradation, settlement slip

## Security & Privacy Tasks

- HSM/KMS integration for signing/secrets
- Field‑level encryption; tokenization of sensitive identifiers
- DEPA‑style consent artifacts for statements/AA; data minimization reviews


