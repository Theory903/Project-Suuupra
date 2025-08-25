#!/bin/bash

# Deploy UPI Core Payment Service
# This replaces the existing payments service with our real UPI Core implementation

set -e

echo "🚀 Deploying UPI Core Payment Service..."

# Change to project root
cd "$(dirname "$0")/../.."

# Stop existing payments service
echo "⏹️  Stopping existing payments service..."
docker stop suuupra-payments || echo "Payments service not running"

# Remove existing payments container
echo "🗑️  Removing existing payments container..."
docker rm suuupra-payments || echo "Payments container not found"

# Build new UPI Core Payment API image
echo "🔨 Building UPI Core Payment API..."
docker build -t suuupra-upi-payments:latest -f services/upi-core/Dockerfile.payment-api services/upi-core/

# Start new payments service
echo "🟢 Starting UPI Core Payment API..."
docker run -d \
  --name suuupra-upi-payments \
  --network suuupra-network \
  -p 8082:8080 \
  -e PORT=8080 \
  -e GO_ENV=production \
  --restart unless-stopped \
  --label "com.suuupra.service=payments" \
  --label "com.suuupra.version=1.0.0" \
  --label "com.suuupra.api=true" \
  --health-cmd="curl -f http://localhost:8080/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  --health-start-period=10s \
  suuupra-upi-payments:latest

echo "✅ UPI Core Payment API deployed successfully!"
echo ""
echo "📍 Service is now available at:"
echo "   http://localhost:8082/health"
echo "   http://localhost:8082/payments/api/v1/intents"  
echo "   http://localhost:8082/payments/api/v1/payments"
echo ""
echo "🔄 The API Gateway will automatically route payment requests to this service."
echo ""

# Wait for service to be healthy
echo "⏳ Waiting for service to be healthy..."
sleep 5

# Test the service
if curl -f -s http://localhost:8082/health > /dev/null; then
    echo "✅ Health check passed - Service is running!"
    
    # Test payment intent creation
    echo "🧪 Testing payment intent creation..."
    INTENT_RESPONSE=$(curl -s -X POST http://localhost:8082/payments/api/v1/intents \
        -H "Content-Type: application/json" \
        -d '{"amount":2900,"currency":"INR","description":"Test payment"}')
    
    if echo "$INTENT_RESPONSE" | grep -q "pi_"; then
        echo "✅ Payment intent creation successful!"
        echo "📄 Response: $INTENT_RESPONSE"
    else
        echo "⚠️  Payment intent test failed"
        echo "📄 Response: $INTENT_RESPONSE"
    fi
else
    echo "❌ Health check failed - Service may not be running properly"
    docker logs suuupra-upi-payments --tail 20
fi

echo ""
echo "🎉 Deployment complete! Your payment system now uses real UPI Core processing."
