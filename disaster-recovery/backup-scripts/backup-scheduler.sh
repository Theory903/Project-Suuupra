#!/bin/bash

# Backup Scheduler for Suuupra Platform
# This is a simplified version for development/testing

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting backup process at $(date)"

# Simple health check endpoint
start_health_server() {
    echo "Starting health check server on port 9999..."
    while true; do
        echo -e "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n" | nc -l -p 9999 2>/dev/null || sleep 1
    done &
}

# Cleanup old backups
cleanup_old_backups() {
    echo "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
}

# Simple backup simulation (in real scenario, this would backup actual data)
perform_backup() {
    echo "Performing backup simulation..."
    echo "Backup completed at $(date)" > "$BACKUP_DIR/backup_$TIMESTAMP.txt"
    echo "Backup file created: backup_$TIMESTAMP.txt"
}

# Main execution
main() {
    start_health_server
    
    while true; do
        perform_backup
        cleanup_old_backups
        echo "Backup cycle completed. Next backup in 24 hours."
        sleep 86400  # 24 hours
    done
}

# Handle signals
trap 'echo "Backup scheduler stopped"; exit 0' SIGTERM SIGINT

# Start the scheduler
main
