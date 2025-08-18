#!/bin/bash

# ==============================================================================
# Suuupra Platform - Verified Working Services Deployment
#
# Deploys only the verified working services (4/17) for immediate testing
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

COMPOSE_FILE="docker-compose.verified-working.yml"

header() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 🚀 $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
}

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

# Test service health
test_health() {
    local service_name=$1
    local port=$2
    local path="${3:-/health}"
    local max_retries="${4:-15}"
    
    for i in $(seq 1 $max_retries); do
        if curl -f -s --max-time 5 "http://localhost:$port$path" > /dev/null 2>&1; then
            success "$service_name: Health check passed"
            return 0
        fi
        
        if [[ $i -lt $max_retries ]]; then
            log "$service_name: Health check attempt $i/$max_retries..."
            sleep 3
        fi
    done
    
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $service_name: Health check failed${NC}"
    return 1
}

main() {
    echo -e "${CYAN}"
    cat << 'EOF'
    🎓 SUUUPRA PLATFORM - VERIFIED WORKING SERVICES
    
    Deploying 4 verified working services + full infrastructure
    for production-grade integration testing.
    
    VERIFIED SERVICES:
    • UPI Core (Go) - Payment processing
    • Bank Simulator (Node.js) - Banking simulation
    • Recommendations (Python) - ML recommendations  
    • Analytics (Python) - Data analytics
EOF
    echo -e "${NC}"
    
    # Clean up
    log "Cleaning up existing containers..."
    docker-compose -f $COMPOSE_FILE down 2>/dev/null || true
    
    # Deploy everything
    header "DEPLOYING VERIFIED WORKING PLATFORM"
    log "Starting all infrastructure and verified services..."
    
    docker-compose -f $COMPOSE_FILE up -d
    
    log "Waiting for services to initialize..."
    sleep 90
    
    # Test all health endpoints
    header "TESTING SERVICE HEALTH"
    
    test_health "UPI Core" "8083" "/health"
    test_health "Bank Simulator" "3000" "/health"  
    test_health "Recommendations" "8095" "/health"
    test_health "Analytics" "8087" "/health"
    
    # Test infrastructure
    test_health "Prometheus" "9090" "/" 5
    test_health "Elasticsearch" "9200" "/" 5
    
    # Final status
    echo ""
    header "DEPLOYMENT COMPLETE"
    echo ""
    
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    success "🎉 Verified working platform deployed successfully!"
    echo ""
    echo -e "${CYAN}🔗 Service Health Endpoints:${NC}"
    echo "• UPI Core: http://localhost:8083/health"
    echo "• Bank Simulator: http://localhost:3000/health"
    echo "• Recommendations: http://localhost:8095/health"
    echo "• Analytics: http://localhost:8087/health"
    echo ""
    echo -e "${CYAN}📊 Monitoring & Observability:${NC}"
    echo "• Prometheus: http://localhost:9090"
    echo "• Grafana: http://localhost:3001 (admin/admin)"
    echo "• Jaeger: http://localhost:16686"
    echo "• Elasticsearch: http://localhost:9200"
    echo "• Minio: http://localhost:9000 (minioadmin/minioadmin123)"
    echo ""
    echo -e "${CYAN}🎯 Integration Testing Ready:${NC}"
    echo "This platform is ready for integration testing with 4 working services."
    echo "You can now test payment flows, recommendations, and analytics."
}

# Run main function
main "$@"
