---
title: "Identity Service – Master Explainer Guide"
version: "v2"
last_updated: "2025-08-08"
audience: [new-engineers, SREs, architects]
reading_time: "~90-120 min"
---

## 0 · How to Use This Guide

- Start with Quickstart Lab, then deep dives per feature.
- Use code refs and folder map to locate implementations quickly.
- For production, see the Hardening and Ops sections.

---

## 1 · What · Why · Who (at a Glance)

| Aspect | Details |
| ------ | ------- |
| **What** | A production-ready Identity and Access Management (IAM) service: password auth + MFA, RBAC with tenant scoping, OAuth2/OIDC Authorization Server, sessions and revocation, audit logging |
| **Why** | Centralize authN/Z, standardize tokens (OIDC), simplify client integration (Gateway via JWKS), and meet security/ops requirements |
| **Who** | Backend engineers, SREs, security engineers integrating auth into services and operating the platform |
| **Learning Objectives** | Run the service locally • Register/login and fetch profile • Use OIDC discovery + JWKS • Manage roles/permissions • Enable MFA • Operate sessions/revocation • Observe and harden |

---

## 2 · When to Use & When Not to Use

| Use-Case | Rationale |
| -------- | --------- |
| **Ideal** | Polyglot microservices needing unified auth (JWT/OIDC) and RBAC with tenant scoping |
| **Anti-Pattern** | Single small app without SSO/OIDC needs or RBAC complexity |

---

## 3 · Prerequisites & Setup

| Item | Version | Local Command |
| ----------- | ------- | ------------- |
| Java | 17+ | `sdk use java 17` |
| Maven | 3.9+ | `./mvnw -v` |
| Postgres | 15 | `docker run -p 5432:5432 -e POSTGRES_PASSWORD=identity -e POSTGRES_DB=identity postgres:15` |
| Redis | 7+ | `docker run -p 6379:6379 redis:7` |

```bash
# Install & boot (local)
cd services/identity
./mvnw spring-boot:run

# Smoke test
curl -s localhost:8081/actuator/health | jq
```

---

## 4 · Quickstart Lab (20 min)

1) Register and login (legacy endpoints, marked deprecated)

```bash
curl -s -X POST http://localhost:8081/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"Str0ngPassw0rd!"}' | jq

curl -s -X POST http://localhost:8081/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"Str0ngPassw0rd!"}' | jq
```

2) Fetch profile

```bash
TOKEN="<accessToken>"
curl -s http://localhost:8081/api/v1/users/me -H "authorization: Bearer $TOKEN" | jq
```

3) OIDC discovery (preferred integration)

```bash
curl -s http://localhost:8081/.well-known/openid-configuration | jq
```

---

## 5 · Project Layout

```text
services/identity/
  src/main/java/com/suuupra/identity/
    IdentityApplication.java
    config/                # Security, SAS, Cache, Method security
    auth/                  # Controllers, services, DTOs, JWT, rate/lockout, HIBP
    user/                  # User domain (entities, repos, controller)
    rbac/                  # Permission evaluator, admin RBAC APIs, caching
    tenant/                # Tenant-scoped roles + admin APIs
    mfa/                   # TOTP enrollment/verification + entities
    audit/                 # Append-only audit log service (hash chain)
    keys/                  # Key rotation scaffolding
    notifications/         # Email service abstraction
  src/main/resources/
    application.yml        # Config, JWT, OIDC, rate limits, clients
    db/migration/          # Flyway migrations
```

---

## 6 · Tech Stack & Libraries (+Why)

| Layer | Tech | Rationale | Trade-offs |
| ----- | ---- | --------- | ---------- |
| API | Spring Boot | Mature ecosystem | JVM footprint |
| Auth | Spring Security, SAS | First-class OAuth2/OIDC | Config breadth |
| JWT | Nimbus JOSE | ES256/JWKs standard | Key mgmt required |
| DB | Postgres 15 | ACID + SQL | Ops overhead |
| Cache | Redis 7 | Sub-ms hot paths | Persistence config |
| Cache (local) | Caffeine | TinyLFU performance | Local-only |

---

## 7 · Architecture & Request Flow

### 7.1 High-Level Diagram

```text
Client → Gateway → Identity (AuthN/Z, SAS) → Postgres/Redis
                     ↑
                 JWKS/OIDC
```

### 7.2 Sequence: Login (legacy) → SAS migration

1) POST /auth/login → rate-limit → lockout → authenticate → issue access/refresh
2) Preferred: OIDC Auth Code + PKCE via `/oauth2/authorize` + `/oauth2/token`
3) Gateway validates tokens via OIDC discovery/JWKS

---

## 8 · Feature Deep Dives

### 8.1 Password Auth

- Argon2id hashing; password policy checks
- HIBP k‑anonymity check (configurable)
- Rate limits per email/IP + exponential backoff/lockout

### 8.2 Tokens & Sessions

- ES256 JWTs with `kid`, `sid` (session id), `sv` (session version), `roles`
- Refresh tokens (opaque, Redis) with rotation
- Revocation: session-version + jti denylist; `/users/token/revoke`
- Introspection endpoint returns `active`, `sub`, `sid`, `sv`

### 8.3 OAuth2/OIDC (SAS)

- OIDC discovery, JWKS, authorization, and token endpoints
- Config-driven clients (public PKCE and confidential)
- Token customizer adds `roles`; scopes configurable per client
- Migration: legacy login/register marked `X-Auth-Deprecated: true`

### 8.4 RBAC & Tenancy

- Roles ↔ Permissions; permission-based guards via `@PreAuthorize("hasPermission(..)")`
- Tenant-scoped role assignments; `TenantContext` from `X-Tenant` or token claim
- Caffeine cache for checks + targeted eviction on admin changes
- Admin APIs: list/assign roles, role CRUD, tenant role ops

### 8.5 MFA (TOTP)

- TOTP enrollment (otpauth URI) and verification
- Roadmap: backup codes (hashed), secret encryption, drift window, step-up policies

### 8.6 Audit Logging

- Append-only audit sink in Postgres with hash chaining
- Admin role/tenant changes recorded with actor, target, IP/UA, diff

---

## 9 · Security

- ES256 keys; JWKS with cache TTL/backoff; rotation scaffolding (`keys.rotate`)
- HSTS, CSP, XSS, frame options enabled; no secrets in repo
- Lockout/backoff + rate limits; device UA/IP capture per session
- RFC roadmap: token revocation (7009), introspection (7662), userinfo

---

## 10 · Observability

| Metric | Meaning | Alert |
| ------ | ------- | ----- |
| auth_latency_p95/99 | Login/introspect latency | p99 > 200ms |
| lockout_rate | % of locked-out attempts | spike alert |
| jwks_cache_hit_ratio | JWKS cache efficiency | drop alert |
| cache_hits/misses | Caffeine effectiveness | trend |

Tracing (OTLP) recommended around login, token, introspect; include tenant (non‑PII) as baggage.

---

## 11 · Operations & Infra

- HA Postgres/Redis, KMS/Vault for secrets/keys; Terraform modules + GitOps CD
- Multi‑AZ; optional multi‑region DR; PITR backups and restore drills
- Supply chain: SAST/DAST, SBOM, signing (cosign), provenance

---

## 12 · API Reference (selected)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/v1/auth/register` | Register (deprecated; use OIDC flows) |
| POST | `/api/v1/auth/login` | Login (deprecated; use OIDC flows) |
| POST | `/api/v1/auth/token/refresh` | Rotate refresh, issue access |
| POST | `/api/v1/auth/token/introspect` | Token validity and claims |
| POST | `/api/v1/auth/logout` | Revoke via refresh; bump `sv` |
| GET | `/api/v1/users/me` | Current user profile |
| GET/POST | `/api/v1/admin/rbac/*` | Roles/permissions admin |
| GET/POST | `/api/v1/admin/tenants/*` | Tenant role admin |
| OIDC | `/.well-known/openid-configuration` | Discovery |
| OIDC | `/oauth2/jwks`, `/oauth2/authorize`, `/oauth2/token` | OIDC endpoints |

---

## 13 · Remaining Work

- SAS userinfo, revocation (7009), introspection (7662)
- MFA backup codes, encryption, drift window, QR provisioning
- Terraform modules for Redis/KMS; CI security gates; dashboards/alerts
- Full `hasPermission` coverage + ABAC hooks

---

## 14 · References

- OWASP ASVS, NIST 800‑63
- OAuth2/OIDC, RFC 7009/7662
- Spring Authorization Server docs


