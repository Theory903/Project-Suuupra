#!/bin/bash
set -euo pipefail

# 🚀 Suuupra Platform - Local Kubernetes Setup
# Following TODO-002: Setup Local Kubernetes Correctly

echo "⚓ Setting up Local Kubernetes with Linkerd Service Mesh..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
if ! command -v minikube &> /dev/null; then
    print_error "Minikube not found. Run ./scripts/setup-dev-environment.sh first"
fi

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Run ./scripts/setup-dev-environment.sh first"
fi

# Step 1: Start Minikube with proper resources
echo "🚀 Starting Minikube with production-like resources..."

# Stop existing minikube if running
minikube stop 2>/dev/null || true

# Start minikube with the exact configuration from TODO
minikube start \
  --cpus=4 \
  --memory=8192 \
  --disk-size=50g \
  --driver=docker \
  --kubernetes-version=v1.29.0

print_status "Minikube started with production-like resources"

# Verify cluster is running
kubectl cluster-info

# Step 2: Enable CRITICAL addons
echo "🔧 Enabling critical Kubernetes addons..."

minikube addons enable ingress
minikube addons enable ingress-dns
minikube addons enable metrics-server
minikube addons enable dashboard
minikube addons enable registry

print_status "Critical addons enabled"

# Step 3: Install Linkerd (NOT Istio - 40% faster)
echo "🔗 Installing Linkerd Service Mesh..."

# Check if linkerd CLI exists
if ! command -v linkerd &> /dev/null; then
    echo "Installing Linkerd CLI..."
    curl --proto '=https' --tlsv1.2 -sSfL https://run.linkerd.io/install | sh
    export PATH=$PATH:$HOME/.linkerd2/bin
    echo 'export PATH=$PATH:$HOME/.linkerd2/bin' >> ~/.zshrc
fi

# Pre-flight checks
echo "Running Linkerd pre-flight checks..."
linkerd check --pre

# Install Linkerd CRDs
echo "Installing Linkerd CRDs..."
linkerd install --crds | kubectl apply -f -

# Install Linkerd control plane
echo "Installing Linkerd control plane..."
linkerd install | kubectl apply -f -

# Wait for Linkerd to be ready
echo "Waiting for Linkerd to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/linkerd-controller -n linkerd
kubectl wait --for=condition=available --timeout=300s deployment/linkerd-destination -n linkerd
kubectl wait --for=condition=available --timeout=300s deployment/linkerd-identity -n linkerd
kubectl wait --for=condition=available --timeout=300s deployment/linkerd-proxy-injector -n linkerd

# Verify Linkerd installation
linkerd check

print_status "Linkerd service mesh installed successfully"

# Install Linkerd Viz extension for observability
echo "Installing Linkerd Viz extension..."
linkerd viz install | kubectl apply -f -

# Wait for viz to be ready
kubectl wait --for=condition=available --timeout=300s deployment/web -n linkerd-viz

print_status "Linkerd Viz extension installed"

# Step 4: Setup namespaces properly
echo "📦 Setting up Suuupra namespaces..."

# Create namespaces
kubectl create namespace suuupra-dev --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace suuupra-staging --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace suuupra-prod --dry-run=client -o yaml | kubectl apply -f -

# Label namespaces for Linkerd injection
kubectl label namespace suuupra-dev linkerd.io/inject=enabled --overwrite
kubectl label namespace suuupra-staging linkerd.io/inject=enabled --overwrite
# Note: Don't auto-inject prod - we'll do it manually for safety

print_status "Suuupra namespaces created with Linkerd injection"

# Step 5: Install additional production tools
echo "🛠️  Installing additional production tools..."

# Install cert-manager for certificate management
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager

print_status "cert-manager installed for certificate management"

# Create a ClusterIssuer for Let's Encrypt (development)
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: devops@suuupra.com
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

print_status "Let's Encrypt staging ClusterIssuer created"

# Step 6: Install Prometheus Operator for monitoring
echo "📊 Installing Prometheus Operator..."

# Add Prometheus community helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false

print_status "Prometheus Operator installed"

# Step 7: Create storage classes for different workloads
echo "💾 Setting up storage classes..."

cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: k8s.io/minikube-hostpath
parameters:
  type: pd-ssd
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: slow-disk
provisioner: k8s.io/minikube-hostpath
parameters:
  type: pd-standard
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
EOF

print_status "Storage classes created"

# Step 8: Setup network policies for security
echo "🔒 Setting up network policies..."

# Default deny-all policy for prod namespace
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: suuupra-prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
# Allow DNS resolution
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: suuupra-prod
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to: []
    ports:
    - protocol: UDP
      port: 53
EOF

print_status "Network policies applied"

# Final verification
echo "🔍 Running final verification..."

# Check cluster status
kubectl get nodes
kubectl get namespaces
kubectl get pods -A | head -20

# Check Linkerd status
linkerd check

print_info "Linkerd dashboard: linkerd viz dashboard"
print_info "Prometheus UI: kubectl port-forward svc/prometheus-kube-prometheus-prometheus -n monitoring 9090:9090"
print_info "Grafana UI: kubectl port-forward svc/prometheus-grafana -n monitoring 3000:80"

echo ""
echo "🎉 Local Kubernetes cluster setup complete!"
echo ""
echo "📋 Cluster Summary:"
echo "  • Kubernetes v1.29.0 with 4 CPUs, 8GB RAM"
echo "  • Linkerd service mesh (40% faster than Istio)"
echo "  • Cert-manager for certificate management"
echo "  • Prometheus + Grafana for monitoring"
echo "  • Three environments: dev, staging, prod"
echo "  • Network policies for security"
echo ""
echo "Next steps:"
echo "1. Run: ./scripts/setup-kafka-kraft.sh"
echo "2. Deploy services: ./scripts/deploy-dev-services.sh"
echo ""
