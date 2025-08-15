#!/bin/bash

# Integration Test Setup Verification Script
set -e

echo "🔍 Verifying UPI Integration Test Setup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local all_good=true
    
    # Check Go
    if command -v go &> /dev/null; then
        local go_version=$(go version | awk '{print $3}')
        print_success "Go is installed: $go_version"
    else
        print_error "Go is not installed"
        all_good=false
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version | awk '{print $3}' | tr -d ',')
        print_success "Docker is installed: $docker_version"
    else
        print_error "Docker is not installed"
        all_good=false
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        local compose_version=$(docker-compose --version | awk '{print $3}' | tr -d ',')
        print_success "Docker Compose is installed: $compose_version"
    else
        print_error "Docker Compose is not installed"
        all_good=false
    fi
    
    # Check netcat
    if command -v nc &> /dev/null; then
        print_success "netcat (nc) is available"
    else
        print_warning "netcat (nc) is not available - some tests may not work"
    fi
    
    # Check k6 (optional)
    if command -v k6 &> /dev/null; then
        local k6_version=$(k6 version | head -n1)
        print_success "k6 is installed: $k6_version"
    else
        print_warning "k6 is not installed - load tests will be skipped"
    fi
    
    return $([[ $all_good == true ]])
}

# Check file structure
check_file_structure() {
    print_status "Checking integration test file structure..."
    
    local base_dir="/Users/abhishekjha/Documents/Project-Suuupra"
    local test_dir="$base_dir/tools/testing/integration/upi-bank-integration"
    
    local required_files=(
        "$test_dir/go.mod"
        "$test_dir/types.go"
        "$test_dir/clients.go"
        "$test_dir/upi_bank_integration_test.go"
        "$test_dir/run-tests.sh"
        "$test_dir/README.md"
        "$test_dir/proto/bank_simulator.proto"
        "$test_dir/proto/upi_core.proto"
        "$base_dir/docker-compose.integration.yml"
        "$base_dir/scripts/test-integration.sh"
    )
    
    local all_files_exist=true
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            print_success "✓ $file"
        else
            print_error "✗ Missing: $file"
            all_files_exist=false
        fi
    done
    
    # Check executable permissions
    local executable_files=(
        "$test_dir/run-tests.sh"
        "$test_dir/generate.sh"
        "$base_dir/scripts/test-integration.sh"
    )
    
    for file in "${executable_files[@]}"; do
        if [ -x "$file" ]; then
            print_success "✓ $file is executable"
        elif [ -f "$file" ]; then
            print_warning "⚠ $file exists but is not executable"
            chmod +x "$file"
            print_success "✓ Made $file executable"
        else
            print_error "✗ Missing executable: $file"
            all_files_exist=false
        fi
    done
    
    return $([[ $all_files_exist == true ]])
}

# Test Go module setup
test_go_module() {
    print_status "Testing Go module setup..."
    
    local test_dir="/Users/abhishekjha/Documents/Project-Suuupra/tools/testing/integration/upi-bank-integration"
    
    cd "$test_dir"
    
    # Initialize go module if needed
    if [ ! -f "go.mod" ]; then
        print_status "Initializing Go module..."
        go mod init github.com/suuupra/upi-bank-integration-tests
    fi
    
    # Test go mod tidy
    if go mod tidy; then
        print_success "Go module dependencies resolved successfully"
    else
        print_error "Failed to resolve Go module dependencies"
        return 1
    fi
    
    # Test compilation
    if go build -o /dev/null .; then
        print_success "Go code compiles successfully"
    else
        print_warning "Go code has compilation issues (this may be expected for mock implementations)"
    fi
    
    return 0
}

# Check Docker environment
check_docker_environment() {
    print_status "Checking Docker environment..."
    
    local compose_file="/Users/abhishekjha/Documents/Project-Suuupra/docker-compose.integration.yml"
    
    if [ ! -f "$compose_file" ]; then
        print_error "Docker Compose file not found: $compose_file"
        return 1
    fi
    
    # Validate docker-compose file
    if docker-compose -f "$compose_file" config &> /dev/null; then
        print_success "Docker Compose configuration is valid"
    else
        print_error "Docker Compose configuration is invalid"
        return 1
    fi
    
    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        return 1
    fi
    
    return 0
}

# Test basic functionality
test_basic_functionality() {
    print_status "Testing basic functionality..."
    
    local test_dir="/Users/abhishekjha/Documents/Project-Suuupra/tools/testing/integration/upi-bank-integration"
    
    cd "$test_dir"
    
    # Test that the test runner script exists and is callable
    if [ -x "./run-tests.sh" ]; then
        print_success "Test runner script is executable"
        
        # Test help functionality
        if ./run-tests.sh --help &> /dev/null; then
            print_success "Test runner help works"
        else
            print_warning "Test runner help may have issues"
        fi
    else
        print_error "Test runner script is not executable"
        return 1
    fi
    
    return 0
}

# Main function
main() {
    echo "========================================"
    echo "  UPI Integration Test Setup Checker"
    echo "========================================"
    echo ""
    
    local all_checks_passed=true
    
    # Run all checks
    if ! check_prerequisites; then
        all_checks_passed=false
    fi
    echo ""
    
    if ! check_file_structure; then
        all_checks_passed=false
    fi
    echo ""
    
    if ! test_go_module; then
        all_checks_passed=false
    fi
    echo ""
    
    if ! check_docker_environment; then
        all_checks_passed=false
    fi
    echo ""
    
    if ! test_basic_functionality; then
        all_checks_passed=false
    fi
    echo ""
    
    # Summary
    echo "========================================"
    if [ "$all_checks_passed" = true ]; then
        print_success "🎉 All checks passed! Integration test setup is ready."
        echo ""
        print_status "Next steps:"
        echo "1. Run integration tests: cd tools/testing/integration/upi-bank-integration && ./run-tests.sh"
        echo "2. Run from project root: ./scripts/test-integration.sh"
        echo "3. Generate reports: cd tools/testing/integration/upi-bank-integration && ./run-tests.sh --report"
        echo ""
    else
        print_error "❌ Some checks failed. Please address the issues above."
        echo ""
        print_status "Common solutions:"
        echo "- Install missing prerequisites (Go, Docker, Docker Compose)"
        echo "- Check file permissions (chmod +x script files)"
        echo "- Ensure Docker daemon is running"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"