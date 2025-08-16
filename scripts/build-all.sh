#!/bin/bash
# ==============================================================================
# Master Build Script for Suuupra EdTech Platform
#
# This script iterates through all microservice directories in `/services`
# and executes the `build.sh` script within each one. This provides a
# single command to build all Docker images for the platform locally.
#
# Usage:
# ./scripts/build-all.sh
#
# Prerequisites:
# - Must be run from the project root.
# - Each service directory must contain a `build.sh` script.
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # Return the exit status of the last command in the pipe that failed.

# --- Configuration ---
SERVICES_DIR="services"
SCRIPT_NAME="build.sh"

# --- Main Logic ---
echo "🚀 Starting master build for all services..."

if [ ! -d "$SERVICES_DIR" ]; then
  echo "❌ Error: Directory '$SERVICES_DIR' not found. Please run this script from the project root."
  exit 1
fi

for service in "$SERVICES_DIR"/*; do
  if [ -d "$service" ]; then
    SERVICE_NAME=$(basename "$service")
    BUILD_SCRIPT_PATH="$service/$SCRIPT_NAME"

    if [ -f "$BUILD_SCRIPT_PATH" ]; then
      echo "----------------------------------------------------------------------"
      echo "🔨 Building service: $SERVICE_NAME"
      echo "----------------------------------------------------------------------"
      
      (
        cd "$service" && \
        if [ -x "$SCRIPT_NAME" ]; then
          ./"$SCRIPT_NAME"
        else
          echo "› Warning: '$SCRIPT_NAME' is not executable. Attempting with 'bash'."
          bash "$SCRIPT_NAME"
        fi
      )
      
      if [ $? -eq 0 ]; then
        echo "✅ Successfully built service: $SERVICE_NAME"
      else
        echo "❌ Failed to build service: $SERVICE_NAME"
        # Decide whether to exit on failure or continue with other services
        # exit 1 # Uncomment to stop the entire build on the first failure
      fi
      
      echo "" # Add a newline for better readability
    else
      echo "› Skipping service '$SERVICE_NAME': '$SCRIPT_NAME' not found."
    fi
  fi
done

echo "🎉 Master build process completed."