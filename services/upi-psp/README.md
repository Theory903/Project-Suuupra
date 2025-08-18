# UPI PSP Service

A comprehensive **Payment Service Provider (PSP)** backend service for the UPI (Unified Payments Interface) ecosystem. This service provides secure payment processing, user management, device binding, QR code generation, and transaction management capabilities.

## 🎯 Overview

The UPI PSP Service acts as the backend for mobile payment applications, providing:

- **Secure Authentication**: JWT-based auth with device binding and biometric support
- **UPI Transaction Processing**: P2P, P2M payments with real-time status tracking
- **QR Code Management**: Dynamic QR generation and scanning capabilities
- **Device Security**: Multi-device support with security validation
- **Payment Requests**: Money request and collection features
- **Transaction History**: Comprehensive transaction tracking and reporting

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Applications                      │
│               (iOS, Android, Web)                          │
└─────────────────────────────────────────────────────────────┘
                              │ REST API
┌─────────────────────────────────────────────────────────────┐
│                    UPI PSP Service                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   Auth      │ │   Payment   │ │        QR Code          │ │
│  │  Service    │ │   Service   │ │       Service           │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ gRPC
┌─────────────────────────────────────────────────────────────┐
│                    UPI Core Service                         │
│              (Transaction Processing)                       │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Go 1.21+**
- **Docker & Docker Compose**
- **PostgreSQL 15+**
- **Redis 7+**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/upi-psp
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose**
   ```bash
   make docker-run
   ```

4. **Or run in development mode**
   ```bash
   make dev
   ```

The service will be available at:
- **API**: http://localhost:8097
- **Health Check**: http://localhost:8097/health
- **Metrics**: http://localhost:9090

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone_number": "+1234567890",
  "password": "securepassword",
  "pin": "1234"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword",
  "device_id": "device-123",
  "device_info": {
    "device_name": "iPhone 14",
    "platform": "ios",
    "os_version": "16.0",
    "app_version": "1.0.0"
  }
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

### Payment Endpoints

#### Send Money
```http
POST /api/v1/payments/send
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "payer_vpa": "user@suuupra",
  "payee_vpa": "merchant@suuupra",
  "amount": "100.00",
  "description": "Payment for services",
  "pin": "1234"
}
```

#### Request Money
```http
POST /api/v1/payments/request
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "requester_vpa": "user@suuupra",
  "payer_vpa": "friend@suuupra",
  "amount": "50.00",
  "description": "Dinner split",
  "expires_in": 24
}
```

#### Transaction History
```http
GET /api/v1/payments/history?limit=20&offset=0
Authorization: Bearer <access-token>
```

### QR Code Endpoints

#### Generate QR Code
```http
POST /api/v1/qr/generate
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "vpa": "merchant@suuupra",
  "amount": "250.00",
  "description": "Product purchase",
  "type": "dynamic",
  "expires_in": 30
}
```

#### Scan QR Code
```http
POST /api/v1/qr/scan
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "qr_string": "upi://pay?pa=merchant@suuupra&am=250.00&tn=Product%20purchase",
  "device_id": "device-123"
}
```

## 🔧 Configuration

The service uses environment variables for configuration. Key settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `8097` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_HOST` | Redis host | `localhost` |
| `JWT_SECRET` | JWT signing secret | - |
| `UPI_PSP_ID` | UPI PSP identifier | `SUUUPRAPSP` |

See [`.env.example`](.env.example) for complete configuration options.

## 🛠️ Development

### Available Commands

```bash
# Development
make dev              # Start with hot reload
make run              # Run without hot reload
make build            # Build binary

# Testing
make test             # Run tests
make test-coverage    # Run tests with coverage
make test-race        # Run tests with race detection

# Code Quality
make lint             # Run linter
make format           # Format code
make security-scan    # Security analysis

# Docker
make docker-build     # Build Docker image
make docker-run       # Start services
make docker-stop      # Stop services

# Database
make db-migrate       # Run migrations
make db-reset         # Reset database

# Utilities
make clean            # Clean build artifacts
make install-tools    # Install dev tools
```

### Project Structure

```
services/upi-psp/
├── cmd/                    # Application entry points
│   └── main.go
├── internal/               # Private application code
│   ├── config/            # Configuration management
│   ├── database/          # Database connection & migrations
│   ├── handlers/          # HTTP request handlers
│   ├── middleware/        # HTTP middleware
│   ├── models/           # Database models
│   ├── repository/       # Data access layer
│   └── services/         # Business logic
├── scripts/              # Build and deployment scripts
├── tests/                # Integration tests
├── docker-compose.yml    # Docker services
├── Dockerfile           # Container definition
├── Makefile            # Build automation
└── README.md           # This file
```

## 🔒 Security Features

### Authentication & Authorization
- **JWT-based authentication** with refresh tokens
- **Device binding** and fingerprinting
- **Multi-factor authentication** support
- **Role-based access control**

### Transaction Security
- **PIN verification** for sensitive operations
- **Biometric authentication** support
- **Device trust scoring**
- **Real-time fraud detection**
- **Transaction encryption**

### API Security
- **Rate limiting** per user/device
- **Request size limits**
- **CORS protection**
- **Security headers**
- **Input validation & sanitization**

## 📊 Monitoring & Observability

### Health Checks
- **Liveness**: `/health`
- **Readiness**: `/ready`
- **Metrics**: `/metrics`

### Logging
- **Structured JSON logging**
- **Request/response logging**
- **Error tracking**
- **Performance metrics**

### Metrics
- **Prometheus integration**
- **Custom business metrics**
- **Database connection pooling**
- **Redis performance metrics**

## 🧪 Testing

The service includes comprehensive testing:

```bash
# Run all tests
make test

# Run with coverage
make test-coverage

# Run specific test
go test -v ./internal/services/...

# Run benchmarks
make benchmark
```

### Test Categories
- **Unit Tests**: Service and handler logic
- **Integration Tests**: Database and external service interactions
- **API Tests**: End-to-end HTTP endpoint testing
- **Security Tests**: Authentication and authorization flows

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
make docker-build
make docker-run
```

### Production Deployment
```bash
# Build for production
make build-linux

# Deploy (customize based on your infrastructure)
make deploy
```

### Environment Setup
- **Development**: Use `.env` file
- **Staging/Production**: Use environment variables or secret management
- **Kubernetes**: Use ConfigMaps and Secrets

## 🔄 Database Schema

### Core Tables
- **users**: User accounts and profiles
- **devices**: Registered user devices
- **vpas**: Virtual Payment Addresses
- **transactions**: Payment transactions
- **qr_codes**: Generated QR codes
- **payment_requests**: Money requests

### Key Features
- **UUID primary keys** for security
- **Soft deletes** for audit trails
- **Indexed queries** for performance
- **JSONB metadata** for flexibility

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow coding standards (`make format lint`)
4. Write tests for new functionality
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Coding Standards
- **Go best practices** and idiomatic code
- **Comprehensive error handling**
- **Structured logging**
- **Unit test coverage > 80%**
- **API documentation** for new endpoints

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Documentation**: Internal docs
- **Issues**: GitHub Issues
- **Email**: dev-team@suuupra.com

---

**Built with ❤️ using Go, PostgreSQL, and Redis**