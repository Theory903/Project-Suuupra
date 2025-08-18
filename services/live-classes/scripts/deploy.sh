#!/bin/bash

# Production deployment script for Live Classes Service
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying Live Classes Service...${NC}"

# Configuration
SERVICE_NAME="live-classes"
NAMESPACE=${NAMESPACE:-"default"}
ENVIRONMENT=${ENVIRONMENT:-"development"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
REGISTRY=${REGISTRY:-""}

echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo "  Service: ${SERVICE_NAME}"
echo "  Environment: ${ENVIRONMENT}"
echo "  Namespace: ${NAMESPACE}"
echo "  Image Tag: ${IMAGE_TAG}"

# Pre-deployment checks
echo -e "${BLUE}🔍 Running pre-deployment checks...${NC}"

# Check if kubectl is available
if ! command -v kubectl >/dev/null 2>&1; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

# Check if Helm is available
if ! command -v helm >/dev/null 2>&1; then
    echo -e "${RED}❌ Helm is not installed${NC}"
    exit 1
fi

# Check if connected to cluster
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${RED}❌ Not connected to Kubernetes cluster${NC}"
    exit 1
fi

# Create namespace if it doesn't exist
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Database migration
echo -e "${BLUE}🗄️ Running database migrations...${NC}"
./scripts/migrate.sh

# Deploy using Kustomize
echo -e "${BLUE}📦 Deploying to Kubernetes...${NC}"

# Set image tag in kustomization
if [[ -f "infrastructure/k8s/overlays/${ENVIRONMENT}/kustomization.yaml" ]]; then
    cd "infrastructure/k8s/overlays/${ENVIRONMENT}"
    
    # Update image tag
    if [[ -n "${REGISTRY}" ]]; then
        IMAGE_NAME="${REGISTRY}/suuupra/${SERVICE_NAME}:${IMAGE_TAG}"
    else
        IMAGE_NAME="suuupra/${SERVICE_NAME}:${IMAGE_TAG}"
    fi
    
    kustomize edit set image "${SERVICE_NAME}=${IMAGE_NAME}"
    
    # Apply manifests
    kubectl apply -k . -n "${NAMESPACE}"
    
    cd - >/dev/null
else
    echo -e "${YELLOW}⚠️ Kustomize overlay not found for ${ENVIRONMENT}, using base manifests${NC}"
    kubectl apply -k infrastructure/k8s/base -n "${NAMESPACE}"
fi

# Wait for deployment to be ready
echo -e "${BLUE}⏳ Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/"${SERVICE_NAME}" -n "${NAMESPACE}" --timeout=300s

# Verify deployment
echo -e "${BLUE}🔍 Verifying deployment...${NC}"
kubectl get pods -l app="${SERVICE_NAME}" -n "${NAMESPACE}"

# Health check
echo -e "${BLUE}🏥 Running health check...${NC}"
SERVICE_URL=$(kubectl get service "${SERVICE_NAME}" -n "${NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "localhost")
SERVICE_PORT=$(kubectl get service "${SERVICE_NAME}" -n "${NAMESPACE}" -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || echo "8086")

# Port forward for health check if LoadBalancer not available
if [[ "${SERVICE_URL}" == "localhost" ]]; then
    echo -e "${YELLOW}⚠️ LoadBalancer not available, using port-forward for health check${NC}"
    kubectl port-forward service/"${SERVICE_NAME}" 8086:8086 -n "${NAMESPACE}" &
    PORT_FORWARD_PID=$!
    sleep 5
    SERVICE_URL="localhost"
    SERVICE_PORT="8086"
fi

# Health check with retry
HEALTH_CHECK_URL="http://${SERVICE_URL}:${SERVICE_PORT}/health"
echo "Health check URL: ${HEALTH_CHECK_URL}"

for i in {1..10}; do
    if curl -s -f "${HEALTH_CHECK_URL}" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Health check attempt ${i}/10 failed, retrying...${NC}"
        sleep 10
    fi
    
    if [[ $i -eq 10 ]]; then
        echo -e "${RED}❌ Health check failed after 10 attempts${NC}"
        
        # Show pod logs for debugging
        echo -e "${BLUE}📋 Pod logs:${NC}"
        kubectl logs -l app="${SERVICE_NAME}" -n "${NAMESPACE}" --tail=50
        
        # Kill port-forward if it was started
        if [[ -n "${PORT_FORWARD_PID:-}" ]]; then
            kill "${PORT_FORWARD_PID}" 2>/dev/null || true
        fi
        
        exit 1
    fi
done

# Kill port-forward if it was started
if [[ -n "${PORT_FORWARD_PID:-}" ]]; then
    kill "${PORT_FORWARD_PID}" 2>/dev/null || true
fi

# Show deployment info
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo -e "${GREEN}📊 Service Information:${NC}"
kubectl get service "${SERVICE_NAME}" -n "${NAMESPACE}"

echo -e "${GREEN}🎬 Live Classes Service deployed successfully!${NC}"
echo -e "${BLUE}📖 API Documentation: http://${SERVICE_URL}:${SERVICE_PORT}/docs${NC}"
echo -e "${BLUE}📊 Metrics: http://${SERVICE_URL}:${SERVICE_PORT}/metrics${NC}"

# Show useful commands
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo "  View logs: kubectl logs -f deployment/${SERVICE_NAME} -n ${NAMESPACE}"
echo "  Scale service: kubectl scale deployment/${SERVICE_NAME} --replicas=3 -n ${NAMESPACE}"
echo "  Port forward: kubectl port-forward service/${SERVICE_NAME} 8086:8086 -n ${NAMESPACE}"
