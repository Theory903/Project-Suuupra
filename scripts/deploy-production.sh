#!/bin/bash
# ==============================================================================
# Suuupra Platform - Production Deployment Script
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="suuupra-prod-eks"
AWS_REGION="us-east-1"
NAMESPACE="production"
TERRAFORM_DIR="infrastructure/terraform/environments/prod"
KUSTOMIZE_DIR="infrastructure/kubernetes/overlays/prod"

# Functions
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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("terraform" "kubectl" "aws" "helm" "docker" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed"
            exit 1
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Check environment variables
    local required_vars=("AWS_REGION" "CLUSTER_NAME")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

deploy_infrastructure() {
    log_info "Deploying AWS infrastructure with Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    terraform init -upgrade
    
    # Plan deployment
    log_info "Planning Terraform deployment..."
    terraform plan -out=tfplan
    
    # Apply infrastructure
    log_info "Applying Terraform configuration..."
    terraform apply tfplan
    
    # Get outputs
    VPC_ID=$(terraform output -raw vpc_id)
    EKS_CLUSTER_NAME=$(terraform output -raw eks_cluster_name)
    RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    
    log_success "Infrastructure deployed successfully"
    log_info "VPC ID: $VPC_ID"
    log_info "EKS Cluster: $EKS_CLUSTER_NAME"
    log_info "RDS Endpoint: $RDS_ENDPOINT"
    
    cd - > /dev/null
}

configure_kubectl() {
    log_info "Configuring kubectl for EKS cluster..."
    
    aws eks update-kubeconfig \
        --region "$AWS_REGION" \
        --name "$CLUSTER_NAME"
    
    # Verify connection
    if kubectl cluster-info &> /dev/null; then
        log_success "kubectl configured successfully"
    else
        log_error "Failed to connect to Kubernetes cluster"
        exit 1
    fi
}

create_namespaces() {
    log_info "Creating Kubernetes namespaces..."
    
    local namespaces=("production" "monitoring" "vault" "istio-system")
    
    for ns in "${namespaces[@]}"; do
        if ! kubectl get namespace "$ns" &> /dev/null; then
            kubectl create namespace "$ns"
            log_info "Created namespace: $ns"
        else
            log_info "Namespace $ns already exists"
        fi
    done
    
    # Label namespaces for Istio
    kubectl label namespace production istio-injection=enabled --overwrite
    kubectl label namespace monitoring istio-injection=enabled --overwrite
}

install_istio() {
    log_info "Installing Istio service mesh..."
    
    # Download and install Istio
    if ! command -v istioctl &> /dev/null; then
        curl -L https://istio.io/downloadIstio | sh -
        export PATH="$PWD/istio-*/bin:$PATH"
    fi
    
    # Install Istio
    istioctl install --set values.defaultRevision=default -y
    
    # Apply security policies
    kubectl apply -f infrastructure/security/istio-security.yaml
    
    log_success "Istio installed successfully"
}

install_vault() {
    log_info "Installing HashiCorp Vault..."
    
    # Add Helm repository
    helm repo add hashicorp https://helm.releases.hashicorp.com
    helm repo update
    
    # Install Vault
    helm upgrade --install vault hashicorp/vault \
        --namespace vault \
        --values infrastructure/security/vault-values.yaml \
        --wait
    
    # Apply Vault configuration
    kubectl apply -f infrastructure/security/vault-config.yaml
    
    log_success "Vault installed successfully"
}

install_monitoring() {
    log_info "Installing monitoring stack..."
    
    # Add Helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Install Prometheus Operator
    helm upgrade --install prometheus-operator prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --values infrastructure/monitoring/prometheus-values.yaml \
        --wait
    
    # Apply custom Prometheus configuration
    kubectl apply -f infrastructure/monitoring/prometheus-config.yaml
    
    # Apply Grafana configuration
    kubectl apply -f infrastructure/monitoring/grafana-config.yaml
    
    # Install Jaeger
    kubectl apply -f infrastructure/monitoring/jaeger-config.yaml
    
    log_success "Monitoring stack installed successfully"
}

deploy_applications() {
    log_info "Deploying applications..."
    
    # Apply network policies first
    kubectl apply -f infrastructure/security/network-policies.yaml
    
    # Deploy base applications
    kubectl apply -k "$KUSTOMIZE_DIR"
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=600s deployment --all -n "$NAMESPACE"
    
    log_success "Applications deployed successfully"
}

configure_hpa() {
    log_info "Configuring Horizontal Pod Autoscalers..."
    
    # Apply HPA configurations
    kubectl apply -f infrastructure/kubernetes/apps/base/api-gateway-hpa.yaml
    
    # Install metrics server if not present
    if ! kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
    fi
    
    log_success "HPA configured successfully"
}

setup_ingress() {
    log_info "Setting up ingress controllers..."
    
    # Install AWS Load Balancer Controller
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
        --namespace kube-system \
        --set clusterName="$CLUSTER_NAME" \
        --set serviceAccount.create=false \
        --set serviceAccount.name=aws-load-balancer-controller \
        --wait
    
    # Apply ingress configurations
    kubectl apply -f infrastructure/kubernetes/ingress/
    
    log_success "Ingress configured successfully"
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Check pod status
    local failed_pods
    failed_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    
    if [ "$failed_pods" -gt 0 ]; then
        log_warning "$failed_pods pods are not running"
        kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running
    else
        log_success "All pods are running"
    fi
    
    # Check service endpoints
    log_info "Checking service endpoints..."
    local services=("api-gateway" "identity-service" "content-service" "commerce-service")
    
    for service in "${services[@]}"; do
        if kubectl get endpoints "$service" -n "$NAMESPACE" &> /dev/null; then
            local endpoints
            endpoints=$(kubectl get endpoints "$service" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
            if [ "$endpoints" -gt 0 ]; then
                log_success "$service: $endpoints endpoints ready"
            else
                log_warning "$service: No endpoints ready"
            fi
        else
            log_warning "$service: Service not found"
        fi
    done
}

display_access_info() {
    log_info "Deployment completed! Access information:"
    
    echo ""
    echo "🌐 External URLs:"
    
    # Get Load Balancer URLs
    local lb_hostname
    lb_hostname=$(kubectl get ingress api-gateway-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Not available yet")
    echo "   API Gateway: https://$lb_hostname"
    
    # Monitoring URLs
    echo "   Grafana: https://grafana.suuupra.com"
    echo "   Prometheus: https://prometheus.suuupra.com"
    echo "   Jaeger: https://jaeger.suuupra.com"
    
    echo ""
    echo "🔧 Management Commands:"
    echo "   kubectl get pods -n $NAMESPACE"
    echo "   kubectl logs -f deployment/api-gateway -n $NAMESPACE"
    echo "   kubectl port-forward svc/grafana 3000:3000 -n monitoring"
    
    echo ""
    echo "📊 Monitoring:"
    echo "   kubectl top nodes"
    echo "   kubectl top pods -n $NAMESPACE"
    
    echo ""
    echo "🔐 Security:"
    echo "   kubectl get networkpolicies -n $NAMESPACE"
    echo "   kubectl get peerauthentications -n $NAMESPACE"
}

cleanup_on_error() {
    log_error "Deployment failed. Cleaning up..."
    
    # Add cleanup logic here if needed
    # For now, just exit
    exit 1
}

main() {
    log_info "Starting Suuupra Platform production deployment..."
    
    # Set trap for error handling
    trap cleanup_on_error ERR
    
    # Deployment steps
    check_prerequisites
    deploy_infrastructure
    configure_kubectl
    create_namespaces
    install_istio
    install_vault
    install_monitoring
    deploy_applications
    configure_hpa
    setup_ingress
    
    # Health checks and info
    run_health_checks
    display_access_info
    
    log_success "🚀 Suuupra Platform deployed successfully!"
    log_info "The platform is now ready to serve billions of users!"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "infrastructure")
        check_prerequisites
        deploy_infrastructure
        ;;
    "applications")
        check_prerequisites
        configure_kubectl
        deploy_applications
        ;;
    "health")
        check_prerequisites
        configure_kubectl
        run_health_checks
        ;;
    "cleanup")
        log_warning "This will destroy the entire production environment!"
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY == "yes" ]]; then
            cd "$TERRAFORM_DIR"
            terraform destroy -auto-approve
            log_success "Environment destroyed"
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|infrastructure|applications|health|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy         - Full production deployment"
        echo "  infrastructure - Deploy only AWS infrastructure"
        echo "  applications   - Deploy only Kubernetes applications"
        echo "  health         - Run health checks"
        echo "  cleanup        - Destroy entire environment"
        exit 1
        ;;
esac
