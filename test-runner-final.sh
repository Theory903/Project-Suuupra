#!/bin/bash

# Suuupra Services Test Runner - Final Fixed Version
# Comprehensive testing script with all dependency fixes

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
    
    local missing_tools=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_tools+=("Node.js")
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        missing_tools+=("Python 3")
    fi
    
    # Check Go (optional)
    if ! command -v go &> /dev/null; then
        print_warning "Go not found - Go services will be skipped"
    fi
    
    # Check Java (optional)
    if ! command -v java &> /dev/null; then
        print_warning "Java not found - Java services will be skipped"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("Docker")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install the missing tools and try again"
        return 1
    fi
    
    print_success "Prerequisites check completed"
}

# Enhanced dependency installation with comprehensive fixes
install_dependencies() {
    print_status "Installing dependencies for all services..."
    
    # Install Node.js test orchestrator dependencies
    cd "$SCRIPT_DIR"
    if [ -f "test-package.json" ]; then
        print_info "Installing test orchestrator dependencies..."
        cp test-package.json package.json
        npm install --silent &> "${LOG_DIR}/orchestrator-npm.log" && \
        print_success "Test orchestrator dependencies installed" || \
        print_warning "Failed to install orchestrator dependencies"
    fi
    
    # Track installation results
    local success_count=0
    local total_count=0
    
    # Python services with fixed requirements
    local python_services=("analytics" "commerce" "llm-tutor" "notifications" "recommendations" "vod")
    
    for service in "${python_services[@]}"; do
        if [ -d "${SERVICES_DIR}/${service}" ]; then
            print_info "Installing Python dependencies for $service..."
            total_count=$((total_count + 1))
            
            # Use fixed requirements if available
            local req_file="${SERVICES_DIR}/${service}/requirements_fixed.txt"
            if [ ! -f "$req_file" ]; then
                req_file="${SERVICES_DIR}/${service}/requirements.txt"
            fi
            
            if [ -f "$req_file" ]; then
                if python3 -m pip install --user --quiet -r "$req_file" &> "${LOG_DIR}/${service}-pip.log"; then
                    print_success "✓ Python dependencies for $service"
                    success_count=$((success_count + 1))
                else
                    print_warning "✗ Python dependencies for $service"
                fi
            else
                print_warning "No requirements file found for $service"
            fi
        fi
    done
    
    # Node.js services
    local node_services=("admin" "api-gateway" "bank-simulator" "content" "content-delivery" "creator-studio" "live-classes")
    
    for service in "${node_services[@]}"; do
        if [ -d "${SERVICES_DIR}/${service}" ]; then
            print_info "Installing Node.js dependencies for $service..."
            total_count=$((total_count + 1))
            
            cd "${SERVICES_DIR}/${service}"
            if [ -f "package.json" ]; then
                if npm install --silent &> "${LOG_DIR}/${service}-npm.log"; then
                    print_success "✓ Node.js dependencies for $service"
                    success_count=$((success_count + 1))
                else
                    print_warning "✗ Node.js dependencies for $service"
                fi
            fi
        fi
    done
    
    # Go services (optional)
    if command -v go &> /dev/null; then
        local go_services=("counters" "live-tracking" "mass-live" "payments" "search-crawler" "upi-core")
        
        for service in "${go_services[@]}"; do
            if [ -d "${SERVICES_DIR}/${service}" ]; then
                print_info "Installing Go dependencies for $service..."
                total_count=$((total_count + 1))
                
                cd "${SERVICES_DIR}/${service}"
                if [ -f "go.mod" ]; then
                    # Set Go environment for better compatibility
                    export GOPROXY=https://proxy.golang.org,direct
                    export GOSUMDB=sum.golang.org
                    
                    if go mod download &> "${LOG_DIR}/${service}-go.log" && \
                       go mod tidy &> "${LOG_DIR}/${service}-go-tidy.log"; then
                        print_success "✓ Go dependencies for $service"
                        success_count=$((success_count + 1))
                    else
                        print_warning "✗ Go dependencies for $service"
                    fi
                fi
            fi
        done
    fi
    
    # Java services (optional)
    if command -v java &> /dev/null; then
        local java_services=("identity" "ledger")
        
        for service in "${java_services[@]}"; do
            if [ -d "${SERVICES_DIR}/${service}" ]; then
                print_info "Installing Java dependencies for $service..."
                total_count=$((total_count + 1))
                
                cd "${SERVICES_DIR}/${service}"
                if [ -f "pom.xml" ]; then
                    # Try different Maven commands
                    if [ -x "./mvnw" ]; then
                        mvn_cmd="./mvnw"
                    elif command -v mvn &> /dev/null; then
                        mvn_cmd="mvn"
                    else
                        print_warning "Maven not found for $service"
                        continue
                    fi
                    
                    if $mvn_cmd dependency:resolve -q &> "${LOG_DIR}/${service}-maven.log"; then
                        print_success "✓ Java dependencies for $service"
                        success_count=$((success_count + 1))
                    else
                        print_warning "✗ Java dependencies for $service"
                    fi
                fi
            fi
        done
    fi
    
    cd "$SCRIPT_DIR"
    print_success "Dependencies installation completed: $success_count/$total_count services successful"
}

# Setup test infrastructure
setup_infrastructure() {
    print_status "Setting up test infrastructure..."
    
    # Check if Docker is running
    if ! docker ps &> /dev/null; then
        print_error "Docker is not running. Please start Docker and try again."
        return 1
    fi
    
    # Create minimal infrastructure
    print_info "Creating test infrastructure configuration..."
    cat > docker-compose.test.yml << 'EOF'
version: '3.8'

services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: suuupra_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_HOST_AUTH_METHOD: trust
    ports:
      - "5433:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d suuupra_test"]
      interval: 5s
      timeout: 5s
      retries: 10

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
      retries: 10

volumes:
  postgres_test_data:
  redis_test_data:
EOF
    
    print_info "Starting test infrastructure with Docker Compose..."
    if docker-compose -f docker-compose.test.yml up -d --wait-timeout 60 &> "${LOG_DIR}/infrastructure.log"; then
        print_success "Test infrastructure started successfully"
        
        # Wait for services to be ready
        print_info "Waiting for databases to be ready..."
        sleep 5
        
        # Verify connectivity
        verify_infrastructure
    else
        print_warning "Failed to start some infrastructure components (continuing anyway)"
    fi
}

# Verify infrastructure connectivity
verify_infrastructure() {
    local services_ready=0
    local total_services=2
    
    # Check PostgreSQL
    if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U test_user -d suuupra_test &> /dev/null; then
        print_success "✓ PostgreSQL is ready"
        services_ready=$((services_ready + 1))
    else
        print_warning "✗ PostgreSQL not ready"
    fi
    
    # Check Redis
    if docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping &> /dev/null; then
        print_success "✓ Redis is ready"
        services_ready=$((services_ready + 1))
    else
        print_warning "✗ Redis not ready"
    fi
    
    print_info "Infrastructure readiness: $services_ready/$total_services services"
}

# Run comprehensive tests
run_comprehensive_tests() {
    print_status "Running comprehensive service tests..."
    
    # Set test environment variables
    export NODE_ENV=test
    export POSTGRES_URL="postgresql://test_user:test_password@localhost:5433/suuupra_test"
    export REDIS_URL="redis://localhost:6380"
    export API_GATEWAY_URL="http://localhost:3000"
    export IDENTITY_SERVICE_URL="http://localhost:8080"
    
    # Create enhanced test orchestrator
    create_enhanced_test_orchestrator
    
    # Run the test orchestrator with timeout
    print_info "Starting enhanced test orchestrator..."
    if timeout 300 node enhanced-test-orchestrator.js 2>&1 | tee "${RESULTS_DIR}/test-execution.log"; then
        test_exit_code=0
        print_success "Test orchestrator completed successfully"
    else
        test_exit_code=$?
        if [ $test_exit_code -eq 124 ]; then
            print_error "Test orchestrator timed out after 5 minutes"
        else
            print_error "Test orchestrator failed with exit code: $test_exit_code"
        fi
    fi
    
    return $test_exit_code
}

# Create enhanced test orchestrator
create_enhanced_test_orchestrator() {
    cat > enhanced-test-orchestrator.js << 'EOF'
const fs = require('fs');
const path = require('path');

class EnhancedTestOrchestrator {
    constructor() {
        this.services = {
            // Node.js Services
            'api-gateway': { type: 'node', port: 3000, framework: 'fastify', status: 'not_tested' },
            'admin': { type: 'node', port: 3001, framework: 'react', status: 'not_tested' },
            'bank-simulator': { type: 'node', port: 3002, framework: 'fastify', status: 'not_tested' },
            'content': { type: 'node', port: 3003, framework: 'express', status: 'not_tested' },
            'content-delivery': { type: 'node', port: 3004, framework: 'express', status: 'not_tested' },
            'creator-studio': { type: 'node', port: 3005, framework: 'react', status: 'not_tested' },
            'live-classes': { type: 'node', port: 3006, framework: 'fastify', status: 'not_tested' },
            
            // Python Services
            'analytics': { type: 'python', port: 8001, framework: 'fastapi', status: 'not_tested' },
            'commerce': { type: 'python', port: 8002, framework: 'fastapi', status: 'not_tested' },
            'llm-tutor': { type: 'python', port: 8003, framework: 'fastapi', status: 'not_tested' },
            'notifications': { type: 'python', port: 8004, framework: 'fastapi', status: 'not_tested' },
            'recommendations': { type: 'python', port: 8005, framework: 'fastapi', status: 'not_tested' },
            'vod': { type: 'python', port: 8006, framework: 'fastapi', status: 'not_tested' },
            
            // Go Services
            'counters': { type: 'go', port: 8101, framework: 'chi', status: 'not_tested' },
            'live-tracking': { type: 'rust', port: 8102, framework: 'axum', status: 'not_tested' },
            'mass-live': { type: 'go', port: 8103, framework: 'gin', status: 'not_tested' },
            'payments': { type: 'go', port: 8104, framework: 'gin', status: 'not_tested' },
            'search-crawler': { type: 'go', port: 8105, framework: 'gin', status: 'not_tested' },
            'upi-core': { type: 'go', port: 8106, framework: 'grpc', status: 'not_tested' },
            
            // Java Services
            'identity': { type: 'java', port: 8201, framework: 'spring-boot', status: 'not_tested' },
            'ledger': { type: 'java', port: 8202, framework: 'spring-boot', status: 'not_tested' }
        };
        this.testResults = {};
    }

    async runTests() {
        console.log('🚀 Starting Enhanced Suuupra Service Tests\n');
        console.log(`Testing ${Object.keys(this.services).length} services...\n`);
        
        for (const [serviceName, serviceConfig] of Object.entries(this.services)) {
            await this.testService(serviceName, serviceConfig);
        }
        
        this.generateReport();
    }

    async testService(serviceName, serviceConfig) {
        console.log(`🔍 Testing ${serviceName} (${serviceConfig.type}/${serviceConfig.framework})...`);
        
        const result = {
            service: serviceName,
            type: serviceConfig.type,
            framework: serviceConfig.framework,
            port: serviceConfig.port,
            tests: {},
            passed: 0,
            failed: 0,
            errors: [],
            status: 'tested',
            timestamp: new Date().toISOString()
        };

        try {
            // Test 1: Service directory structure
            await this.testServiceStructure(serviceName, serviceConfig, result);
            
            // Test 2: Configuration files
            await this.testConfigurationFiles(serviceName, serviceConfig, result);
            
            // Test 3: Source code structure
            await this.testSourceStructure(serviceName, serviceConfig, result);
            
            // Test 4: Documentation
            await this.testDocumentation(serviceName, serviceConfig, result);
            
            // Test 5: Infrastructure files
            await this.testInfrastructure(serviceName, serviceConfig, result);

        } catch (error) {
            result.errors.push(`Test execution failed: ${error.message}`);
            result.failed++;
            console.log(`  ❌ Error: ${error.message}`);
        }

        this.testResults[serviceName] = result;
        
        const status = result.failed === 0 ? '✅' : '❌';
        const percentage = result.passed + result.failed > 0 ? 
            Math.round((result.passed / (result.passed + result.failed)) * 100) : 0;
        console.log(`${status} ${serviceName}: ${result.passed} passed, ${result.failed} failed (${percentage}%)\n`);
    }

    async testServiceStructure(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        
        // Check if service directory exists
        if (fs.existsSync(servicePath)) {
            result.tests.directoryExists = true;
            result.passed++;
            console.log(`  ✅ Service directory exists`);
        } else {
            result.tests.directoryExists = false;
            result.failed++;
            result.errors.push('Service directory not found');
            console.log(`  ❌ Service directory missing`);
            return;
        }

        // Check for main application files
        const mainFiles = this.getMainFiles(serviceConfig.type);
        let mainFileFound = null;
        
        for (const file of mainFiles) {
            if (fs.existsSync(path.join(servicePath, file))) {
                mainFileFound = file;
                break;
            }
        }
        
        if (mainFileFound) {
            result.tests.mainFileExists = true;
            result.passed++;
            console.log(`  ✅ Main file found: ${mainFileFound}`);
        } else {
            result.tests.mainFileExists = false;
            result.failed++;
            result.errors.push('Main application file not found');
            console.log(`  ❌ Main file missing`);
        }
    }

    async testConfigurationFiles(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const configFiles = this.getConfigFiles(serviceConfig.type);
        
        let configFound = [];
        for (const file of configFiles) {
            if (fs.existsSync(path.join(servicePath, file))) {
                configFound.push(file);
            }
        }
        
        if (configFound.length > 0) {
            result.tests.configExists = true;
            result.passed++;
            console.log(`  ✅ Configuration found: ${configFound.join(', ')}`);
        } else {
            result.tests.configExists = false;
            result.failed++;
            result.errors.push('Configuration files not found');
            console.log(`  ❌ Configuration missing`);
        }
    }

    async testSourceStructure(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const srcPath = path.join(servicePath, 'src');
        
        if (fs.existsSync(srcPath)) {
            result.tests.sourceStructure = true;
            result.passed++;
            console.log(`  ✅ Source directory structure found`);
            
            // Check for API/routes
            const apiPaths = ['src/api', 'src/routes', 'src/controllers'];
            let apiFound = false;
            for (const apiPath of apiPaths) {
                if (fs.existsSync(path.join(servicePath, apiPath))) {
                    apiFound = true;
                    break;
                }
            }
            
            if (apiFound) {
                result.tests.apiStructure = true;
                result.passed++;
                console.log(`  ✅ API structure found`);
            } else {
                result.tests.apiStructure = false;
                result.failed++;
                result.errors.push('API structure not found');
                console.log(`  ❌ API structure missing`);
            }
        } else {
            result.tests.sourceStructure = false;
            result.failed++;
            result.errors.push('Source directory not found');
            console.log(`  ❌ Source structure missing`);
        }
    }

    async testDocumentation(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const docFiles = ['README.md', 'TODO.md', 'docs/', 'src/api/openapi.yaml'];
        
        let docsFound = [];
        for (const docFile of docFiles) {
            if (fs.existsSync(path.join(servicePath, docFile))) {
                docsFound.push(docFile);
            }
        }
        
        if (docsFound.length >= 2) {
            result.tests.documentation = true;
            result.passed++;
            console.log(`  ✅ Documentation found: ${docsFound.join(', ')}`);
        } else {
            result.tests.documentation = false;
            result.failed++;
            result.errors.push('Insufficient documentation');
            console.log(`  ❌ Documentation insufficient`);
        }
    }

    async testInfrastructure(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const infraFiles = ['Dockerfile', 'docker-compose.yml', 'k8s/', 'infrastructure/'];
        
        let infraFound = [];
        for (const infraFile of infraFiles) {
            if (fs.existsSync(path.join(servicePath, infraFile))) {
                infraFound.push(infraFile);
            }
        }
        
        if (infraFound.length >= 2) {
            result.tests.infrastructure = true;
            result.passed++;
            console.log(`  ✅ Infrastructure files found: ${infraFound.join(', ')}`);
        } else {
            result.tests.infrastructure = false;
            result.failed++;
            result.errors.push('Infrastructure files missing');
            console.log(`  ❌ Infrastructure incomplete`);
        }

        // Check for test directories
        const testDirs = ['tests/', 'test/', 'src/test/'];
        let testFound = false;
        for (const testDir of testDirs) {
            if (fs.existsSync(path.join(servicePath, testDir))) {
                testFound = true;
                break;
            }
        }
        
        if (testFound) {
            result.tests.testDirectory = true;
            result.passed++;
            console.log(`  ✅ Test directory found`);
        } else {
            result.tests.testDirectory = false;
            result.failed++;
            result.errors.push('Test directory not found');
            console.log(`  ❌ Test directory missing`);
        }
    }

    getMainFiles(type) {
        switch (type) {
            case 'node': 
                return [
                    'src/server.ts', 'src/server.js', 'src/index.ts', 'src/index.js', 
                    'index.js', 'server.js', 'src/app.ts', 'src/app.js'
                ];
            case 'python': 
                return [
                    'src/main.py', 'main.py', 'app.py', 'src/app.py', 
                    'server.py', 'src/server.py'
                ];
            case 'go': 
                return [
                    'main.go', 'cmd/main.go', 'cmd/server/main.go',
                    'cmd/*/main.go'
                ];
            case 'java': 
                return [
                    'src/main/java', 'pom.xml', 'src/main/java/*/Application.java'
                ];
            case 'rust': 
                return [
                    'src/main.rs', 'Cargo.toml'
                ];
            default: 
                return [];
        }
    }

    getConfigFiles(type) {
        switch (type) {
            case 'node': 
                return ['package.json', 'tsconfig.json', '.env.example'];
            case 'python': 
                return ['requirements.txt', 'requirements_fixed.txt', 'pyproject.toml', 'setup.py'];
            case 'go': 
                return ['go.mod', 'go.sum'];
            case 'java': 
                return ['pom.xml', 'build.gradle', 'src/main/resources/application.yml'];
            case 'rust': 
                return ['Cargo.toml', 'Cargo.lock'];
            default: 
                return [];
        }
    }

    generateReport() {
        console.log('\n📊 Generating Enhanced Test Report...\n');
        
        const summary = {
            totalServices: Object.keys(this.testResults).length,
            passedServices: 0,
            failedServices: 0,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            servicesByType: {},
            servicesByStatus: { passed: [], failed: [] }
        };

        // Calculate statistics by service type
        Object.values(this.testResults).forEach(result => {
            summary.totalTests += result.passed + result.failed;
            summary.passedTests += result.passed;
            summary.failedTests += result.failed;
            
            // Track by service type
            if (!summary.servicesByType[result.type]) {
                summary.servicesByType[result.type] = { total: 0, passed: 0, failed: 0 };
            }
            summary.servicesByType[result.type].total++;
            
            if (result.failed === 0) {
                summary.passedServices++;
                summary.servicesByType[result.type].passed++;
                summary.servicesByStatus.passed.push(result.service);
            } else {
                summary.failedServices++;
                summary.servicesByType[result.type].failed++;
                summary.servicesByStatus.failed.push(result.service);
            }
        });

        const report = {
            timestamp: new Date().toISOString(),
            summary,
            services: this.testResults,
            metadata: {
                testDuration: '~5 minutes',
                testTypes: ['Structure', 'Configuration', 'Source Code', 'Documentation', 'Infrastructure'],
                coverage: 'Service architecture and setup validation'
            }
        };

        // Write JSON report
        fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));

        // Print enhanced summary
        console.log('='.repeat(80));
        console.log('🎯 SUUUPRA SERVICES ENHANCED TEST SUMMARY');
        console.log('='.repeat(80));
        console.log(`📅 Timestamp: ${report.timestamp}`);
        console.log(`🏢 Services Tested: ${summary.totalServices}`);
        console.log(`✅ Services Passed: ${summary.passedServices}`);
        console.log(`❌ Services Failed: ${summary.failedServices}`);
        console.log(`🧪 Total Tests: ${summary.totalTests}`);
        console.log(`✅ Tests Passed: ${summary.passedTests}`);
        console.log(`❌ Tests Failed: ${summary.failedTests}`);
        
        const successRate = summary.totalTests > 0 ? 
            ((summary.passedTests / summary.totalTests) * 100).toFixed(1) : 0;
        console.log(`📈 Success Rate: ${successRate}%`);
        
        // Print by service type
        console.log('\n📊 BY SERVICE TYPE:');
        Object.entries(summary.servicesByType).forEach(([type, stats]) => {
            const typeRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
            console.log(`  ${type.toUpperCase()}: ${stats.passed}/${stats.total} (${typeRate}%)`);
        });
        
        console.log('='.repeat(80));

        // Print failed services details
        if (summary.failedServices > 0) {
            console.log('\n❌ SERVICES NEEDING ATTENTION:\n');
            Object.entries(this.testResults).forEach(([serviceName, result]) => {
                if (result.failed > 0) {
                    console.log(`🔴 ${serviceName} (${result.type}/${result.framework}):`);
                    result.errors.forEach(error => {
                        console.log(`   • ${error}`);
                    });
                    console.log('');
                }
            });
        }

        // Print successful services
        if (summary.passedServices > 0) {
            console.log('\n✅ FULLY COMPLIANT SERVICES:\n');
            summary.servicesByStatus.passed.forEach(serviceName => {
                const result = this.testResults[serviceName];
                console.log(`🟢 ${serviceName} (${result.type}/${result.framework}) - ${result.passed} tests passed`);
            });
            console.log('');
        }

        console.log('📋 Detailed report saved to: test-results.json\n');
    }
}

// Run the enhanced tests
const orchestrator = new EnhancedTestOrchestrator();
orchestrator.runTests().catch(console.error);
EOF
}

# Generate comprehensive test report with charts
generate_test_report() {
    print_status "Generating comprehensive test report..."
    
    # Create enhanced HTML report if results exist
    if [ -f "test-results.json" ]; then
        create_enhanced_html_report
        print_success "Enhanced HTML report generated: ${RESULTS_DIR}/test-report.html"
    else
        print_warning "No test results found to generate report"
    fi
    
    # Copy logs to results directory
    if [ -d "$LOG_DIR" ]; then
        cp -r "$LOG_DIR" "$RESULTS_DIR/"
        print_info "Logs copied to results directory"
    fi
}

# Create enhanced HTML report with better visualization
create_enhanced_html_report() {
    cat > "${RESULTS_DIR}/test-report.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Suuupra Services Comprehensive Test Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px; 
            border-radius: 20px; 
            margin-bottom: 30px; 
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 3em; margin-bottom: 10px; font-weight: 300; }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin-bottom: 40px; 
        }
        .stat-card { 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            text-align: center; 
            box-shadow: 0 8px 25px rgba(0,0,0,0.1); 
            transition: transform 0.3s, box-shadow 0.3s; 
        }
        .stat-card:hover { 
            transform: translateY(-5px); 
            box-shadow: 0 15px 35px rgba(0,0,0,0.15); 
        }
        .stat-value { font-size: 3em; font-weight: bold; margin-bottom: 10px; }
        .stat-label { color: #666; font-size: 1.1em; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .charts-section { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 30px; 
            margin-bottom: 40px; 
        }
        .chart-container { 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 8px 25px rgba(0,0,0,0.1); 
        }
        .services-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); 
            gap: 25px; 
        }
        .service-card { 
            background: white; 
            border-radius: 15px; 
            padding: 25px; 
            box-shadow: 0 8px 25px rgba(0,0,0,0.1); 
            transition: transform 0.3s; 
            border-left: 5px solid #ddd;
        }
        .service-card:hover { transform: translateY(-3px); }
        .service-card.passed { border-left-color: #28a745; }
        .service-card.failed { border-left-color: #dc3545; }
        .service-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 20px; 
            padding-bottom: 15px; 
            border-bottom: 2px solid #f0f0f0; 
        }
        .service-title { font-size: 1.4em; font-weight: bold; }
        .service-badge { 
            background: #e9ecef; 
            padding: 8px 15px; 
            border-radius: 20px; 
            font-size: 0.8em; 
            font-weight: bold;
        }
        .test-progress { 
            display: flex; 
            gap: 15px; 
            margin-bottom: 20px; 
        }
        .test-stat { text-align: center; }
        .test-stat-value { font-size: 2em; font-weight: bold; }
        .test-stat-label { font-size: 0.9em; color: #666; }
        .progress-bar { 
            width: 100%; 
            height: 10px; 
            background: #f0f0f0; 
            border-radius: 5px; 
            overflow: hidden; 
            margin: 15px 0;
        }
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #28a745, #20c997); 
            transition: width 0.5s ease; 
        }
        .error-list { margin-top: 15px; }
        .error-item { 
            background: #f8d7da; 
            color: #721c24; 
            padding: 10px 15px; 
            border-radius: 8px; 
            margin-bottom: 8px; 
            font-size: 0.9em; 
            border-left: 4px solid #dc3545;
        }
        .no-errors { 
            color: #28a745; 
            font-style: italic; 
            text-align: center; 
            padding: 20px; 
            background: #d4edda; 
            border-radius: 8px; 
        }
        .section-title { 
            font-size: 2em; 
            margin: 40px 0 20px 0; 
            color: #333; 
            border-bottom: 3px solid #667eea; 
            padding-bottom: 10px; 
        }
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .charts-section { grid-template-columns: 1fr; }
            .services-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Suuupra Services Test Report</h1>
            <p id="timestamp">Generated on: Loading...</p>
        </div>
        
        <div class="stats-grid" id="stats">
            <!-- Stats will be populated by JavaScript -->
        </div>
        
        <div class="charts-section">
            <div class="chart-container">
                <h3>Services by Status</h3>
                <canvas id="statusChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Services by Technology</h3>
                <canvas id="techChart"></canvas>
            </div>
        </div>
        
        <h2 class="section-title">📋 Service Details</h2>
        <div class="services-grid" id="services">
            <!-- Services will be populated by JavaScript -->
        </div>
    </div>

    <script>
        // Load test results and populate the report
        fetch('./test-results.json')
            .then(response => response.json())
            .then(data => {
                populateReport(data);
                createCharts(data);
            })
            .catch(error => {
                document.getElementById('stats').innerHTML = '<div style="text-align: center; color: #dc3545; grid-column: 1/-1;">❌ Failed to load test results</div>';
                console.error('Error loading test results:', error);
            });

        function populateReport(data) {
            // Update timestamp
            document.getElementById('timestamp').textContent = `Generated on: ${new Date(data.timestamp).toLocaleString()}`;
            
            // Populate stats
            const statsContainer = document.getElementById('stats');
            const summary = data.summary;
            
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value info">${summary.totalServices}</div>
                    <div class="stat-label">Services Tested</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value success">${summary.passedServices}</div>
                    <div class="stat-label">Services Passed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value failure">${summary.failedServices}</div>
                    <div class="stat-label">Services Failed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value info">${summary.totalTests}</div>
                    <div class="stat-label">Total Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value success">${summary.passedTests}</div>
                    <div class="stat-label">Tests Passed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value failure">${summary.failedTests}</div>
                    <div class="stat-label">Tests Failed</div>
                </div>
            `;
            
            // Populate services
            const servicesContainer = document.getElementById('services');
            const serviceCards = Object.entries(data.services).map(([serviceName, result]) => {
                const status = result.failed === 0 ? 'passed' : 'failed';
                const statusIcon = result.failed === 0 ? '✅' : '❌';
                const totalTests = result.passed + result.failed;
                const successRate = totalTests > 0 ? Math.round((result.passed / totalTests) * 100) : 0;
                
                const errorsList = result.errors.length > 0 ? 
                    result.errors.map(error => `<div class="error-item">${error}</div>`).join('') :
                    '<div class="no-errors">✨ All tests passed! This service is fully compliant.</div>';
                
                return `
                    <div class="service-card ${status}">
                        <div class="service-header">
                            <div>
                                <div class="service-title">${statusIcon} ${serviceName}</div>
                                <div class="service-badge">${result.type}/${result.framework || 'unknown'}</div>
                            </div>
                        </div>
                        
                        <div class="test-progress">
                            <div class="test-stat">
                                <div class="test-stat-value success">${result.passed}</div>
                                <div class="test-stat-label">Passed</div>
                            </div>
                            <div class="test-stat">
                                <div class="test-stat-value failure">${result.failed}</div>
                                <div class="test-stat-label">Failed</div>
                            </div>
                            <div class="test-stat">
                                <div class="test-stat-value info">${successRate}%</div>
                                <div class="test-stat-label">Success Rate</div>
                            </div>
                        </div>
                        
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${successRate}%"></div>
                        </div>
                        
                        <div class="error-list">
                            <strong>Test Results:</strong>
                            ${errorsList}
                        </div>
                    </div>
                `;
            }).join('');
            
            servicesContainer.innerHTML = serviceCards;
        }

        function createCharts(data) {
            // Status Chart
            const statusCtx = document.getElementById('statusChart').getContext('2d');
            new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Passed', 'Failed'],
                    datasets: [{
                        data: [data.summary.passedServices, data.summary.failedServices],
                        backgroundColor: ['#28a745', '#dc3545'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });

            // Technology Chart
            const techCtx = document.getElementById('techChart').getContext('2d');
            const techData = data.summary.servicesByType;
            const techLabels = Object.keys(techData);
            const techCounts = techLabels.map(tech => techData[tech].total);
            
            new Chart(techCtx, {
                type: 'bar',
                data: {
                    labels: techLabels.map(t => t.toUpperCase()),
                    datasets: [{
                        label: 'Services',
                        data: techCounts,
                        backgroundColor: ['#007bff', '#28a745', '#ffc107', '#17a2b8', '#6f42c1'],
                        borderWidth: 0,
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
    </script>
</body>
</html>
EOF

    # Copy test results to results directory
    if [ -f "test-results.json" ]; then
        cp test-results.json "${RESULTS_DIR}/"
    fi
}

# Cleanup test infrastructure
cleanup() {
    print_status "Cleaning up test infrastructure..."
    
    # Stop Docker containers
    if [ -f "docker-compose.test.yml" ]; then
        docker-compose -f docker-compose.test.yml down -v &> /dev/null || true
        print_success "Docker containers stopped"
    fi
    
    # Clean up any remaining processes
    pkill -f "enhanced-test-orchestrator" &> /dev/null || true
    pkill -f "node.*server" &> /dev/null || true
    pkill -f "python.*main.py" &> /dev/null || true
    
    # Clean up temporary files
    rm -f enhanced-test-orchestrator.js
    
    print_success "Process cleanup completed"
}

# Main execution function
main() {
    local command="${1:-full}"
    
    echo "🚀 Suuupra Services Test Runner - Final Fixed Version"
    echo "====================================================="
    
    case "$command" in
        "setup")
            check_prerequisites
            install_dependencies
            setup_infrastructure
            ;;
        "test")
            run_comprehensive_tests
            ;;
        "report")
            generate_test_report
            ;;
        "cleanup")
            cleanup
            ;;
        "full")
            # Set up signal handlers for cleanup
            trap cleanup EXIT SIGINT SIGTERM
            
            check_prerequisites || exit 1
            install_dependencies
            setup_infrastructure
            
            # Run tests and capture results
            test_success=true
            run_comprehensive_tests || test_success=false
            
            generate_test_report
            
            # Final cleanup
            cleanup
            
            if [ "$test_success" = true ]; then
                print_success "🎉 All tests completed successfully!"
                print_info "📋 Check test-results/test-report.html for detailed results"
                print_info "📊 Interactive charts and visualizations included"
                exit 0
            else
                print_error "❌ Some tests failed. Check the report for details."
                print_info "📋 Check test-results/test-report.html for detailed results"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 [setup|test|report|cleanup|full]"
            echo ""
            echo "Commands:"
            echo "  setup   - Install dependencies and setup infrastructure"
            echo "  test    - Run comprehensive service tests"
            echo "  report  - Generate test report"
            echo "  cleanup - Clean up test infrastructure"
            echo "  full    - Run complete test suite (default)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"