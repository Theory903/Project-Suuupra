#!/bin/bash
set -e

# LLM Tutor Service Deployment Script
# Deploys the service to Kubernetes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="llm-tutor"
NAMESPACE=${NAMESPACE:-"llm-tutor"}
ENVIRONMENT=${ENVIRONMENT:-"development"}
REGISTRY=${REGISTRY:-"your-registry.com"}
TAG=${TAG:-"latest"}
KUBECTL=${KUBECTL:-"kubectl"}

echo "🚀 Deploying LLM Tutor Service"
echo "  Environment: $ENVIRONMENT"
echo "  Namespace: $NAMESPACE"
echo "  Registry: $REGISTRY"
echo "  Tag: $TAG"

# Change to project directory
cd "$PROJECT_DIR"

# Validate prerequisites
if ! command -v $KUBECTL &> /dev/null; then
    echo "❌ kubectl not found"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo "❌ helm not found"
    exit 1
fi

# Check cluster connection
echo "🔗 Checking cluster connection..."
if ! $KUBECTL cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
fi

# Create namespace if it doesn't exist
echo "📁 Ensuring namespace exists..."
$KUBECTL create namespace "$NAMESPACE" --dry-run=client -o yaml | $KUBECTL apply -f -

# Deploy dependencies first
echo "📦 Deploying dependencies..."

# Deploy PostgreSQL
if [[ "$ENVIRONMENT" == "development" ]]; then
    helm upgrade --install postgresql \
        oci://registry-1.docker.io/bitnamicharts/postgresql \
        --namespace "$NAMESPACE" \
        --set auth.postgresPassword=password \
        --set auth.database=llm_tutor \
        --set primary.persistence.size=10Gi \
        --wait --timeout=300s
fi

# Deploy Redis
helm upgrade --install redis \
    oci://registry-1.docker.io/bitnamicharts/redis \
    --namespace "$NAMESPACE" \
    --set auth.enabled=false \
    --set replica.replicaCount=1 \
    --wait --timeout=300s

# Deploy Milvus using Kustomize
echo "🗂️  Deploying vector database..."
$KUBECTL apply -k infrastructure/k8s/overlays/$ENVIRONMENT

# Wait for dependencies to be ready
echo "⏳ Waiting for dependencies..."
$KUBECTL wait --for=condition=ready pod -l app.kubernetes.io/name=postgresql -n "$NAMESPACE" --timeout=300s
$KUBECTL wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n "$NAMESPACE" --timeout=300s

# Deploy the main application
echo "🚀 Deploying LLM Tutor service..."

# Update image tag in deployment
if [[ -f "infrastructure/k8s/overlays/$ENVIRONMENT/kustomization.yaml" ]]; then
    # Use kustomize to set image
    cd "infrastructure/k8s/overlays/$ENVIRONMENT"
    kustomize edit set image llm-tutor="$REGISTRY/$SERVICE_NAME:$TAG"
    cd "$PROJECT_DIR"
fi

# Apply the deployment
$KUBECTL apply -k "infrastructure/k8s/overlays/$ENVIRONMENT"

# Wait for deployment to be ready
echo "⏳ Waiting for deployment..."
$KUBECTL rollout status deployment/llm-tutor -n "$NAMESPACE" --timeout=600s

# Run database migrations
echo "🗃️  Running database migrations..."
$KUBECTL run llm-tutor-migrate \
    --image="$REGISTRY/$SERVICE_NAME:$TAG" \
    --namespace="$NAMESPACE" \
    --rm -i --restart=Never \
    --command -- python -m alembic upgrade head

# Verify deployment
echo "✅ Verifying deployment..."
$KUBECTL get pods -n "$NAMESPACE" -l app=llm-tutor

# Check service health
SERVICE_IP=$($KUBECTL get service llm-tutor -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [[ -n "$SERVICE_IP" ]]; then
    echo "🌐 Service available at: http://$SERVICE_IP"
    
    # Health check
    if curl -f "http://$SERVICE_IP/health" &> /dev/null; then
        echo "✅ Health check passed"
    else
        echo "⚠️  Health check failed"
    fi
else
    echo "📝 Service deployed but no external IP assigned"
fi

# Show deployment info
echo ""
echo "📊 Deployment Information:"
$KUBECTL get deployment llm-tutor -n "$NAMESPACE" -o wide
echo ""
echo "🔍 Pod Status:"
$KUBECTL get pods -n "$NAMESPACE" -l app=llm-tutor

# Show logs if deployment failed
if ! $KUBECTL get deployment llm-tutor -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' | grep -q "True"; then
    echo ""
    echo "❌ Deployment failed. Recent logs:"
    $KUBECTL logs -n "$NAMESPACE" -l app=llm-tutor --tail=50
    exit 1
fi

echo ""
echo "✅ Deployment completed successfully!"

# Provide useful commands
echo ""
echo "🔧 Useful commands:"
echo "  View logs: kubectl logs -f -n $NAMESPACE -l app=llm-tutor"
echo "  Port forward: kubectl port-forward -n $NAMESPACE service/llm-tutor 8092:80"
echo "  Scale: kubectl scale deployment llm-tutor -n $NAMESPACE --replicas=3"
echo "  Status: kubectl get all -n $NAMESPACE"
