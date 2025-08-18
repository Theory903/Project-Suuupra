# API Reference

## Overview

Comprehensive API documentation for all Suuupra platform services, including REST APIs, GraphQL endpoints, WebSocket connections, and authentication methods.

## Quick Start

### Base URLs
- **Development**: `http://localhost:8080/api/v1`
- **Staging**: `https://api-staging.suuupra.com/api/v1`
- **Production**: `https://api.suuupra.com/api/v1`

### Authentication
All API requests require authentication via JWT tokens:

```bash
# Get access token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token in requests
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/v1/users/me
```

## Service APIs

### Core Services
- [API Gateway](api-gateway.md) - Request routing, authentication, rate limiting
- [Identity Service](identity.md) - Authentication, authorization, user management
- [Content Service](content.md) - Content management, file uploads, search
- [Commerce Service](commerce.md) - Orders, cart, inventory management

### Financial Services
- [Payment Gateway](payments.md) - Payment processing, fraud detection
- [UPI Core](upi-core.md) - UPI transaction processing
- [Bank Simulator](bank-simulator.md) - Banking operations simulation
- [Ledger Service](ledger.md) - Financial ledger and accounting

### Media & Streaming
- [VOD Service](vod.md) - Video on demand
- [Live Streaming](live-streaming.md) - Real-time video streaming
- [Live Classes](live-classes.md) - Interactive live sessions

### Intelligence & Analytics
- [LLM Tutor](llm-tutor.md) - AI-powered tutoring
- [Search Service](search.md) - Full-text search and discovery
- [Recommendations](recommendations.md) - Personalized recommendations
- [Analytics](analytics.md) - Real-time analytics and insights

## API Standards

### REST API Design
- **HTTP Methods**: GET, POST, PUT, DELETE, PATCH
- **Status Codes**: Standard HTTP status codes
- **Content Type**: `application/json`
- **Versioning**: URL path versioning (`/api/v1/`)

### Request/Response Format
```json
// Request
{
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "metadata": {
    "requestId": "req-123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}

// Response (Success)
{
  "success": true,
  "data": {
    "id": "user-123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "metadata": {
    "requestId": "req-123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}

// Response (Error)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  },
  "metadata": {
    "requestId": "req-123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Pagination
```json
// Request
GET /api/v1/users?page=1&limit=20&sort=created_at&order=desc

// Response
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Filtering and Sorting
```bash
# Filtering
GET /api/v1/users?status=active&role=admin&created_after=2025-01-01

# Sorting
GET /api/v1/users?sort=name,created_at&order=asc,desc

# Search
GET /api/v1/content?q=javascript&category=tutorial&limit=10
```

## Authentication

### JWT Token Structure
```json
{
  "header": {
    "alg": "ES256",
    "typ": "JWT",
    "kid": "key-id-123"
  },
  "payload": {
    "iss": "https://identity.suuupra.com",
    "aud": "suuupra-api",
    "sub": "user-123",
    "iat": 1642680000,
    "exp": 1642683600,
    "roles": ["user"],
    "permissions": ["read:profile", "write:profile"],
    "tenant": "org-456"
  }
}
```

### OAuth 2.0 / OIDC Flow
```bash
# 1. Authorization request
GET https://identity.suuupra.com/oauth2/authorize?
    response_type=code&
    client_id=your-client-id&
    redirect_uri=https://app.suuupra.com/callback&
    scope=openid profile email&
    state=random-state

# 2. Token exchange
POST https://identity.suuupra.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=auth-code&
redirect_uri=https://app.suuupra.com/callback&
client_id=your-client-id&
client_secret=your-client-secret
```

### API Key Authentication
```bash
# Using API key in header
curl -H "X-API-Key: your-api-key" \
  http://localhost:8080/api/v1/data

# Using API key in query parameter
curl "http://localhost:8080/api/v1/data?api_key=your-api-key"
```

## Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1642680000
Retry-After: 60
```

### Rate Limit Tiers
| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| Free | 60 | 100 |
| Basic | 1000 | 2000 |
| Pro | 10000 | 20000 |
| Enterprise | Custom | Custom |

## Error Handling

### Standard Error Codes

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | VALIDATION_ERROR | Request validation failed |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict |
| 422 | UNPROCESSABLE_ENTITY | Semantic error |
| 429 | RATE_LIMITED | Rate limit exceeded |
| 500 | INTERNAL_ERROR | Server error |
| 502 | BAD_GATEWAY | Upstream error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Invalid email format",
          "code": "INVALID_FORMAT"
        }
      ]
    }
  },
  "metadata": {
    "requestId": "req-123",
    "timestamp": "2025-01-15T10:30:00Z",
    "path": "/api/v1/users"
  }
}
```

## WebSocket APIs

### Connection
```javascript
const ws = new WebSocket('wss://api.suuupra.com/ws');

// Authentication
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
};
```

### Message Format
```json
// Client to Server
{
  "type": "subscribe",
  "channel": "user-notifications",
  "data": {
    "userId": "user-123"
  }
}

// Server to Client
{
  "type": "notification",
  "channel": "user-notifications",
  "data": {
    "id": "notif-456",
    "message": "New message received",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

## GraphQL API

### Endpoint
- **URL**: `https://api.suuupra.com/graphql`
- **Playground**: `https://api.suuupra.com/graphql` (development only)

### Schema Overview
```graphql
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: Pagination): UserConnection
  content(id: ID!): Content
  search(query: String!, filters: SearchFilters): SearchResults
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload
  deleteUser(id: ID!): DeleteUserPayload
}

type Subscription {
  userUpdated(userId: ID!): User
  notifications(userId: ID!): Notification
}
```

### Example Queries
```graphql
# Get user with profile
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    profile {
      avatar
      bio
    }
    createdAt
  }
}

# Search content
query SearchContent($query: String!, $limit: Int) {
  search(query: $query, filters: { limit: $limit }) {
    totalCount
    edges {
      node {
        id
        title
        description
        createdAt
      }
    }
  }
}

# Create user
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    success
    user {
      id
      name
      email
    }
    errors {
      field
      message
    }
  }
}
```

## SDK and Client Libraries

### JavaScript/TypeScript
```bash
npm install @suuupra/api-client

# Usage
import { SuuupraClient } from '@suuupra/api-client';

const client = new SuuupraClient({
  baseUrl: 'https://api.suuupra.com',
  apiKey: 'your-api-key'
});

const user = await client.users.get('user-123');
```

### Python
```bash
pip install suuupra-api

# Usage
from suuupra import SuuupraClient

client = SuuupraClient(
    base_url='https://api.suuupra.com',
    api_key='your-api-key'
)

user = client.users.get('user-123')
```

### Go
```bash
go get github.com/suuupra/go-client

# Usage
import "github.com/suuupra/go-client"

client := suuupra.NewClient("https://api.suuupra.com", "your-api-key")
user, err := client.Users.Get("user-123")
```

## Testing

### API Testing Tools
- **Postman**: Collection available at `/docs/postman/`
- **Insomnia**: Workspace available at `/docs/insomnia/`
- **OpenAPI**: Spec available at `/api/v1/openapi.json`

### Test Environment
- **Base URL**: `https://api-test.suuupra.com`
- **Test Data**: Automatically reset daily
- **Rate Limits**: Relaxed for testing

### Example Test Scripts
```javascript
// Jest API test
describe('Users API', () => {
  test('should create user', async () => {
    const response = await fetch('/api/v1/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com'
      })
    });
    
    expect(response.status).toBe(201);
    const user = await response.json();
    expect(user.data.email).toBe('test@example.com');
  });
});
```

## Webhooks

### Webhook Events
```json
{
  "id": "evt_123",
  "type": "user.created",
  "data": {
    "object": {
      "id": "user-123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "created": 1642680000,
  "livemode": true
}
```

### Webhook Verification
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## Migration Guides

### API Versioning
- **v1**: Current stable version
- **v2**: Beta version (breaking changes)
- **Deprecation**: 6 months notice before removal

### Breaking Changes
- Always communicated via changelog
- Migration guides provided
- Backward compatibility when possible

## Support

### Documentation
- **OpenAPI Specs**: Available for all services
- **Interactive Docs**: Swagger UI at `/docs`
- **Changelog**: Track API changes

### Getting Help
- **Developer Portal**: https://developers.suuupra.com
- **Support Email**: api-support@suuupra.com
- **Community**: Discord #api-support
- **GitHub Issues**: Report bugs and feature requests
