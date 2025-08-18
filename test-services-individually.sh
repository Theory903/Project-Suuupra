#!/bin/bash

# ==============================================================================
# Suuupra Platform - Individual Service Testing Script
#
# This script tests each service individually to identify and fix build issues
# before deploying the complete platform.
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
COMPOSE_FILE="docker-compose.production.yml"
WORKING_COMPOSE="docker-compose.working.yml"
LOG_DIR="logs/service-tests"
RESULTS_FILE="service-test-results.txt"

# Create log directory
mkdir -p $LOG_DIR

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
    echo "[$(date +'%H:%M:%S')] $1" >> $LOG_DIR/test.log
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
    echo "[$(date +'%H:%M:%S')] SUCCESS: $1" >> $LOG_DIR/test.log
    echo "✅ $1" >> $RESULTS_FILE
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
    echo "[$(date +'%H:%M:%S')] ERROR: $1" >> $LOG_DIR/test.log
    echo "❌ $1" >> $RESULTS_FILE
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
    echo "[$(date +'%H:%M:%S')] WARN: $1" >> $LOG_DIR/test.log
    echo "⚠️  $1" >> $RESULTS_FILE
}

header() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 🚀 $1${NC}"
    echo "================================" >> $LOG_DIR/test.log
    echo "[$(date +'%H:%M:%S')] $1" >> $LOG_DIR/test.log
    echo "================================" >> $LOG_DIR/test.log
}

# Initialize results file
echo "🎓 Suuupra Platform - Service Test Results" > $RESULTS_FILE
echo "Generated: $(date)" >> $RESULTS_FILE
echo "=========================================" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

# Test individual service
test_service() {
    local service_name=$1
    local port=$2
    local health_path="${3:-/health}"
    local build_timeout="${4:-300}"
    
    header "TESTING $service_name"
    
    # Stop any running containers first
    docker-compose -f $COMPOSE_FILE stop $service_name 2>/dev/null || true
    docker-compose -f $COMPOSE_FILE rm -f $service_name 2>/dev/null || true
    
    # Test build
    log "Building $service_name..."
    if timeout $build_timeout docker-compose -f $COMPOSE_FILE build $service_name > $LOG_DIR/${service_name}_build.log 2>&1; then
        success "$service_name: Build successful"
        
        # Test startup
        log "Starting $service_name..."
        if docker-compose -f $COMPOSE_FILE up -d $service_name > $LOG_DIR/${service_name}_start.log 2>&1; then
            sleep 15  # Give service time to start
            
            # Test health check
            log "Health checking $service_name on port $port..."
            if curl -f -s --max-time 10 "http://localhost:$port$health_path" > $LOG_DIR/${service_name}_health.log 2>&1; then
                success "$service_name: Service healthy"
                
                # Get service info
                curl -s "http://localhost:$port/" > $LOG_DIR/${service_name}_info.log 2>&1 || true
                
                return 0
            else
                error "$service_name: Health check failed"
                docker logs $(docker-compose -f $COMPOSE_FILE ps -q $service_name) > $LOG_DIR/${service_name}_logs.log 2>&1 || true
                return 1
            fi
        else
            error "$service_name: Failed to start"
            return 1
        fi
    else
        error "$service_name: Build failed"
        return 1
    fi
}

# Clean up function
cleanup_service() {
    local service_name=$1
    docker-compose -f $COMPOSE_FILE stop $service_name 2>/dev/null || true
    docker-compose -f $COMPOSE_FILE rm -f $service_name 2>/dev/null || true
}

# Main testing function
main() {
    echo -e "${CYAN}"
    cat << 'EOF'
    🎓 SUUUPRA PLATFORM - INDIVIDUAL SERVICE TESTING
    
    Testing all 17 services individually to identify build issues
    and ensure production-grade deployment readiness.
EOF
    echo -e "${NC}"
    
    # Start infrastructure first
    header "STARTING INFRASTRUCTURE"
    log "Starting core infrastructure services..."
    docker-compose -f $COMPOSE_FILE up -d postgres redis zookeeper kafka jaeger prometheus grafana elasticsearch minio etcd milvus
    
    log "Waiting for infrastructure to be ready..."
    sleep 60
    
    # Test infrastructure health
    if curl -f -s "http://localhost:9090" > /dev/null; then
        success "Infrastructure: Prometheus ready"
    else
        warn "Infrastructure: Prometheus not responding"
    fi
    
    # Initialize counters
    local total_services=17
    local successful_services=0
    local failed_services=0
    
    # Test each service individually
    echo ""
    header "TESTING FOUNDATION SERVICES"
    
    # Identity Service (Spring Boot)
    if test_service "identity" "8081" "/health" 600; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "identity"
    
    # Content Service (Node.js/TypeScript)
    if test_service "content" "8082" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "content"
    
    # API Gateway (Node.js)
    if test_service "api-gateway" "8080" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "api-gateway"
    
    echo ""
    header "TESTING PAYMENTS & COMMERCE SERVICES"
    
    # UPI Core (Go)
    if test_service "upi-core" "8083" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "upi-core"
    
    # Bank Simulator (Node.js)
    if test_service "bank-simulator" "3000" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "bank-simulator"
    
    # Commerce Service (Python)
    if test_service "commerce" "8084" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "commerce"
    
    # Payments Service (Go)
    if test_service "payments" "8085" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "payments"
    
    # Ledger Service (Java)
    if test_service "ledger" "8086" "/health" 600; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "ledger"
    
    echo ""
    header "TESTING MEDIA SERVICES"
    
    # Live Classes (Node.js)
    if test_service "live-classes" "8090" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "live-classes"
    
    # VOD Service (Python)
    if test_service "vod" "8097" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "vod"
    
    # Mass Live (Go)
    if test_service "mass-live" "8088" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "mass-live"
    
    # Creator Studio (Node.js)
    if test_service "creator-studio" "8093" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "creator-studio"
    
    echo ""
    header "TESTING INTELLIGENCE SERVICES"
    
    # LLM Tutor (Python)
    if test_service "llm-tutor" "8092" "/health" 400; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "llm-tutor"
    
    # Search Crawler (Go)
    if test_service "search-crawler" "8096" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "search-crawler"
    
    # Recommendations (Python)
    if test_service "recommendations" "8095" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "recommendations"
    
    # Analytics (Python)
    if test_service "analytics" "8087" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "analytics"
    
    echo ""
    header "TESTING SUPPORTING SERVICES"
    
    # Counters (Go)
    if test_service "counters" "8089" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "counters"
    
    # Live Tracking (Go)
    if test_service "live-tracking" "8091" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "live-tracking"
    
    # Notifications (Python)
    if test_service "notifications" "8098" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "notifications"
    
    # Admin Dashboard (Node.js)
    if test_service "admin" "8099" "/health" 300; then
        ((successful_services++))
    else
        ((failed_services++))
    fi
    cleanup_service "admin"
    
    # Final results
    echo ""
    header "TEST RESULTS SUMMARY"
    echo ""
    echo -e "${GREEN}✅ Successful Services: $successful_services/$total_services${NC}"
    echo -e "${RED}❌ Failed Services: $failed_services/$total_services${NC}"
    echo ""
    
    if [[ $successful_services -eq $total_services ]]; then
        success "🎉 ALL SERVICES PASSED! Ready for full platform deployment"
        echo ""
        echo -e "${CYAN}To deploy the complete platform:${NC}"
        echo "./start-suuupra-platform.sh --services=all"
    else
        warn "Some services failed. Check logs in $LOG_DIR/ for details"
        echo ""
        echo -e "${CYAN}Failed services need fixing before full deployment.${NC}"
        echo "Check build logs: ls -la $LOG_DIR/*_build.log"
        echo "Check startup logs: ls -la $LOG_DIR/*_start.log"
    fi
    
    echo ""
    echo "📊 Detailed results saved to: $RESULTS_FILE"
    echo "📋 Service logs available in: $LOG_DIR/"
}

# Usage information
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    cat << EOF
🎓 Suuupra Platform - Individual Service Testing

This script tests each of the 17 microservices individually to identify
build issues and ensure production readiness.

USAGE:
    $0

WHAT IT DOES:
    1. Starts infrastructure services (postgres, redis, kafka, etc.)
    2. Tests each application service individually:
       - Build test
       - Startup test  
       - Health check test
    3. Generates detailed report of results

OUTPUTS:
    - Service test results: $RESULTS_FILE
    - Detailed logs: $LOG_DIR/
    - Build logs: $LOG_DIR/*_build.log
    - Health logs: $LOG_DIR/*_health.log

After successful testing, use:
    ./start-suuupra-platform.sh --services=all
EOF
    exit 0
fi

# Run main function
main "$@"
