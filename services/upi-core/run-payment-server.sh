#!/bin/bash

# Simple UPI Core Payment Server Runner
# This runs a simplified payment API server that matches frontend expectations

set -e

echo "🚀 Starting UPI Core Payment Server..."

# Set environment variables
export PORT=8080
export GO_ENV=development

# Change to service directory
cd "$(dirname "$0")"

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+ to run the server."
    exit 1
fi

# Run the simple payment server
echo "📍 Payment API will be available at:"
echo "   http://localhost:8080/health"
echo "   http://localhost:8080/payments/api/v1/intents"
echo "   http://localhost:8080/payments/api/v1/payments"
echo ""
echo "🔄 Starting server..."

go run simple-payment-server.go
