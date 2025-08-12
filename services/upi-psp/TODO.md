# Beyond‑UPI PSP (Mobile) — Engineering Backlog

Secure, inclusive PSP app for Beyond‑UPI with alias privacy, delegated pay, MINI controls, group commits/splits, offline vouchers, device linking, and unified statements.

## Global KPIs

- App crashes < 0.3% sessions
- Payer confirm → success: perceived p95 ≤ 1.2 s (includes network/UX)
- SDK integration time (merchant) ≤ 2 days to first live payment (sample app + docs)
- MINI policy violation detection ≥ 99.99%

## Milestone 1 — Foundations & Security [Weeks 1‑3]

- [ ] Project setup & CI
  - [ ] Flutter stable; flavors (dev/stage/prod); CI for analyze/test/build
  - Acceptance: green pipeline on PR; signed release build artifact

- [ ] Device security
  - [ ] Root/JB detection, screen protection, app integrity checks
  - [ ] Device fingerprint; secure storage bootstrap
  - Acceptance: security gates block on compromised device; audit event fired

- [ ] Auth & device binding
  - [ ] Passkey‑first login; SMS number attestation; session handoff QR
  - [ ] Link/revoke devices; remote freeze
  - Acceptance: linking requires possession + biometric/passkey

## Milestone 2 — Payments UX & Aliases [Weeks 3‑6]

- [ ] Send/Request money flows (P2P/P2M)
  - [ ] Recipient selection (VPA/mobile/QR); amount entry; review; confirm; receipt
  - [ ] gRPC client to `upi-core` and REST to `payments`
  - Acceptance: happy paths green; idempotency preserved on retry

- [ ] Private, tokenized handles (aliases)
  - [ ] Create/rotate/revoke from settings; show verified name preview pre‑confirm
  - [ ] Back‑compat: raw VPA entry prompts upgrade to alias
  - Acceptance: alias never displayed as PII in UI logs; rotation transparent for saved contacts

## Milestone 3 — Delegations & MINI [Weeks 6‑9]

- [ ] Delegated Pay (UPI Circle)
  - [ ] Link lifecycle (invite/accept/suspend/revoke); policies (caps/category/time/geo)
  - [ ] Full mode: silent under cap; Partial mode: real‑time approvals
  - Acceptance: approval p95 ≤ 2 s; receipts labeled “Paid by A via B”

- [ ] UPI MINI
  - [ ] Guardian link mandatory; templates (School‑Only, Transit‑Only)
  - [ ] Real‑time notifications + weekly digest; always require PIN/biometric
  - Acceptance: blocked tx shows clear reason; guardian override path logged

## Milestone 4 — Groups, Self‑Transfer, Statements [Weeks 9‑12]

- [ ] Group Commit & Split
  - [ ] Create groups; split equal/itemized; quorum tracking; escrow indicators
  - [ ] Visual status (“3 of 5 paid”); capture when all pay
  - Acceptance: if one hold fails, all released; no orphaned debits shown

- [ ] Easy Self‑Transfer
  - [ ] Discover & link owned accounts; one‑tap transfer; rules UI (sweeps/top‑ups)
  - Acceptance: setup time < 60 s; wrong‑account prevention via owned‑by‑user attestation banner

- [ ] Statement Builder (client views)
  - [ ] Combined/per‑account/family/business views; tags/categories
  - [ ] Exports flow: CSV/XLSX/PDF; GSTR JSON hand‑off to backend
  - Acceptance: first unified view < 2 min post consent

## Milestone 5 — Offline & Routing UX [Weeks 12‑14]

- [ ] Offline payments
  - [ ] Voucher wallet UI: issue N vouchers (device‑bound, capped); redeem via QR/NFC/ultrasonic
  - [ ] Sync center and conflict resolution banners
  - Acceptance: offline redeem ≤ 2 s; double‑spend rejection clearly surfaced post‑sync

- [ ] Multi‑rail routing banners
  - [ ] UX for degraded rail with optional consented fallback (fee display if any)
  - Acceptance: receipts store planned and actual rail

## Observability & Quality

- [ ] Structured logs (privacy‑safe), crash reporting, performance traces
- [ ] Feature flags per epic; remote config for kill‑switches
- [ ] Accessibility: voiceover labels, font scaling, contrast

## Security & Privacy

- [ ] Least‑privilege permissions; background networking constraints
- [ ] PII minimization; redaction in logs; consent artifact storage and purge UI
- [ ] Field encryption for sensitive local caches


