# Identity Service

## Overview

Production-ready Identity and Access Management (IAM) service providing authentication, authorization, and user management with OAuth 2.0/OIDC compliance.

## Quick Start

```bash
cd services/identity
./mvnw spring-boot:run

# Health check
curl localhost:8081/actuator/health
```

## Core Features

### Authentication
- Password authentication with Argon2id hashing
- Multi-factor authentication (TOTP, SMS, WebAuthn)
- OAuth 2.0 Authorization Code Flow with PKCE
- Session management with JWT tokens

### Authorization
- Role-Based Access Control (RBAC)
- Attribute-Based Access Control (ABAC)
- Tenant-scoped permissions
- Fine-grained permission system

### Standards Compliance
- OAuth 2.0 and OpenID Connect (OIDC)
- JWKS endpoint for token verification
- Token introspection and revocation
- DPoP (Demonstration of Proof of Possession)

## API Endpoints

### Authentication (Deprecated - Use OIDC)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/logout` | User logout |
| POST | `/api/v1/auth/token/refresh` | Refresh access token |

### OIDC/OAuth 2.0 (Recommended)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/.well-known/openid-configuration` | OIDC discovery |
| GET | `/oauth2/jwks` | JSON Web Key Set |
| GET | `/oauth2/authorize` | Authorization endpoint |
| POST | `/oauth2/token` | Token endpoint |
| GET | `/userinfo` | User information |

### User Management
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/users/me` | Get current user |
| PUT | `/api/v1/users/me` | Update current user |
| GET | `/api/v1/users/sessions` | List user sessions |
| DELETE | `/api/v1/users/sessions/{id}` | Revoke session |

### Multi-Factor Authentication
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/mfa/enroll/init` | Start TOTP enrollment |
| POST | `/api/v1/mfa/enroll/verify` | Complete TOTP enrollment |
| POST | `/api/v1/mfa/verify` | Verify TOTP code |

### WebAuthn (Passkeys)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/webauthn/register/start` | Start passkey registration |
| POST | `/api/v1/webauthn/register/finish` | Complete passkey registration |
| POST | `/api/v1/webauthn/assert/start` | Start passkey authentication |
| POST | `/api/v1/webauthn/assert/finish` | Complete passkey authentication |

### Admin APIs
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/admin/users` | List users |
| POST | `/api/v1/admin/users/{id}/roles` | Assign roles |
| DELETE | `/api/v1/admin/users/{id}/roles/{role}` | Remove role |
| GET | `/api/v1/admin/roles` | List roles |
| POST | `/api/v1/admin/roles` | Create role |

## Configuration

### JWT Settings
```yaml
jwt:
  issuer: "https://identity.suuupra.local"
  access-token-ttl: PT15M  # 15 minutes
  refresh-token-ttl: P30D  # 30 days
  signing-algorithm: ES256
```

### OAuth 2.0 Client
```yaml
clients:
  - client-id: "suuupra-web"
    client-secret: "{noop}secret"
    redirect-uris:
      - "https://app.suuupra.com/callback"
    scopes:
      - "openid"
      - "profile"
      - "email"
    grant-types:
      - "authorization_code"
      - "refresh_token"
```

### Security Settings
```yaml
security:
  password:
    min-length: 12
    require-uppercase: true
    require-lowercase: true
    require-numbers: true
    require-symbols: true
  
  mfa:
    required-for-admin: true
    totp-issuer: "Suuupra"
  
  rate-limiting:
    login-attempts: 5
    lockout-duration: PT15M
```

## Database Schema

### Core Tables
```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

-- User Roles
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    tenant_id UUID,
    PRIMARY KEY (user_id, role_id, tenant_id)
);

-- Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    resource VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL
);

-- Role Permissions
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);
```

## Security

### Password Security
- Argon2id hashing with 32MB memory, 2 iterations
- Password policy enforcement
- Breach detection via HaveIBeenPwned API
- Account lockout after failed attempts

### Token Security
- ES256 signed JWTs with key rotation
- Short-lived access tokens (15 min)
- Refresh token rotation
- Token revocation support

### Session Security
- Secure session management
- Device tracking and management
- Concurrent session limits
- Session invalidation on security events

## Monitoring

### Key Metrics
- `identity_login_attempts_total` - Login attempt counter
- `identity_login_duration_seconds` - Login latency
- `identity_mfa_verifications_total` - MFA verification attempts
- `identity_token_validations_total` - Token validation requests

### Health Checks
- Database connectivity
- Redis connectivity
- External service dependencies

## Operations

### Key Rotation
```bash
# Generate new signing key
curl -X POST http://localhost:8081/api/v1/admin/keys/rotate

# Promote key to active
curl -X POST http://localhost:8081/api/v1/admin/keys/promote?kid=new-key-id
```

### User Management
```bash
# Reset user MFA
curl -X POST http://localhost:8081/api/v1/admin/mfa/users/{userId}/reset

# Lock user account
curl -X POST http://localhost:8081/api/v1/admin/users/{userId}/lock
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid JWT | Token expired or malformed | Check token format and expiry |
| JWKS fetch failed | Network or configuration issue | Verify JWKS endpoint |
| Login failed | Invalid credentials or account locked | Check user status and credentials |
| MFA required | User has MFA enabled | Complete MFA flow |

## Development

### Local Setup
```bash
# Prerequisites
java >= 17
postgresql >= 15
redis >= 7

# Database
docker-compose up postgres redis

# Build and run
./mvnw spring-boot:run
```

### Testing
```bash
./mvnw test                    # Unit tests
./mvnw test -Dtest=*IT         # Integration tests
./mvnw verify                  # All tests + quality checks
```
