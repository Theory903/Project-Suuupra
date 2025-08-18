#!/bin/bash

# ==============================================================================
# 🎓 SUUUPRA PLATFORM - PRODUCTION WORKING SERVICES DEPLOYMENT
#
# Deploys verified working services in production-grade setup
# Avoids problematic services until they are fixed
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
LOG_DIR="logs/production-deployment"

# Create log directory
mkdir -p $LOG_DIR

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️ $1${NC}"
}

header() {
    echo -e "${PURPLE}[$(date +'%H:%M:%S')] 🚀 $1${NC}"
}

# Test service health
test_health() {
    local service_name=$1
    local port=$2
    local path="${3:-/health}"
    local max_attempts=6
    local attempt=1
    
    log "Testing $service_name health on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port$path" >/dev/null 2>&1; then
            success "$service_name is healthy on port $port"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts failed for $service_name, waiting 10s..."
        sleep 10
        ((attempt++))
    done
    
    error "$service_name health check failed on port $port"
    return 1
}

# Main execution
main() {
    header "🎓 SUUUPRA PLATFORM - PRODUCTION DEPLOYMENT"
    log "Starting production-grade deployment of working services..."
    
    # Step 1: Start core infrastructure (no Kafka for now)
    header "Step 1: Starting Core Infrastructure"
    log "Starting PostgreSQL with multiple databases..."
    docker-compose -f $COMPOSE_FILE up -d postgres
    sleep 15
    
    log "Starting Redis..."
    docker-compose -f $COMPOSE_FILE up -d redis
    sleep 10
    
    log "Starting Elasticsearch..."
    docker-compose -f $COMPOSE_FILE up -d elasticsearch
    sleep 20
    
    log "Starting Minio (S3 storage)..."
    docker-compose -f $COMPOSE_FILE up -d minio
    sleep 10
    
    log "Starting monitoring stack..."
    docker-compose -f $COMPOSE_FILE up -d prometheus grafana jaeger
    sleep 15
    
    # Test infrastructure
    log "Testing infrastructure health..."
    curl -f http://localhost:9200 >/dev/null 2>&1 && success "Elasticsearch OK" || warning "Elasticsearch not ready"
    curl -f http://localhost:9090 >/dev/null 2>&1 && success "Prometheus OK" || warning "Prometheus not ready"
    curl -f http://localhost:9000 >/dev/null 2>&1 && success "Minio OK" || warning "Minio not ready"
    
    # Step 2: Deploy working application services
    header "Step 2: Deploying Application Services"
    
    # UPI Core (Go) - Payment processing
    log "Starting UPI Core service..."
    docker-compose -f $COMPOSE_FILE up -d upi-core
    sleep 15
    test_health "UPI Core" 8083
    
    # Bank Simulator (Node.js) - Banking simulation
    log "Starting Bank Simulator..."
    docker-compose -f $COMPOSE_FILE up -d bank-simulator
    sleep 15
    test_health "Bank Simulator" 3000
    
    # Commerce (Node.js) - E-commerce
    log "Starting Commerce service..."
    docker-compose -f $COMPOSE_FILE up -d commerce
    sleep 15
    test_health "Commerce" 8084
    
    # Recommendations (Python) - ML recommendations
    log "Starting Recommendations service..."
    docker-compose -f $COMPOSE_FILE up -d recommendations
    sleep 15
    test_health "Recommendations" 8095
    
    # Analytics (Python) - Data analytics
    log "Starting Analytics service..."
    docker-compose -f $COMPOSE_FILE up -d analytics
    sleep 15
    test_health "Analytics" 8087
    
    # Content (Node.js) - Content management
    log "Starting Content service..."
    docker-compose -f $COMPOSE_FILE up -d content
    sleep 20
    test_health "Content" 8082
    
    # VOD (Python) - Video on demand
    log "Starting VOD service..."
    docker-compose -f $COMPOSE_FILE up -d vod
    sleep 15
    test_health "VOD" 8097 "/health" || warning "VOD may need additional setup"
    
    # Step 3: Platform Status
    header "Step 3: Platform Status"
    docker-compose -f $COMPOSE_FILE ps
    
    # Step 4: Health Summary
    header "Step 4: Service Health Summary"
    echo -e "${CYAN}===========================================${NC}"
    echo -e "${CYAN}🎓 SUUUPRA PLATFORM HEALTH CHECK${NC}"
    echo -e "${CYAN}===========================================${NC}"
    
    # Test all services
    test_health "UPI Core" 8083 && echo "✅ UPI Core: Payment processing ready"
    test_health "Bank Simulator" 3000 && echo "✅ Bank Simulator: Banking simulation ready"
    test_health "Commerce" 8084 && echo "✅ Commerce: E-commerce platform ready"
    test_health "Recommendations" 8095 && echo "✅ Recommendations: ML engine ready"
    test_health "Analytics" 8087 && echo "✅ Analytics: Data processing ready"
    test_health "Content" 8082 && echo "✅ Content: Content management ready"
    
    echo -e "${CYAN}===========================================${NC}"
    echo -e "${GREEN}🎉 PRODUCTION PLATFORM SUCCESSFULLY DEPLOYED!${NC}"
    echo -e "${CYAN}===========================================${NC}"
    
    # Service URLs
    echo -e "${BLUE}📋 Service URLs:${NC}"
    echo "• UPI Core: http://localhost:8083/health"
    echo "• Bank Simulator: http://localhost:3000/health"
    echo "• Commerce: http://localhost:8084/health"
    echo "• Recommendations: http://localhost:8095/health"
    echo "• Analytics: http://localhost:8087/health"
    echo "• Content: http://localhost:8082/health"
    echo "• Prometheus: http://localhost:9090"
    echo "• Grafana: http://localhost:3001"
    echo "• Elasticsearch: http://localhost:9200"
    echo "• Minio: http://localhost:9000"
    
    success "🎓 Production-grade Suuupra platform is now running!"
}

# Run main function
main "$@"
