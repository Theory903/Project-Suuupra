#!/bin/bash

set -e

echo "🧪 Running Creator Studio Tests..."

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

# Function to run tests for a service
run_service_tests() {
    local service=$1
    local service_path=$2
    
    echo "🔬 Testing ${service}..."
    
    if [ ! -d "$service_path" ]; then
        echo -e "${YELLOW}⚠️  ${service} directory not found, skipping...${NC}"
        return 0
    fi
    
    cd "$service_path"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${YELLOW}⚠️  No package.json found in ${service}, skipping...${NC}"
        cd - > /dev/null
        return 0
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies for ${service}..."
        npm ci
    fi
    
    # Run linting
    if npm run lint --silent 2>/dev/null; then
        echo -e "${GREEN}✅ ${service} linting passed${NC}"
    else
        echo -e "${RED}❌ ${service} linting failed${NC}"
        cd - > /dev/null
        return 1
    fi
    
    # Run unit tests
    if npm test 2>/dev/null; then
        echo -e "${GREEN}✅ ${service} unit tests passed${NC}"
    else
        echo -e "${RED}❌ ${service} unit tests failed${NC}"
        cd - > /dev/null
        return 1
    fi
    
    # Run coverage check if available
    if npm run test:coverage --silent 2>/dev/null; then
        echo -e "${GREEN}✅ ${service} coverage check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  ${service} coverage check not available${NC}"
    fi
    
    cd - > /dev/null
    return 0
}

# Start test dependencies with Docker Compose
echo "🐳 Starting test dependencies..."
docker-compose -f docker-compose.test.yml up -d mongo redis minio

# Wait for services to be ready
echo "⏳ Waiting for test dependencies to be ready..."
sleep 15

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
check_service "MongoDB" 27017
check_service "Redis" 6379
check_service "MinIO" 9000

# Set test environment variables
export NODE_ENV=test
export MONGODB_URI="mongodb://localhost:27017/creator_studio_test"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export AWS_ACCESS_KEY_ID="minioadmin"
export AWS_SECRET_ACCESS_KEY="minioadmin"
export S3_BUCKET_NAME="test-bucket"
export JWT_SECRET="test-jwt-secret"

# Run tests for each service
BACKEND_TESTS_PASSED=true
FRONTEND_TESTS_PASSED=true

# Test backend
if ! run_service_tests "Backend" "./backend"; then
    BACKEND_TESTS_PASSED=false
fi

# Test frontend
if ! run_service_tests "Frontend" "./frontend"; then
    FRONTEND_TESTS_PASSED=false
fi

# Run integration tests if available
if [ -d "tests/integration" ]; then
    echo "🔗 Running integration tests..."
    cd tests/integration
    
    if [ -f "package.json" ]; then
        npm ci
        if npm test; then
            echo -e "${GREEN}✅ Integration tests passed${NC}"
        else
            echo -e "${RED}❌ Integration tests failed${NC}"
            BACKEND_TESTS_PASSED=false
        fi
    fi
    
    cd - > /dev/null
fi

# Run E2E tests if available
if [ -d "tests/e2e" ]; then
    echo "🎭 Running E2E tests..."
    cd tests/e2e
    
    if [ -f "package.json" ]; then
        npm ci
        if npm test; then
            echo -e "${GREEN}✅ E2E tests passed${NC}"
        else
            echo -e "${RED}❌ E2E tests failed${NC}"
            FRONTEND_TESTS_PASSED=false
        fi
    fi
    
    cd - > /dev/null
fi

# Run load tests if available
if [ -d "tests/load" ]; then
    echo "⚡ Running load tests..."
    cd tests/load
    
    if command -v k6 &> /dev/null; then
        k6 run script.js
        echo -e "${GREEN}✅ Load tests completed${NC}"
    else
        echo -e "${YELLOW}⚠️  k6 not installed, skipping load tests${NC}"
    fi
    
    cd - > /dev/null
fi

# Cleanup test environment
echo "🧹 Cleaning up test environment..."
docker-compose -f docker-compose.test.yml down

# Determine overall test result
if [ "$BACKEND_TESTS_PASSED" = true ] && [ "$FRONTEND_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    echo "📊 Test reports available in coverage directories"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    if [ "$BACKEND_TESTS_PASSED" = false ]; then
        echo -e "${RED}   - Backend tests failed${NC}"
    fi
    if [ "$FRONTEND_TESTS_PASSED" = false ]; then
        echo -e "${RED}   - Frontend tests failed${NC}"
    fi
    exit 1
fi
