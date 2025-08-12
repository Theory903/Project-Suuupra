# Beyond‑UPI Payments Service

## Overview

The Payments Service is the orchestrator and gateway for the Beyond‑UPI rail. It exposes developer‑grade APIs, enforces risk and policy, drives multi‑rail routing, runs the event‑sourced ledger (with outbox/CDC), and guarantees idempotent, exactly‑once postings across money‑moving flows. It integrates with `upi-core` for UPI, external card/netbanking rails, and powers merchant settlement, refunds/disputes, escrow/holds/streams, aliases, delegated pay, groups/splits, MINI/MAX tiers, offline vouchers, and webhooks.

This repository currently uses Node.js + TypeScript (Fastify) for the HTTP surface and orchestration, with Kafka/Redis/Postgres as core infra. Migration to Go for hot paths can happen behind a stable API facade if/when needed.

## Responsibilities

- Core payment lifecycle: intent → authorize → capture/hold → settle → refund → dispute
- Event‑sourced ledger with exactly‑once semantics (outbox + CDC)
- Idempotency on all unsafe APIs
- Multi‑rail routing and rail health SLOs/circuit breakers
- Risk service integration and dynamic, risk‑based authentication
- Alias privacy: private, rotating, scoped payee/payer aliases
- Offline vouchers issue/redeem/sync
- Delegated pay, UPI MINI and UPI MAX policy layers
- Group collect, split, and escrow commit flows
- Deterministic refunds and disputes (ODR)
- Webhooks/eventing (ordered, signed, at‑least‑once, replay)
- Settlement windows, fees, reconciliation

## Non‑Functional Requirements

- Success rate: ≥ 99.9% p50 day, ≥ 99.5% p95 day
- Latency (payer confirm → success): p50 ≤ 300 ms; p95 ≤ 800 ms on online rails
- Duplicate rate: ≤ 1 in 10M money‑moving calls
- Observability: OpenTelemetry traces; RED metrics per endpoint; per‑bank SLOs
- Privacy by design: tokenization, data minimization, DEPA‑style consent artifacts
- Security: device binding, passkeys, HSM/KMS for keys/signing, field‑level encryption

## Architecture (high‑level)

```
┌──────────┐     ┌───────────────────────┐     ┌──────────────────────┐
│  Client  │──►──│ Payments (Fastify API)│──►──│ Orchestrators (Core) │
└──────────┘     └─────────┬─────────────┘     └─────────┬────────────┘
                            │                               │
                ┌───────────▼───────────┐       ┌──────────▼──────────┐
                │ Ledger + Outbox + CDC │       │ Risk + Policy Layer │
                └───────────┬───────────┘       └──────────┬──────────┘
                            │                               │
                ┌───────────▼───────────┐       ┌──────────▼──────────┐
                │ Rail Router + Health  │──────►│ Rail Adapters       │
                └───────────┬───────────┘       │  (UPI, Cards, ... ) │
                            │                   └──────────────────────┘
               ┌────────────▼───────────┐
               │ Webhooks + Delivery    │
               └────────────────────────┘
```

## Feature Map (ownership)

- Aliases: owned here; resolve internally at payment time; rotation/revoke safe by design
- Offline vouchers: issue, merchant redeem envelope, sync/reconcile
- Delegated pay, MINI/MAX: policy control and audit; PSP provides UX
- Group collect/splits: escrow holds + quorum capture; at‑most‑once capture
- Self‑transfer: account discovery, rules engine (sweeps/top‑ups)
- Statement Builder: unified views and exports; depends on AA integrations
- Escrow/Hold/Streams: programmable money primitives; idempotent release
- Refunds/Disputes: first‑class objects; deterministic states; ERP webhooks
- Dynamic risk: assess → recommend PASS|CHALLENGE|BLOCK; idempotent decisioning
- Multi‑rail routing: SLO/circuit breakers; consented fallback
- Limits/Controls: merchant/MCC/geo/device caps and allow/deny lists
- Device linking/session handoff: policy and audit surface; PSP handles UX
- Webhooks/Eventing: HMAC signatures, ordering, replay, dead‑letter
- Developer platform: SDKs, sandbox personas, certification suite

## API Surface (v1 overview)

- Payments and Intents: `/payments`, `/intents`
- Aliases: `/aliases`, `/aliases/{id}/rotate`, `/aliases/{id}/revoke`
- Offline: `/offline/vouchers`, `/offline/redeem`, `/offline/sync`
- Delegations: `/delegations`, `/delegations/{id}/approve|suspend|revoke`
- MINI/MAX: `/mini/policies`, `/guardians/{id}/link`, `/trusted_parties`
- Groups/Splits: `/groups`, `/collects`, `/collects/{id}/commit|cancel`
- Self‑transfers and Rules: `/accounts`, `/self_transfers`, `/rules`
- Escrow/Streams: `/escrows`, `/escrows/{id}/release|cancel`, `/streams`
- Refunds/Disputes: `/refunds`, `/disputes`
- Risk: `/risk/assess`
- Routing/Health: `/routes/decide`, `/meta/rails/health`
- Limits: `/limits`
- Devices/Sessions: `/devices/link|revoke`, `/session/handoff`
- Webhooks: `/webhooks/endpoints`

See `src/api/openapi.yaml` for detailed schemas (to be filled as part of MVP Rail epic).

## KPIs (global)

- Success rate (end‑to‑end)
- Latency (confirm → success)
- Duplicate rate
- Refund p95 ≤ 15 min; dispute TAT ≤ 48 h (MAX)
- Webhook delivery p95 ≤ 2 s; redelivery success ≥ 99.99%

## Local Development

Prerequisites: Node 18+, pnpm/npm, Postgres 15+, Redis 7+, Kafka 3.5+, OpenTelemetry collector (optional).

1) Install

   ```bash
   cd services/payments
pnpm i # or npm i
   ```

2) Configure

   ```bash
   cp .env.example .env
# fill DB, Kafka, Redis, secrets
   ```

3) Run

   ```bash
pnpm start
```

The default HTTP port is 8084 (see `src/server.ts`).

## Configuration (env)

```env
# HTTP
PORT=8084

# Postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=payments

# Redis / Kafka
REDIS_URL=redis://localhost:6379/0
KAFKA_BROKERS=localhost:9092

# Services
UPI_CORE_GRPC=localhost:50051
RISK_SERVICE_URL=http://localhost:8081

# Security
JWT_SECRET=replace-me
HMAC_SIGNING_SECRET=replace-me
FIELD_ENCRYPTION_KEY=replace-with-32-bytes

# Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
METRICS_PORT=9090
```

## Observability & SLOs

- Tracing: OpenTelemetry spans across request → risk → route → rail adapter
- Metrics: RED per endpoint; rail health gauges; routing decisions; idempotency hits
- Logs: structured, correlation IDs, request and money‑moving audit fields
- SLOs: per‑rail success/latency budgets; circuit breaker auto‑fallback

## Security & Privacy

- Device binding, passkeys; HSM/KMS for signing keys
- Tokenized aliases; data minimization; consent artifacts
- Field‑level encryption for sensitive payloads
- Access control: least privilege, service accounts, scoped tokens

## Rollout Plan (high level)

1. MVP Rail: payments, idempotency, ledger, refunds, webhooks
2. Privacy & Safety: aliases, risk‑based auth, device linking
3. Money Programming: escrow/hold, streams
4. Tiers: UPI MAX (invoices/settlements), UPI MINI (policies)
5. Social: delegated pay, groups/splits, self‑transfer
6. Statements: AA + unified ledger, exports
7. Offline: vouchers/TEE/USSD pilots → GA
8. Cross‑border pilots

## Repository Structure

```
services/payments/
  ├── src/
  │   ├── server.ts                 # HTTP entrypoint (Fastify)
  │   ├── api/openapi.yaml          # API spec (to be completed)
  │   ├── modules/                  # Feature modules (tbd)
  │   └── lib/                      # Shared libs (idempotency, ledger client, etc.)
  ├── scripts/
  ├── tsconfig.json
  └── package.json
```

## Contributing

- Changes require tests and docs updates
- Keep API changes behind feature flags and versioned routes
- Follow conventional commits and pre‑commit hooks

## License

MIT


