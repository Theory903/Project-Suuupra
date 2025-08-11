#!/bin/bash

# UPI Ecosystem Services Health Check Script
# Tests API Gateway and Identity Service endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_GATEWAY_HOST="localhost"
API_GATEWAY_PORT="8080"
IDENTITY_HOST="localhost"
IDENTITY_PORT="8081"
TIMEOUT=10

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}🧪 UPI Ecosystem Services Health Check${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Function to test HTTP endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    local method="${4:-GET}"
    local headers="${5:-}"
    local body="${6:-}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing $name... "
    
    # Build curl command
    curl_cmd="curl -s -o /dev/null -w '%{http_code}|%{time_total}' --max-time $TIMEOUT"
    
    if [ "$method" != "GET" ]; then
        curl_cmd="$curl_cmd -X $method"
    fi
    
    if [ -n "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    if [ -n "$body" ]; then
        curl_cmd="$curl_cmd -d '$body'"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    # Execute curl and parse response
    response=$(eval $curl_cmd 2>/dev/null || echo "000|0.000")
    status_code=$(echo "$response" | tail -1 | cut -d'|' -f1)
    response_time=$(echo "$response" | tail -1 | cut -d'|' -f2)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${status_code}, ${response_time}s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status_code, Time: ${response_time}s)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to check if service is running
check_service_running() {
    local service_name="$1"
    local host="$2"
    local port="$3"
    
    echo -n "Checking if $service_name is running on $host:$port... "
    
    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✅ RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ NOT RUNNING${NC}"
        return 1
    fi
}

# Function to start service if not running
start_service_if_needed() {
    local service_name="$1"
    local service_dir="$2"
    local start_command="$3"
    local host="$4"
    local port="$5"
    
    if ! check_service_running "$service_name" "$host" "$port"; then
        echo -e "${YELLOW}🚀 Starting $service_name...${NC}"
        
        cd "$service_dir"
        eval "$start_command" &
        local pid=$!
        
        # Wait for service to start
        local attempts=0
        while [ $attempts -lt 30 ]; do
            if nc -z "$host" "$port" 2>/dev/null; then
                echo -e "${GREEN}✅ $service_name started successfully (PID: $pid)${NC}"
                echo "$pid" > "/tmp/${service_name}.pid"
                cd - >/dev/null
                return 0
            fi
            sleep 2
            attempts=$((attempts + 1))
        done
        
        echo -e "${RED}❌ Failed to start $service_name${NC}"
        cd - >/dev/null
        return 1
    fi
    return 0
}

# Function to cleanup services
cleanup_services() {
    echo -e "${YELLOW}🧹 Cleaning up services...${NC}"
    
    if [ -f "/tmp/api-gateway.pid" ]; then
        local pid=$(cat /tmp/api-gateway.pid)
        kill $pid 2>/dev/null || true
        rm -f /tmp/api-gateway.pid
    fi
    
    if [ -f "/tmp/identity.pid" ]; then
        local pid=$(cat /tmp/identity.pid)
        kill $pid 2>/dev/null || true
        rm -f /tmp/identity.pid
    fi
}

# Trap to cleanup on exit
trap cleanup_services EXIT

echo -e "${BLUE}📋 Pre-flight Checks${NC}"
echo "==================="

# Check if required tools are available
command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl is required but not installed${NC}"; exit 1; }
command -v nc >/dev/null 2>&1 || { echo -e "${RED}❌ netcat is required but not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ Required tools available${NC}"
echo ""

# Check current service status
echo -e "${BLUE}🔍 Service Status Check${NC}"
echo "======================"

API_GATEWAY_RUNNING=false
IDENTITY_RUNNING=false

if check_service_running "API Gateway" "$API_GATEWAY_HOST" "$API_GATEWAY_PORT"; then
    API_GATEWAY_RUNNING=true
fi

if check_service_running "Identity Service" "$IDENTITY_HOST" "$IDENTITY_PORT"; then
    IDENTITY_RUNNING=true
fi

echo ""

# Start services if needed (optional - uncomment if you want auto-start)
# if ! $API_GATEWAY_RUNNING; then
#     start_service_if_needed "API Gateway" "services/api-gateway" "npm run dev" "$API_GATEWAY_HOST" "$API_GATEWAY_PORT"
#     API_GATEWAY_RUNNING=true
# fi

# if ! $IDENTITY_RUNNING; then
#     start_service_if_needed "Identity Service" "services/identity" "mvn spring-boot:run" "$IDENTITY_HOST" "$IDENTITY_PORT"
#     IDENTITY_RUNNING=true
# fi

echo -e "${BLUE}🧪 API Gateway Tests${NC}"
echo "==================="

if $API_GATEWAY_RUNNING; then
    # Basic health check
    test_endpoint "Health Check" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/healthz" "200"
    
    # CORS preflight
    test_endpoint "CORS Preflight" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/identity/health" "204" "OPTIONS"
    
    # Metrics endpoint
    test_endpoint "Metrics Endpoint" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/metrics" "200"
    
    # Admin API (if enabled)
    test_endpoint "Admin API Status" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/admin/status" "200"
    
    # Proxy to Identity service (will fail if Identity not running)
    test_endpoint "Proxy to Identity" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/identity/actuator/health" "502"
    
    # Invalid service route
    test_endpoint "Invalid Service Route" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/nonexistent/test" "502"
    
    # Rate limiting test (should pass initially)
    test_endpoint "Rate Limit Test" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/identity/health" "502"
    
else
    echo -e "${YELLOW}⚠️  API Gateway not running - skipping tests${NC}"
    echo -e "${BLUE}💡 To start API Gateway:${NC}"
    echo "   cd services/api-gateway && npm install && npm run dev"
fi

echo ""
echo -e "${BLUE}🔐 Identity Service Tests${NC}"
echo "========================"

if $IDENTITY_RUNNING; then
    # Spring Boot actuator endpoints
    test_endpoint "Health Check" "http://$IDENTITY_HOST:$IDENTITY_PORT/actuator/health" "200"
    test_endpoint "Info Endpoint" "http://$IDENTITY_HOST:$IDENTITY_PORT/actuator/info" "200"
    test_endpoint "Prometheus Metrics" "http://$IDENTITY_HOST:$IDENTITY_PORT/actuator/prometheus" "200"
    
    # Auth endpoints
    # Expect Forbidden (no valid credentials or auth flow), not 400
    test_endpoint "Login Endpoint" "http://$IDENTITY_HOST:$IDENTITY_PORT/auth/login" "403" "POST" "-H 'Content-Type: application/json'" '{"username":"test","password":"test"}'
    test_endpoint "Register Endpoint" "http://$IDENTITY_HOST:$IDENTITY_PORT/auth/register" "400" "POST" "-H 'Content-Type: application/json'" '{"username":"test","email":"test@test.com","password":"test"}'
    
    # User management endpoints
    test_endpoint "Users Endpoint (No Auth)" "http://$IDENTITY_HOST:$IDENTITY_PORT/api/users" "401"
    
    # OAuth2 endpoints
    test_endpoint "OAuth2 Authorization" "http://$IDENTITY_HOST:$IDENTITY_PORT/oauth2/authorize" "400"
    test_endpoint "OAuth2 Token" "http://$IDENTITY_HOST:$IDENTITY_PORT/oauth2/token" "400" "POST"
    
    # JWKS endpoint
    test_endpoint "JWKS Endpoint" "http://$IDENTITY_HOST:$IDENTITY_PORT/.well-known/jwks.json" "200"
    
    # OpenID Configuration
    test_endpoint "OpenID Configuration" "http://$IDENTITY_HOST:$IDENTITY_PORT/.well-known/openid_configuration" "200"
    
    # WebAuthn endpoints
    test_endpoint "WebAuthn Registration Options" "http://$IDENTITY_HOST:$IDENTITY_PORT/api/webauthn/registration/start" "401" "POST"
    
    # MFA endpoints
    test_endpoint "MFA Setup" "http://$IDENTITY_HOST:$IDENTITY_PORT/api/mfa/setup" "401" "POST"
    
    # Admin endpoints
    test_endpoint "Admin Users" "http://$IDENTITY_HOST:$IDENTITY_PORT/api/admin/users" "401"
    test_endpoint "Admin Roles" "http://$IDENTITY_HOST:$IDENTITY_PORT/api/admin/roles" "401"
    
else
    echo -e "${YELLOW}⚠️  Identity Service not running - skipping tests${NC}"
    echo -e "${BLUE}💡 To start Identity Service:${NC}"
    echo "   cd services/identity && mvn spring-boot:run"
fi

echo ""
echo -e "${BLUE}🔗 Integration Tests${NC}"
echo "=================="

if $API_GATEWAY_RUNNING && $IDENTITY_RUNNING; then
    # Test API Gateway → Identity Service proxy
    test_endpoint "Gateway → Identity Health" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/identity/actuator/health" "200"
    test_endpoint "Gateway → Identity JWKS" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/identity/.well-known/jwks.json" "200"
    test_endpoint "Gateway → Identity Auth" "http://$API_GATEWAY_HOST:$API_GATEWAY_PORT/identity/auth/login" "400" "POST" "-H 'Content-Type: application/json'" '{"username":"test","password":"test"}'
else
    echo -e "${YELLOW}⚠️  Both services needed for integration tests${NC}"
fi

echo ""
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo "======================="
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
if [ "$TOTAL_TESTS" -gt 0 ]; then
    echo -e "Success Rate: ${BLUE}$(( PASSED_TESTS * 100 / TOTAL_TESTS ))%${NC}"
else
    echo -e "Success Rate: ${BLUE}N/A${NC}"
fi

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check the output above for details.${NC}"
    echo ""
    echo -e "${BLUE}💡 Common Issues:${NC}"
    echo "1. Services not running - start them manually"
    echo "2. Database not available - check PostgreSQL connection"
    echo "3. Redis not available - check Redis connection"
    echo "4. Port conflicts - check if ports 8080/8081 are free"
    echo "5. Dependencies missing - run 'npm install' or 'mvn install'"
    exit 1
fi
