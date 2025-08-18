#!/bin/bash

set -e

echo "🧪 Running Mass Live Service Tests..."

# Configuration
TEST_TIMEOUT=${TEST_TIMEOUT:-"300s"}
COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-"80"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 Test Configuration:"
echo "   Timeout: ${TEST_TIMEOUT}"
echo "   Coverage Threshold: ${COVERAGE_THRESHOLD}%"

# Check if Go is available
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go is not installed or not in PATH${NC}"
    exit 1
fi

# Start test dependencies
echo "🐳 Starting test dependencies..."
docker-compose -f docker-compose.test.yml up -d postgres redis minio

# Wait for services to be ready
echo "⏳ Waiting for test dependencies to be ready..."
sleep 10

# Function to check service health
check_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN}✅ $service is ready${NC}"
            return 0
        fi
        echo "⏳ Waiting for $service (attempt $attempt/$max_attempts)..."
        sleep 2
        ((attempt++))
    done

    echo -e "${RED}❌ $service failed to start${NC}"
    return 1
}

# Check test dependencies
check_service "PostgreSQL" 5434
check_service "Redis" 6381
check_service "MinIO" 9002

# Set test environment variables
export DATABASE_URL="postgres://massuser:masspass@localhost:5434/mass_live_test_db?sslmode=disable"
export REDIS_URL="redis://localhost:6381/15"
export S3_BUCKET="test-bucket"
export AWS_ACCESS_KEY_ID="minioadmin"
export AWS_SECRET_ACCESS_KEY="minioadmin"
export S3_ENDPOINT="http://localhost:9002"
export JWT_SECRET="test-jwt-secret"
export ENVIRONMENT="test"

# Create test database
echo "🗄️  Setting up test database..."
PGPASSWORD=masspass createdb -h localhost -p 5434 -U massuser mass_live_test_db 2>/dev/null || echo "Database already exists"

# Run database migrations (if available)
if [ -f "migrations/migrate.sh" ]; then
    echo "🔄 Running database migrations..."
    ./migrations/migrate.sh
fi

# Clean previous test results
echo "🧹 Cleaning previous test results..."
rm -rf coverage.out coverage.html

# Run unit tests with coverage
echo "🔬 Running unit tests..."
go test -v -race -coverprofile=coverage.out -covermode=atomic -timeout="${TEST_TIMEOUT}" ./...

# Check if tests passed
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Unit tests failed${NC}"
    docker-compose -f docker-compose.test.yml down
    exit 1
fi

# Generate coverage report
echo "📊 Generating coverage report..."
go tool cover -html=coverage.out -o coverage.html

# Check coverage threshold
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
echo "📈 Test coverage: ${COVERAGE}%"

if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Coverage ${COVERAGE}% is below threshold ${COVERAGE_THRESHOLD}%${NC}"
else
    echo -e "${GREEN}✅ Coverage ${COVERAGE}% meets threshold ${COVERAGE_THRESHOLD}%${NC}"
fi

# Run integration tests if available
if [ -d "tests/integration" ]; then
    echo "🔗 Running integration tests..."
    go test -v -tags=integration -timeout="${TEST_TIMEOUT}" ./tests/integration/...
fi

# Run benchmark tests
echo "⚡ Running benchmark tests..."
go test -bench=. -benchmem ./... | tee benchmark_results.txt

# Cleanup
echo "🧹 Cleaning up test environment..."
docker-compose -f docker-compose.test.yml down

echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
echo "📊 Coverage report available at: coverage.html"
echo "⚡ Benchmark results available at: benchmark_results.txt"
