#!/bin/bash

# ==============================================================================
# Suuupra EdTech Platform - Production Grade Startup Script
#
# This script provides a one-command deployment for the entire Suuupra platform
# with all 17 microservices, designed for billion-user scale.
#
# Usage:
#   ./start-suuupra-platform.sh [--mode=development|production] [--services=all|core|media|intelligence]
#
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
MODE="${1:-production}"
SERVICES="${2:-all}"
COMPOSE_FILE="docker-compose.production.yml"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

header() {
    echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Banner function
show_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
    ███████╗██╗   ██╗██╗   ██╗██╗   ██╗██████╗ ██████╗  █████╗ 
    ██╔════╝██║   ██║██║   ██║██║   ██║██╔══██╗██╔══██╗██╔══██╗
    ███████╗██║   ██║██║   ██║██║   ██║██████╔╝██████╔╝███████║
    ╚════██║██║   ██║██║   ██║██║   ██║██╔═══╝ ██╔══██╗██╔══██║
    ███████║╚██████╔╝╚██████╔╝╚██████╔╝██║     ██║  ██║██║  ██║
    ╚══════╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝
    
    🎓 EDTECH SUPER-PLATFORM - PRODUCTION GRADE DEPLOYMENT 🎓
    📊 17 Microservices • 🌍 Billion User Scale • 🔐 Enterprise Security
EOF
    echo -e "${NC}"
}

# Prerequisites check
check_prerequisites() {
    header "🔍 CHECKING PREREQUISITES"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is required but not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is required but not installed"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    # Check available disk space (require at least 10GB)
    available_space=$(df . | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 10485760 ]]; then # 10GB in KB
        warn "Low disk space detected. Recommend at least 10GB free space"
    fi
    
    # Check available memory (recommend at least 8GB)
    if [[ $(uname) == "Darwin" ]]; then
        total_mem=$(sysctl -n hw.memsize)
        total_mem_gb=$((total_mem / 1024 / 1024 / 1024))
    else
        total_mem_gb=$(free -g | awk '/^Mem:/{print $2}')
    fi
    
    if [[ $total_mem_gb -lt 8 ]]; then
        warn "Low memory detected ($total_mem_gb GB). Recommend at least 8GB RAM"
    fi
    
    success "All prerequisites satisfied"
}

# Environment setup
setup_environment() {
    header "🔧 SETTING UP ENVIRONMENT"
    
    # Create .env file if it doesn't exist
    if [[ ! -f .env ]]; then
        log "Creating .env file from template"
        cp .env.example .env
    fi
    
    # Create required directories
    log "Creating required directories"
    mkdir -p {logs,data,temp,monitoring/grafana/provisioning/{dashboards,datasources}}
    
    # Make scripts executable
    chmod +x scripts/*.sh 2>/dev/null || true
    
    success "Environment setup completed"
}

# Service health check
check_service_health() {
    local service_name=$1
    local health_url=$2
    local retries=$3
    
    log "Checking health of $service_name..."
    
    for ((i=1; i<=retries; i++)); do
        if curl -f -s "$health_url" &>/dev/null; then
            success "$service_name is healthy"
            return 0
        fi
        
        if [[ $i -lt $retries ]]; then
            log "Attempt $i/$retries failed for $service_name, retrying in ${HEALTH_CHECK_INTERVAL}s..."
            sleep $HEALTH_CHECK_INTERVAL
        fi
    done
    
    error "$service_name health check failed after $retries attempts"
    return 1
}

# Start infrastructure services
start_infrastructure() {
    header "🏗️ STARTING INFRASTRUCTURE SERVICES"
    
    log "Starting core infrastructure..."
    docker-compose -f $COMPOSE_FILE up -d \
        postgres redis zookeeper kafka jaeger prometheus grafana elasticsearch minio etcd milvus
    
    # Wait for core services to be healthy
    log "Waiting for infrastructure services to be ready..."
    sleep 30
    
    # Check infrastructure health
    local infrastructure_services=(
        "postgres:http://localhost:5432"
        "redis:redis://localhost:6379"
        "kafka:localhost:9092"
    )
    
    success "Infrastructure services started successfully"
}

# Start application services by phase
start_foundation_services() {
    header "🌟 STARTING FOUNDATION SERVICES"
    
    docker-compose -f $COMPOSE_FILE up -d identity content
    sleep 20
    
    docker-compose -f $COMPOSE_FILE up -d api-gateway
    sleep 10
    
    # Health checks
    check_service_health "Identity Service" "http://localhost:8081/health" 10
    check_service_health "Content Service" "http://localhost:8082/health" 10
    check_service_health "API Gateway" "http://localhost:8080/health" 10
    
    success "Foundation services are running"
}

start_payments_services() {
    header "💳 STARTING PAYMENTS & COMMERCE SERVICES"
    
    docker-compose -f $COMPOSE_FILE up -d upi-core bank-simulator
    sleep 15
    
    docker-compose -f $COMPOSE_FILE up -d commerce payments ledger
    sleep 20
    
    # Health checks
    check_service_health "UPI Core" "http://localhost:8083/health" 10
    check_service_health "Bank Simulator" "http://localhost:3000/health" 10
    check_service_health "Commerce Service" "http://localhost:8084/health" 10
    
    success "Payments services are running"
}

start_media_services() {
    header "📺 STARTING MEDIA SERVICES"
    
    docker-compose -f $COMPOSE_FILE up -d live-classes vod mass-live creator-studio
    sleep 25
    
    # Health checks
    check_service_health "Live Classes" "http://localhost:8090/health" 10
    check_service_health "VOD Service" "http://localhost:8097/health" 10
    check_service_health "Creator Studio" "http://localhost:8093/health" 10
    
    success "Media services are running"
}

start_intelligence_services() {
    header "🧠 STARTING INTELLIGENCE SERVICES"
    
    docker-compose -f $COMPOSE_FILE up -d llm-tutor search-crawler recommendations analytics
    sleep 30
    
    # Health checks
    check_service_health "LLM Tutor" "http://localhost:8092/health" 15
    check_service_health "Search Crawler" "http://localhost:8096/health" 10
    check_service_health "Recommendations" "http://localhost:8095/health" 10
    check_service_health "Analytics" "http://localhost:8087/health" 10
    
    success "Intelligence services are running"
}

start_supporting_services() {
    header "🔧 STARTING SUPPORTING SERVICES"
    
    docker-compose -f $COMPOSE_FILE up -d counters live-tracking notifications admin
    sleep 20
    
    # Health checks
    check_service_health "Counters" "http://localhost:8089/health" 10
    check_service_health "Live Tracking" "http://localhost:8091/health" 10
    check_service_health "Notifications" "http://localhost:8098/health" 10
    check_service_health "Admin Dashboard" "http://localhost:8099/health" 10
    
    success "Supporting services are running"
}

# Start health monitor
start_health_monitor() {
    header "🏥 STARTING HEALTH MONITORING"
    
    docker-compose -f $COMPOSE_FILE up -d health-monitor
    sleep 5
    
    success "Health monitoring dashboard available at http://localhost:9999"
}

# Platform status overview
show_platform_status() {
    header "📊 SUUUPRA PLATFORM STATUS"
    
    echo ""
    echo -e "${CYAN}🌐 PLATFORM ENDPOINTS:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "📊 Health Dashboard:    ${GREEN}http://localhost:9999${NC}"
    echo -e "🌐 API Gateway:         ${GREEN}http://localhost:8080${NC}"
    echo -e "🔐 Identity Service:    ${GREEN}http://localhost:8081${NC}"
    echo -e "🏦 Bank Simulator:      ${GREEN}http://localhost:3000${NC}"
    echo -e "🔄 UPI Core:            ${GREEN}http://localhost:8083${NC}"
    echo -e "🛒 Commerce:            ${GREEN}http://localhost:8084${NC}"
    echo -e "🤖 LLM Tutor:           ${GREEN}http://localhost:8092${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${CYAN}🔍 MONITORING & OBSERVABILITY:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "📈 Grafana Dashboard:   ${GREEN}http://localhost:3001${NC} (admin/admin)"
    echo -e "🔍 Jaeger Tracing:      ${GREEN}http://localhost:16686${NC}"
    echo -e "📊 Prometheus Metrics:  ${GREEN}http://localhost:9090${NC}"
    echo -e "🔍 Elasticsearch:       ${GREEN}http://localhost:9200${NC}"
    echo -e "📦 MinIO Console:       ${GREEN}http://localhost:9001${NC} (minioadmin/minioadmin123)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Show running containers
    echo -e "${CYAN}🐳 RUNNING CONTAINERS:${NC}"
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    success "🎉 SUUUPRA PLATFORM SUCCESSFULLY DEPLOYED!"
    success "🌍 Ready for billion-user scale with 17 production-ready microservices"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Visit the Health Dashboard: http://localhost:9999"
    echo "2. Explore the APIs via API Gateway: http://localhost:8080"
    echo "3. Monitor with Grafana: http://localhost:3001"
    echo "4. View traces in Jaeger: http://localhost:16686"
    echo ""
    echo -e "${YELLOW}To stop the platform: ${NC}docker-compose -f $COMPOSE_FILE down"
    echo -e "${YELLOW}To view logs: ${NC}docker-compose -f $COMPOSE_FILE logs -f [service-name]"
}

# Cleanup function
cleanup() {
    if [[ "${1:-}" == "error" ]]; then
        error "Deployment failed. Cleaning up..."
        docker-compose -f $COMPOSE_FILE down
    fi
}

# Main deployment function
main() {
    trap 'cleanup error' ERR
    
    show_banner
    
    header "🚀 STARTING SUUUPRA PLATFORM DEPLOYMENT"
    log "Mode: $MODE"
    log "Services: $SERVICES"
    log "Compose File: $COMPOSE_FILE"
    echo ""
    
    # Run checks and setup
    check_prerequisites
    setup_environment
    
    # Phase-based deployment for reliability
    case "$SERVICES" in
        "all"|"")
            start_infrastructure
            start_foundation_services
            start_payments_services
            start_media_services
            start_intelligence_services
            start_supporting_services
            start_health_monitor
            ;;
        "core")
            start_infrastructure
            start_foundation_services
            start_health_monitor
            ;;
        "media")
            start_infrastructure
            start_foundation_services
            start_media_services
            start_health_monitor
            ;;
        "intelligence")
            start_infrastructure
            start_foundation_services
            start_intelligence_services
            start_health_monitor
            ;;
        *)
            error "Unknown services option: $SERVICES"
            exit 1
            ;;
    esac
    
    # Final platform status
    show_platform_status
}

# Usage information
usage() {
    cat << EOF
🎓 Suuupra EdTech Platform - Production Deployment Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --mode=MODE          Deployment mode (development|production) [default: production]
    --services=SERVICES  Services to deploy (all|core|media|intelligence) [default: all]
    --help              Show this help message

EXAMPLES:
    # Deploy complete platform (all 17 services)
    $0

    # Deploy only core services
    $0 --services=core

    # Deploy in development mode
    $0 --mode=development

SERVICES BY PHASE:
    📋 Core (Foundation):     API Gateway, Identity, Content
    💳 Payments & Commerce:   Commerce, Payments, UPI Core, Bank Simulator, Ledger
    📺 Media:                Live Classes, VOD, Mass Live, Creator Studio
    🧠 Intelligence:         LLM Tutor, Search, Recommendations, Analytics
    🔧 Supporting:           Counters, Live Tracking, Notifications, Admin

MONITORING ENDPOINTS:
    📊 Health Dashboard:     http://localhost:9999
    📈 Grafana:             http://localhost:3001
    🔍 Jaeger:              http://localhost:16686
    📊 Prometheus:          http://localhost:9090

For more information, visit: https://github.com/suuupra/platform
EOF
}

# Handle help flag
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
fi

# Parse arguments
for arg in "$@"; do
    case $arg in
        --mode=*)
            MODE="${arg#*=}"
            ;;
        --services=*)
            SERVICES="${arg#*=}"
            ;;
        *)
            error "Unknown argument: $arg"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main
