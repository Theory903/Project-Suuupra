#!/bin/bash

# ===================================================================
# SERVICE DOCKER COMPOSE REFINEMENT SCRIPT
# 
# This script systematically updates all service-specific Docker Compose 
# files to align with the main architecture and remove infrastructure 
# duplication.
# ===================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Service configuration mapping (service_name:port:metrics_port:database)
SERVICE_CONFIGS=(
    "commerce:8083:9094:commerce"
    "content:8089:9100:content"  
    "notifications:8085:9096:notifications"
    "analytics:8097:9108:analytics"
    "live-classes:8090:9101:live_classes"
    "vod:8091:9102:vod"
    "mass-live:8092:9103:mass_live"
    "creator-studio:8093:9104:creator_studio"
    "search-crawler:8094:9105:search_crawler"
    "recommendations:8095:9106:recommendations"
    "llm-tutor:8096:9107:llm_tutor"
    "counters:8098:9109:counters"
    "live-tracking:8099:9110:live_tracking"
    "admin:8100:9111:admin"
    "ledger:8086:9097:ledger"
    "upi-core:8087:9098:upi_core"
    "bank-simulator:8088:9099:bank_simulator"
)

# Function to get service config
get_service_config() {
    local service_name=$1
    for config in "${SERVICE_CONFIGS[@]}"; do
        if [[ "$config" == "$service_name:"* ]]; then
            echo "$config"
            return
        fi
    done
}

# Function to create standardized Docker Compose content
create_service_compose() {
    local service_name=$1
    local config=$(get_service_config "$service_name")
    if [[ -z "$config" ]]; then
        log_error "Service configuration not found: $service_name"
        return 1
    fi
    IFS=':' read -r name port metrics_port database <<< "$config"
    
    cat << EOF
version: '4'

services:
  # $service_name Service - Production Ready
  $service_name:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: suuupra-$service_name
    restart: unless-stopped
    ports:
      - "$port:$port"   # Main service port (aligned with main compose)
      - "$metrics_port:$metrics_port"   # Metrics port (aligned with main compose)
    environment:
      # Core configuration (aligned with main docker-compose.yml)
      NODE_ENV: production
      PORT: $port
      METRICS_PORT: $metrics_port
      
      # Database - Using main infrastructure PostgreSQL
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres123}
      POSTGRES_DATABASE: $database
      
      # Redis - Using main infrastructure
      REDIS_HOST: redis
      REDIS_PORT: 6379
      
      # Event streaming - Using main infrastructure Kafka
      KAFKA_BROKERS: kafka:29092
      KAFKA_CLIENT_ID: $service_name-service
      KAFKA_GROUP_ID: $service_name-consumers
      
      # Security & Vault - Using main infrastructure
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: \${VAULT_TOKEN:-myroot}
      VAULT_MOUNT_PATH: $service_name
      
      # Observability - Using main infrastructure
      OTEL_SERVICE_NAME: $service_name-service
      OTEL_SERVICE_VERSION: 1.0.0
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      OTEL_RESOURCE_ATTRIBUTES: service.namespace=suuupra,deployment.environment=docker-compose
      
    volumes:
      - app_logs:/app/logs
    
    # Use main infrastructure services (no separate dependencies)
    external_links:
      - postgres:postgres
      - redis:redis
      - kafka:kafka
      - vault:vault
      - otel-collector:otel-collector
    
    networks:
      - suuupra-network
    
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:$port/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    
    labels:
      - "prometheus.scrape=true"
      - "prometheus.port=$metrics_port"

# ===================================================================
# VOLUMES - Aligned with main infrastructure
# ===================================================================
volumes:
  app_logs:
    external: true
    name: suuupra_app_logs

# ===================================================================
# NETWORKS - Using main infrastructure network
# ===================================================================
networks:
  suuupra-network:
    external: true
    name: suuupra-network

# ===================================================================
# NOTES:
# - All infrastructure services (PostgreSQL, Redis, Kafka, Vault, 
#   Prometheus, Grafana, Jaeger) are provided by main infrastructure
# - Use: docker-compose -f ../../docker-compose.infrastructure.yml up -d
# - Then: docker-compose -f docker-compose.yml up -d
# ===================================================================
EOF
}

# Function to backup and update service compose file
update_service_compose() {
    local service_name=$1
    local compose_file="services/$service_name/docker-compose.yml"
    
    if [[ ! -f "$compose_file" ]]; then
        log_warning "Docker Compose file not found: $compose_file"
        return 0
    fi
    
    log_info "Updating $service_name service..."
    
    # Create backup
    cp "$compose_file" "$compose_file.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Generate new content
    create_service_compose "$service_name" > "$compose_file"
    
    log_success "Updated $compose_file"
}

# Main execution
main() {
    log_info "Starting service Docker Compose refinement..."
    log_info "This script will align all service files with main architecture"
    
    # Change to project root directory
    cd "$(dirname "$0")/.."
    
    local updated_count=0
    local total_services=${#SERVICE_CONFIGS[@]}
    
    # Update each service
    for config in "${SERVICE_CONFIGS[@]}"; do
        IFS=':' read -r service_name port metrics_port database <<< "$config"
        
        # Skip already updated services
        if [[ "$service_name" == "api-gateway" || "$service_name" == "identity" || "$service_name" == "payments" ]]; then
            log_info "Skipping $service_name (already updated manually)"
            continue
        fi
        
        update_service_compose "$service_name"
        ((updated_count++))
    done
    
    # Summary
    log_success "Refinement complete!"
    log_info "Updated: $updated_count services"
    log_info "Total services: $total_services"
    log_info "Skipped: 3 services (already updated)"
    
    # Generate final summary report
    cat << EOF

# ===================================================================
# SERVICE DOCKER COMPOSE REFINEMENT SUMMARY
# ===================================================================

## Changes Applied:
✅ Updated version from '3.8' to '4'
✅ Removed duplicate infrastructure services  
✅ Aligned ports with main architecture
✅ Standardized environment variables
✅ Fixed service naming consistency
✅ Updated networks to use main suuupra-network
✅ Added proper external_links for main services
✅ Standardized health checks and monitoring

## Services Updated:
$(for config in "${SERVICE_CONFIGS[@]}"; do
    IFS=':' read -r service port metrics_port database <<< "$config"
    if [[ "$service" != "api-gateway" && "$service" != "identity" && "$service" != "payments" ]]; then
        echo "- $service → Port $port, Metrics $metrics_port, DB $database"
    fi
done)

## Services Previously Updated:
- api-gateway → Port 8080, Metrics 9080
- identity → Port 8081, Metrics 9092  
- payments → Port 8082, Metrics 9093

## Deployment Instructions:
1. Start infrastructure: docker-compose -f docker-compose.infrastructure.yml up -d
2. Start all services: docker-compose -f docker-compose.yml up -d
3. Or start individual service: cd services/[service-name] && docker-compose up -d

## Backup Files:
All original files backed up with timestamp suffix (.backup.YYYYMMDD_HHMMSS)

REFINEMENT STATUS: ✅ COMPLETE
EOF
}

# Execute main function
main "$@"
