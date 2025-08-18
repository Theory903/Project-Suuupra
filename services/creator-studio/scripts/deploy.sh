#!/bin/bash

set -e

echo "🚀 Deploying Creator Studio..."

# Configuration
NAMESPACE=${NAMESPACE:-"suuupra"}
ENVIRONMENT=${ENVIRONMENT:-"development"}
VERSION=${VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}

echo "📋 Deployment Configuration:"
echo "   Namespace: ${NAMESPACE}"
echo "   Environment: ${ENVIRONMENT}"
echo "   Version: ${VERSION}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
fi

# Create namespace if it doesn't exist
echo "🏗️  Ensuring namespace exists..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMaps and Secrets first
echo "🔧 Applying configuration..."
if [ -f "infrastructure/k8s/base/configmap.yaml" ]; then
    kubectl apply -f infrastructure/k8s/base/configmap.yaml -n "${NAMESPACE}"
fi

if [ -f "infrastructure/k8s/base/secrets.yaml" ]; then
    kubectl apply -f infrastructure/k8s/base/secrets.yaml -n "${NAMESPACE}"
fi

# Apply base resources
echo "📦 Applying base Kubernetes resources..."
kubectl apply -k infrastructure/k8s/base/ -n "${NAMESPACE}"

# Apply environment-specific overlays if they exist
if [ -d "infrastructure/k8s/overlays/${ENVIRONMENT}" ]; then
    echo "🔧 Applying ${ENVIRONMENT} environment overlay..."
    kubectl apply -k "infrastructure/k8s/overlays/${ENVIRONMENT}/" -n "${NAMESPACE}"
fi

# Update deployments with new image versions
echo "🔄 Updating deployment images..."
kubectl set image deployment/creator-studio-backend-deployment \
    creator-studio-backend="suuupra/creator-studio-backend:${VERSION}" \
    -n "${NAMESPACE}"

kubectl set image deployment/creator-studio-frontend-deployment \
    creator-studio-frontend="suuupra/creator-studio-frontend:${VERSION}" \
    -n "${NAMESPACE}"

# Wait for deployments to complete
echo "⏳ Waiting for backend deployment..."
kubectl rollout status deployment/creator-studio-backend-deployment -n "${NAMESPACE}" --timeout=300s

echo "⏳ Waiting for frontend deployment..."
kubectl rollout status deployment/creator-studio-frontend-deployment -n "${NAMESPACE}" --timeout=300s

# Verify deployments
echo "✅ Verifying deployments..."
kubectl get pods -l app=creator-studio-backend -n "${NAMESPACE}"
kubectl get pods -l app=creator-studio-frontend -n "${NAMESPACE}"

# Show service endpoints
echo "🌐 Service endpoints:"
kubectl get services -l app.kubernetes.io/name=creator-studio -n "${NAMESPACE}"

# Show ingress if available
if kubectl get ingress -n "${NAMESPACE}" 2>/dev/null | grep -q creator-studio; then
    echo "🔗 Ingress configuration:"
    kubectl get ingress -l app.kubernetes.io/name=creator-studio -n "${NAMESPACE}"
fi

# Run database migrations if needed
echo "🗄️  Running database migrations..."
kubectl create job creator-studio-migration-$(date +%s) \
    --from=cronjob/creator-studio-migration \
    -n "${NAMESPACE}" 2>/dev/null || echo "Migration job template not found, skipping..."

echo "🎉 Creator Studio deployment complete!"
echo "📊 To view logs:"
echo "   Backend: kubectl logs -f deployment/creator-studio-backend-deployment -n ${NAMESPACE}"
echo "   Frontend: kubectl logs -f deployment/creator-studio-frontend-deployment -n ${NAMESPACE}"
echo "🔍 To debug:"
echo "   kubectl describe deployment/creator-studio-backend-deployment -n ${NAMESPACE}"
echo "   kubectl describe deployment/creator-studio-frontend-deployment -n ${NAMESPACE}"
