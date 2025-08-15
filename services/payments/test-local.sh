#!/bin/bash

# Test script for Payment Gateway service
set -e

echo "🧪 Testing Payment Gateway Service Locally"

# Configuration
SERVICE_URL="http://localhost:8084"
DATABASE_URL="postgres://postgres:postgres@localhost:5433/payments?sslmode=disable"
REDIS_URL="redis://localhost:6380/0"

# Set environment variables
export DATABASE_URL="$DATABASE_URL"
export REDIS_URL="$REDIS_URL"
export UPI_CORE_GRPC="localhost:50051"
export JWT_SECRET="dev-jwt-secret-key-for-testing"
export HMAC_SIGNING_SECRET="dev-hmac-secret-for-testing"
export FIELD_ENCRYPTION_KEY="dev-32-character-encryption-key!!"
export WEBHOOK_SIGNING_SECRET="dev-webhook-secret-for-testing"
export LOG_LEVEL="debug"
export ENVIRONMENT="development"

echo "✅ Environment configured"
echo "   Database: $DATABASE_URL"
echo "   Redis: $REDIS_URL"

# Test database connectivity
echo "📡 Testing database connectivity..."
if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Test Redis connectivity
echo "📡 Testing Redis connectivity..."
if redis-cli -h localhost -p 6380 ping > /dev/null 2>&1; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
    exit 1
fi

# Start the service in background (if not already running)
echo "🚀 Starting Payment Gateway service..."
if pgrep -f "./payments-service" > /dev/null; then
    echo "🔄 Service already running, killing existing process..."
    pkill -f "./payments-service" || true
    sleep 2
fi

# Start the service
./payments-service &
SERVICE_PID=$!

# Wait for service to start
echo "⏳ Waiting for service to start..."
for i in {1..30}; do
    if curl -s "${SERVICE_URL}/health" > /dev/null 2>&1; then
        echo "✅ Service started successfully!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Service failed to start within 30 seconds"
        kill $SERVICE_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Test health endpoint
echo "🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "${SERVICE_URL}/health")
echo "Health Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    kill $SERVICE_PID 2>/dev/null || true
    exit 1
fi

# Test ready endpoint
echo "🏗️  Testing ready endpoint..."
READY_RESPONSE=$(curl -s "${SERVICE_URL}/ready")
echo "Ready Response: $READY_RESPONSE"

# Test metrics endpoint
echo "📊 Testing metrics endpoint..."
METRICS_RESPONSE=$(curl -s "${SERVICE_URL}/metrics" | head -10)
echo "Metrics Response (first 10 lines):"
echo "$METRICS_RESPONSE"

echo ""
echo "🎉 All basic tests passed!"
echo "🔧 Service is running at: $SERVICE_URL"
echo "📊 Metrics available at: ${SERVICE_URL}/metrics"
echo "🏥 Health check at: ${SERVICE_URL}/health"
echo ""
echo "🛑 To stop the service, run: kill $SERVICE_PID"
echo "💡 Service PID: $SERVICE_PID"

# Keep the service running
wait $SERVICE_PID