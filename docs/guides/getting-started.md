# Getting Started with Suuupra Platform

## Overview

Quick setup guide to get the Suuupra platform running locally for development, with step-by-step instructions for each service.

## Prerequisites

### System Requirements
- **OS**: macOS, Linux, or Windows with WSL2
- **RAM**: 16GB minimum, 32GB recommended
- **Storage**: 50GB free space
- **CPU**: 4+ cores recommended

### Required Tools

| Tool | Version | Installation |
|------|---------|--------------|
| Docker | 24+ | [Install Docker](https://docs.docker.com/get-docker/) |
| Docker Compose | v2+ | Included with Docker Desktop |
| Node.js | 18 LTS | [Install Node.js](https://nodejs.org/) or `nvm install 18` |
| Python | 3.11+ | [Install Python](https://python.org/) or `pyenv install 3.11` |
| Go | 1.21+ | [Install Go](https://golang.org/) or `gvm install go1.21` |
| Java | 17+ | [Install Java](https://adoptopenjdk.net/) or `sdk install java 17` |
| kubectl | Latest | [Install kubectl](https://kubernetes.io/docs/tasks/tools/) |
| Git | 2.30+ | [Install Git](https://git-scm.com/) |

### Optional Tools
- **k9s**: Kubernetes cluster management - `brew install k9s`
- **jq**: JSON processing - `brew install jq`
- **httpie**: HTTP client - `brew install httpie`

## Quick Start (15 minutes)

### 1. Clone Repository
```bash
git clone https://github.com/suuupra/platform.git
cd platform
```

### 2. Start Core Infrastructure
```bash
# Start databases and supporting services
docker-compose -f docker-compose.infrastructure.yml up -d

# Verify services are running
docker-compose ps
```

### 3. Start Core Services
```bash
# API Gateway
cd services/api-gateway
npm install
npm run dev &

# Identity Service  
cd ../identity
./mvnw spring-boot:run &

# Content Service
cd ../content
npm install
npm run dev &

# Wait for services to start (30 seconds)
sleep 30
```

### 4. Verify Setup
```bash
# Check service health
curl http://localhost:8080/health  # API Gateway
curl http://localhost:8081/actuator/health  # Identity Service
curl http://localhost:8082/health  # Content Service

# Expected response: {"status": "healthy"} or similar
```

### 5. Access Web Interface
- **Application**: http://localhost:3000
- **API Gateway**: http://localhost:8080
- **Grafana**: http://localhost:3001 (admin/admin)
- **Kibana**: http://localhost:5601

## Detailed Setup

### Infrastructure Services

#### Start All Infrastructure
```bash
# PostgreSQL, Redis, Elasticsearch, etc.
docker-compose -f docker-compose.infrastructure.yml up -d

# Check status
docker-compose -f docker-compose.infrastructure.yml ps
```

#### Individual Infrastructure Services
```bash
# PostgreSQL (Identity, Commerce)
docker run -d --name postgres \
  -e POSTGRES_DB=suuupra \
  -e POSTGRES_USER=suuupra \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15

# Redis (Caching, Sessions)
docker run -d --name redis \
  -p 6379:6379 \
  redis:7

# Elasticsearch (Search, Logs)
docker run -d --name elasticsearch \
  -e discovery.type=single-node \
  -e ES_JAVA_OPTS="-Xms512m -Xmx512m" \
  -p 9200:9200 \
  elasticsearch:8.11.0

# MongoDB (Content)
docker run -d --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  -p 27017:27017 \
  mongo:6

# MinIO (File Storage)
docker run -d --name minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

### Core Services Setup

#### API Gateway
```bash
cd services/api-gateway

# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Test
curl http://localhost:8080/health
```

#### Identity Service
```bash
cd services/identity

# Environment setup
cp src/main/resources/application-dev.yml.example \
   src/main/resources/application-dev.yml
# Edit configuration as needed

# Start service
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Test
curl http://localhost:8081/actuator/health
```

#### Content Service
```bash
cd services/content

# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Configure MongoDB and Elasticsearch URLs

# Database setup
npm run db:setup

# Start service
npm run dev

# Test
curl http://localhost:8082/health
```

#### Commerce Service
```bash
cd services/commerce

# Python virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Environment setup
cp .env.example .env
# Configure database URLs

# Database migration
alembic upgrade head

# Start service
uvicorn main:app --reload --port 8084

# Test
curl http://localhost:8084/health
```

#### Payment Service
```bash
cd services/payments

# Install dependencies
go mod tidy

# Environment setup
cp .env.example .env
# Configure database and external service URLs

# Database migration
make db-migrate

# Start service
go run main.go

# Test
curl http://localhost:8085/health
```

## Development Workflow

### Making Changes

#### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

#### 2. Make Changes
```bash
# Edit code
vim services/api-gateway/src/routes/users.ts

# Test locally
npm test
```

#### 3. Commit Changes
```bash
git add .
git commit -m "feat: add user profile endpoint"
```

#### 4. Push and Create PR
```bash
git push origin feature/your-feature-name
# Create pull request via GitHub/GitLab
```

### Testing

#### Unit Tests
```bash
# API Gateway
cd services/api-gateway
npm test

# Identity Service
cd services/identity
./mvnw test

# Content Service
cd services/content
npm test

# Commerce Service
cd services/commerce
pytest

# Payment Service
cd services/payments
go test ./...
```

#### Integration Tests
```bash
# Full integration test suite
npm run test:integration

# Service-specific integration tests
cd services/api-gateway
npm run test:integration
```

### Database Operations

#### Migrations
```bash
# Identity Service (Flyway)
cd services/identity
./mvnw flyway:migrate

# Commerce Service (Alembic)
cd services/commerce
alembic upgrade head

# Content Service (MongoDB)
cd services/content
npm run db:migrate
```

#### Seeding Test Data
```bash
# Seed all services
make seed-all

# Individual services
cd services/identity && npm run seed
cd services/content && npm run seed
cd services/commerce && python scripts/seed_data.py
```

## Configuration

### Environment Variables

#### API Gateway (.env)
```bash
NODE_ENV=development
PORT=8080
REDIS_URL=redis://localhost:6379
IDENTITY_SERVICE_URL=http://localhost:8081
CONTENT_SERVICE_URL=http://localhost:8082
LOG_LEVEL=debug
```

#### Identity Service (application-dev.yml)
```yaml
server:
  port: 8081

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/identity
    username: suuupra
    password: password
  
  redis:
    host: localhost
    port: 6379

jwt:
  issuer: http://localhost:8081
  access-token-ttl: PT15M
```

#### Content Service (.env)
```bash
NODE_ENV=development
PORT=8082
MONGODB_URL=mongodb://admin:password@localhost:27017/content?authSource=admin
ELASTICSEARCH_URL=http://localhost:9200
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

### Service Discovery
Services communicate via environment variables pointing to localhost ports during development:

```bash
# API Gateway discovers services via:
IDENTITY_SERVICE_URL=http://localhost:8081
CONTENT_SERVICE_URL=http://localhost:8082
COMMERCE_SERVICE_URL=http://localhost:8084
PAYMENT_SERVICE_URL=http://localhost:8085
```

## Monitoring and Debugging

### Logs
```bash
# View service logs
docker-compose logs -f api-gateway
docker-compose logs -f identity-service

# Application logs
tail -f services/api-gateway/logs/app.log
tail -f services/identity/logs/application.log
```

### Health Checks
```bash
# Check all services
./scripts/health-check.sh

# Individual service health
curl http://localhost:8080/health | jq
curl http://localhost:8081/actuator/health | jq
curl http://localhost:8082/health | jq
```

### Metrics and Monitoring
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Jaeger**: http://localhost:16686

### Database Access
```bash
# PostgreSQL
psql -h localhost -U suuupra -d suuupra

# MongoDB
mongosh mongodb://admin:password@localhost:27017/content?authSource=admin

# Redis
redis-cli -h localhost -p 6379

# Elasticsearch
curl http://localhost:9200/_cat/indices
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using a port
lsof -i :8080

# Kill process using port
kill -9 $(lsof -ti:8080)
```

#### Database Connection Issues
```bash
# Check database status
docker-compose ps postgres redis mongodb

# Restart database
docker-compose restart postgres

# Check connection
pg_isready -h localhost -p 5432
```

#### Service Dependencies
```bash
# Start services in order
docker-compose up -d postgres redis  # Databases first
sleep 10
npm run dev  # Then application services
```

#### Memory Issues
```bash
# Check Docker memory usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Settings > Resources > Memory > 8GB+

# Check system memory
free -h  # Linux
vm_stat  # macOS
```

### Getting Help

#### Documentation
- [Architecture Overview](../architecture/system-overview.md)
- [Service Documentation](../services/)
- [API Documentation](../api/)

#### Support Channels
- **Slack**: #platform-support
- **GitHub Issues**: Create issue with logs and reproduction steps
- **Team Chat**: @platform-team

#### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
export DEBUG=*

# Start with debug output
npm run dev:debug
```

## Next Steps

After getting the basic setup running:

1. **Explore Services**: Try the [API documentation](../api/)
2. **Run Tests**: Execute the test suites
3. **Make Changes**: Create a simple feature
4. **Deploy Locally**: Try Docker Compose full stack
5. **Learn Architecture**: Read the [system overview](../architecture/system-overview.md)

## Scripts and Automation

### Useful Scripts
```bash
# Start all services
./scripts/start-all.sh

# Stop all services  
./scripts/stop-all.sh

# Reset development environment
./scripts/reset-dev.sh

# Run health checks
./scripts/health-check.sh

# Seed test data
./scripts/seed-data.sh
```

### Makefile Commands
```bash
# Setup development environment
make setup

# Start all services
make dev

# Run tests
make test

# Clean up
make clean
```
