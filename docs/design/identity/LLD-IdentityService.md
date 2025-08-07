# Low-Level Design: Identity Service

## 1. 🎯 Overview

This document provides the low-level design for the **Identity Service**. This service is responsible for managing users, authentication, and authorization.

### 1.1. Learning Objectives

- Implement OAuth 2.0 and OpenID Connect (OIDC).
- Design a flexible RBAC system.
- Implement secure password storage and management.

---

## 2. 🏗️ Architecture

The Identity Service is built with **Java and Spring Boot**, chosen for their robust security features and mature ecosystem.

**Key Components**:
- **OAuth 2.0/OIDC Provider**: We use the Spring Authorization Server to implement our OAuth 2.0 and OIDC provider.
- **User Management**: Handles user registration, profile management, and password management.
- **RBAC Engine**: Manages roles and permissions.

---

## 3. 🗄️ Database Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- ... other fields
);

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- User-roles mapping table
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- Permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

-- Role-permissions mapping table
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);
```text

---

## 4. 🔐 Security

- **Password Hashing**: We use **Argon2** for password hashing, which is a modern, secure hashing algorithm.
- **MFA**: We support multiple MFA factors, including TOTP, SMS, and push notifications.
- **Session Management**: We use JWTs for stateless session management, with short-lived access tokens and long-lived refresh tokens.
