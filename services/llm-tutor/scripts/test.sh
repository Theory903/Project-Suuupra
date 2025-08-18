#!/bin/bash
set -e

# LLM Tutor Service Test Script
# Runs comprehensive tests including unit, integration, and performance tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="llm-tutor"
COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-80}
TEST_TYPE=${TEST_TYPE:-"all"}

echo "🧪 Testing LLM Tutor Service"
echo "  Project Dir: $PROJECT_DIR"
echo "  Test Type: $TEST_TYPE"
echo "  Coverage Threshold: $COVERAGE_THRESHOLD%"

# Change to project directory
cd "$PROJECT_DIR"

# Validate environment
if [[ ! -f "requirements.txt" ]]; then
    echo "❌ requirements.txt not found"
    exit 1
fi

# Setup test environment
echo "🔧 Setting up test environment..."

# Create test environment file
cat > .env.test << EOF
ENVIRONMENT=test
DATABASE_URL=sqlite+aiosqlite:///./test.db
REDIS_URL=redis://localhost:6379/15
MILVUS_HOST=localhost
ELASTICSEARCH_URL=http://localhost:9200
LOG_LEVEL=ERROR
ENABLE_TRACING=false
PROMETHEUS_ENABLED=false
EOF

# Install test dependencies if needed
if [[ ! -d "venv" ]]; then
    echo "📦 Creating virtual environment..."
    python -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

# Start test services with Docker Compose
echo "🐳 Starting test infrastructure..."
docker-compose -f docker-compose.test.yml up -d postgres redis elasticsearch

# Wait for services to be ready
echo "⏳ Waiting for test services..."
timeout 60 bash -c 'until docker-compose -f docker-compose.test.yml exec postgres pg_isready -U test_user; do sleep 1; done'
timeout 30 bash -c 'until docker-compose -f docker-compose.test.yml exec redis redis-cli ping; do sleep 1; done'
timeout 60 bash -c 'until curl -s http://localhost:9200/_cluster/health; do sleep 1; done'

# Run database migrations for tests
echo "🗃️  Setting up test database..."
export DATABASE_URL="postgresql+asyncpg://test_user:test_pass@localhost:5432/test_llm_tutor"
python -m alembic upgrade head

# Function to run specific test types
run_unit_tests() {
    echo "🔬 Running unit tests..."
    python -m pytest tests/unit/ \
        --cov=src \
        --cov-report=term-missing \
        --cov-report=xml:coverage.xml \
        --cov-report=html:htmlcov \
        --cov-fail-under=$COVERAGE_THRESHOLD \
        --junitxml=test-results-unit.xml \
        -v
}

run_integration_tests() {
    echo "🔗 Running integration tests..."
    python -m pytest tests/integration/ \
        --junitxml=test-results-integration.xml \
        -v
}

run_performance_tests() {
    echo "⚡ Running performance tests..."
    python -m pytest tests/performance/ \
        --benchmark-only \
        --benchmark-json=benchmark-results.json \
        --junitxml=test-results-performance.xml \
        -v
}

run_security_tests() {
    echo "🔒 Running security tests..."
    
    # Static security analysis
    if command -v bandit &> /dev/null; then
        echo "  Running Bandit security scanner..."
        bandit -r src/ -f json -o security-bandit.json || true
    fi
    
    # Dependency vulnerability scan
    if command -v safety &> /dev/null; then
        echo "  Scanning dependencies for vulnerabilities..."
        safety check --json --output security-safety.json || true
    fi
    
    # Security-focused tests
    python -m pytest tests/security/ \
        --junitxml=test-results-security.xml \
        -v
}

run_load_tests() {
    echo "📈 Running load tests..."
    
    # Start the application in test mode
    uvicorn src.main:app --host 0.0.0.0 --port 8092 &
    APP_PID=$!
    
    # Wait for app to start
    sleep 10
    
    # Run k6 load tests if available
    if command -v k6 &> /dev/null && [[ -f "tests/performance/load_test.js" ]]; then
        k6 run tests/performance/load_test.js \
            --out json=load-test-results.json
    fi
    
    # Cleanup
    kill $APP_PID 2>/dev/null || true
}

run_end_to_end_tests() {
    echo "🎭 Running end-to-end tests..."
    
    # Start the full application stack
    docker-compose up -d
    
    # Wait for application to be ready
    timeout 120 bash -c 'until curl -s http://localhost:8092/health; do sleep 2; done'
    
    # Run E2E tests
    python -m pytest tests/e2e/ \
        --junitxml=test-results-e2e.xml \
        -v
    
    # Cleanup
    docker-compose down
}

# Run tests based on type
case $TEST_TYPE in
    "unit")
        run_unit_tests
        ;;
    "integration")
        run_integration_tests
        ;;
    "performance")
        run_performance_tests
        ;;
    "security")
        run_security_tests
        ;;
    "load")
        run_load_tests
        ;;
    "e2e")
        run_end_to_end_tests
        ;;
    "all")
        run_unit_tests
        run_integration_tests
        run_security_tests
        run_performance_tests
        ;;
    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo "Available types: unit, integration, performance, security, load, e2e, all"
        exit 1
        ;;
esac

# Cleanup test infrastructure
echo "🧹 Cleaning up test infrastructure..."
docker-compose -f docker-compose.test.yml down -v

# Generate test report
echo "📊 Generating test report..."
cat > test-report.md << EOF
# LLM Tutor Service Test Report

**Test Run:** $(date)
**Test Type:** $TEST_TYPE
**Coverage Threshold:** $COVERAGE_THRESHOLD%

## Test Results

$(if [[ -f "test-results-unit.xml" ]]; then
    echo "### Unit Tests"
    echo "- Results: test-results-unit.xml"
    echo "- Coverage: htmlcov/index.html"
fi)

$(if [[ -f "test-results-integration.xml" ]]; then
    echo "### Integration Tests"
    echo "- Results: test-results-integration.xml"
fi)

$(if [[ -f "test-results-performance.xml" ]]; then
    echo "### Performance Tests"
    echo "- Results: test-results-performance.xml"
    echo "- Benchmarks: benchmark-results.json"
fi)

$(if [[ -f "test-results-security.xml" ]]; then
    echo "### Security Tests"
    echo "- Results: test-results-security.xml"
    echo "- Bandit Report: security-bandit.json"
    echo "- Safety Report: security-safety.json"
fi)

## Artifacts

- Coverage Report: htmlcov/index.html
- XML Reports: test-results-*.xml
- Security Scans: security-*.json

EOF

echo "✅ Testing completed!"
echo "📋 Test report: test-report.md"

# Show coverage summary if available
if [[ -f "coverage.xml" ]]; then
    echo ""
    echo "📊 Coverage Summary:"
    python -c "
import xml.etree.ElementTree as ET
tree = ET.parse('coverage.xml')
root = tree.getroot()
coverage = float(root.attrib['line-rate']) * 100
print(f'  Line Coverage: {coverage:.1f}%')
if coverage < $COVERAGE_THRESHOLD:
    print('  ❌ Below threshold')
    exit(1)
else:
    print('  ✅ Above threshold')
"
fi
