#!/bin/bash

# Deploy All Suuupra Services - Production Ready Deployment Script
# This script deploys all improved services with proper error handling and validation

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${DOCKER_REGISTRY:-suuupra}"
TAG="${DOCKER_TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE_PREFIX="${NAMESPACE_PREFIX:-suuupra}"
DRY_RUN="${DRY_RUN:-false}"

# Service definitions (compatible with bash 3.2+)
SERVICES_LIST="
identity:java:8081
api-gateway:node:3001
content:node:8082
commerce:python:8084
notifications:python:8085
counters:go:8086
analytics:python:8087
mass-live:go:8088
live-tracking:rust:8089
llm-tutor:python:8092
bank-simulator:node:3000
payments:go:8084
live-classes:node:8090
admin:node:8091
creator-studio:node:8093
ledger:java:8094
recommendations:python:8095
search-crawler:go:8096
vod:python:8097
upi-core:go:8098
"

# Function to get service info
get_service_info() {
    local service=$1
    echo "$SERVICES_LIST" | grep "^${service}:" | head -n1
}

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}" >&2
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}" >&2
}

# Utility functions
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if kubectl is installed (only for production)
    if [[ "${ENVIRONMENT}" != "development" ]] && ! command -v kubectl &> /dev/null; then
        error "kubectl is required for production environment but not installed"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "docker is required but not installed"
        exit 1
    fi
    
    # Check if docker-compose is installed (for development)
    if [[ "${ENVIRONMENT}" == "development" ]] && ! command -v docker-compose &> /dev/null; then
        error "docker-compose is required for development environment but not installed"
        exit 1
    fi
    
    # Check Kubernetes connectivity (only for production)
    if [[ "${ENVIRONMENT}" != "development" ]] && ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check Docker registry access
    if [[ "${DRY_RUN}" != "true" ]]; then
        if ! docker info &> /dev/null; then
            error "Cannot connect to Docker daemon"
            exit 1
        fi
    fi
    
    success "All prerequisites satisfied"
}

# Deploy global infrastructure
deploy_global_infrastructure() {
    log "Deploying global infrastructure..."
    
    # Skip global infrastructure for development environment
    if [[ "${ENVIRONMENT}" == "development" ]]; then
        log "Skipping global infrastructure deployment for development environment"
        return 0
    fi
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log "[DRY RUN] Would deploy global-monitoring-stack.yaml"
        log "[DRY RUN] Would deploy global-security-policies.yaml"
        return 0
    fi
    
    # Deploy monitoring stack
    if [[ -f "global-monitoring-stack.yaml" ]]; then
        kubectl apply -f global-monitoring-stack.yaml
        success "Deployed global monitoring stack"
    else
        warn "global-monitoring-stack.yaml not found, skipping"
    fi
    
    # Deploy security policies
    if [[ -f "global-security-policies.yaml" ]]; then
        kubectl apply -f global-security-policies.yaml
        success "Deployed global security policies"
    else
        warn "global-security-policies.yaml not found, skipping"
    fi
    
    # Wait for monitoring stack to be ready
    if kubectl get namespace monitoring &> /dev/null; then
        log "Waiting for monitoring stack to be ready..."
        kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=300s || warn "Prometheus pods not ready in time"
        kubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=300s || warn "Grafana pods not ready in time"
    fi
}

# Build Docker image for a service
build_service() {
    local service=$1
    local service_type=$2
    local service_dir="services/${service}"
    
    if [[ ! -d "${service_dir}" ]]; then
        error "Service directory ${service_dir} not found"
        return 1
    fi
    
    if [[ ! -f "${service_dir}/Dockerfile" ]]; then
        warn "No Dockerfile found for ${service}, skipping build"
        return 0
    fi
    
    log "Building ${service} service..."
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log "[DRY RUN] Would build ${REGISTRY}/${service}:${TAG}"
        return 0
    fi
    
    # Build Docker image
    if ! docker build -t "${REGISTRY}/${service}:${TAG}" "${service_dir}"; then
        error "Failed to build ${service}"
        return 1
    fi
    
    # Push to registry (if not local development)
    if [[ "${ENVIRONMENT}" != "development" ]]; then
        if ! docker push "${REGISTRY}/${service}:${TAG}"; then
            error "Failed to push ${service}"
            return 1
        fi
    fi
    
    success "Built ${service} service"
}

# Deploy service to Kubernetes
deploy_service() {
    local service=$1
    local service_type=$2
    local service_dir="services/${service}"
    local k8s_dir="${service_dir}/k8s"
    
    log "Deploying ${service} service..."
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        if [[ -d "${k8s_dir}" ]]; then
            log "[DRY RUN] Would deploy Kubernetes manifests from ${k8s_dir}"
        elif [[ -f "${service_dir}/docker-compose.yml" ]]; then
            log "[DRY RUN] Would deploy using docker-compose"
        fi
        return 0
    fi
    
    # Deploy using Kubernetes manifests if available
    if [[ -d "${k8s_dir}" ]]; then
        # Create namespace if it doesn't exist
        local namespace="${NAMESPACE_PREFIX}-${service}"
        if ! kubectl get namespace "${namespace}" &> /dev/null; then
            kubectl create namespace "${namespace}"
            kubectl label namespace "${namespace}" app.kubernetes.io/name="${service}"
        fi
        
        # Apply all manifests
        kubectl apply -f "${k8s_dir}/" --namespace="${namespace}" || {
            error "Failed to deploy Kubernetes manifests for ${service}"
            return 1
        }
        
        # Wait for deployment to be ready
        if kubectl get deployment "${service}-service" -n "${namespace}" &> /dev/null; then
            kubectl wait --for=condition=available deployment/"${service}-service" -n "${namespace}" --timeout=300s || {
                warn "${service} deployment not ready in time"
            }
        fi
        
    # Fallback to docker-compose for development
    elif [[ -f "${service_dir}/docker-compose.yml" && "${ENVIRONMENT}" == "development" ]]; then
        (cd "${service_dir}" && docker-compose up -d) || {
            error "Failed to deploy ${service} with docker-compose"
            return 1
        }
    else
        warn "No deployment configuration found for ${service}"
        return 1
    fi
    
    success "Deployed ${service} service"
}

# Validate service deployment
validate_service() {
    local service=$1
    local service_type=$2
    local port=$(echo "$service_type" | cut -d: -f2)
    
    log "Validating ${service} service..."
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log "[DRY RUN] Would validate ${service} on port ${port}"
        return 0
    fi
    
    # For Kubernetes deployments
    local namespace="${NAMESPACE_PREFIX}-${service}"
    if kubectl get namespace "${namespace}" &> /dev/null; then
        # Check if pods are running
        local running_pods=$(kubectl get pods -n "${namespace}" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        if [[ ${running_pods} -gt 0 ]]; then
            success "${service} has ${running_pods} running pod(s)"
            
            # Try to port-forward and test health endpoint
            local pod_name=$(kubectl get pods -n "${namespace}" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
            if [[ -n "${pod_name}" ]]; then
                timeout 10 kubectl port-forward "${pod_name}" "${port}:${port}" -n "${namespace}" &>/dev/null &
                local port_forward_pid=$!
                sleep 2
                
                if curl -f "http://localhost:${port}/health" &>/dev/null; then
                    success "${service} health check passed"
                else
                    warn "${service} health check failed"
                fi
                
                kill ${port_forward_pid} 2>/dev/null || true
            fi
        else
            warn "${service} has no running pods"
        fi
    fi
}

# Deploy specific service
deploy_specific_service() {
    local service=$1
    
    local service_info=$(get_service_info "$service")
    if [[ -z "$service_info" ]]; then
        error "Unknown service: ${service}"
        return 1
    fi
    
    local service_type=$(echo "$service_info" | cut -d: -f2-3)
    
    log "Deploying specific service: ${service}"
    
    # Build service
    build_service "${service}" "${service_type}" || return 1
    
    # Deploy service
    deploy_service "${service}" "${service_type}" || return 1
    
    # Validate deployment
    validate_service "${service}" "${service_type}" || return 1
    
    success "Successfully deployed ${service}"
}

# Deploy all services
deploy_all_services() {
    log "Starting deployment of all services..."
    
    local failed_services=()
    local successful_services=()
    
    # Process each service from the list
    while IFS= read -r service_line; do
        [[ -z "$service_line" ]] && continue
        local service=$(echo "$service_line" | cut -d: -f1)
        local service_type=$(echo "$service_line" | cut -d: -f2-3)
        
        log "Processing service: ${service} (${service_type})"
        
        # Build service
        if build_service "${service}" "${service_type}"; then
            # Deploy service
            if deploy_service "${service}" "${service_type}"; then
                # Validate deployment
                if validate_service "${service}" "${service_type}"; then
                    successful_services+=("${service}")
                else
                    failed_services+=("${service}")
                fi
            else
                failed_services+=("${service}")
            fi
        else
            failed_services+=("${service}")
        fi
        
        # Add small delay between services
        sleep 2
    done <<< "$SERVICES_LIST"
    
    # Report results
    log "Deployment Summary:"
    log "Successful services (${#successful_services[@]}): ${successful_services[*]}"
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        warn "Failed services (${#failed_services[@]}): ${failed_services[*]}"
        return 1
    fi
    
    success "All services deployed successfully!"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main function
main() {
    trap cleanup EXIT
    
    log "Starting Suuupra Platform Deployment"
    log "Environment: ${ENVIRONMENT}"
    log "Registry: ${REGISTRY}"
    log "Tag: ${TAG}"
    log "Dry Run: ${DRY_RUN}"
    
    # Check prerequisites
    check_prerequisites
    
    # Deploy global infrastructure first
    deploy_global_infrastructure
    
    # Parse command line arguments
    case "${1:-all}" in
        "all")
            deploy_all_services
            ;;
        "global")
            deploy_global_infrastructure
            ;;
        *)
            deploy_specific_service "$1"
            ;;
    esac
    
    success "Deployment completed!"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [service_name|all|global]

Deploy Suuupra Platform services with improved configurations.

Arguments:
    service_name    Deploy specific service (e.g., identity, api-gateway)
    all            Deploy all services (default)
    global         Deploy only global infrastructure

Environment Variables:
    DOCKER_REGISTRY    Docker registry prefix (default: suuupra)
    DOCKER_TAG         Docker image tag (default: latest)
    ENVIRONMENT        Deployment environment (default: production)
    NAMESPACE_PREFIX   Kubernetes namespace prefix (default: suuupra)
    DRY_RUN           Enable dry run mode (default: false)

Examples:
    # Deploy all services
    $0 all

    # Deploy specific service
    $0 identity

    # Deploy with custom registry
    DOCKER_REGISTRY=myregistry.com/suuupra $0 all

    # Dry run deployment
    DRY_RUN=true $0 all

Available services:
    $(echo "$SERVICES_LIST" | grep -v '^$' | cut -d: -f1 | tr '\n' ' ')
EOF
}

# Handle help flag
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Run main function
main "$@"
