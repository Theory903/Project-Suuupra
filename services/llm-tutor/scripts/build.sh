#!/bin/bash
set -e

# LLM Tutor Service Build Script
# Builds Docker image and prepares for deployment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="llm-tutor"
REGISTRY=${REGISTRY:-"your-registry.com"}
TAG=${TAG:-"latest"}
ENVIRONMENT=${ENVIRONMENT:-"development"}

echo "🔨 Building LLM Tutor Service"
echo "  Project Dir: $PROJECT_DIR"
echo "  Environment: $ENVIRONMENT"
echo "  Registry: $REGISTRY"
echo "  Tag: $TAG"

# Change to project directory
cd "$PROJECT_DIR"

# Validate environment
if [[ ! -f "requirements.txt" ]]; then
    echo "❌ requirements.txt not found"
    exit 1
fi

if [[ ! -f "Dockerfile" ]]; then
    echo "❌ Dockerfile not found"
    exit 1
fi

# Create build info
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo "  Build Time: $BUILD_TIME"
echo "  Git Commit: $GIT_COMMIT"
echo "  Git Branch: $GIT_BRANCH"

# Create build context
echo "📦 Preparing build context..."
mkdir -p .build
cp -r src .build/
cp requirements.txt .build/
cp Dockerfile .build/

# Create build info file
cat > .build/build-info.json << EOF
{
    "service": "$SERVICE_NAME",
    "version": "$TAG",
    "environment": "$ENVIRONMENT",
    "build_time": "$BUILD_TIME",
    "git_commit": "$GIT_COMMIT",
    "git_branch": "$GIT_BRANCH"
}
EOF

# Build Docker image
echo "🐳 Building Docker image..."
docker build \
    --build-arg BUILD_TIME="$BUILD_TIME" \
    --build-arg GIT_COMMIT="$GIT_COMMIT" \
    --build-arg GIT_BRANCH="$GIT_BRANCH" \
    --build-arg ENVIRONMENT="$ENVIRONMENT" \
    -t "$SERVICE_NAME:$TAG" \
    -t "$SERVICE_NAME:latest" \
    -f .build/Dockerfile \
    .build/

# Tag for registry if specified
if [[ "$REGISTRY" != "your-registry.com" ]]; then
    echo "🏷️  Tagging for registry..."
    docker tag "$SERVICE_NAME:$TAG" "$REGISTRY/$SERVICE_NAME:$TAG"
    docker tag "$SERVICE_NAME:latest" "$REGISTRY/$SERVICE_NAME:latest"
fi

# Run security scan if available
if command -v trivy &> /dev/null; then
    echo "🔍 Running security scan..."
    trivy image --exit-code 0 --severity HIGH,CRITICAL "$SERVICE_NAME:$TAG"
fi

# Test the image
echo "🧪 Testing image..."
docker run --rm "$SERVICE_NAME:$TAG" python -c "import src.main; print('✅ Import test passed')"

# Cleanup build context
rm -rf .build

echo "✅ Build completed successfully!"
echo "   Image: $SERVICE_NAME:$TAG"
if [[ "$REGISTRY" != "your-registry.com" ]]; then
    echo "   Registry: $REGISTRY/$SERVICE_NAME:$TAG"
fi

# Show image info
echo ""
echo "📊 Image Information:"
docker images "$SERVICE_NAME:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
