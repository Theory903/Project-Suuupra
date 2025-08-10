#!/usr/bin/env bash
set -euo pipefail

# Usage: ./render-vault-env.sh <vault-path> <output-file>
# Example: ./render-vault-env.sh secret/identity-service identity.env

if [ $# -ne 2 ]; then
  echo "Usage: $0 <vault-path> <output-file>" >&2
  exit 1
fi

VAULT_PATH="$1"
OUT_FILE="$2"

vault kv get -format=json "$VAULT_PATH" \
  | jq -r '.data.data | to_entries[] | "export \(.key)=\(.value)"' \
  > "$OUT_FILE"

echo "Wrote $OUT_FILE"

