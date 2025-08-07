#!/bin/bash

# API Gateway Load Testing Script
# Usage: ./run-load-tests.sh [profile] [scenario] [base-url]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TESTS_DIR="$PROJECT_ROOT/tests/load"
RESULTS_DIR="$PROJECT_ROOT/test-results/load"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
PROFILE=${1:-baseline}
SCENARIO=${2:-mixed}
BASE_URL=${3:-http://localhost:3000}
JWT_TOKEN=${JWT_TOKEN:-""}
API_KEY=${API_KEY:-""}

# Available profiles
PROFILES=("baseline" "stress" "spike" "soak" "ai_focused")
SCENARIOS=("mixed" "auth" "api" "ai" "streaming" "websocket" "rate_limit" "circuit_breaker")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
API Gateway Load Testing Script

Usage: $0 [profile] [scenario] [base-url]

Profiles:
  baseline    - Normal traffic patterns (default)
  stress      - Find breaking point
  spike       - Sudden traffic increases
  soak        - Extended duration test
  ai_focused  - AI endpoint focused test

Scenarios:
  mixed       - Mixed workload (default)
  auth        - Authentication focused
  api         - Standard API endpoints
  ai          - AI endpoints only
  streaming   - Server-sent events
  websocket   - WebSocket connections
  rate_limit  - Rate limiting behavior
  circuit_breaker - Circuit breaker behavior

Environment Variables:
  JWT_TOKEN   - JWT token for authentication
  API_KEY     - API key for authentication
  K6_OPTIONS  - Additional k6 options

Examples:
  $0                                    # Run baseline mixed test
  $0 stress api                         # Run stress test on API endpoints
  $0 baseline mixed http://staging.com  # Test against staging environment

EOF
}

# Validate inputs
validate_inputs() {
    if [[ "$1" == "-h" || "$1" == "--help" ]]; then
        show_help
        exit 0
    fi

    if [[ ! " ${PROFILES[@]} " =~ " ${PROFILE} " ]]; then
        log_error "Invalid profile: $PROFILE"
        log_info "Available profiles: ${PROFILES[*]}"
        exit 1
    fi

    if [[ ! " ${SCENARIOS[@]} " =~ " ${SCENARIO} " ]]; then
        log_error "Invalid scenario: $SCENARIO"
        log_info "Available scenarios: ${SCENARIOS[*]}"
        exit 1
    fi

    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed. Please install k6 first."
        log_info "Visit: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
}

# Setup test environment
setup_test_env() {
    log_info "Setting up test environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Create test-specific results directory
    TEST_RESULTS_DIR="$RESULTS_DIR/${PROFILE}_${SCENARIO}_${TIMESTAMP}"
    mkdir -p "$TEST_RESULTS_DIR"
    
    log_info "Test results will be saved to: $TEST_RESULTS_DIR"
}

# Health check
health_check() {
    log_info "Performing health check on $BASE_URL..."
    
    local health_endpoint="$BASE_URL/health"
    if curl -s --max-time 10 "$health_endpoint" > /dev/null; then
        log_success "Health check passed"
    else
        log_warning "Health check failed or endpoint not available"
        log_warning "Continuing with test anyway..."
    fi
}

# Pre-test validation
pre_test_validation() {
    log_info "Running pre-test validation..."
    
    # Test basic connectivity
    if ! curl -s --max-time 5 "$BASE_URL" > /dev/null; then
        log_error "Cannot connect to $BASE_URL"
        exit 1
    fi
    
    # Test authentication if tokens provided
    if [[ -n "$JWT_TOKEN" ]]; then
        log_info "Testing JWT authentication..."
        local auth_test=$(curl -s -w "%{http_code}" -o /dev/null \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$BASE_URL/api/v1/user/profile")
        
        if [[ "$auth_test" == "200" ]]; then
            log_success "JWT authentication test passed"
        elif [[ "$auth_test" == "401" ]]; then
            log_warning "JWT token appears to be invalid"
        else
            log_info "JWT test returned status: $auth_test"
        fi
    fi
    
    if [[ -n "$API_KEY" ]]; then
        log_info "Testing API key authentication..."
        local api_key_test=$(curl -s -w "%{http_code}" -o /dev/null \
            -H "X-API-Key: $API_KEY" \
            "$BASE_URL/api/v1/health")
        
        if [[ "$api_key_test" == "200" ]]; then
            log_success "API key authentication test passed"
        elif [[ "$api_key_test" == "401" ]]; then
            log_warning "API key appears to be invalid"
        else
            log_info "API key test returned status: $api_key_test"
        fi
    fi
}

# Run the load test
run_load_test() {
    log_info "Starting load test..."
    log_info "Profile: $PROFILE"
    log_info "Scenario: $SCENARIO"
    log_info "Target: $BASE_URL"
    
    local k6_cmd="k6 run"
    local k6_options=""
    
    # Add additional k6 options if provided
    if [[ -n "$K6_OPTIONS" ]]; then
        k6_options="$K6_OPTIONS"
    fi
    
    # Set environment variables for k6
    export PROFILE="$PROFILE"
    export SCENARIO="$SCENARIO"
    export BASE_URL="$BASE_URL"
    export JWT_TOKEN="$JWT_TOKEN"
    export API_KEY="$API_KEY"
    
    # Run k6 test
    local test_output="$TEST_RESULTS_DIR/test-output.log"
    local json_output="$TEST_RESULTS_DIR/results.json"
    local slo_output="$TEST_RESULTS_DIR/slo-report.json"
    
    log_info "Running k6 test (output logged to $test_output)..."
    
    if k6 run $k6_options \
        --out json="$json_output" \
        "$TESTS_DIR/k6-profiles.js" 2>&1 | tee "$test_output"; then
        log_success "Load test completed successfully"
    else
        log_error "Load test failed"
        return 1
    fi
    
    # Move SLO report if generated
    if [[ -f "slo-report.json" ]]; then
        mv "slo-report.json" "$slo_output"
    fi
    
    if [[ -f "load-test-summary.json" ]]; then
        mv "load-test-summary.json" "$TEST_RESULTS_DIR/summary.json"
    fi
}

# Analyze results
analyze_results() {
    log_info "Analyzing test results..."
    
    local slo_file="$TEST_RESULTS_DIR/slo-report.json"
    local summary_file="$TEST_RESULTS_DIR/summary.json"
    
    if [[ -f "$slo_file" ]]; then
        log_info "SLO Report:"
        
        # Extract key metrics using jq if available
        if command -v jq &> /dev/null; then
            local overall_compliance=$(jq -r '.overallCompliance' "$slo_file")
            local passed=$(jq -r '.passed' "$slo_file")
            
            echo "  Overall SLO Compliance: ${overall_compliance}%"
            
            if [[ "$passed" == "true" ]]; then
                log_success "All SLOs passed ✅"
            else
                log_warning "Some SLOs failed ❌"
                
                # Show failed SLOs
                jq -r '.slos | to_entries[] | select(.value.passed == false) | "  ❌ \(.key): \(.value.actual) (target: \(.value.target))"' "$slo_file"
                
                # Show recommendations
                echo ""
                log_info "Recommendations:"
                jq -r '.recommendations[]? | "  - [\(.severity | ascii_upcase)] \(.message)"' "$slo_file"
            fi
        else
            log_info "Install jq for detailed SLO analysis"
            cat "$slo_file"
        fi
    fi
    
    # Generate simple HTML report
    generate_html_report
}

# Generate HTML report
generate_html_report() {
    local html_file="$TEST_RESULTS_DIR/report.html"
    
    cat > "$html_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Load Test Report - $PROFILE/$SCENARIO</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
        .passed { border-color: #4CAF50; background: #f9fff9; }
        .failed { border-color: #f44336; background: #fff9f9; }
        .warning { border-color: #ff9800; background: #fffaf0; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Load Test Report</h1>
        <p><strong>Profile:</strong> $PROFILE</p>
        <p><strong>Scenario:</strong> $SCENARIO</p>
        <p><strong>Target:</strong> $BASE_URL</p>
        <p class="timestamp"><strong>Timestamp:</strong> $TIMESTAMP</p>
    </div>
    
    <h2>Test Configuration</h2>
    <ul>
        <li>Profile: $PROFILE</li>
        <li>Scenario: $SCENARIO</li>
        <li>Base URL: $BASE_URL</li>
        <li>Authentication: $([ -n "$JWT_TOKEN" ] && echo "JWT Token" || [ -n "$API_KEY" ] && echo "API Key" || echo "None")</li>
    </ul>
EOF

    # Add SLO results if available
    if [[ -f "$TEST_RESULTS_DIR/slo-report.json" ]] && command -v jq &> /dev/null; then
        cat >> "$html_file" << EOF
    
    <h2>SLO Results</h2>
    <div id="slo-results">
EOF
        
        # Add SLO metrics
        jq -r '.slos | to_entries[] | "<div class=\"metric \(if .value.passed then "passed" else "failed" end)\"><h4>\(.key | ascii_upcase)</h4><p>Target: \(.value.target)</p><p>Actual: \(.value.actual)</p><p>Status: \(if .value.passed then "✅ PASSED" else "❌ FAILED" end)</p></div>"' "$TEST_RESULTS_DIR/slo-report.json" >> "$html_file"
        
        cat >> "$html_file" << EOF
    </div>
    
    <h2>Recommendations</h2>
    <ul>
EOF
        
        jq -r '.recommendations[]? | "<li><strong>[\(.severity | ascii_upcase)]</strong> \(.message)</li>"' "$TEST_RESULTS_DIR/slo-report.json" >> "$html_file"
        
        cat >> "$html_file" << EOF
    </ul>
EOF
    fi
    
    cat >> "$html_file" << EOF
    
    <h2>Raw Results</h2>
    <p>Detailed results are available in the following files:</p>
    <ul>
        <li><a href="test-output.log">Test Output Log</a></li>
        <li><a href="results.json">Raw JSON Results</a></li>
        <li><a href="slo-report.json">SLO Report</a></li>
        <li><a href="summary.json">Test Summary</a></li>
    </ul>
    
    <p><em>Generated at $(date)</em></p>
</body>
</html>
EOF
    
    log_success "HTML report generated: $html_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Remove any temporary files
    rm -f slo-report.json load-test-summary.json 2>/dev/null || true
    
    # Archive old test results (keep last 10)
    if [[ -d "$RESULTS_DIR" ]]; then
        local old_results=($(ls -1t "$RESULTS_DIR" | tail -n +11))
        for result in "${old_results[@]}"; do
            if [[ -d "$RESULTS_DIR/$result" ]]; then
                log_info "Archiving old result: $result"
                tar -czf "$RESULTS_DIR/${result}.tar.gz" -C "$RESULTS_DIR" "$result"
                rm -rf "$RESULTS_DIR/$result"
            fi
        done
    fi
}

# Main execution
main() {
    log_info "API Gateway Load Testing Script"
    log_info "=============================="
    
    validate_inputs "$@"
    setup_test_env
    health_check
    pre_test_validation
    
    if run_load_test; then
        analyze_results
        log_success "Load test completed successfully!"
        log_info "Results available at: $TEST_RESULTS_DIR"
        
        # Open HTML report if on macOS/Linux with GUI
        if [[ "$OSTYPE" == "darwin"* ]] && command -v open &> /dev/null; then
            open "$TEST_RESULTS_DIR/report.html"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$TEST_RESULTS_DIR/report.html"
        fi
    else
        log_error "Load test failed!"
        exit 1
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"
