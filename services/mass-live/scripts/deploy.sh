#!/bin/bash

set -e

echo "🚀 Deploying Mass Live Service..."

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

# Apply base resources
echo "📦 Applying base Kubernetes resources..."
kubectl apply -k infrastructure/k8s/base/ -n "${NAMESPACE}"

# Apply environment-specific overlays if they exist
if [ -d "infrastructure/k8s/overlays/${ENVIRONMENT}" ]; then
    echo "🔧 Applying ${ENVIRONMENT} environment overlay..."
    kubectl apply -k "infrastructure/k8s/overlays/${ENVIRONMENT}/" -n "${NAMESPACE}"
fi

# Update deployment image
echo "🔄 Updating deployment image to version ${VERSION}..."
kubectl set image deployment/mass-live-deployment \
    mass-live="suuupra/mass-live:${VERSION}" \
    -n "${NAMESPACE}"

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
kubectl rollout status deployment/mass-live-deployment -n "${NAMESPACE}" --timeout=300s

# Verify deployment
echo "✅ Verifying deployment..."
kubectl get pods -l app=mass-live -n "${NAMESPACE}"

# Show service endpoints
echo "🌐 Service endpoints:"
kubectl get services -l app=mass-live -n "${NAMESPACE}"

# Show ingress if available
if kubectl get ingress -n "${NAMESPACE}" 2>/dev/null | grep -q mass-live; then
    echo "🔗 Ingress configuration:"
    kubectl get ingress -l app=mass-live -n "${NAMESPACE}"
fi

echo "🎉 Mass Live Service deployment complete!"
echo "📊 To view logs: kubectl logs -f deployment/mass-live-deployment -n ${NAMESPACE}"
echo "🔍 To debug: kubectl describe deployment/mass-live-deployment -n ${NAMESPACE}"
