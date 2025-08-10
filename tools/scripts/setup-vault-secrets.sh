#!/usr/bin/env bash
set -euo pipefail

# Setup Vault secrets for production deployment
# Usage: ./setup-vault-secrets.sh

echo "Setting up Vault secrets for Suuupra Identity..."

# Generate KEKs
KMS_KEK=$(openssl rand -base64 32)
MFA_KEK=$(openssl rand -base64 32)

echo "Generated KEKs. Storing in Vault..."

# Store Identity service secrets
vault kv put secret/identity-service \
  KMS_KEKBASE64="$KMS_KEK" \
  SECURITY_MFA_KEKBASE64="$MFA_KEK"

# Store API Gateway config
vault kv put secret/api-gateway \
  OIDC_DISCOVERY_URL="https://identity.suuupra.com/.well-known/openid-configuration" \
  OIDC_ISSUER="https://identity.suuupra.com" \
  OIDC_AUDIENCE="suuupra-api"

echo "✅ Vault secrets configured successfully!"
echo ""
echo "KEKs generated (store securely for backup):"
echo "KMS_KEKBASE64: $KMS_KEK"
echo "SECURITY_MFA_KEKBASE64: $MFA_KEK"
echo ""
echo "Next steps:"
echo "1. Apply Kubernetes manifests: kubectl apply -k infrastructure/kubernetes/apps/overlays/vault/"
echo "2. Or use Docker Compose: docker-compose -f docker-compose.prod.yml up -d"
