#!/bin/bash

# ==============================================================================
# Suuupra Platform - Working Services Deployment Script
#
# Deploys only the services that are currently building and running successfully
# for production-grade testing and integration validation.
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
LOG_DIR="logs/working-deployment"

# Create log directory
mkdir -p $LOG_DIR

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
    echo "[$(date +'%H:%M:%S')] $1" >> $LOG_DIR/deploy.log
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
    echo "[$(date +'%H:%M:%S')] SUCCESS: $1" >> $LOG_DIR/deploy.log
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
    echo "[$(date +'%H:%M:%S')] ERROR: $1" >> $LOG_DIR/deploy.log
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
    echo "[$(date +'%H:%M:%S')] WARN: $1" >> $LOG_DIR/deploy.log
}

header() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 🚀 $1${NC}"
    echo "================================" >> $LOG_DIR/deploy.log
    echo "[$(date +'%H:%M:%S')] $1" >> $LOG_DIR/deploy.log
    echo "================================" >> $LOG_DIR/deploy.log
}

# Test service health
test_health() {
    local service_name=$1
    local port=$2
    local path="${3:-/health}"
    local max_retries="${4:-30}"
    
    for i in $(seq 1 $max_retries); do
        if curl -f -s --max-time 5 "http://localhost:$port$path" > /dev/null 2>&1; then
            success "$service_name: Health check passed"
            return 0
        fi
        
        if [[ $i -lt $max_retries ]]; then
            log "$service_name: Health check attempt $i/$max_retries failed, retrying..."
            sleep 2
        fi
    done
    
    error "$service_name: Health check failed after $max_retries attempts"
    return 1
}

# Main deployment function
main() {
    echo -e "${CYAN}"
    cat << 'EOF'
    🎓 SUUUPRA PLATFORM - WORKING SERVICES DEPLOYMENT
    
    Deploying verified working services for production-grade testing.
    This includes infrastructure + 3 verified application services.
EOF
    echo -e "${NC}"
    
    # Clean up any existing containers
    log "Cleaning up existing containers..."
    docker-compose -f $COMPOSE_FILE down 2>/dev/null || true
    
    # Start infrastructure services
    header "DEPLOYING INFRASTRUCTURE"
    log "Starting core infrastructure services..."
    
    docker-compose -f $COMPOSE_FILE up -d \
        postgres \
        redis \
        zookeeper \
        kafka \
        jaeger \
        prometheus \
        grafana \
        elasticsearch \
        minio \
        etcd \
        milvus
    
    log "Waiting for infrastructure to be ready..."
    sleep 60
    
    # Test infrastructure health
    log "Testing infrastructure health..."
    test_health "Prometheus" "9090" "/" 10
    test_health "Elasticsearch" "9200" "/" 10
    
    # Start verified working services
    header "DEPLOYING WORKING SERVICES"
    
    log "Starting UPI Core..."
    docker-compose -f $COMPOSE_FILE up -d upi-core
    test_health "UPI Core" "8083" "/health" 30
    
    log "Starting Bank Simulator..."
    docker-compose -f $COMPOSE_FILE up -d bank-simulator
    test_health "Bank Simulator" "3000" "/health" 30
    
    log "Starting Recommendations..."
    docker-compose -f $COMPOSE_FILE up -d recommendations
    test_health "Recommendations" "8095" "/health" 30
    
    # Final status
    echo ""
    header "DEPLOYMENT SUMMARY"
    echo ""
    
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    success "🎉 Working services deployed successfully!"
    echo ""
    echo -e "${CYAN}Service Health Endpoints:${NC}"
    echo "• UPI Core: http://localhost:8083/health"
    echo "• Bank Simulator: http://localhost:3000/health"
    echo "• Recommendations: http://localhost:8095/health"
    echo ""
    echo -e "${CYAN}Monitoring & Observability:${NC}"
    echo "• Prometheus: http://localhost:9090"
    echo "• Grafana: http://localhost:3001 (admin/admin)"
    echo "• Jaeger: http://localhost:16686"
    echo "• Elasticsearch: http://localhost:9200"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "1. Fix remaining service build issues"
    echo "2. Add more services incrementally"
    echo "3. Run integration tests"
    echo ""
    echo "📋 Logs available in: $LOG_DIR/"
}

# Usage information
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    cat << EOF
🎓 Suuupra Platform - Working Services Deployment

This script deploys only the verified working services for production testing.

USAGE:
    $0

SERVICES DEPLOYED:
    Infrastructure: postgres, redis, kafka, zookeeper, jaeger, prometheus, grafana, elasticsearch, minio, etcd, milvus
    Applications: upi-core, bank-simulator, recommendations

OUTPUTS:
    - Deployment logs: $LOG_DIR/
    - Service health checks with retries
    - Final status summary

After deployment, services can be accessed via their health endpoints.
EOF
    exit 0
fi

# Run main function
main "$@"
