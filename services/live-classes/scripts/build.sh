#!/bin/bash

# Production build script for Live Classes Service
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎬 Building Live Classes Service...${NC}"

# Configuration
SERVICE_NAME="live-classes"
IMAGE_NAME="suuupra/${SERVICE_NAME}"
VERSION=${1:-"latest"}
REGISTRY=${REGISTRY:-""}

# Build info
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}
GIT_BRANCH=${GITHUB_REF_NAME:-$(git branch --show-current 2>/dev/null || echo "unknown")}

echo -e "${YELLOW}📋 Build Configuration:${NC}"
echo "  Service: ${SERVICE_NAME}"
echo "  Image: ${IMAGE_NAME}:${VERSION}"
echo "  Build Date: ${BUILD_DATE}"
echo "  Git Commit: ${GIT_COMMIT}"
echo "  Git Branch: ${GIT_BRANCH}"

# Pre-build checks
echo -e "${BLUE}🔍 Running pre-build checks...${NC}"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

# Check if required files exist
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

if [[ ! -f "Dockerfile" ]]; then
    echo -e "${RED}❌ Dockerfile not found${NC}"
    exit 1
fi

# Install dependencies and run tests
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm ci

echo -e "${BLUE}🔨 Building TypeScript...${NC}"
npm run build

echo -e "${BLUE}🧪 Running tests...${NC}"
npm test

echo -e "${BLUE}🔍 Running linting...${NC}"
npm run lint

echo -e "${BLUE}🛡️ Running security audit...${NC}"
npm audit --audit-level=high

# Generate Prisma client
echo -e "${BLUE}🗄️ Generating Prisma client...${NC}"
npx prisma generate

# Build Docker image
echo -e "${BLUE}🐳 Building Docker image...${NC}"
docker build \
    --target production \
    --build-arg BUILD_DATE="${BUILD_DATE}" \
    --build-arg GIT_COMMIT="${GIT_COMMIT}" \
    --build-arg GIT_BRANCH="${GIT_BRANCH}" \
    --build-arg VERSION="${VERSION}" \
    -t "${IMAGE_NAME}:${VERSION}" \
    -t "${IMAGE_NAME}:latest" \
    .

# Security scanning with Trivy
echo -e "${BLUE}🛡️ Scanning image for vulnerabilities...${NC}"
if command -v trivy >/dev/null 2>&1; then
    trivy image --exit-code 1 --severity HIGH,CRITICAL "${IMAGE_NAME}:${VERSION}"
else
    echo -e "${YELLOW}⚠️ Trivy not found, skipping security scan${NC}"
fi

# Tag for registry if specified
if [[ -n "${REGISTRY}" ]]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    docker tag "${IMAGE_NAME}:${VERSION}" "${FULL_IMAGE_NAME}"
    echo -e "${GREEN}🏷️ Tagged image: ${FULL_IMAGE_NAME}${NC}"
fi

# Image info
IMAGE_SIZE=$(docker images "${IMAGE_NAME}:${VERSION}" --format "table {{.Size}}" | tail -n 1)
echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${GREEN}📦 Image: ${IMAGE_NAME}:${VERSION}${NC}"
echo -e "${GREEN}📏 Size: ${IMAGE_SIZE}${NC}"

# Push to registry if specified
if [[ -n "${REGISTRY}" && "${PUSH_IMAGE:-false}" == "true" ]]; then
    echo -e "${BLUE}📤 Pushing to registry...${NC}"
    docker push "${FULL_IMAGE_NAME}"
    echo -e "${GREEN}✅ Image pushed to registry${NC}"
fi

echo -e "${GREEN}🎉 Live Classes Service build complete!${NC}"
