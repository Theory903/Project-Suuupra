# Signing Key Rotation Runbook

## Overview
Identity service uses ES256 (ECDSA P-256) keys for JWT signing. Keys are stored encrypted in the database and rotated periodically for security.

## Key Rotation Process

### 1. Generate Next Key
```bash
# Connect to identity service pod/container
kubectl exec -it identity-pod -- /bin/bash

# Or via API (requires admin auth)
curl -X POST https://identity.your-domain.com/api/v1/admin/keys/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 2. Promote New Key
```bash
# List available keys
curl -s https://identity.your-domain.com/.well-known/jwks.json | jq '.keys[].kid'

# Promote specific key ID to current
curl -X POST https://identity.your-domain.com/api/v1/admin/keys/$NEW_KID/promote \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3. Verification
```bash
# Check JWKS contains both old and new keys
curl -s https://identity.your-domain.com/.well-known/jwks.json | jq '.keys | length'

# Verify new tokens use new key
curl -X POST https://identity.your-domain.com/oauth2/token \
  -u client:secret \
  -d 'grant_type=client_credentials&scope=api' \
  | jq -r '.access_token' \
  | jwt decode --no-verify - | jq '.header.kid'
```

### 4. Gateway Cache Refresh
Wait 10-15 minutes for gateway JWKS cache to refresh, or restart gateway pods.

### 5. Cleanup Old Keys (Optional)
After 24-48 hours, disable old keys:
```sql
UPDATE signing_keys SET enabled=FALSE WHERE kid='old-key-id';
```

## Frequency
- **Development**: Monthly
- **Staging**: Bi-weekly  
- **Production**: Weekly or after security incidents

## Emergency Rotation
If key compromise is suspected:
1. Immediately generate and promote new key
2. Disable compromised key: `UPDATE signing_keys SET enabled=FALSE WHERE kid='compromised-kid'`
3. Restart all gateway instances to clear JWKS cache
4. Monitor for authentication failures

## Monitoring
- Alert on JWKS fetch failures from gateway
- Monitor JWT signature verification errors
- Track key rotation success/failure in logs

## Troubleshooting
- **Gateway 401s after rotation**: Check JWKS cache TTL, restart gateway
- **Database errors**: Verify KMS/Vault connectivity for key encryption
- **No keys available**: Emergency: restore from backup or regenerate initial key
