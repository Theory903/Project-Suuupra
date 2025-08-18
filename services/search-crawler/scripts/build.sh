#!/bin/bash

set -e

echo "🏗️  Building Search Crawler Service..."

# Get version from git or use default
VERSION=${VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}
IMAGE_NAME="suuupra/search-crawler"
FULL_IMAGE_NAME="${IMAGE_NAME}:${VERSION}"

echo "📦 Building Docker image: ${FULL_IMAGE_NAME}"

# Build the Docker image
docker build -t "${FULL_IMAGE_NAME}" .

# Tag as latest
docker tag "${FULL_IMAGE_NAME}" "${IMAGE_NAME}:latest"

echo "✅ Build completed successfully!"
echo "🏷️  Image tagged as: ${FULL_IMAGE_NAME}"
echo "🏷️  Image tagged as: ${IMAGE_NAME}:latest"

# Optional: Push to registry if PUSH_TO_REGISTRY is set
if [ "${PUSH_TO_REGISTRY}" = "true" ]; then
    echo "📤 Pushing to registry..."
    docker push "${FULL_IMAGE_NAME}"
    docker push "${IMAGE_NAME}:latest"
    echo "✅ Push completed!"
fi

echo "🎉 Search Crawler Service build complete!"
