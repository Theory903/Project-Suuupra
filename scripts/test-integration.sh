#!/bin/bash

# Integration Test Script for Bank Simulator and UPI Core Services
set -e

echo "🚀 Starting UPI Integration Tests"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.integration.yml"
BANK_SIMULATOR_HTTP="http://localhost:8080"
UPI_CORE_GRPC="localhost:50052"
BANK_SIMULATOR_GRPC="localhost:50050"
UPI_INTEGRATION_TEST_DIR="tools/testing/integration/upi-bank-integration"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if service is healthy
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1

    print_status "Checking health of $service_name..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to become healthy"
    return 1
}

# Function to check gRPC service
check_grpc_service() {
    local service_name=$1
    local grpc_endpoint=$2
    local max_attempts=30
    local attempt=1

    print_status "Checking gRPC health of $service_name..."
    
    while [ $attempt -le $max_attempts ]; do
        if grpcurl -plaintext "$grpc_endpoint" grpc.health.v1.Health/Check > /dev/null 2>&1; then
            print_success "$service_name gRPC is healthy"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name gRPC failed to become healthy"
    return 1
}

# Function to run basic API tests
run_api_tests() {
    print_status "Running API tests..."
    
    # Test 1: Get supported banks
    print_status "Testing: Get supported banks"
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BANK_SIMULATOR_HTTP/api/banks/")
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    response_body=$(echo $response | sed -e 's/HTTPSTATUS:.*//g')
    
    if [ "$http_code" -eq 200 ]; then
        print_success "✓ Get banks API working"
        echo "Response: $response_body" | head -c 100
        echo "..."
    else
        print_error "✗ Get banks API failed (HTTP $http_code)"
        return 1
    fi
    
    # Test 2: Health check
    print_status "Testing: Service health check"
    if curl -f -s "$BANK_SIMULATOR_HTTP/health" > /dev/null; then
        print_success "✓ Health check working"
    else
        print_error "✗ Health check failed"
        return 1
    fi
    
    # Test 3: Check specific bank
    print_status "Testing: Get specific bank info"
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BANK_SIMULATOR_HTTP/api/banks/HDFC")
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    
    if [ "$http_code" -eq 200 ]; then
        print_success "✓ Get specific bank API working"
    else
        print_error "✗ Get specific bank API failed (HTTP $http_code)"
        return 1
    fi
}

# Function to run gRPC tests
run_grpc_tests() {
    print_status "Running gRPC tests..."
    
    # Check if grpcurl is available
    if ! command -v grpcurl &> /dev/null; then
        print_warning "grpcurl not found, skipping detailed gRPC tests"
        print_status "Install grpcurl with: go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest"
        return 0
    fi
    
    # Test UPI Core gRPC service
    print_status "Testing: UPI Core gRPC health"
    if grpcurl -plaintext "$UPI_CORE_GRPC" grpc.health.v1.Health/Check > /dev/null 2>&1; then
        print_success "✓ UPI Core gRPC health check working"
    else
        print_error "✗ UPI Core gRPC health check failed"
        return 1
    fi
    
    # Test Bank Simulator gRPC service
    print_status "Testing: Bank Simulator gRPC health"
    if grpcurl -plaintext "$BANK_SIMULATOR_GRPC" grpc.health.v1.Health/Check > /dev/null 2>&1; then
        print_success "✓ Bank Simulator gRPC health check working"
    else
        print_error "✗ Bank Simulator gRPC health check failed"
        return 1
    fi
    
    # List available services
    print_status "Available gRPC services on UPI Core:"
    grpcurl -plaintext "$UPI_CORE_GRPC" list 2>/dev/null || print_warning "Could not list UPI Core services"
    
    print_status "Available gRPC services on Bank Simulator:"
    grpcurl -plaintext "$BANK_SIMULATOR_GRPC" list 2>/dev/null || print_warning "Could not list Bank Simulator services"
}

# Function to run load tests
run_load_tests() {
    if ! command -v k6 &> /dev/null; then
        print_warning "k6 not found, skipping load tests"
        print_status "Install k6 from: https://k6.io/docs/getting-started/installation/"
        return 0
    fi
    
    print_status "Running load tests..."
    
    if [ -f "tests/integration/transaction-flow-test.js" ]; then
        k6 run tests/integration/transaction-flow-test.js
        if [ $? -eq 0 ]; then
            print_success "✓ Load tests passed"
        else
            print_error "✗ Load tests failed"
            return 1
        fi
    else
        print_warning "Load test file not found"
    fi
}

# Function to run comprehensive UPI integration tests
run_upi_integration_tests() {
    print_status "Running comprehensive UPI Core ↔ Bank Simulator integration tests..."
    
    # Check if integration test directory exists
    if [ ! -d "$UPI_INTEGRATION_TEST_DIR" ]; then
        print_warning "UPI integration test directory not found: $UPI_INTEGRATION_TEST_DIR"
        return 0
    fi
    
    # Save current directory
    local original_dir=$(pwd)
    
    # Change to integration test directory
    cd "$UPI_INTEGRATION_TEST_DIR"
    
    # Check if Go is available
    if ! command -v go &> /dev/null; then
        print_warning "Go not found, skipping UPI integration tests"
        cd "$original_dir"
        return 0
    fi
    
    # Initialize Go module if needed
    if [ ! -f "go.mod" ]; then
        print_status "Initializing Go module for integration tests..."
        go mod init github.com/suuupra/upi-bank-integration-tests > /dev/null 2>&1 || true
    fi
    
    # Download dependencies
    print_status "Downloading Go dependencies..."
    go mod tidy > /dev/null 2>&1 || true
    
    # Run the integration test suite
    print_status "Executing UPI integration test suite..."
    
    if ./run-tests.sh --report; then
        print_success "✓ UPI integration tests passed"
        
        # Show test report if available
        local latest_report=$(ls -t test_report_*.txt 2>/dev/null | head -n1)
        if [ -n "$latest_report" ]; then
            print_status "Test report generated: $UPI_INTEGRATION_TEST_DIR/$latest_report"
        fi
        
        # Show benchmark results if available
        if [ -f "benchmark_results.txt" ]; then
            print_status "Benchmark results:"
            echo "$(head -n 10 benchmark_results.txt)"
            echo "... (see $UPI_INTEGRATION_TEST_DIR/benchmark_results.txt for full results)"
        fi
        
    else
        print_error "✗ UPI integration tests failed"
        
        # Show some debug information
        print_status "Debug information:"
        echo "- Go version: $(go version 2>/dev/null || echo 'Go not available')"
        echo "- Working directory: $(pwd)"
        echo "- Available files: $(ls -la)"
        
        cd "$original_dir"
        return 1
    fi
    
    # Return to original directory
    cd "$original_dir"
    
    return 0
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    docker-compose -f $COMPOSE_FILE down -v > /dev/null 2>&1 || true
    print_success "Cleanup completed"
}

# Main execution
main() {
    print_status "Starting integration test suite..."
    
    # Cleanup any existing containers
    print_status "Cleaning up existing containers..."
    docker-compose -f $COMPOSE_FILE down -v > /dev/null 2>&1 || true
    
    # Start services
    print_status "Starting services with Docker Compose..."
    if ! docker-compose -f $COMPOSE_FILE up -d; then
        print_error "Failed to start services"
        exit 1
    fi
    
    # Wait for services to be healthy
    print_status "Waiting for services to be ready..."
    
    # Check database
    print_status "Waiting for PostgreSQL..."
    sleep 10
    
    # Check Redis
    print_status "Waiting for Redis..."
    sleep 5
    
    # Check Kafka
    print_status "Waiting for Kafka..."
    sleep 15
    
    # Check application services
    if ! check_service_health "Bank Simulator" "$BANK_SIMULATOR_HTTP/health"; then
        print_error "Bank Simulator failed to start"
        cleanup
        exit 1
    fi
    
    # Run tests
    print_status "Running test suite..."
    
    # API Tests
    if ! run_api_tests; then
        print_error "API tests failed"
        cleanup
        exit 1
    fi
    
    # gRPC Tests
    if ! run_grpc_tests; then
        print_error "gRPC tests failed"
        cleanup
        exit 1
    fi
    
    # Load Tests
    run_load_tests
    
    # UPI Core ↔ Bank Simulator Integration Tests
    run_upi_integration_tests
    
    print_success "🎉 All integration tests completed successfully!"
    
    # Show service URLs
    echo ""
    print_status "Service URLs:"
    echo "  • Bank Simulator HTTP API: $BANK_SIMULATOR_HTTP"
    echo "  • Bank Simulator gRPC: $BANK_SIMULATOR_GRPC"
    echo "  • UPI Core gRPC: $UPI_CORE_GRPC"
    echo "  • Prometheus: http://localhost:9093"
    echo "  • Grafana: http://localhost:3001 (admin/admin)"
    echo "  • Jaeger: http://localhost:16686"
    echo ""
    
    # Keep services running or cleanup
    read -p "Keep services running for manual testing? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        cleanup
    else
        print_status "Services are running. Use 'docker-compose -f $COMPOSE_FILE down -v' to stop them."
    fi
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
