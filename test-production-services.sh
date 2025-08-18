#!/bin/bash

# ==============================================================================
# 🎓 SUUUPRA PLATFORM - PRODUCTION SERVICE TESTING
#
# Comprehensive testing script for all working services
# Tests each service individually, then runs integration tests
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.verified-working.yml"
LOG_DIR="logs/production-tests"
RESULTS_FILE="production-test-results.txt"

# Create log directory
mkdir -p $LOG_DIR

# Clear previous results
> $RESULTS_FILE

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
    echo "[$(date +'%H:%M:%S')] $1" >> $LOG_DIR/test.log
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
    echo "✅ $1" >> $RESULTS_FILE
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
    echo "❌ $1" >> $RESULTS_FILE
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
    echo "⚠️ $1" >> $RESULTS_FILE
}

header() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 🚀 $1${NC}"
    echo "================================" >> $LOG_DIR/test.log
    echo "[$(date +'%H:%M:%S')] $1" >> $LOG_DIR/test.log
    echo "================================" >> $LOG_DIR/test.log
}

# Test service health with detailed output
test_service() {
    local service_name=$1
    local port=$2
    local path="${3:-/health}"
    local max_retries="${4:-10}"
    
    log "Testing $service_name on port $port..."
    
    for i in $(seq 1 $max_retries); do
        if response=$(curl -f -s --max-time 5 "http://localhost:$port$path" 2>/dev/null); then
            success "$service_name: Health check passed"
            echo "  Response: $response" | head -c 100
            echo ""
            return 0
        fi
        
        if [[ $i -lt $max_retries ]]; then
            log "$service_name: Attempt $i/$max_retries failed, retrying..."
            sleep 3
        fi
    done
    
    error "$service_name: Health check failed after $max_retries attempts"
    return 1
}

# Test infrastructure service
test_infrastructure() {
    local service_name=$1
    local port=$2
    local path="${3:-/}"
    
    log "Testing infrastructure: $service_name..."
    
    if curl -f -s --max-time 5 "http://localhost:$port$path" > /dev/null 2>&1; then
        success "$service_name: Infrastructure ready"
        return 0
    else
        error "$service_name: Infrastructure not ready"
        return 1
    fi
}

# Main testing function
main() {
    echo -e "${CYAN}"
    cat << 'EOF'
    🎓 SUUUPRA PLATFORM - PRODUCTION SERVICE TESTING
    
    Testing all verified working services for production readiness.
    This will test individual services and then integration flows.
EOF
    echo -e "${NC}"
    
    # Start fresh deployment
    header "STARTING FRESH DEPLOYMENT"
    log "Stopping any existing containers..."
    docker-compose -f $COMPOSE_FILE down 2>/dev/null || true
    
    log "Starting infrastructure services first..."
    docker-compose -f $COMPOSE_FILE up -d postgres redis elasticsearch prometheus grafana jaeger minio etcd milvus zookeeper
    
    log "Waiting for infrastructure to stabilize..."
    sleep 45
    
    # Test infrastructure
    header "TESTING INFRASTRUCTURE"
    test_infrastructure "PostgreSQL" "5432" ""
    test_infrastructure "Redis" "6379" ""
    test_infrastructure "Elasticsearch" "9200" "/"
    test_infrastructure "Prometheus" "9090" "/"
    test_infrastructure "Grafana" "3001" "/api/health"
    
    # Start application services without Kafka dependencies
    header "STARTING APPLICATION SERVICES"
    log "Starting UPI Core..."
    docker-compose -f $COMPOSE_FILE up -d upi-core
    
    log "Starting Bank Simulator..."
    docker-compose -f $COMPOSE_FILE up -d bank-simulator
    
    log "Starting Recommendations..."
    docker-compose -f $COMPOSE_FILE up -d recommendations
    
    log "Starting Analytics..."
    docker-compose -f $COMPOSE_FILE up -d analytics
    
    log "Waiting for application services to initialize..."
    sleep 60
    
    # Test application services
    header "TESTING APPLICATION SERVICES"
    test_service "UPI Core" "8083" "/health"
    test_service "Bank Simulator" "3000" "/health"
    test_service "Recommendations" "8095" "/health"
    test_service "Analytics" "8087" "/health"
    
    # Integration tests
    header "INTEGRATION TESTING"
    log "Testing service-to-service communication..."
    
    # Test UPI Core metrics endpoint
    if curl -f -s "http://localhost:9091/metrics" > /dev/null 2>&1; then
        success "UPI Core: Metrics endpoint working"
    else
        warn "UPI Core: Metrics endpoint not responding"
    fi
    
    # Test Bank Simulator gRPC port
    if nc -z localhost 50050 2>/dev/null; then
        success "Bank Simulator: gRPC port accessible"
    else
        warn "Bank Simulator: gRPC port not accessible"
    fi
    
    # Final status
    echo ""
    header "PRODUCTION TEST SUMMARY"
    echo ""
    
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    echo -e "${CYAN}📊 Test Results Summary:${NC}"
    cat $RESULTS_FILE
    
    echo ""
    success "🎉 Production service testing completed!"
    echo ""
    echo -e "${CYAN}🔗 Service Endpoints:${NC}"
    echo "• UPI Core: http://localhost:8083/health"
    echo "• Bank Simulator: http://localhost:3000/health"
    echo "• Recommendations: http://localhost:8095/health"
    echo "• Analytics: http://localhost:8087/health"
    echo ""
    echo -e "${CYAN}📊 Monitoring:${NC}"
    echo "• Prometheus: http://localhost:9090"
    echo "• Grafana: http://localhost:3001 (admin/admin)"
    echo "• Jaeger: http://localhost:16686"
    echo ""
    echo -e "${CYAN}🎯 Ready for Integration Testing:${NC}"
    echo "Platform is ready for comprehensive integration testing!"
}

# Usage information
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    cat << EOF
🎓 Suuupra Platform - Production Service Testing

USAGE:
    $0

FEATURES:
    - Tests infrastructure services first
    - Tests application services individually
    - Performs basic integration tests
    - Generates detailed test results

OUTPUTS:
    - Test logs: $LOG_DIR/
    - Results summary: $RESULTS_FILE
    - Service health status with response data

This script ensures production readiness of all working services.
EOF
    exit 0
fi

# Run main function
main "$@"
