#!/bin/bash

# Suuupra Services Test Runner
# Comprehensive testing script with service lifecycle management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES_DIR="${SCRIPT_DIR}/services"
LOG_DIR="${SCRIPT_DIR}/test-logs"
RESULTS_DIR="${SCRIPT_DIR}/test-results"

# Ensure directories exist
mkdir -p "$LOG_DIR"
mkdir -p "$RESULTS_DIR"

# Print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check Go
    if ! command -v go &> /dev/null; then
        print_error "Go is required but not installed"
        exit 1
    fi
    
    # Check Java
    if ! command -v java &> /dev/null; then
        print_error "Java is required but not installed"
        exit 1
    fi
    
    # Check Rust
    if ! command -v rustc &> /dev/null; then
        print_error "Rust is required but not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is required but not installed"
        exit 1
    fi
    
    print_success "All prerequisites are available"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies for all services..."
    
    # Install Node.js test orchestrator dependencies
    cd "$SCRIPT_DIR"
    if [ -f "test-package.json" ]; then
        print_info "Installing test orchestrator dependencies..."
        cp test-package.json package.json
        npm install
        print_success "Test orchestrator dependencies installed"
    fi
    
    # Install service dependencies
    for service_dir in "$SERVICES_DIR"/*; do
        if [ -d "$service_dir" ]; then
            service_name=$(basename "$service_dir")
            print_info "Installing dependencies for $service_name..."
            
            cd "$service_dir"
            
            # Node.js dependencies
            if [ -f "package.json" ]; then
                npm install &> "${LOG_DIR}/${service_name}-npm-install.log" || {
                    print_warning "Failed to install npm dependencies for $service_name"
                }
            fi
            
            # Python dependencies
            if [ -f "requirements.txt" ]; then
                python3 -m pip install -r requirements.txt &> "${LOG_DIR}/${service_name}-pip-install.log" || {
                    print_warning "Failed to install pip dependencies for $service_name"
                }
            fi
            
            # Go dependencies
            if [ -f "go.mod" ]; then
                go mod tidy &> "${LOG_DIR}/${service_name}-go-mod.log" || {
                    print_warning "Failed to install Go dependencies for $service_name"
                }
            fi
            
            # Java dependencies (Maven)
            if [ -f "pom.xml" ]; then
                ./mvnw dependency:resolve &> "${LOG_DIR}/${service_name}-maven-deps.log" || {
                    print_warning "Failed to install Maven dependencies for $service_name"
                }
            fi
            
            # Rust dependencies
            if [ -f "Cargo.toml" ]; then
                cargo fetch &> "${LOG_DIR}/${service_name}-cargo-fetch.log" || {
                    print_warning "Failed to fetch Cargo dependencies for $service_name"
                }
            fi
        fi
    done
    
    cd "$SCRIPT_DIR"
    print_success "Dependencies installation completed"
}

# Setup test infrastructure
setup_infrastructure() {
    print_status "Setting up test infrastructure..."
    
    # Start required databases and services using Docker Compose
    if [ -f "docker-compose.test.yml" ]; then
        print_info "Starting test infrastructure with Docker Compose..."
        docker-compose -f docker-compose.test.yml up -d --wait
        print_success "Test infrastructure started"
    else
        print_warning "No docker-compose.test.yml found, creating minimal infrastructure..."
        create_test_infrastructure
    fi
}

# Create minimal test infrastructure
create_test_infrastructure() {
    cat > docker-compose.test.yml << EOF
version: '3.8'

services:
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_DB: suuupra_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d suuupra_test"]
      interval: 5s
      timeout: 5s
      retries: 5

  mysql-test:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: suuupra_test
      MYSQL_USER: test_user
      MYSQL_PASSWORD: test_password
    ports:
      - "3307:3306"
    volumes:
      - mysql_test_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_test_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  mongodb-test:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: root_password
      MONGO_INITDB_DATABASE: suuupra_test
    ports:
      - "27018:27017"
    volumes:
      - mongodb_test_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 5s
      timeout: 5s
      retries: 5

  elasticsearch-test:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9201:9200"
    volumes:
      - elasticsearch_test_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_test_data:
  mysql_test_data:
  redis_test_data:
  mongodb_test_data:
  elasticsearch_test_data:
EOF

    docker-compose -f docker-compose.test.yml up -d --wait
    print_success "Test infrastructure created and started"
}

# Run comprehensive tests
run_comprehensive_tests() {
    print_status "Running comprehensive service tests..."
    
    # Set test environment variables
    export NODE_ENV=test
    export POSTGRES_URL="postgresql://test_user:test_password@localhost:5433/suuupra_test"
    export MYSQL_URL="mysql://test_user:test_password@localhost:3307/suuupra_test"
    export REDIS_URL="redis://localhost:6380"
    export MONGODB_URL="mongodb://root:root_password@localhost:27018/suuupra_test?authSource=admin"
    export ELASTICSEARCH_URL="http://localhost:9201"
    
    # Run the main test orchestrator
    node test-orchestrator.js 2>&1 | tee "${RESULTS_DIR}/test-execution.log"
    
    # Capture exit code
    test_exit_code=${PIPESTATUS[0]}
    
    if [ $test_exit_code -eq 0 ]; then
        print_success "All tests completed successfully"
    else
        print_error "Some tests failed (exit code: $test_exit_code)"
    fi
    
    return $test_exit_code
}

# Run load tests
run_load_tests() {
    print_status "Running load tests..."
    
    if command -v k6 &> /dev/null; then
        # Run k6 load tests for each service
        for service_dir in "$SERVICES_DIR"/*; do
            if [ -d "$service_dir/tests/load" ]; then
                service_name=$(basename "$service_dir")
                print_info "Running load tests for $service_name..."
                
                cd "$service_dir/tests/load"
                for k6_script in *.js; do
                    if [ -f "$k6_script" ]; then
                        k6 run "$k6_script" --out json="${RESULTS_DIR}/${service_name}-load-results.json" || {
                            print_warning "Load test failed for $service_name: $k6_script"
                        }
                    fi
                done
                cd "$SCRIPT_DIR"
            fi
        done
        print_success "Load tests completed"
    else
        print_warning "k6 not found, skipping load tests"
    fi
}

# Generate comprehensive test report
generate_test_report() {
    print_status "Generating comprehensive test report..."
    
    # Create HTML report
    cat > "${RESULTS_DIR}/test-report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Suuupra Services Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f8ff; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .service { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: flex; gap: 20px; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 Suuupra Services Test Report</h1>
        <p>Generated on: $(date)</p>
    </div>
EOF

    # Add test results if available
    if [ -f "test-results.json" ]; then
        print_info "Adding detailed test results to report..."
        echo "<script>const testResults = $(cat test-results.json);</script>" >> "${RESULTS_DIR}/test-report.html"
        
        cat >> "${RESULTS_DIR}/test-report.html" << EOF
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const summary = testResults.summary;
            
            document.body.innerHTML += \`
                <div class="metrics">
                    <div class="metric">
                        <h3>\${summary.totalServices}</h3>
                        <p>Services Tested</p>
                    </div>
                    <div class="metric">
                        <h3 class="success">\${summary.passedServices}</h3>
                        <p>Services Passed</p>
                    </div>
                    <div class="metric">
                        <h3 class="failure">\${summary.failedServices}</h3>
                        <p>Services Failed</p>
                    </div>
                    <div class="metric">
                        <h3>\${summary.totalTests}</h3>
                        <p>Total Tests</p>
                    </div>
                    <div class="metric">
                        <h3 class="success">\${summary.passedTests}</h3>
                        <p>Tests Passed</p>
                    </div>
                    <div class="metric">
                        <h3 class="failure">\${summary.failedTests}</h3>
                        <p>Tests Failed</p>
                    </div>
                </div>
                
                <h2>Service Details</h2>
            \`;
            
            Object.entries(testResults.services).forEach(([serviceName, result]) => {
                const status = result.failed === 0 ? 'success' : 'failure';
                const duration = Math.round((new Date(result.endTime) - new Date(result.startTime)) / 1000);
                
                document.body.innerHTML += \`
                    <div class="service">
                        <h3 class="\${status}">\${serviceName}</h3>
                        <p>Duration: \${duration}s | Passed: \${result.passed} | Failed: \${result.failed}</p>
                        \${result.errors.length > 0 ? '<div class="failure">Errors:<ul>' + result.errors.map(e => '<li>' + e + '</li>').join('') + '</ul></div>' : ''}
                    </div>
                \`;
            });
        });
    </script>
EOF
    fi
    
    echo "</body></html>" >> "${RESULTS_DIR}/test-report.html"
    
    print_success "Test report generated: ${RESULTS_DIR}/test-report.html"
}

# Cleanup test infrastructure
cleanup() {
    print_status "Cleaning up test infrastructure..."
    
    if [ -f "docker-compose.test.yml" ]; then
        docker-compose -f docker-compose.test.yml down -v
        print_success "Test infrastructure cleaned up"
    fi
    
    # Clean up any remaining processes
    pkill -f "test-orchestrator" || true
    pkill -f "node.*server" || true
    pkill -f "python.*main.py" || true
    pkill -f "go run" || true
    pkill -f "cargo run" || true
    
    print_success "Process cleanup completed"
}

# Main execution function
main() {
    local command="${1:-full}"
    
    echo "🚀 Suuupra Services Test Runner"
    echo "=================================="
    
    case "$command" in
        "setup")
            check_prerequisites
            install_dependencies
            setup_infrastructure
            ;;
        "test")
            run_comprehensive_tests
            ;;
        "load")
            run_load_tests
            ;;
        "report")
            generate_test_report
            ;;
        "cleanup")
            cleanup
            ;;
        "full")
            check_prerequisites
            install_dependencies
            setup_infrastructure
            
            # Run tests and capture results
            test_success=true
            run_comprehensive_tests || test_success=false
            run_load_tests || true  # Don't fail on load test issues
            
            generate_test_report
            
            # Cleanup
            cleanup
            
            if [ "$test_success" = true ]; then
                print_success "🎉 All tests completed successfully!"
                exit 0
            else
                print_error "❌ Some tests failed. Check the report for details."
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 [setup|test|load|report|cleanup|full]"
            echo ""
            echo "Commands:"
            echo "  setup   - Install dependencies and setup infrastructure"
            echo "  test    - Run comprehensive service tests"
            echo "  load    - Run load tests"
            echo "  report  - Generate test report"
            echo "  cleanup - Clean up test infrastructure"
            echo "  full    - Run complete test suite (default)"
            exit 1
            ;;
    esac
}

# Set up signal handlers for cleanup
trap cleanup EXIT SIGINT SIGTERM

# Run main function
main "$@"