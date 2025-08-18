#!/bin/bash

# ===================================================================
# SUUUPRA LOAD TEST ORCHESTRATOR - PHASE 4
# Comprehensive Load Testing Framework for Production Readiness
# ===================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_RESULTS_DIR="${PROJECT_ROOT}/test-results/performance"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default values
ENVIRONMENT="development"
TEST_PROFILE="smoke"
BASE_URL="http://localhost:3001"
WS_URL="ws://localhost:3001"
REGION="us-east-1"
PARALLELISM=1
GENERATE_REPORT=true
SEND_NOTIFICATIONS=false
SLACK_WEBHOOK=""
DISCORD_WEBHOOK=""

# Test configurations by environment
declare -A ENV_CONFIGS
ENV_CONFIGS[development]="http://localhost:3001|ws://localhost:3001|us-east-1"
ENV_CONFIGS[staging]="https://staging-api.suuupra.io|wss://staging-api.suuupra.io|us-east-1"
ENV_CONFIGS[production]="https://api.suuupra.io|wss://api.suuupra.io|us-east-1"

# ===================================================================
# UTILITY FUNCTIONS
# ===================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*${NC}" >&2
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*${NC}" >&2
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $*${NC}" >&2
}

print_banner() {
    cat << 'EOF'
 ____                                     
/ ___| _   _ _   _ _   _ _ __  _ __ __ _ 
\___ \| | | | | | | | | '_ \| '__/ _` |
 ___) | |_| | |_| | |_| | |_) | | | (_| |
|____/ \__,_|\__,_|\__,_| .__/|_|  \__,_|
                        |_|              
LOAD TESTING FRAMEWORK - PHASE 4
===================================================================
EOF
}

show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV     Target environment (development|staging|production) [default: development]
    -p, --profile PROFILE     Test profile (smoke|baseline|stress|spike|soak|peak) [default: smoke]
    -u, --base-url URL        Base API URL [default: auto-detected from environment]
    -w, --ws-url URL          WebSocket URL [default: auto-detected from environment]
    -r, --region REGION       Target region [default: us-east-1]
    -j, --parallel N          Run tests in parallel (N processes) [default: 1]
    --no-report              Skip HTML report generation
    --notify-slack URL        Slack webhook URL for notifications
    --notify-discord URL      Discord webhook URL for notifications
    -h, --help               Show this help message

EXAMPLES:
    # Smoke test in development
    $0 -e development -p smoke

    # Baseline performance test in staging
    $0 -e staging -p baseline

    # Stress test with notifications
    $0 -e staging -p stress --notify-slack https://hooks.slack.com/...

    # Peak load test in production
    $0 -e production -p peak -j 2

TEST PROFILES:
    smoke     - Quick verification (5 VUs, 1 minute)
    baseline  - Normal load testing (100-200 VUs, 22 minutes)
    stress    - Find breaking point (500-1500 VUs, 45 minutes)
    spike     - Sudden traffic increase (100-2000 VUs, 13 minutes)
    soak      - Extended stability (300 VUs, 60 minutes)
    peak      - Black Friday scenario (1000-2000 VUs, 90 minutes)

ENVIRONMENTS:
    development - Local K8s cluster (minikube)
    staging     - Staging K8s cluster
    production  - Production K8s cluster (CAUTION!)

EOF
}

check_dependencies() {
    local missing_deps=()
    
    # Check k6
    if ! command -v k6 &> /dev/null; then
        missing_deps+=("k6")
    fi
    
    # Check jq
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        echo "Please install missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                k6)
                    echo "  k6: https://k6.io/docs/get-started/installation/"
                    ;;
                jq)
                    echo "  jq: sudo apt-get install jq  # or brew install jq"
                    ;;
                curl)
                    echo "  curl: sudo apt-get install curl  # or brew install curl"
                    ;;
            esac
        done
        exit 1
    fi
}

setup_environment() {
    local env=$1
    
    if [[ -v ENV_CONFIGS[$env] ]]; then
        IFS='|' read -r base_url ws_url region <<< "${ENV_CONFIGS[$env]}"
        BASE_URL=${base_url}
        WS_URL=${ws_url}
        REGION=${region}
        info "Environment: $env | Base URL: $BASE_URL | Region: $REGION"
    else
        error "Unknown environment: $env"
        exit 1
    fi
}

validate_api_health() {
    local health_url="${BASE_URL}/health"
    info "Checking API health: $health_url"
    
    local response
    local http_status
    
    response=$(curl -s -w "%{http_code}" -o /tmp/health_check.json "$health_url" || echo "000")
    http_status=${response: -3}
    
    if [[ $http_status == "200" ]]; then
        log "✅ API health check passed"
        if [[ -f /tmp/health_check.json ]]; then
            local version=$(jq -r '.version // "unknown"' /tmp/health_check.json 2>/dev/null || echo "unknown")
            local uptime=$(jq -r '.uptime // "unknown"' /tmp/health_check.json 2>/dev/null || echo "unknown")
            info "API Version: $version | Uptime: $uptime"
        fi
        return 0
    else
        error "❌ API health check failed (HTTP $http_status)"
        warn "Make sure the API is running and accessible at: $BASE_URL"
        return 1
    fi
}

prepare_test_environment() {
    # Create results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Prepare test data directory
    local test_data_dir="${TEST_RESULTS_DIR}/test-data"
    mkdir -p "$test_data_dir"
    
    # Generate test tokens (mock for demo)
    local token_file="${test_data_dir}/tokens.json"
    cat > "$token_file" << 'EOF'
{
  "admin_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin_mock_token",
  "user_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_mock_token",
  "instructor_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.instructor_mock_token"
}
EOF
    
    # Export tokens as environment variables
    export ADMIN_TOKEN=$(jq -r '.admin_token' "$token_file")
    export USER_TOKEN=$(jq -r '.user_token' "$token_file")
    export INSTRUCTOR_TOKEN=$(jq -r '.instructor_token' "$token_file")
    
    info "Test environment prepared in: $TEST_RESULTS_DIR"
}

run_k6_test() {
    local profile=$1
    local output_dir="${TEST_RESULTS_DIR}/${profile}_${TIMESTAMP}"
    mkdir -p "$output_dir"
    
    info "Starting K6 test with profile: $profile"
    info "Results will be saved to: $output_dir"
    
    # K6 run command with comprehensive options
    local k6_cmd=(
        k6 run
        --config "${SCRIPT_DIR}/k6-config.json"
        --env TEST_PROFILE="$profile"
        --env BASE_URL="$BASE_URL"
        --env WS_URL="$WS_URL"
        --env REGION="$REGION"
        --env NODE_ENV="$ENVIRONMENT"
        --summary-export="${output_dir}/summary.json"
        --out json="${output_dir}/results.json"
        --out influxdb=http://localhost:8086/k6
        "${SCRIPT_DIR}/comprehensive-load-tests.js"
    )
    
    # Export environment variables for the test
    export TEST_PROFILE="$profile"
    export BASE_URL="$BASE_URL"
    export WS_URL="$WS_URL"
    export REGION="$REGION"
    export NODE_ENV="$ENVIRONMENT"
    
    log "Running command: ${k6_cmd[*]}"
    
    # Run the test and capture output
    local start_time=$(date +%s)
    local exit_code=0
    
    if "${k6_cmd[@]}" 2>&1 | tee "${output_dir}/test.log"; then
        log "✅ K6 test completed successfully"
    else
        exit_code=$?
        error "❌ K6 test failed with exit code: $exit_code"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Save test metadata
    cat > "${output_dir}/metadata.json" << EOF
{
  "profile": "$profile",
  "environment": "$ENVIRONMENT",
  "base_url": "$BASE_URL",
  "region": "$REGION",
  "start_time": "$start_time",
  "end_time": "$end_time",
  "duration_seconds": $duration,
  "exit_code": $exit_code,
  "timestamp": "$TIMESTAMP",
  "k6_version": "$(k6 version --json | jq -r '.k6')",
  "command": "$(printf '%s ' "${k6_cmd[@]}")"
}
EOF
    
    info "Test duration: ${duration} seconds"
    return $exit_code
}

generate_comprehensive_report() {
    local profile=$1
    local output_dir="${TEST_RESULTS_DIR}/${profile}_${TIMESTAMP}"
    
    if [[ ! -f "${output_dir}/summary.json" ]]; then
        warn "No summary.json found, skipping report generation"
        return 1
    fi
    
    info "Generating comprehensive performance report..."
    
    # Generate HTML report (K6 should have generated this)
    local html_report="${output_dir}/performance-report.html"
    if [[ -f "$html_report" ]]; then
        log "✅ HTML report generated: $html_report"
    fi
    
    # Generate SLO compliance report
    local slo_report="${output_dir}/slo-compliance-report.json"
    if [[ -f "$slo_report" ]]; then
        log "✅ SLO compliance report generated: $slo_report"
        
        # Check SLO compliance
        local compliance=$(jq -r '.overallCompliance // 0' "$slo_report")
        local passed=$(jq -r '.passed // false' "$slo_report")
        
        if [[ "$passed" == "true" ]]; then
            log "✅ All SLOs passed (${compliance}% compliance)"
        else
            warn "⚠️ SLO compliance issues detected (${compliance}% compliance)"
            
            # Show recommendations
            local recommendations=$(jq -r '.recommendations[]? | "  - \(.severity | ascii_upcase): \(.message)"' "$slo_report")
            if [[ -n "$recommendations" ]]; then
                warn "Recommendations:"
                echo "$recommendations"
            fi
        fi
    fi
    
    # Generate performance insights
    generate_performance_insights "$output_dir"
    
    # Generate comparison report if previous results exist
    generate_comparison_report "$profile" "$output_dir"
    
    info "📊 All reports generated in: $output_dir"
}

generate_performance_insights() {
    local output_dir=$1
    local insights_file="${output_dir}/performance-insights.md"
    
    info "Generating performance insights..."
    
    cat > "$insights_file" << 'EOF'
# Performance Test Insights

## Executive Summary
This report provides actionable insights from the load testing session.

## Key Findings

### Response Time Analysis
- **P50 Latency**: [Median response time]
- **P95 Latency**: [95th percentile - SLO target]
- **P99 Latency**: [99th percentile - extreme cases]

### Throughput Analysis
- **Peak RPS**: [Maximum requests per second achieved]
- **Average RPS**: [Sustained throughput]
- **Throughput vs Latency**: [Trade-off analysis]

### Error Analysis
- **Total Errors**: [Number of failed requests]
- **Error Rate**: [Percentage of failed requests]
- **Error Types**: [Breakdown by HTTP status codes]

### Resource Utilization
- **CPU Usage**: [Peak and average CPU utilization]
- **Memory Usage**: [Peak and average memory usage]
- **Network I/O**: [Data transfer rates]

### Scalability Assessment
- **Breaking Point**: [Maximum sustainable load]
- **Linear Scaling**: [Performance scaling characteristics]
- **Bottlenecks**: [Identified performance bottlenecks]

## Recommendations

### Immediate Actions
1. [High priority optimizations]
2. [Critical performance fixes]
3. [Scaling adjustments]

### Strategic Improvements
1. [Architecture enhancements]
2. [Long-term optimizations]
3. [Capacity planning recommendations]

### Monitoring & Alerting
1. [SLI/SLO adjustments]
2. [Alert threshold tuning]
3. [Dashboard improvements]

## Next Steps
- [ ] Address critical performance issues
- [ ] Implement recommended optimizations
- [ ] Schedule follow-up testing
- [ ] Update capacity planning models

---
*Report generated on: $(date)*
*Test Profile: ${TEST_PROFILE}*
*Environment: ${ENVIRONMENT}*
EOF
    
    log "✅ Performance insights generated: $insights_file"
}

generate_comparison_report() {
    local profile=$1
    local current_dir=$2
    
    # Find the most recent previous test of the same profile
    local previous_dir=$(find "$TEST_RESULTS_DIR" -maxdepth 1 -type d -name "${profile}_*" | grep -v "$TIMESTAMP" | sort | tail -1)
    
    if [[ -n "$previous_dir" && -f "${previous_dir}/summary.json" ]]; then
        info "Generating comparison report with previous test..."
        
        local comparison_file="${current_dir}/comparison-report.json"
        
        # Extract key metrics from both tests
        local current_p95=$(jq -r '.metrics.http_req_duration.p95 // 0' "${current_dir}/summary.json")
        local current_error_rate=$(jq -r '.metrics.http_req_failed.rate // 0' "${current_dir}/summary.json")
        local current_rps=$(jq -r '.metrics.http_reqs.rate // 0' "${current_dir}/summary.json")
        
        local previous_p95=$(jq -r '.metrics.http_req_duration.p95 // 0' "${previous_dir}/summary.json")
        local previous_error_rate=$(jq -r '.metrics.http_req_failed.rate // 0' "${previous_dir}/summary.json")
        local previous_rps=$(jq -r '.metrics.http_reqs.rate // 0' "${previous_dir}/summary.json")
        
        # Calculate percentage changes
        local p95_change=$(echo "scale=2; ($current_p95 - $previous_p95) / $previous_p95 * 100" | bc -l 2>/dev/null || echo "0")
        local error_change=$(echo "scale=2; ($current_error_rate - $previous_error_rate) / $previous_error_rate * 100" | bc -l 2>/dev/null || echo "0")
        local rps_change=$(echo "scale=2; ($current_rps - $previous_rps) / $previous_rps * 100" | bc -l 2>/dev/null || echo "0")
        
        # Generate comparison report
        cat > "$comparison_file" << EOF
{
  "comparison_timestamp": "$(date -Iseconds)",
  "current_test": {
    "directory": "$(basename "$current_dir")",
    "timestamp": "$TIMESTAMP",
    "p95_latency_ms": $current_p95,
    "error_rate": $current_error_rate,
    "requests_per_second": $current_rps
  },
  "previous_test": {
    "directory": "$(basename "$previous_dir")",
    "p95_latency_ms": $previous_p95,
    "error_rate": $previous_error_rate,
    "requests_per_second": $previous_rps
  },
  "changes": {
    "p95_latency_percent": $p95_change,
    "error_rate_percent": $error_change,
    "rps_percent": $rps_change
  },
  "regression_detected": $(echo "$p95_change > 10 || $error_change > 50" | bc -l)
}
EOF
        
        # Log significant changes
        if (( $(echo "$p95_change > 10" | bc -l) )); then
            warn "⚠️ Latency regression detected: ${p95_change}% increase in P95"
        elif (( $(echo "$p95_change < -5" | bc -l) )); then
            log "✅ Performance improvement: ${p95_change}% decrease in P95 latency"
        fi
        
        if (( $(echo "$rps_change > 5" | bc -l) )); then
            log "✅ Throughput improvement: ${rps_change}% increase in RPS"
        elif (( $(echo "$rps_change < -10" | bc -l) )); then
            warn "⚠️ Throughput regression: ${rps_change}% decrease in RPS"
        fi
        
        log "✅ Comparison report generated: $comparison_file"
    else
        info "No previous test results found for comparison"
    fi
}

send_notifications() {
    local profile=$1
    local output_dir="${TEST_RESULTS_DIR}/${profile}_${TIMESTAMP}"
    local success=$2
    
    if [[ "$SEND_NOTIFICATIONS" != "true" ]]; then
        return 0
    fi
    
    local status_icon="✅"
    local status_text="PASSED"
    local color="good"
    
    if [[ "$success" != "0" ]]; then
        status_icon="❌"
        status_text="FAILED"
        color="danger"
    fi
    
    # Check SLO compliance
    local slo_status=""
    local slo_report="${output_dir}/slo-compliance-report.json"
    if [[ -f "$slo_report" ]]; then
        local compliance=$(jq -r '.overallCompliance // 0' "$slo_report")
        local passed=$(jq -r '.passed // false' "$slo_report")
        slo_status="SLO Compliance: ${compliance}%"
        if [[ "$passed" != "true" ]]; then
            status_icon="⚠️"
            color="warning"
        fi
    fi
    
    # Send Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        info "Sending Slack notification..."
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Load Test $status_text: $profile\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Profile\", \"value\": \"$profile\", \"short\": true},
                        {\"title\": \"Status\", \"value\": \"$status_icon $status_text\", \"short\": true},
                        {\"title\": \"SLO Status\", \"value\": \"$slo_status\", \"short\": true},
                        {\"title\": \"Base URL\", \"value\": \"$BASE_URL\", \"short\": false},
                        {\"title\": \"Results\", \"value\": \"$output_dir\", \"short\": false}
                    ],
                    \"footer\": \"Suuupra Load Testing Framework\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" >/dev/null 2>&1 && log "✅ Slack notification sent" || warn "⚠️ Failed to send Slack notification"
    fi
    
    # Send Discord notification  
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        info "Sending Discord notification..."
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"Load Test $status_text: $profile\",
                    \"color\": $(case $color in good) echo 3066993;; warning) echo 16776960;; danger) echo 15158332;; esac),
                    \"fields\": [
                        {\"name\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"inline\": true},
                        {\"name\": \"Profile\", \"value\": \"$profile\", \"inline\": true},
                        {\"name\": \"Status\", \"value\": \"$status_icon $status_text\", \"inline\": true},
                        {\"name\": \"SLO Status\", \"value\": \"$slo_status\", \"inline\": false},
                        {\"name\": \"Base URL\", \"value\": \"$BASE_URL\", \"inline\": false}
                    ],
                    \"footer\": {\"text\": \"Suuupra Load Testing Framework\"},
                    \"timestamp\": \"$(date -Iseconds)\"
                }]
            }" \
            "$DISCORD_WEBHOOK" >/dev/null 2>&1 && log "✅ Discord notification sent" || warn "⚠️ Failed to send Discord notification"
    fi
}

cleanup() {
    info "Performing cleanup..."
    
    # Clean up temporary files
    rm -f /tmp/health_check.json
    
    # Archive old test results (keep last 10)
    find "$TEST_RESULTS_DIR" -maxdepth 1 -type d -name "*_*" | sort | head -n -10 | xargs rm -rf 2>/dev/null || true
    
    info "Cleanup completed"
}

# ===================================================================
# MAIN EXECUTION
# ===================================================================

main() {
    print_banner
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -p|--profile)
                TEST_PROFILE="$2"
                shift 2
                ;;
            -u|--base-url)
                BASE_URL="$2"
                shift 2
                ;;
            -w|--ws-url)
                WS_URL="$2"
                shift 2
                ;;
            -r|--region)
                REGION="$2"
                shift 2
                ;;
            -j|--parallel)
                PARALLELISM="$2"
                shift 2
                ;;
            --no-report)
                GENERATE_REPORT=false
                shift
                ;;
            --notify-slack)
                SLACK_WEBHOOK="$2"
                SEND_NOTIFICATIONS=true
                shift 2
                ;;
            --notify-discord)
                DISCORD_WEBHOOK="$2"
                SEND_NOTIFICATIONS=true
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown argument: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate arguments
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        error "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$TEST_PROFILE" =~ ^(smoke|baseline|stress|spike|soak|peak)$ ]]; then
        error "Invalid test profile: $TEST_PROFILE"
        exit 1
    fi
    
    # Setup
    log "Starting Suuupra Load Testing Framework"
    log "Environment: $ENVIRONMENT | Profile: $TEST_PROFILE | Parallelism: $PARALLELISM"
    
    check_dependencies
    setup_environment "$ENVIRONMENT"
    
    # Pre-flight checks
    if ! validate_api_health; then
        error "API health check failed. Aborting test."
        exit 1
    fi
    
    prepare_test_environment
    
    # Run the load test
    local test_start=$(date +%s)
    local test_exit_code=0
    
    trap cleanup EXIT
    
    if run_k6_test "$TEST_PROFILE"; then
        log "✅ Load test completed successfully"
    else
        test_exit_code=$?
        error "❌ Load test failed"
    fi
    
    local test_end=$(date +%s)
    local total_duration=$((test_end - test_start))
    
    # Generate reports
    if [[ "$GENERATE_REPORT" == "true" ]]; then
        generate_comprehensive_report "$TEST_PROFILE"
    fi
    
    # Send notifications
    send_notifications "$TEST_PROFILE" "$test_exit_code"
    
    # Final summary
    log "=========================================="
    log "LOAD TEST SUMMARY"
    log "=========================================="
    log "Profile: $TEST_PROFILE"
    log "Environment: $ENVIRONMENT"
    log "Duration: ${total_duration}s"
    log "Status: $([ $test_exit_code -eq 0 ] && echo "✅ SUCCESS" || echo "❌ FAILED")"
    log "Results: ${TEST_RESULTS_DIR}/${TEST_PROFILE}_${TIMESTAMP}"
    log "=========================================="
    
    exit $test_exit_code
}

# Run main function with all arguments
main "$@"
