#!/bin/bash

# Development startup script for UPI PSP Service

set -e

echo "🚀 Starting UPI PSP Service in Development Mode"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go is not installed${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Starting dependencies with Docker Compose...${NC}"

# Start dependencies (PostgreSQL and Redis)
docker-compose up -d postgres redis

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for dependencies to be ready...${NC}"
sleep 10

# Check if PostgreSQL is ready
until docker-compose exec -T postgres pg_isready -U upi_psp -d upi_psp_db; do
    echo -e "${YELLOW}⏳ Waiting for PostgreSQL...${NC}"
    sleep 2
done

# Check if Redis is ready
until docker-compose exec -T redis redis-cli ping; do
    echo -e "${YELLOW}⏳ Waiting for Redis...${NC}"
    sleep 2
done

echo -e "${GREEN}✅ Dependencies are ready${NC}"

# Set environment variables for development
export NODE_ENV=development
export PORT=8097
export LOG_LEVEL=debug
export DATABASE_URL="postgresql://upi_psp:upi_psp_password@localhost:5434/upi_psp_db?sslmode=disable"
export REDIS_HOST=localhost
export REDIS_PORT=6381
export REDIS_PASSWORD=""
export REDIS_DB=0

# Install dependencies
echo -e "${BLUE}📥 Installing Go dependencies...${NC}"
go mod tidy

# Run database migrations (handled by GORM auto-migrate)
echo -e "${BLUE}🗄️  Running database setup...${NC}"

# Build and run the application
echo -e "${GREEN}🏃 Starting UPI PSP Service...${NC}"
echo -e "${BLUE}📍 Service will be available at: http://localhost:8097${NC}"
echo -e "${BLUE}📍 Health check: http://localhost:8097/health${NC}"
echo -e "${BLUE}📍 API docs: http://localhost:8097/api/v1${NC}"

# Run with hot reload using air (if installed) or regular go run
if command -v air &> /dev/null; then
    echo -e "${YELLOW}🔄 Using air for hot reload${NC}"
    air
else
    echo -e "${YELLOW}📝 Hot reload not available. Install 'air' for better development experience:${NC}"
    echo -e "${YELLOW}   go install github.com/cosmtrek/air@latest${NC}"
    go run cmd/main.go
fi
