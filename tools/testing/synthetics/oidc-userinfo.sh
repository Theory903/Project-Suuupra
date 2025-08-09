#!/usr/bin/env bash
set -euo pipefail
BASE=${IDENTITY_BASE:-http://localhost:8081}
TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" -d grant_type=client_credentials -d scope=openid $BASE/oauth2/token | jq -r .access_token)
curl -s -H "Authorization: Bearer $TOKEN" $BASE/userinfo | jq .


