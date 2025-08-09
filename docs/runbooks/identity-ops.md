# Identity Ops Runbook

## Key Rotation

- Use POST /api/v1/admin/keys/rotate to create next key
- Promote when staged: POST /api/v1/admin/keys/promote?kid=...
- Verify JWKS exposes both keys; monitor JWKSFailures and client verifications

## mTLS Cert Rotation

- Rotate CA in ingress; preload client certs; schedule dual-trust window
- Monitor mtls_enforcement_failures_total and handshake failures

## DPoP Nonce Issues

- Check dpop_nonce_challenges_total and dpop_replay_errors_total
- Inspect gateway logs for missing DPoP headers

## WebAuthn Incidents

- Check failure ratio panel; list credentials via admin endpoints
- Roll back authenticator policy (residentKey/UV) via config

## DR/Backup

- Backup Postgres (clients, users, keys) and Redis (sessions, nonces)
- Restore order: DB -> Redis -> roll keys -> restart

## Backups/Restore Drills

- Nightly logical backups: pg_dump (DB) and Redis RDB/AOF snapshots
- Weekly restore rehearsal in staging; document RTO/RPO

## Key/Cert Rotation Rehearsals

- JWT: generate next, promote, verify clients, deprecate previous
- mTLS: distribute client certs, update truststore, dual-trust window

## Redis/Postgres HA

- Postgres: streaming replication with automated failover (Patroni or RDS Multi-AZ)
- Redis: Sentinel or managed Redis with multi-AZ; configure client timeouts and retries

## TLS Client Cert Distribution

- Use Vault/ACME/PKI to issue client certs; set expiry < 90 days; automate renewal pipelines

## SLOs & Burn-Rate Alerts

- Define SLOs (Availability, Token P95/P99, Authz error budget)
- Burn-rate alerts (short/long windows) tied to dashboards

## Data Retention & Rotation

- Audit logs WORM retention (e.g., 365 days) with periodic archival
- Secrets rotation automation (DB, Redis, OAuth clients) every 90 days
