# Identity Service API Documentation

## Overview
The Identity Service provides comprehensive user authentication, authorization, and profile management for the Suuupra platform.

## Base URL
- Development: `http://localhost:8080`
- Production: `https://identity.suuupra.com`

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+91-9876543210"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

#### POST /api/v1/auth/login
Authenticate user and receive JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "expiresIn": 3600,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  }
}
```

#### POST /api/v1/auth/refresh
Refresh JWT access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "new_jwt_access_token",
  "expiresIn": 3600
}
```

#### POST /api/v1/auth/logout
Logout user and invalidate tokens.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### POST /api/v1/auth/validate
Validate JWT token and return user information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "valid": true,
  "userId": "user_123",
  "email": "user@example.com",
  "role": "USER",
  "permissions": ["read:profile", "write:profile"],
  "expiresAt": "2024-01-15T10:30:00Z"
}
```

### User Management Endpoints

#### GET /api/v1/users/profile
Get current user's profile information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+91-9876543210",
  "role": "USER",
  "status": "ACTIVE",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "lastLoginAt": "2024-01-15T09:00:00Z"
}
```

#### PUT /api/v1/users/profile
Update current user's profile information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+91-9876543210"
}
```

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+91-9876543210",
  "role": "USER",
  "status": "ACTIVE",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### GET /api/v1/users (Admin Only)
List all users with pagination.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `page`: Page number (default: 0)
- `size`: Page size (default: 20)

**Response (200):**
```json
[
  {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-15T09:00:00Z"
  }
]
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request data",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

## Security Features

### JWT Tokens
- **Access Token**: Short-lived (1 hour) for API access
- **Refresh Token**: Long-lived (30 days) for token renewal
- **Algorithm**: RS256 with RSA key pairs
- **Claims**: User ID, email, role, permissions, expiration

### Password Security
- **Minimum Length**: 8 characters
- **Requirements**: At least one uppercase, lowercase, number, and special character
- **Hashing**: bcrypt with salt rounds = 12
- **Rate Limiting**: Failed login attempts limited to 5 per 15 minutes

### Role-Based Access Control (RBAC)
- **USER**: Basic user permissions
- **ADMIN**: Full administrative access
- **TEACHER**: Course and content management
- **CREATOR**: Content creation and analytics

## Rate Limiting
- **Authentication endpoints**: 10 requests per minute per IP
- **User management**: 100 requests per minute per user
- **Token validation**: 1000 requests per minute per token

## Monitoring & Logging
- All authentication events are logged
- Failed login attempts trigger security alerts
- Token validation metrics are tracked
- User activity is monitored for anomalies