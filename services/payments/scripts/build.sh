#!/bin/bash

# Build script for Payment Gateway service

set -e

echo "<×  Building Payment Gateway service..."

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "L Go is not installed. Please install Go 1.21 or later."
    exit 1
fi

# Check Go version
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
REQUIRED_VERSION="1.21"

if ! printf '%s\n%s\n' "$REQUIRED_VERSION" "$GO_VERSION" | sort -V -C; then
    echo "L Go version $GO_VERSION is not supported. Please upgrade to Go $REQUIRED_VERSION or later."
    exit 1
fi

echo " Go version: $GO_VERSION"

# Clean previous builds
echo ">ù Cleaning previous builds..."
rm -f payments
rm -rf dist/

# Download dependencies
echo "=æ Downloading dependencies..."
go mod download
go mod tidy

# Run tests
echo ">ê Running tests..."
go test ./... -v

# Build for current platform
echo "=( Building for current platform..."
CGO_ENABLED=0 go build -a -installsuffix cgo -o payments ./cmd/main.go

# Build for multiple platforms
echo "< Building for multiple platforms..."
mkdir -p dist/

# Linux AMD64
echo "  Building for linux/amd64..."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -a -installsuffix cgo -o dist/payments-linux-amd64 ./cmd/main.go

# Linux ARM64
echo "  Building for linux/arm64..."
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -a -installsuffix cgo -o dist/payments-linux-arm64 ./cmd/main.go

# macOS AMD64
echo "  Building for darwin/amd64..."
GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -a -installsuffix cgo -o dist/payments-darwin-amd64 ./cmd/main.go

# macOS ARM64 (Apple Silicon)
echo "  Building for darwin/arm64..."
GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -a -installsuffix cgo -o dist/payments-darwin-arm64 ./cmd/main.go

# Windows AMD64
echo "  Building for windows/amd64..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -a -installsuffix cgo -o dist/payments-windows-amd64.exe ./cmd/main.go

echo " Build completed successfully!"
echo "=Á Binaries available in:"
echo "  - ./payments (current platform)"
echo "  - ./dist/ (multiple platforms)"

# Show binary info
echo ""
echo "=Ê Binary information:"
ls -lh payments dist/ 2>/dev/null || true