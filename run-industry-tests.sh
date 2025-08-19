#!/bin/bash

# 🏭 INDUSTRY-GRADE API TESTING SUITE
# Comprehensive testing using multiple industry-standard tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
POSTMAN_DIR="postman"
REPORTS_DIR="reports/industry"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CURRENT_REPORT_DIR="${REPORTS_DIR}/test_${TIMESTAMP}"

# Test files
ARTILLERY_FILE="tests/artillery/full-suite.yml"
K6_FILE="tests/k6/full-suite.js"
VEGETA_TARGETS="tests/vegeta/targets.txt"
WRK_SCRIPT="tests/wrk/test-script.lua"

# Create reports directory
mkdir -p "$CURRENT_REPORT_DIR"

echo -e "${BOLD}${PURPLE}🏭 INDUSTRY-GRADE API TESTING SUITE${NC}"
echo -e "${CYAN}====================================${NC}"
echo -e "${YELLOW}🎯 Testing all services with professional-grade tools${NC}"
echo ""
echo -e "${BLUE}📊 Test Configuration:${NC}"
echo -e "   🗂️  Reports Directory: ${CURRENT_REPORT_DIR}"
echo -e "   🎯 Target: http://localhost:8080"
echo -e "   🔧 Tools: Newman, Artillery, k6, Vegeta, wrk"
echo -e "   📈 Test Types: Functional, Load, Performance, Stress"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run test with error handling
run_test() {
    local test_name="$1"
    local test_command="$2"
    local output_file="$3"
    
    echo -e "${BLUE}🧪 Running ${test_name}...${NC}"
    
    if eval "$test_command" > "$output_file" 2>&1; then
        echo -e "${GREEN}✅ ${test_name} completed successfully${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  ${test_name} completed with issues (check logs)${NC}"
        return 1
    fi
}

echo -e "${BOLD}${CYAN}🚀 STARTING COMPREHENSIVE TEST SUITE${NC}"
echo ""

# 1. FUNCTIONAL TESTING (Newman/Postman)
echo -e "${BOLD}${BLUE}1️⃣  FUNCTIONAL TESTING (Newman/Postman)${NC}"
echo -e "${CYAN}----------------------------------------${NC}"

if command_exists npx; then
    cd "$POSTMAN_DIR"
    run_test "Newman Functional Tests" \
        "npx newman run Suuupra-EdTech-Platform.postman_collection.json -e environments/Local-Development.postman_environment.json --reporters cli,json --reporter-json-export '../${CURRENT_REPORT_DIR}/newman-functional.json'" \
        "../${CURRENT_REPORT_DIR}/newman-functional.log"
    cd ..
else
    echo -e "${YELLOW}⚠️  Newman not available (npx required). Skipping functional tests.${NC}"
fi

echo ""

# 2. LOAD TESTING (Artillery)
echo -e "${BOLD}${BLUE}2️⃣  LOAD TESTING (Artillery)${NC}"
echo -e "${CYAN}-----------------------------${NC}"

if command_exists npx; then
    run_test "Artillery Load Tests" \
        "npx artillery@latest run '$ARTILLERY_FILE' --output '${CURRENT_REPORT_DIR}/artillery-results.json'" \
        "${CURRENT_REPORT_DIR}/artillery.log"
    
    # Generate Artillery HTML report if possible
    if [ -f "${CURRENT_REPORT_DIR}/artillery-results.json" ]; then
        npx artillery@latest report "${CURRENT_REPORT_DIR}/artillery-results.json" --output "${CURRENT_REPORT_DIR}/artillery-report.html" 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}⚠️  Artillery not available (npx required). Skipping load tests.${NC}"
fi

echo ""

# 3. PERFORMANCE TESTING (k6)
echo -e "${BOLD}${BLUE}3️⃣  PERFORMANCE TESTING (k6)${NC}"
echo -e "${CYAN}-----------------------------${NC}"

if command_exists k6; then
    run_test "k6 Performance Tests" \
        "k6 run '$K6_FILE' --summary-export='${CURRENT_REPORT_DIR}/k6-summary.json' --out json='${CURRENT_REPORT_DIR}/k6-results.json'" \
        "${CURRENT_REPORT_DIR}/k6.log"
else
    echo -e "${YELLOW}⚠️  k6 not installed. Install with: brew install k6${NC}"
fi

echo ""

# 4. HTTP BENCHMARKING (Vegeta)
echo -e "${BOLD}${BLUE}4️⃣  HTTP BENCHMARKING (Vegeta)${NC}"
echo -e "${CYAN}-------------------------------${NC}"

if command_exists vegeta; then
    echo -e "${BLUE}   Running Vegeta attack for 60 seconds at 100 RPS...${NC}"
    run_test "Vegeta HTTP Benchmark" \
        "vegeta attack -targets='$VEGETA_TARGETS' -rate=100 -duration=60s | vegeta report -type=json > '${CURRENT_REPORT_DIR}/vegeta-results.json'" \
        "${CURRENT_REPORT_DIR}/vegeta.log"
    
    # Generate Vegeta text report
    if [ -f "${CURRENT_REPORT_DIR}/vegeta-results.json" ]; then
        vegeta report < "${CURRENT_REPORT_DIR}/vegeta-results.json" > "${CURRENT_REPORT_DIR}/vegeta-report.txt" 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}⚠️  Vegeta not installed. Install with: brew install vegeta${NC}"
fi

echo ""

# 5. HTTP LOAD TESTING (wrk)
echo -e "${BOLD}${BLUE}5️⃣  HTTP LOAD TESTING (wrk)${NC}"
echo -e "${CYAN}---------------------------${NC}"

if command_exists wrk; then
    echo -e "${BLUE}   Running wrk for 60 seconds with 100 connections...${NC}"
    run_test "wrk HTTP Load Test" \
        "wrk -t12 -c100 -d60s -s '$WRK_SCRIPT' http://localhost:8080/healthz" \
        "${CURRENT_REPORT_DIR}/wrk-results.txt"
else
    echo -e "${YELLOW}⚠️  wrk not installed. Install with: brew install wrk${NC}"
fi

echo ""

# 6. CUSTOM NODE.JS LOAD TEST
echo -e "${BOLD}${BLUE}6️⃣  CUSTOM CONCURRENT LOAD TEST${NC}"
echo -e "${CYAN}--------------------------------${NC}"

if [ -f "real-load-generator.js" ]; then
    echo -e "${BLUE}   Running custom Node.js load generator...${NC}"
    run_test "Custom Load Generator" \
        "timeout 120s node real-load-generator.js" \
        "${CURRENT_REPORT_DIR}/custom-load-results.txt"
else
    echo -e "${YELLOW}⚠️  Custom load generator not found. Skipping.${NC}"
fi

echo ""

# GENERATE COMPREHENSIVE REPORT
echo -e "${BOLD}${PURPLE}📊 GENERATING COMPREHENSIVE REPORT${NC}"
echo -e "${CYAN}===================================${NC}"

cat > "${CURRENT_REPORT_DIR}/INDUSTRY-TEST-SUMMARY.md" << EOF
# 🏭 Industry-Grade API Testing Report

**Test Date**: $(date)  
**Test Duration**: Comprehensive multi-tool testing suite  
**Target System**: Suuupra EdTech Platform (http://localhost:8080)

## 🎯 Test Overview

This comprehensive test suite validates the Suuupra EdTech Platform using industry-standard testing tools:

### 🔧 Testing Tools Used
- **Newman/Postman**: Functional API testing
- **Artillery**: Load testing with realistic traffic patterns
- **k6**: Performance testing with advanced scenarios
- **Vegeta**: HTTP benchmarking and attack testing
- **wrk**: High-performance HTTP load testing
- **Custom Node.js**: Concurrent connection testing

### 📊 Services Tested
- API Gateway (Port 8080)
- Identity Service (Port 8081)
- Payment System (Port 8082)
- Commerce Platform (Port 8083)
- Content Delivery (Port 8089)
- Banking Simulator (Port 8088)
- UPI Core (Port 8087)
- Analytics Engine (Port 8097)
- Notifications (Port 8085)
- Admin Dashboard (Port 8100)
- Live Classes (Port 8090)
- LLM Tutor (Port 8096)
- Recommendations (Port 8095)

## 📈 Test Results

### Functional Testing (Newman)
$([ -f "${CURRENT_REPORT_DIR}/newman-functional.json" ] && echo "✅ Completed - See newman-functional.json" || echo "⚠️ Not completed")

### Load Testing (Artillery)
$([ -f "${CURRENT_REPORT_DIR}/artillery-results.json" ] && echo "✅ Completed - See artillery-results.json and artillery-report.html" || echo "⚠️ Not completed")

### Performance Testing (k6)
$([ -f "${CURRENT_REPORT_DIR}/k6-summary.json" ] && echo "✅ Completed - See k6-summary.json and k6-results.json" || echo "⚠️ Not completed")

### HTTP Benchmarking (Vegeta)
$([ -f "${CURRENT_REPORT_DIR}/vegeta-results.json" ] && echo "✅ Completed - See vegeta-results.json and vegeta-report.txt" || echo "⚠️ Not completed")

### HTTP Load Testing (wrk)
$([ -f "${CURRENT_REPORT_DIR}/wrk-results.txt" ] && echo "✅ Completed - See wrk-results.txt" || echo "⚠️ Not completed")

### Custom Load Testing
$([ -f "${CURRENT_REPORT_DIR}/custom-load-results.txt" ] && echo "✅ Completed - See custom-load-results.txt" || echo "⚠️ Not completed")

## 📁 Report Files

All detailed results are available in: \`${CURRENT_REPORT_DIR}/\`

### Key Files:
- \`newman-functional.json\` - Functional test results
- \`artillery-report.html\` - Interactive load test report
- \`k6-summary.json\` - Performance test summary
- \`vegeta-report.txt\` - HTTP benchmark results
- \`wrk-results.txt\` - Load test results
- \`*.log\` - Detailed execution logs

## 🎯 Next Steps

1. Review individual tool reports for detailed metrics
2. Analyze performance bottlenecks identified
3. Optimize services based on test findings
4. Re-run tests after optimizations
5. Set up continuous performance monitoring

---

*Generated by Industry-Grade API Testing Suite*  
*Timestamp: $(date)*
EOF

echo -e "${GREEN}✅ Comprehensive report generated: ${CURRENT_REPORT_DIR}/INDUSTRY-TEST-SUMMARY.md${NC}"

echo ""
echo -e "${BOLD}${GREEN}🎉 INDUSTRY-GRADE TESTING SUITE COMPLETED!${NC}"
echo -e "${CYAN}===========================================${NC}"
echo ""
echo -e "${BLUE}📊 Results Summary:${NC}"
echo -e "   📁 Reports Directory: ${CURRENT_REPORT_DIR}"
echo -e "   📋 Summary Report: INDUSTRY-TEST-SUMMARY.md"
echo -e "   🌐 HTML Reports: artillery-report.html (if available)"
echo ""
echo -e "${PURPLE}💡 Next Steps:${NC}"
echo -e "   1. Review detailed reports in: ${CURRENT_REPORT_DIR}/"
echo -e "   2. Open HTML reports in browser for interactive analysis"
echo -e "   3. Analyze performance metrics and bottlenecks"
echo -e "   4. Optimize services based on findings"
echo ""
echo -e "${BOLD}${CYAN}🏆 Professional-grade testing complete!${NC}"
