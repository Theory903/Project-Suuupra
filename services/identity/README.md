# Identity Service

Production‑grade Identity service (auth, RBAC/tenancy, audit) with Spring Authorization Server (OIDC).

- Port: 8081 (configurable)
- Datastores: Postgres, Redis
- Build: Maven (do not run build by default)

## OIDC / Authorization Server

- Discovery: `GET /.well-known/openid-configuration`
- JWKS: `GET /oauth2/jwks`
- Authorize: `GET /oauth2/authorize`
- Token: `POST /oauth2/token`

### Config-driven Clients

Configure under `security.oauth.clients` in `application.yml`:

```yaml
security:
  oauth:
    clients:
      - clientId: sample-public-client
        redirectUris:
          - http://localhost:3000/callback
        grants: [authorization_code, refresh_token]
        scopes: [openid, profile, api]
      - clientId: sample-confidential-client
        clientSecret: "{noop}secret"
        grants: [client_credentials]
        scopes: [api]
```

### Client Credentials example

```bash
curl -s -X POST http://localhost:8081/oauth2/token \
  -u sample-confidential-client:secret \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&scope=api'
```

### Authorization Code + PKCE (high level)

1) Create code verifier+challenge, open browser to `/oauth2/authorize?response_type=code&client_id=sample-public-client&redirect_uri=http://localhost:3000/callback&scope=openid%20profile%20api&code_challenge=<BASE64URL_SHA256>&code_challenge_method=S256`
2) Exchange `code` at `/oauth2/token` with `grant_type=authorization_code`, `client_id`, `redirect_uri`, `code_verifier`.

## Migration Note

- Legacy endpoints `/api/v1/auth/login` and `/api/v1/auth/register` return `X-Auth-Deprecated: true` and will be removed. Use OIDC flows above.

## DPoP & mTLS

- Protected endpoints issue `DPoP-Nonce` and require DPoP JWT including the nonce; `cnf.jkt` must match the access token claim
- Admin/high‑risk routes can require mTLS via annotation; configure ingress with client cert validation

## WebAuthn (Passkeys)

- Endpoints:
  - POST `/api/v1/webauthn/register/start` → creation options
  - POST `/api/v1/webauthn/register/finish` → persist credential
  - POST `/api/v1/webauthn/assert/start` → request options
  - POST `/api/v1/webauthn/assert/finish` → verify assertion
- Admin:
  - GET `/api/v1/admin/webauthn/users/{userId}/credentials` (optional `?aaguid=`)
  - PATCH `/api/v1/admin/webauthn/credentials/{credentialId}` rename
  - DELETE `/api/v1/admin/webauthn/credentials/{credentialId}` / DELETE `/api/v1/admin/webauthn/users/{userId}/credentials`

## Local Development

```bash
docker run -p 5432:5432 -e POSTGRES_PASSWORD=identity -e POSTGRES_DB=identity postgres:15
docker run -p 6379:6379 redis:7
cd services/identity && ./mvnw spring-boot:run
```

Smoke tests:

```bash
curl -s localhost:8081/actuator/health | jq
curl -s http://localhost:8081/.well-known/openid-configuration | jq
```

## Observability

- Prometheus metrics at `/actuator/prometheus`; OpenTelemetry tracing enabled (OTLP exporter)
- Grafana dashboard: `monitoring/grafana/dashboards/identity.json`

## Security & Supply Chain

- ES256 JWT; JWKS at `/.well-known/jwks.json` with ETag and TTL
- SBOM (CycloneDX) and OWASP dependency-check
- Release signing via `-P release` with GPG configured
