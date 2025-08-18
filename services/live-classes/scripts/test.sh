#!/bin/bash

# Comprehensive test script for Live Classes Service
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Running Live Classes Service Tests...${NC}"

# Configuration
SERVICE_NAME="live-classes"
TEST_ENV=${TEST_ENV:-"test"}
COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-80}

# Pre-test setup
echo -e "${BLUE}🔧 Setting up test environment...${NC}"

# Check if Node.js is available
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm ci

# Generate Prisma client
echo -e "${BLUE}🗄️ Generating Prisma client...${NC}"
npx prisma generate

# Start test dependencies with Docker Compose
echo -e "${BLUE}🐳 Starting test dependencies...${NC}"
docker-compose -f docker-compose.test.yml up -d postgres redis minio

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for test services to be ready...${NC}"
sleep 10

# Check if test database is accessible
for i in {1..30}; do
    if docker-compose -f docker-compose.test.yml exec -T postgres pg_isready -U liveuser -d live_classes_test >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Test database is ready${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Waiting for test database... (${i}/30)${NC}"
        sleep 2
    fi
    
    if [[ $i -eq 30 ]]; then
        echo -e "${RED}❌ Test database failed to start${NC}"
        docker-compose -f docker-compose.test.yml logs postgres
        exit 1
    fi
done

# Run database migrations for test
echo -e "${BLUE}🗄️ Running test database migrations...${NC}"
export DATABASE_URL="postgresql://liveuser:livepass@localhost:5432/live_classes_test"
npx prisma db push --force-reset

# Linting
echo -e "${BLUE}🔍 Running ESLint...${NC}"
npm run lint

# Type checking
echo -e "${BLUE}🔧 Running TypeScript type check...${NC}"
npx tsc --noEmit

# Unit tests
echo -e "${BLUE}🧪 Running unit tests...${NC}"
npm test -- --coverage --coverageReporters=text --coverageReporters=lcov

# Check coverage threshold
echo -e "${BLUE}📊 Checking coverage threshold...${NC}"
COVERAGE_RESULT=$(npm test -- --coverage --coverageReporters=json-summary --silent | tail -1)
if [[ -f "coverage/coverage-summary.json" ]]; then
    COVERAGE_PERCENT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.lines.pct)")
    echo "Coverage: ${COVERAGE_PERCENT}%"
    
    if (( $(echo "${COVERAGE_PERCENT} < ${COVERAGE_THRESHOLD}" | bc -l) )); then
        echo -e "${RED}❌ Coverage ${COVERAGE_PERCENT}% is below threshold ${COVERAGE_THRESHOLD}%${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Coverage ${COVERAGE_PERCENT}% meets threshold ${COVERAGE_THRESHOLD}%${NC}"
    fi
fi

# Integration tests
echo -e "${BLUE}🔗 Running integration tests...${NC}"
npm run test:integration

# API tests
echo -e "${BLUE}🌐 Running API tests...${NC}"
if [[ -f "tests/api/api-tests.sh" ]]; then
    ./tests/api/api-tests.sh
else
    echo -e "${YELLOW}⚠️ API tests not found, skipping${NC}"
fi

# Load tests (optional)
if [[ "${RUN_LOAD_TESTS:-false}" == "true" ]]; then
    echo -e "${BLUE}⚡ Running load tests...${NC}"
    if command -v k6 >/dev/null 2>&1; then
        k6 run tests/load/k6/basic-load-test.js
    else
        echo -e "${YELLOW}⚠️ k6 not found, skipping load tests${NC}"
    fi
fi

# Security tests
echo -e "${BLUE}🛡️ Running security tests...${NC}"

# Check for known vulnerabilities
npm audit --audit-level=moderate

# OWASP dependency check (if available)
if command -v dependency-check >/dev/null 2>&1; then
    dependency-check --project "${SERVICE_NAME}" --scan . --format JSON --out dependency-check-report.json
    echo -e "${GREEN}✅ OWASP dependency check completed${NC}"
else
    echo -e "${YELLOW}⚠️ OWASP dependency-check not found, skipping${NC}"
fi

# Performance benchmarks
echo -e "${BLUE}⚡ Running performance benchmarks...${NC}"
if [[ -f "tests/performance/benchmark.js" ]]; then
    node tests/performance/benchmark.js
else
    echo -e "${YELLOW}⚠️ Performance benchmarks not found, skipping${NC}"
fi

# Cleanup
echo -e "${BLUE}🧹 Cleaning up test environment...${NC}"
docker-compose -f docker-compose.test.yml down -v

# Test report
echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
echo -e "${GREEN}📊 Test Summary:${NC}"
echo "  ✅ Linting: Passed"
echo "  ✅ Type checking: Passed"
echo "  ✅ Unit tests: Passed"
echo "  ✅ Integration tests: Passed"
echo "  ✅ Security audit: Passed"

if [[ -f "coverage/coverage-summary.json" ]]; then
    FINAL_COVERAGE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.lines.pct)")
    echo "  ✅ Test coverage: ${FINAL_COVERAGE}%"
fi

echo -e "${GREEN}🎬 Live Classes Service is ready for deployment!${NC}"
