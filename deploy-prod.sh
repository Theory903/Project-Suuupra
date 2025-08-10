#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Deploying Suuupra Identity to Production"
echo "=========================================="

# Check prerequisites
if ! command -v vault &> /dev/null; then
    echo "❌ Vault CLI not found. Please install Vault CLI first."
    exit 1
fi

if ! command -v kubectl &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Neither kubectl nor docker-compose found. Please install one."
    exit 1
fi

# Setup Vault secrets
echo "1. Setting up Vault secrets..."
./tools/scripts/setup-vault-secrets.sh

# Deploy based on available tools
if command -v kubectl &> /dev/null; then
    echo ""
    echo "2. Deploying to Kubernetes..."
    kubectl apply -k infrastructure/kubernetes/apps/overlays/vault/
    echo "✅ Kubernetes deployment applied!"
    echo ""
    echo "Check status with:"
    echo "  kubectl get pods -n suuupra"
    echo "  kubectl logs -f deployment/identity -n suuupra"
    
elif command -v docker-compose &> /dev/null; then
    echo ""
    echo "2. Deploying with Docker Compose..."
    
    # Check for .env file
    if [[ ! -f .env ]]; then
        echo "❌ .env file not found. Please copy .env.example to .env and fill in values."
        exit 1
    fi
    
    docker-compose -f docker-compose.prod.yml up -d
    echo "✅ Docker Compose deployment started!"
    echo ""
    echo "Check status with:"
    echo "  docker-compose -f docker-compose.prod.yml ps"
    echo "  docker-compose -f docker-compose.prod.yml logs -f identity"
fi

echo ""
echo "🎉 Production deployment complete!"
echo ""
echo "Test endpoints:"
echo "  Health: https://identity.suuupra.com/actuator/health"
echo "  OIDC Discovery: https://identity.suuupra.com/.well-known/openid-configuration"
echo "  JWKS: https://identity.suuupra.com/.well-known/jwks.json"
