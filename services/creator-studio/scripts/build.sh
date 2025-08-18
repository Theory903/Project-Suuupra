#!/bin/bash

set -e

echo "🏗️  Building Creator Studio..."

# Get version from git or use default
VERSION=${VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}
BACKEND_IMAGE="suuupra/creator-studio-backend"
FRONTEND_IMAGE="suuupra/creator-studio-frontend"

echo "📦 Building Docker images..."

# Build backend
echo "🔧 Building backend image: ${BACKEND_IMAGE}:${VERSION}"
docker build -t "${BACKEND_IMAGE}:${VERSION}" -f backend/Dockerfile backend/
docker tag "${BACKEND_IMAGE}:${VERSION}" "${BACKEND_IMAGE}:latest"

# Build frontend
echo "🎨 Building frontend image: ${FRONTEND_IMAGE}:${VERSION}"
docker build -t "${FRONTEND_IMAGE}:${VERSION}" -f frontend/Dockerfile frontend/
docker tag "${FRONTEND_IMAGE}:${VERSION}" "${FRONTEND_IMAGE}:latest"

echo "✅ Build completed successfully!"
echo "🏷️  Backend image: ${BACKEND_IMAGE}:${VERSION}"
echo "🏷️  Frontend image: ${FRONTEND_IMAGE}:${VERSION}"

# Optional: Push to registry if PUSH_TO_REGISTRY is set
if [ "${PUSH_TO_REGISTRY}" = "true" ]; then
    echo "📤 Pushing images to registry..."
    
    docker push "${BACKEND_IMAGE}:${VERSION}"
    docker push "${BACKEND_IMAGE}:latest"
    
    docker push "${FRONTEND_IMAGE}:${VERSION}"
    docker push "${FRONTEND_IMAGE}:latest"
    
    echo "✅ Push completed!"
fi

echo "🎉 Creator Studio build complete!"
