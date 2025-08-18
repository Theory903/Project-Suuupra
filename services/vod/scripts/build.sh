#!/bin/bash

# Production build script for VOD Service
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎥 Building VOD Service...${NC}"

# Configuration
SERVICE_NAME="vod"
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
if [[ ! -f "requirements.txt" ]]; then
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi

if [[ ! -f "Dockerfile" ]]; then
    echo -e "${RED}❌ Dockerfile not found${NC}"
    exit 1
fi

# Check if Python is available
if ! command -v python3 >/dev/null 2>&1; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

# Check if FFmpeg is available
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ FFmpeg not found locally, will be installed in container${NC}"
fi

# Create virtual environment for testing
echo -e "${BLUE}🐍 Setting up Python environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

# Run linting and formatting
echo -e "${BLUE}🔍 Running code quality checks...${NC}"
black --check src/
isort --check-only src/
flake8 src/
mypy src/

# Run tests
echo -e "${BLUE}🧪 Running tests...${NC}"
pytest tests/ --cov=src --cov-report=term-missing --cov-fail-under=80

# Security audit
echo -e "${BLUE}🛡️ Running security audit...${NC}"
pip audit

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

# Cleanup
deactivate
rm -rf venv

echo -e "${GREEN}🎉 VOD Service build complete!${NC}"
