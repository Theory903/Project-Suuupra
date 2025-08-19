#!/bin/bash

# 🚀 Suuupra EdTech Platform - API Test Runner
# Production-grade API testing script for all microservices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
echo -e "${PURPLE}🚀 Suuupra EdTech Platform - API Testing Suite${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""

# Check if Newman is installed
if ! command -v newman &> /dev/null; then
    echo -e "${YELLOW}⚠️  Newman not found. Installing...${NC}"
    npm install -g newman newman-reporter-html
fi

# Navigate to postman directory
cd postman/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Create reports directory
mkdir -p reports

# Function to run tests
run_test() {
    local test_name=$1
    local collection=$2
    local folder=$3
    
    echo -e "${BLUE}🧪 Running ${test_name}...${NC}"
    
    if [ -n "$folder" ]; then
        newman run "$collection" \
            -e environments/Local-Development.postman_environment.json \
            --folder "$folder" \
            --reporter-html \
            --reporter-html-export "reports/$(echo ${test_name} | tr '[:upper:]' '[:lower:]')-report.html" \
            --timeout 15000 \
            --delay-request 100
    else
        newman run "$collection" \
            -e environments/Local-Development.postman_environment.json \
            --reporter-html \
            --reporter-html-export "reports/$(echo ${test_name} | tr '[:upper:]' '[:lower:]')-report.html" \
            --timeout 15000 \
            --delay-request 100
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${test_name} completed successfully${NC}"
    else
        echo -e "${RED}❌ ${test_name} failed${NC}"
    fi
    echo ""
}

# Parse command line arguments
case "${1:-all}" in
    "health")
        echo -e "${CYAN}🏥 Running Health Checks Only${NC}"
        run_test "Health-Checks" "Simple-API-Tests.postman_collection.json"
        ;;
    "auth")
        echo -e "${CYAN}🔐 Running Authentication Tests${NC}"
        run_test "Authentication" "Production-API-Tests.postman_collection.json" "2. Authentication Flow"
        ;;
    "payments")
        echo -e "${CYAN}💳 Running Payment Tests${NC}"
        run_test "Payments" "Production-API-Tests.postman_collection.json" "3. Banking & Payments"
        ;;
    "upi")
        echo -e "${CYAN}🔄 Running UPI Tests${NC}"
        run_test "UPI" "Production-API-Tests.postman_collection.json" "4. UPI Operations"
        ;;
    "content")
        echo -e "${CYAN}📚 Running Content Tests${NC}"
        run_test "Content" "Production-API-Tests.postman_collection.json" "5. Content Management"
        ;;
    "analytics")
        echo -e "${CYAN}📊 Running Analytics Tests${NC}"
        run_test "Analytics" "Production-API-Tests.postman_collection.json" "6. Analytics & Tracking"
        ;;
    "notifications")
        echo -e "${CYAN}🔔 Running Notification Tests${NC}"
        run_test "Notifications" "Production-API-Tests.postman_collection.json" "7. Notifications"
        ;;
    "performance")
        echo -e "${CYAN}⚡ Running Performance Tests${NC}"
        run_test "Performance" "Production-API-Tests.postman_collection.json" "8. Performance & Load Testing"
        ;;
    "production")
        echo -e "${CYAN}🏭 Running Full Production Test Suite${NC}"
        run_test "Production-Full" "Production-API-Tests.postman_collection.json"
        ;;
    "all"|*)
        echo -e "${CYAN}🎯 Running Complete Test Suite${NC}"
        echo ""
        
        # Run health checks first
        run_test "Health-Checks" "Simple-API-Tests.postman_collection.json"
        
        # Run production tests
        run_test "Production-Tests" "Production-API-Tests.postman_collection.json"
        ;;
esac

# Generate summary
echo -e "${PURPLE}📊 Test Execution Summary${NC}"
echo -e "${CYAN}=========================${NC}"
echo -e "${GREEN}✅ All tests completed${NC}"
echo -e "${BLUE}📁 Reports available in: ./postman/reports/${NC}"
echo -e "${YELLOW}🌐 Open HTML reports in browser to view detailed results${NC}"
echo ""

# List generated reports
echo -e "${CYAN}📋 Generated Reports:${NC}"
ls -la reports/*.html 2>/dev/null | awk '{print "   📄 " $9}' || echo "   No HTML reports found"

echo ""
echo -e "${GREEN}🎉 API Testing Complete!${NC}"
echo -e "${BLUE}🚀 Suuupra EdTech Platform is ready for production${NC}"
