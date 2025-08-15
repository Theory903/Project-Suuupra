#!/bin/bash

# Generate protobuf code for Payment Gateway service
set -e

echo "🔧 Generating protobuf code..."

# Check if protoc is installed
if ! command -v protoc &> /dev/null; then
    echo "❌ protoc is not installed. Please install it first:"
    echo "   brew install protobuf  # on macOS"
    echo "   apt-get install protobuf-compiler  # on Ubuntu"
    exit 1
fi

# Check if protoc-gen-go is installed
if ! command -v protoc-gen-go &> /dev/null; then
    echo "🔧 Installing protoc-gen-go..."
    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
fi

# Check if protoc-gen-go-grpc is installed
if ! command -v protoc-gen-go-grpc &> /dev/null; then
    echo "🔧 Installing protoc-gen-go-grpc..."
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
fi

# Create output directory
mkdir -p proto/

# Generate Go code from protobuf
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/upi_core.proto

echo "✅ Protobuf code generated successfully!"

# Verify generated files
if [ -f "proto/upi_core.pb.go" ] && [ -f "proto/upi_core_grpc.pb.go" ]; then
    echo "✅ Generated files:"
    echo "   - proto/upi_core.pb.go"
    echo "   - proto/upi_core_grpc.pb.go"
else
    echo "❌ Failed to generate protobuf files"
    exit 1
fi