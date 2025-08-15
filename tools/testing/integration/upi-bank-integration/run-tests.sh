#!/bin/bash

# UPI-Bank Integration Test Runner
set -e

echo "🚀 Starting UPI Core ↔ Bank Simulator Integration Tests"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="../../../../docker-compose.integration.yml"
TEST_DIR="$(pwd)"
BANK_SIMULATOR_GRPC="localhost:50050"
UPI_CORE_GRPC="localhost:50052"
MAX_WAIT_TIME=120 # 2 minutes
WAIT_INTERVAL=5

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

print_header() {
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================${NC}"
}

# Function to check if services are ready
wait_for_service() {
    local service_name=$1
    local grpc_endpoint=$2
    local waited=0

    print_status "Waiting for $service_name to be ready..."
    
    while [ $waited -lt $MAX_WAIT_TIME ]; do
        if nc -z $(echo $grpc_endpoint | tr ':' ' ') 2>/dev/null; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep $WAIT_INTERVAL
        waited=$((waited + WAIT_INTERVAL))
    done
    
    print_error "$service_name failed to become ready within $MAX_WAIT_TIME seconds"
    return 1
}

# Function to run specific test
run_test_function() {
    local test_name=$1
    print_status "Running: $test_name"
    
    if go test -v -run "$test_name" -timeout 10m; then
        print_success "✓ $test_name passed"
        return 0
    else
        print_error "✗ $test_name failed"
        return 1
    fi
}

# Function to run benchmarks
run_benchmarks() {
    print_header "Running Performance Benchmarks"
    
    print_status "Running VPA resolution benchmarks..."
    go test -bench=BenchmarkVPAResolution -benchmem -timeout 5m
    
    print_status "Benchmark results saved to benchmark_results.txt"
    go test -bench=. -benchmem -timeout 5m > benchmark_results.txt 2>&1
}

# Function to generate test report
generate_test_report() {
    local report_file="test_report_$(date +%Y%m%d_%H%M%S).txt"
    
    print_header "Generating Test Report"
    
    {
        echo "UPI Core ↔ Bank Simulator Integration Test Report"
        echo "Generated: $(date)"
        echo "=============================================="
        echo ""
        
        echo "Test Environment:"
        echo "- Bank Simulator gRPC: $BANK_SIMULATOR_GRPC"
        echo "- UPI Core gRPC: $UPI_CORE_GRPC"
        echo "- Go Version: $(go version)"
        echo ""
        
        echo "Test Results:"
        echo "============="
        go test -v -json 2>&1 | tee test_results.json
        
        echo ""
        echo "Performance Benchmarks:"
        echo "======================"
        if [ -f "benchmark_results.txt" ]; then
            cat benchmark_results.txt
        else
            echo "No benchmark results available"
        fi
        
        echo ""
        echo "Service Health Status:"
        echo "====================="
        echo "Bank Simulator: $(nc -z $(echo $BANK_SIMULATOR_GRPC | tr ':' ' ') && echo 'UP' || echo 'DOWN')"
        echo "UPI Core: $(nc -z $(echo $UPI_CORE_GRPC | tr ':' ' ') && echo 'UP' || echo 'DOWN')"
        
    } > "$report_file"
    
    print_success "Test report generated: $report_file"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up test environment..."
    cd $(dirname "$COMPOSE_FILE")
    docker-compose -f $(basename "$COMPOSE_FILE") down -v > /dev/null 2>&1 || true
    cd "$TEST_DIR"
    print_success "Cleanup completed"
}

# Function to start services
start_services() {
    print_header "Starting Test Environment"
    
    cd $(dirname "$COMPOSE_FILE")
    
    print_status "Stopping any existing services..."
    docker-compose -f $(basename "$COMPOSE_FILE") down -v > /dev/null 2>&1 || true
    
    print_status "Starting services with Docker Compose..."
    if ! docker-compose -f $(basename "$COMPOSE_FILE") up -d; then
        print_error "Failed to start services"
        return 1
    fi
    
    cd "$TEST_DIR"
    
    # Wait for dependencies first
    print_status "Waiting for infrastructure services..."
    sleep 10  # Give PostgreSQL time to start
    sleep 5   # Give Redis time to start
    sleep 15  # Give Kafka time to start
    
    # Wait for application services
    if ! wait_for_service "Bank Simulator" "$BANK_SIMULATOR_GRPC"; then
        return 1
    fi
    
    if ! wait_for_service "UPI Core" "$UPI_CORE_GRPC"; then
        return 1
    fi
    
    # Additional wait for services to fully initialize
    print_status "Allowing services to fully initialize..."
    sleep 10
    
    print_success "All services are ready!"
}

# Main execution function
main() {
    local run_benchmarks_flag=false
    local generate_report_flag=false
    local specific_test=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--benchmark)
                run_benchmarks_flag=true
                shift
                ;;
            -r|--report)
                generate_report_flag=true
                shift
                ;;
            -t|--test)
                specific_test="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  -b, --benchmark    Run performance benchmarks"
                echo "  -r, --report       Generate detailed test report"
                echo "  -t, --test TEST    Run specific test function"
                echo "  -h, --help         Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_header "UPI Integration Test Suite"
    
    # Check prerequisites
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    if ! command -v nc &> /dev/null; then
        print_error "netcat (nc) is not installed"
        exit 1
    fi
    
    # Ensure go mod is initialized
    if [ ! -f "go.mod" ]; then
        print_status "Initializing Go module..."
        go mod init github.com/suuupra/upi-bank-integration-tests
    fi
    
    # Download dependencies
    print_status "Downloading Go dependencies..."
    go mod tidy
    
    # Start services
    if ! start_services; then
        print_error "Failed to start services"
        cleanup
        exit 1
    fi
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run tests
    print_header "Running Integration Tests"
    
    local test_failed=false
    
    if [ -n "$specific_test" ]; then
        print_status "Running specific test: $specific_test"
        if ! run_test_function "$specific_test"; then
            test_failed=true
        fi
    else
        # Run all test categories
        local test_categories=(
            "TestServiceHealthChecks"
            "TestAccountCreationFlow"
            "TestVPAResolutionFlow"
            "TestTransactionProcessingFlow"
            "TestErrorHandlingAndEdgeCases"
            "TestPerformanceBaseline"
        )
        
        for test in "${test_categories[@]}"; do
            if ! run_test_function "$test"; then
                test_failed=true
            fi
            echo ""
        done
    fi
    
    # Run benchmarks if requested
    if [ "$run_benchmarks_flag" = true ]; then
        run_benchmarks
    fi
    
    # Generate report if requested
    if [ "$generate_report_flag" = true ]; then
        generate_test_report
    fi
    
    # Print summary
    print_header "Test Summary"
    
    if [ "$test_failed" = true ]; then
        print_error "Some tests failed. Check the output above for details."
        
        # Show service logs for debugging
        print_status "Showing recent service logs for debugging..."
        cd $(dirname "$COMPOSE_FILE")
        echo "Bank Simulator logs:"
        docker-compose -f $(basename "$COMPOSE_FILE") logs --tail=20 bank-simulator
        echo ""
        echo "UPI Core logs:"
        docker-compose -f $(basename "$COMPOSE_FILE") logs --tail=20 upi-core
        cd "$TEST_DIR"
        
        exit 1
    else
        print_success "🎉 All tests passed successfully!"
        
        echo ""
        print_status "Service Status:"
        echo "  • Bank Simulator gRPC: $BANK_SIMULATOR_GRPC"
        echo "  • UPI Core gRPC: $UPI_CORE_GRPC"
        echo ""
        
        # Prompt to keep services running
        read -p "Keep services running for manual testing? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Services are running. Use Ctrl+C to stop them."
            trap - EXIT  # Remove the cleanup trap
            wait
        fi
    fi
}

# Run main function with all arguments
main "$@"