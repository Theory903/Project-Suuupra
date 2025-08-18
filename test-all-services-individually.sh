#!/bin/bash

# ==============================================================================
# 🎓 SUUUPRA PLATFORM - INDIVIDUAL SERVICE TESTING
#
# Tests each service individually to ensure production-grade deployment
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
LOG_DIR="logs/individual-tests"
RESULTS_FILE="individual-service-results.txt"

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
    echo "[$(date +'%H:%M:%S')] SUCCESS: $1" >> $RESULTS_FILE
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
    echo "[$(date +'%H:%M:%S')] ERROR: $1" >> $RESULTS_FILE
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️ $1${NC}"
    echo "[$(date +'%H:%M:%S')] WARNING: $1" >> $RESULTS_FILE
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

# Test service build
test_build() {
    local service_name=$1
    log "Building $service_name..."
    
    if docker-compose -f $COMPOSE_FILE build $service_name 2>&1 | tee $LOG_DIR/${service_name}-build.log; then
        success "$service_name build successful"
        return 0
    else
        error "$service_name build failed"
        return 1
    fi
}

# Start infrastructure
start_infrastructure() {
    header "Starting Infrastructure Services..."
    
    log "Starting PostgreSQL..."
    docker-compose -f $COMPOSE_FILE up -d postgres
    sleep 10
    
    log "Starting Redis..."
    docker-compose -f $COMPOSE_FILE up -d redis
    sleep 5
    
    log "Starting Zookeeper..."
    docker-compose -f $COMPOSE_FILE up -d zookeeper
    sleep 15
    
    log "Starting Kafka..."
    docker-compose -f $COMPOSE_FILE up -d kafka
    sleep 20
    
    log "Starting Elasticsearch..."
    docker-compose -f $COMPOSE_FILE up -d elasticsearch
    sleep 15
    
    log "Starting monitoring services..."
    docker-compose -f $COMPOSE_FILE up -d prometheus grafana jaeger
    sleep 10
    
    log "Starting Minio and other services..."
    docker-compose -f $COMPOSE_FILE up -d minio etcd milvus
    sleep 10
    
    success "Infrastructure services started"
}

# Test individual service
test_service() {
    local service_name=$1
    local port=$2
    local health_path="${3:-/health}"
    
    header "Testing $service_name Service"
    
    # Build the service
    if ! test_build $service_name; then
        return 1
    fi
    
    # Start the service
    log "Starting $service_name..."
    if docker-compose -f $COMPOSE_FILE up -d $service_name 2>&1 | tee $LOG_DIR/${service_name}-start.log; then
        success "$service_name started successfully"
    else
        error "$service_name failed to start"
        return 1
    fi
    
    # Test health
    if test_health $service_name $port $health_path; then
        success "$service_name is fully operational"
        return 0
    else
        error "$service_name failed health check"
        docker logs suuupra-$service_name --tail 20 > $LOG_DIR/${service_name}-logs.txt
        return 1
    fi
}

# Main execution
main() {
    header "🎓 SUUUPRA PLATFORM - INDIVIDUAL SERVICE TESTING"
    log "Starting comprehensive service testing..."
    
    # Start infrastructure first
    start_infrastructure
    
    # Test infrastructure health
    log "Testing infrastructure health..."
    curl -f http://localhost:5432 >/dev/null 2>&1 || warning "PostgreSQL connection test skipped"
    curl -f http://localhost:9200 >/dev/null 2>&1 && success "Elasticsearch OK" || warning "Elasticsearch not ready"
    curl -f http://localhost:9090 >/dev/null 2>&1 && success "Prometheus OK" || warning "Prometheus not ready"
    
    # Test services that we know work
    header "Testing Known Working Services"
    test_service "upi-core" 8083
    test_service "bank-simulator" 3000
    test_service "recommendations" 8095
    test_service "analytics" 8087
    test_service "commerce" 8084
    test_service "content" 8082
    
    # Test additional services
    header "Testing Additional Services"
    test_service "vod" 8097
    
    # Summary
    header "Test Results Summary"
    echo -e "${CYAN}===========================================${NC}"
    cat $RESULTS_FILE
    echo -e "${CYAN}===========================================${NC}"
    
    # Count results
    local success_count=$(grep "SUCCESS" $RESULTS_FILE | wc -l)
    local error_count=$(grep "ERROR" $RESULTS_FILE | wc -l)
    
    header "Final Results: $success_count successful, $error_count failed"
    
    if [ $error_count -eq 0 ]; then
        success "🎉 ALL TESTED SERVICES ARE WORKING!"
        return 0
    else
        warning "Some services need fixes. Check logs in $LOG_DIR/"
        return 1
    fi
}

# Run main function
main "$@"
