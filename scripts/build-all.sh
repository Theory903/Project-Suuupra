#!/bin/bash

# Master build script for all services
# This script iterates through all directories in the services/ folder.
# For each service, it checks for a build.sh, pom.xml, or package.json
# and runs the appropriate build command.

set -e # Exit immediately if a command exits with a non-zero status.

BASE_DIR=$(pwd)
SERVICES_DIR="services"

echo "Starting build for all services..."

for SERVICE_DIR in "$SERVICES_DIR"/*; do
  if [ -d "$SERVICE_DIR" ]; then
    SERVICE_NAME=$(basename "$SERVICE_DIR")
    echo "--------------------------------------------------"
    echo "Building service: $SERVICE_NAME"
    echo "--------------------------------------------------"
    
    cd "$SERVICE_DIR"

    if [ -f "build.sh" ]; then
      echo "Found build.sh, executing..."
      /bin/bash build.sh
    elif [ -f "pom.xml" ]; then
      echo "Found pom.xml, running Maven build..."
      mvn clean package -DskipTests
    elif [ -f "package.json" ]; then
      echo "Found package.json, running npm install..."
      npm install
    else
      echo "No build file (build.sh, pom.xml, or package.json) found for $SERVICE_NAME. Skipping."
    fi
    
    cd "$BASE_DIR"
    echo "Finished building $SERVICE_NAME."
    echo ""
  fi
done

echo "All services built successfully."