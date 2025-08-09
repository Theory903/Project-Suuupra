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

1. Register and login (legacy endpoints, marked deprecated)

```bash
curl -s -X POST http://localhost:8081/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"Str0ngPassw0rd!"}' | jq

curl -s -X POST http://localhost:8081/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"Str0ngPassw0rd!"}' | jq
```

2. Fetch profile

```bash
TOKEN="<accessToken>"
curl -s http://localhost:8081/api/v1/users/me -H "authorization: Bearer $TOKEN" | jq
```

3. OIDC discovery (preferred integration)

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

### 8.3 OAuth2/OIDC (Spring Authorization Server)

- OIDC discovery, JWKS, authorization, token, and userinfo endpoints are enabled
- Config-driven clients (public PKCE and confidential)
- Token customizer adds `roles`; scopes configurable per client
- Legacy login/register are deprecated via `X-Auth-Deprecated: true`

### 8.4 DPoP and mTLS (High-Risk Flows)

- DPoP nonce challenges: server issues `DPoP-Nonce` and expects nonce in DPoP JWT
- Replay protection and `cnf.jkt` binding validated on protected routes
- Optional mTLS for admin/high-risk endpoints via annotation and filter

### 8.5 WebAuthn (Passkeys)

- Registration and assertion ceremonies implemented with challenge storage in Redis
- Credential storage with signCount, AAGUID, friendly name; admin list/rename/delete
- Step-up protection: annotate sensitive admin endpoints (`@StepUpProtected`)

<!-- consolidated above into 8.3 and added details for nonce and WebAuthn -->

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
- DPoP nonce challenges; `cnf.jkt` proof binding; optional mTLS on admin APIs
- RFC alignment: revocation (7009), introspection (7662), userinfo

---

## 10 · Observability

| Metric | Meaning | Alert |
| ------ | ------- | ----- |
| auth_latency_p95/99 | Login/introspect latency | p99 > 200ms |
| lockout_rate | % of locked-out attempts | spike alert |
| jwks_cache_hit_ratio | JWKS cache efficiency | drop alert |
| cache_hits/misses | Caffeine effectiveness | trend |
| dpop_nonce_challenges_total | DPoP nonce challenges issued | spike alert |
| `webauthn_(register\|assert)_(success\|failure)_total` | WebAuthn success/failure | failure spike |

Tracing (OTLP) recommended around login, token, introspect; include tenant (non‑PII) as baggage.

---

## 11 · Operations & Infra

- HA Postgres/Redis, KMS/Vault for secrets/keys; Terraform modules + GitOps CD
- Multi‑AZ; optional multi‑region DR; PITR backups and restore drills
- Supply chain: SAST/DAST, SBOM, signing (cosign), provenance

---

## 12 · API Reference

### 12.1 Public Auth (legacy — deprecated)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/v1/auth/register` | Register (deprecated; prefer OIDC flows) |
| POST | `/api/v1/auth/login` | Login (deprecated; prefer OIDC flows) |
| POST | `/api/v1/auth/token/refresh` | Rotate refresh, issue access |
| POST | `/api/v1/auth/token/introspect` | Token validity and claims |
| POST | `/api/v1/auth/logout` | Revoke via refresh; bump `sv` |

### 12.2 User APIs

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/v1/users/me` | Current user profile |
| GET | `/api/v1/users/sessions` | List sessions |
| POST | `/api/v1/users/sessions/{sid}/revoke` | Revoke session by id |
| POST | `/api/v1/users/token/revoke` | Denylist current access token |

### 12.3 MFA (TOTP)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/v1/mfa/enroll/init` | Start TOTP enrollment (QR/secret) |
| POST | `/api/v1/mfa/enroll/verify` | Verify TOTP and enable |
| POST | `/api/v1/mfa/backup/verify` | Verify a backup code |

### 12.4 WebAuthn (Passkeys)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/v1/webauthn/register/start` | Begin registration (creation options) |
| POST | `/api/v1/webauthn/register/finish` | Finish registration |
| POST | `/api/v1/webauthn/assert/start` | Begin assertion (request options) |
| POST | `/api/v1/webauthn/assert/finish` | Finish assertion |

### 12.5 OIDC / SAS

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/.well-known/openid-configuration` | Discovery |
| GET | `/oauth2/jwks` or `/.well-known/jwks.json` | JWKS |
| GET | `/oauth2/authorize` | Authorization endpoint |
| POST | `/oauth2/token` | Token endpoint (DPoP nonce challenge supported) |
| GET | `/userinfo` | OIDC UserInfo |

See API Gateway’s Identity Integration guide for consumer configuration details: [API Gateway – Identity Integration](api-gateway.md#81-identity-integration-jwtjwks-with-es256)

### 12.6 Admin — RBAC, Tenants, Policies

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/v1/admin/rbac/users/{userId}/roles` | List user roles |
| POST | `/api/v1/admin/rbac/users/assign-roles` | Assign roles to users |
| GET | `/api/v1/admin/tenants/{tenantId}/users/{userId}/roles` | List roles in tenant |
| POST | `/api/v1/admin/tenants/{tenantId}/users/{userId}/roles/{role}` | Grant role in tenant |
| DELETE | `/api/v1/admin/tenants/{tenantId}/users/{userId}/roles/{role}` | Revoke role in tenant |
| POST | `/api/v1/admin/tenants/{tenantId}/admins/{userId}` | Add delegated admin |
| DELETE | `/api/v1/admin/tenants/{tenantId}/admins/{userId}` | Remove delegated admin |
| GET | `/api/v1/admin/tenants/{tenantId}/admins` | List delegated admins |
| POST | `/api/v1/admin/memberships/tenant/{tenantId}/assign` | Bulk assign roles |
| POST | `/api/v1/admin/memberships/tenant/{tenantId}/revoke` | Bulk revoke roles |
| POST | `/api/v1/admin/policies` | Create/update ABAC policy (mode) |

### 12.7 Admin — Roles & Role Templates

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/v1/admin/roles` | List roles |
| POST | `/api/v1/admin/roles` | Create role |
| DELETE | `/api/v1/admin/roles/{roleName}` | Delete role |
| POST | `/api/v1/admin/roles/{roleName}/permissions` | Add permissions |
| DELETE | `/api/v1/admin/roles/{roleName}/permissions` | Remove permissions |
| GET | `/api/v1/admin/role-templates` | List templates |
| POST | `/api/v1/admin/role-templates` | Create template |
| POST | `/api/v1/admin/role-templates/{templateId}/permissions` | Add perms to template |
| DELETE | `/api/v1/admin/role-templates/{templateId}/permissions` | Remove perms from template |
| POST | `/api/v1/admin/role-templates/{templateId}/materialize-role` | Create role from template |

### 12.8 Admin — Keys, MFA, WebAuthn

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/v1/admin/keys/rotate` | Create next signing key |
| POST | `/api/v1/admin/keys/promote?kid=...` | Promote key to active |
| POST | `/api/v1/admin/mfa/users/{userId}/reset` | Reset MFA for user |
| GET | `/api/v1/admin/webauthn/users/{userId}/credentials` | List credentials (filter by `aaguid`) |
| PATCH | `/api/v1/admin/webauthn/credentials/{credentialId}` | Rename credential |
| DELETE | `/api/v1/admin/webauthn/credentials/{credentialId}` | Delete credential |
| DELETE | `/api/v1/admin/webauthn/users/{userId}/credentials` | Delete all credentials |

Security notes: Admin routes require JWT with roles, DPoP, and may require mTLS and step‑up (`@StepUpProtected`).

---

## 13 · What’s Next (Optional)

- MFA backup codes and TOTP secret encryption, drift window, QR provisioning
- Terraform modules for infra (Redis/KMS) and GitOps CD; renovate and provenance
- DPoP alignment in resource services (cnf.jkt validation and nonce flow)
- ABAC policy authoring UX and dry-run → enforce workflows

---

## 14 · References

- OWASP ASVS, NIST 800‑63
- OAuth2/OIDC, RFC 7009/7662
- Spring Authorization Server docs
