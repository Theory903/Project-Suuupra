# Identity Service

Scaffolded per `services/identity/TODO.md`. Implements Identity (auth, RBAC, tenancy, audit) and OIDC Authorization Server.

- Port: 8081 (configurable)
- Datastores: Postgres, Redis
- Build: Maven (do not run build by default)

## OIDC / Authorization Server (Phase E)

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
