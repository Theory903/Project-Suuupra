#!/bin/bash
# ==============================================================================
# Suuupra Platform - Load Testing Script for Billion Users
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_GATEWAY_URL="${API_GATEWAY_URL:-https://api.suuupra.com}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus.suuupra.com:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://grafana.suuupra.com:3000}"

# Load test scenarios for billion-user scale
declare -A LOAD_SCENARIOS=(
    ["smoke"]="10 users, 1 minute"
    ["load"]="1000 users, 10 minutes"
    ["stress"]="10000 users, 30 minutes"
    ["spike"]="50000 users, 5 minutes"
    ["volume"]="100000 users, 60 minutes"
    ["billion_user_simulation"]="1000000 users, 120 minutes"
)

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

check_prerequisites() {
    log_info "Checking load testing prerequisites..."
    
    local required_tools=("k6" "kubectl" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            if [ "$tool" = "k6" ]; then
                log_info "Installing k6..."
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    brew install k6
                else
                    sudo gpg -k
                    sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
                    echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
                    sudo apt-get update
                    sudo apt-get install k6
                fi
            else
                log_error "$tool is not installed"
                exit 1
            fi
        fi
    done
    
    # Check API Gateway accessibility
    if ! curl -s "$API_GATEWAY_URL/health" > /dev/null; then
        log_error "API Gateway is not accessible at $API_GATEWAY_URL"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_load_test_script() {
    local scenario="$1"
    local script_file="load-test-${scenario}.js"
    
    cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time');
export let requests = new Counter('requests');

// Test configuration based on scenario
const scenarios = {
    smoke: {
        vus: 10,
        duration: '1m',
    },
    load: {
        vus: 1000,
        duration: '10m',
    },
    stress: {
        stages: [
            { duration: '5m', target: 1000 },
            { duration: '10m', target: 5000 },
            { duration: '10m', target: 10000 },
            { duration: '5m', target: 0 },
        ],
    },
    spike: {
        stages: [
            { duration: '1m', target: 1000 },
            { duration: '30s', target: 50000 },
            { duration: '3m', target: 50000 },
            { duration: '30s', target: 1000 },
        ],
    },
    volume: {
        vus: 100000,
        duration: '60m',
    },
    billion_user_simulation: {
        stages: [
            { duration: '10m', target: 100000 },
            { duration: '20m', target: 500000 },
            { duration: '30m', target: 1000000 },
            { duration: '40m', target: 1000000 },
            { duration: '20m', target: 0 },
        ],
    },
};

export let options = {
    scenarios: {
        SCENARIO_NAME: scenarios.SCENARIO_NAME,
    },
    thresholds: {
        'http_req_duration': ['p(95)<200', 'p(99)<500'],
        'http_req_failed': ['rate<0.01'], // 99% success rate
        'errors': ['rate<0.01'],
        'checks': ['rate>0.99'],
    },
    ext: {
        loadimpact: {
            distribution: {
                'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 40 },
                'amazon:ie:dublin': { loadZone: 'amazon:ie:dublin', percent: 20 },
                'amazon:sg:singapore': { loadZone: 'amazon:sg:singapore', percent: 20 },
                'amazon:au:sydney': { loadZone: 'amazon:au:sydney', percent: 20 },
            },
        },
    },
};

// Test data
const users = Array.from({ length: 10000 }, (_, i) => ({
    id: i + 1,
    email: `user${i + 1}@suuupra.com`,
    name: `User ${i + 1}`,
}));

const API_BASE = __ENV.API_GATEWAY_URL || 'https://api.suuupra.com';

export default function() {
    let user = users[Math.floor(Math.random() * users.length)];
    
    // Test scenarios covering all major user journeys
    testHealthEndpoint();
    testUserAuthentication(user);
    testContentAccess();
    testCommerceOperations();
    testPaymentFlow();
    testAnalyticsTracking();
    testLiveStreaming();
    
    sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}

function testHealthEndpoint() {
    let response = http.get(`${API_BASE}/health`);
    
    check(response, {
        'health check status is 200': (r) => r.status === 200,
        'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
    
    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requests.add(1);
}

function testUserAuthentication(user) {
    // Login request
    let loginPayload = {
        email: user.email,
        password: 'testpassword123',
    };
    
    let response = http.post(`${API_BASE}/api/v1/auth/login`, JSON.stringify(loginPayload), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    check(response, {
        'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
        'login response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    errorRate.add(response.status !== 200 && response.status !== 401);
    responseTime.add(response.timings.duration);
    requests.add(1);
    
    // If login successful, test authenticated endpoints
    if (response.status === 200) {
        let token = JSON.parse(response.body).token;
        testAuthenticatedEndpoints(token);
    }
}

function testAuthenticatedEndpoints(token) {
    let headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    
    // Test user profile
    let profileResponse = http.get(`${API_BASE}/api/v1/users/profile`, { headers });
    
    check(profileResponse, {
        'profile status is 200': (r) => r.status === 200,
        'profile response time < 200ms': (r) => r.timings.duration < 200,
    });
    
    errorRate.add(profileResponse.status !== 200);
    responseTime.add(profileResponse.timings.duration);
    requests.add(1);
}

function testContentAccess() {
    // Test content listing
    let response = http.get(`${API_BASE}/api/v1/content?page=1&limit=20`);
    
    check(response, {
        'content list status is 200': (r) => r.status === 200,
        'content list response time < 300ms': (r) => r.timings.duration < 300,
        'content list has data': (r) => JSON.parse(r.body).data.length > 0,
    });
    
    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requests.add(1);
    
    // Test specific content access
    if (response.status === 200) {
        let content = JSON.parse(response.body).data[0];
        if (content && content.id) {
            let contentResponse = http.get(`${API_BASE}/api/v1/content/${content.id}`);
            
            check(contentResponse, {
                'content detail status is 200': (r) => r.status === 200,
                'content detail response time < 200ms': (r) => r.timings.duration < 200,
            });
            
            errorRate.add(contentResponse.status !== 200);
            responseTime.add(contentResponse.timings.duration);
            requests.add(1);
        }
    }
}

function testCommerceOperations() {
    // Test product catalog
    let response = http.get(`${API_BASE}/api/v1/products?category=electronics&page=1&limit=10`);
    
    check(response, {
        'products status is 200': (r) => r.status === 200,
        'products response time < 400ms': (r) => r.timings.duration < 400,
    });
    
    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requests.add(1);
}

function testPaymentFlow() {
    // Test payment methods
    let response = http.get(`${API_BASE}/api/v1/payments/methods`);
    
    check(response, {
        'payment methods status is 200': (r) => r.status === 200,
        'payment methods response time < 300ms': (r) => r.timings.duration < 300,
    });
    
    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requests.add(1);
}

function testAnalyticsTracking() {
    // Test analytics event tracking
    let eventPayload = {
        event: 'page_view',
        properties: {
            page: '/dashboard',
            user_id: Math.floor(Math.random() * 10000),
            timestamp: new Date().toISOString(),
        },
    };
    
    let response = http.post(`${API_BASE}/api/v1/analytics/events`, JSON.stringify(eventPayload), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    check(response, {
        'analytics tracking status is 200 or 202': (r) => r.status === 200 || r.status === 202,
        'analytics tracking response time < 100ms': (r) => r.timings.duration < 100,
    });
    
    errorRate.add(response.status !== 200 && response.status !== 202);
    responseTime.add(response.timings.duration);
    requests.add(1);
}

function testLiveStreaming() {
    // Test live stream listing
    let response = http.get(`${API_BASE}/api/v1/streams/live`);
    
    check(response, {
        'live streams status is 200': (r) => r.status === 200,
        'live streams response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requests.add(1);
}

export function handleSummary(data) {
    return {
        'load-test-results.json': JSON.stringify(data, null, 2),
        'load-test-summary.html': htmlReport(data),
    };
}

function htmlReport(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Suuupra Load Test Results</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .metric { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .pass { background-color: #d4edda; border-color: #c3e6cb; }
            .fail { background-color: #f8d7da; border-color: #f5c6cb; }
            .summary { font-size: 18px; font-weight: bold; margin-bottom: 30px; }
        </style>
    </head>
    <body>
        <h1>🚀 Suuupra Platform Load Test Results</h1>
        <div class="summary">
            Test Duration: ${data.state.testRunDurationMs / 1000}s |
            Total Requests: ${data.metrics.requests?.values?.count || 0} |
            Error Rate: ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%
        </div>
        
        <div class="metric ${data.metrics.http_req_duration?.values?.['p(95)'] < 200 ? 'pass' : 'fail'}">
            <h3>Response Time (95th percentile)</h3>
            <p>${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms (Target: <200ms)</p>
        </div>
        
        <div class="metric ${(data.metrics.errors?.values?.rate || 0) < 0.01 ? 'pass' : 'fail'}">
            <h3>Error Rate</h3>
            <p>${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(4)}% (Target: <1%)</p>
        </div>
        
        <div class="metric">
            <h3>Throughput</h3>
            <p>${(data.metrics.requests?.values?.rate || 0).toFixed(2)} requests/second</p>
        </div>
        
        <div class="metric">
            <h3>Virtual Users</h3>
            <p>Peak: ${data.metrics.vus_max?.values?.max || 0}</p>
        </div>
    </body>
    </html>
    `;
}
EOF
    
    # Replace SCENARIO_NAME placeholder with actual scenario
    sed -i.bak "s/SCENARIO_NAME/$scenario/g" "$script_file" && rm "${script_file}.bak"
    
    echo "$script_file"
}

run_load_test() {
    local scenario="$1"
    
    log_info "Running $scenario load test scenario: ${LOAD_SCENARIOS[$scenario]}"
    
    # Create test script
    local script_file
    script_file=$(create_load_test_script "$scenario")
    
    # Set environment variables
    export API_GATEWAY_URL="$API_GATEWAY_URL"
    
    # Run k6 test
    log_info "Executing k6 load test..."
    k6 run \
        --out json=results-${scenario}.json \
        --out influxdb=http://localhost:8086/k6 \
        "$script_file"
    
    # Generate report
    generate_report "$scenario"
    
    # Cleanup
    rm "$script_file"
    
    log_success "$scenario load test completed"
}

generate_report() {
    local scenario="$1"
    local results_file="results-${scenario}.json"
    
    if [ ! -f "$results_file" ]; then
        log_warning "Results file not found: $results_file"
        return
    fi
    
    log_info "Generating load test report..."
    
    # Extract key metrics
    local total_requests error_rate avg_response_time p95_response_time
    total_requests=$(jq '.metrics.http_reqs.values.count // 0' "$results_file")
    error_rate=$(jq '.metrics.http_req_failed.values.rate // 0' "$results_file")
    avg_response_time=$(jq '.metrics.http_req_duration.values.avg // 0' "$results_file")
    p95_response_time=$(jq '.metrics.http_req_duration.values["p(95)"] // 0' "$results_file")
    
    # Create summary report
    cat > "load-test-report-${scenario}.md" << EOF
# Load Test Report: $scenario

## Test Summary
- **Scenario**: ${LOAD_SCENARIOS[$scenario]}
- **Date**: $(date)
- **API Gateway**: $API_GATEWAY_URL

## Key Metrics
- **Total Requests**: $total_requests
- **Error Rate**: $(echo "$error_rate * 100" | bc -l | xargs printf "%.4f")%
- **Average Response Time**: $(echo "$avg_response_time" | xargs printf "%.2f")ms
- **95th Percentile Response Time**: $(echo "$p95_response_time" | xargs printf "%.2f")ms

## Performance Targets
- ✅ Response Time (95th percentile): < 200ms
- ✅ Error Rate: < 1%
- ✅ Availability: > 99.9%

## Recommendations
$(if (( $(echo "$p95_response_time > 200" | bc -l) )); then
    echo "⚠️  **Response time exceeds target**. Consider:"
    echo "   - Scaling up API Gateway replicas"
    echo "   - Optimizing database queries"
    echo "   - Implementing better caching strategies"
else
    echo "✅ **Performance targets met**. System is ready for production load."
fi)

$(if (( $(echo "$error_rate > 0.01" | bc -l) )); then
    echo "⚠️  **Error rate exceeds target**. Investigate:"
    echo "   - Application logs for error patterns"
    echo "   - Database connection issues"
    echo "   - Resource constraints"
else
    echo "✅ **Error rate within acceptable limits**."
fi)

## Next Steps
1. Review detailed metrics in Grafana: $GRAFANA_URL
2. Check application logs for any issues
3. Monitor resource utilization during peak load
4. Consider running volume tests for extended periods

---
*Generated by Suuupra Load Testing Suite*
EOF
    
    log_success "Report generated: load-test-report-${scenario}.md"
}

monitor_system_during_test() {
    log_info "Monitoring system metrics during load test..."
    
    # Monitor key metrics
    while true; do
        # Check pod status
        kubectl top pods -n production --no-headers | head -10
        
        # Check node resources
        kubectl top nodes --no-headers
        
        # Check HPA status
        kubectl get hpa -n production --no-headers
        
        echo "---"
        sleep 30
    done &
    
    MONITOR_PID=$!
    echo "$MONITOR_PID" > monitor.pid
}

stop_monitoring() {
    if [ -f monitor.pid ]; then
        local pid
        pid=$(cat monitor.pid)
        kill "$pid" 2>/dev/null || true
        rm monitor.pid
        log_info "Stopped system monitoring"
    fi
}

main() {
    local scenario="${1:-load}"
    
    if [[ ! ${LOAD_SCENARIOS[$scenario]+_} ]]; then
        log_error "Invalid scenario: $scenario"
        log_info "Available scenarios: ${!LOAD_SCENARIOS[*]}"
        exit 1
    fi
    
    log_info "Starting load test for Suuupra Platform..."
    log_info "Scenario: $scenario (${LOAD_SCENARIOS[$scenario]})"
    
    check_prerequisites
    
    # Start system monitoring
    monitor_system_during_test
    
    # Run the load test
    run_load_test "$scenario"
    
    # Stop monitoring
    stop_monitoring
    
    log_success "Load test completed successfully!"
    log_info "Check the generated reports for detailed results."
}

# Handle script termination
trap stop_monitoring EXIT

# Parse command line arguments
case "${1:-help}" in
    "smoke"|"load"|"stress"|"spike"|"volume"|"billion_user_simulation")
        main "$1"
        ;;
    "list")
        log_info "Available load test scenarios:"
        for scenario in "${!LOAD_SCENARIOS[@]}"; do
            echo "  $scenario: ${LOAD_SCENARIOS[$scenario]}"
        done
        ;;
    "help"|*)
        echo "Usage: $0 {scenario|list|help}"
        echo ""
        echo "Load Test Scenarios:"
        for scenario in "${!LOAD_SCENARIOS[@]}"; do
            echo "  $scenario: ${LOAD_SCENARIOS[$scenario]}"
        done
        echo ""
        echo "Examples:"
        echo "  $0 smoke                    # Quick smoke test"
        echo "  $0 load                     # Standard load test"
        echo "  $0 billion_user_simulation  # Billion user simulation"
        echo "  $0 list                     # List all scenarios"
        ;;
esac
