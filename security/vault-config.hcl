# Vault Configuration for Suuupra Platform
ui = true

# Development mode listener
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

# Storage backend
storage "file" {
  path = "/vault/data"
}

# API address
api_addr = "http://0.0.0.0:8200"

# Cluster address
cluster_addr = "http://0.0.0.0:8201"

# Default lease TTL
default_lease_ttl = "168h"
max_lease_ttl = "720h"

# Plugin directory
plugin_directory = "/vault/plugins"

# Enable audit logging
# audit "file" {
#   file_path = "/vault/logs/audit.log"
# }

# Log level
log_level = "INFO"

# Disable mlock for development
disable_mlock = true
