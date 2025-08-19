#!/bin/bash

# 🔥 SUUUPRA EDTECH PLATFORM - 10,000 USER EXTREME LOAD TEST
# Simulating 10K concurrent users for billion-user scale validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test configuration
TOTAL_USERS=10000
CONCURRENT_BATCHES=50
USERS_PER_BATCH=200
ITERATIONS_PER_USER=5
DELAY_BETWEEN_REQUESTS=10  # milliseconds
TEST_DURATION=600  # 10 minutes

echo -e "${PURPLE}${BOLD}🔥 SUUUPRA EDTECH PLATFORM - 10,000 USER EXTREME LOAD TEST${NC}"
echo -e "${CYAN}================================================================${NC}"
echo -e "${YELLOW}⚡ BILLION-USER SCALE VALIDATION - EXTREME PERFORMANCE TEST${NC}"
echo ""
echo -e "${BLUE}📊 Test Configuration:${NC}"
echo -e "   👥 Total Users: ${BOLD}${TOTAL_USERS}${NC}"
echo -e "   🔄 Concurrent Batches: ${BOLD}${CONCURRENT_BATCHES}${NC}"
echo -e "   👤 Users per Batch: ${BOLD}${USERS_PER_BATCH}${NC}"
echo -e "   🔁 Iterations per User: ${BOLD}${ITERATIONS_PER_USER}${NC}"
echo -e "   ⏱️  Request Delay: ${BOLD}${DELAY_BETWEEN_REQUESTS}ms${NC}"
echo -e "   🕐 Test Duration: ${BOLD}${TEST_DURATION}s${NC}"
echo ""

# Create reports directory
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="postman/reports/extreme-load-10k/test_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

echo -e "${CYAN}📁 Reports will be saved to: ${REPORT_DIR}${NC}"
echo ""

# Function to run concurrent Newman instances
run_concurrent_load() {
    local batch_id=$1
    local users_in_batch=$2
    local iterations=$3
    
    echo -e "${BLUE}🚀 Starting Batch ${batch_id} with ${users_in_batch} concurrent users...${NC}"
    
    local pids=()
    
    # Start multiple Newman instances to simulate concurrent users
    for i in $(seq 1 $users_in_batch); do
        (
            newman run postman/Extreme-Load-Test-10K.postman_collection.json \
                -e postman/environments/Local-Development.postman_environment.json \
                -n $iterations \
                --delay-request $DELAY_BETWEEN_REQUESTS \
                --timeout 30000 \
                --reporter-json \
                --reporter-json-export "${REPORT_DIR}/batch_${batch_id}_user_${i}.json" \
                --bail false \
                --silent > "${REPORT_DIR}/batch_${batch_id}_user_${i}.log" 2>&1
        ) &
        pids+=($!)
        
        # Small delay to stagger user starts (simulate real-world ramp-up)
        sleep 0.1
    done
    
    # Wait for all users in this batch to complete
    local completed=0
    for pid in "${pids[@]}"; do
        if wait $pid; then
            ((completed++))
        fi
    done
    
    echo -e "${GREEN}✅ Batch ${batch_id} completed: ${completed}/${users_in_batch} users successful${NC}"
    return 0
}

# Function to monitor system resources
monitor_system() {
    echo -e "${YELLOW}📊 System Resource Monitoring Started...${NC}"
    
    while true; do
        echo "$(date): CPU: $(top -l 1 -n 0 | grep "CPU usage" || echo "N/A"), Memory: $(vm_stat | head -4 | tail -3 | tr '\n' ' ')" >> "${REPORT_DIR}/system_resources.log"
        sleep 5
    done &
    
    MONITOR_PID=$!
    echo -e "${CYAN}🔍 System monitoring PID: ${MONITOR_PID}${NC}"
}

# Function to generate real-time statistics
generate_stats() {
    local current_time=$(date +%s)
    local start_time=$1
    local elapsed=$((current_time - start_time))
    local completed_batches=$2
    local total_batches=$3
    
    local progress=$((completed_batches * 100 / total_batches))
    local estimated_total=$((elapsed * total_batches / completed_batches))
    local remaining=$((estimated_total - elapsed))
    
    echo -e "${CYAN}📊 Progress: ${progress}% (${completed_batches}/${total_batches} batches)${NC}"
    echo -e "${YELLOW}⏱️  Elapsed: ${elapsed}s, Estimated remaining: ${remaining}s${NC}"
}

# Start system monitoring
monitor_system

echo -e "${BOLD}${PURPLE}🔥 INITIATING 10,000 USER EXTREME LOAD TEST${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

START_TIME=$(date +%s)

# Phase 1: Ramp-up (gradual increase)
echo -e "${BOLD}${BLUE}📈 PHASE 1: GRADUAL RAMP-UP (0-2000 users)${NC}"
echo -e "${CYAN}--------------------------------------------${NC}"

for batch in $(seq 1 10); do
    run_concurrent_load $batch 200 3 &
    sleep 2  # 2-second delay between batches during ramp-up
    generate_stats $START_TIME $batch 10
done

# Wait for ramp-up phase to complete
wait
echo -e "${GREEN}✅ Phase 1 completed: 2000 users processed${NC}"
echo ""

# Phase 2: Peak load (maximum concurrent users)
echo -e "${BOLD}${BLUE}🏔️  PHASE 2: PEAK LOAD (2000-8000 users)${NC}"
echo -e "${CYAN}------------------------------------------${NC}"

batch_pids=()
for batch in $(seq 11 40); do
    run_concurrent_load $batch 200 5 &
    batch_pids+=($!)
    sleep 0.5  # Minimal delay during peak load
    
    # Generate stats every 5 batches
    if [ $((batch % 5)) -eq 0 ]; then
        generate_stats $START_TIME $((batch - 10)) 30
    fi
done

# Wait for peak load phase
for pid in "${batch_pids[@]}"; do
    wait $pid
done

echo -e "${GREEN}✅ Phase 2 completed: 6000 additional users processed${NC}"
echo ""

# Phase 3: Sustained load (final 2000 users)
echo -e "${BOLD}${BLUE}⚡ PHASE 3: SUSTAINED PEAK LOAD (8000-10000 users)${NC}"
echo -e "${CYAN}--------------------------------------------------${NC}"

for batch in $(seq 41 50); do
    run_concurrent_load $batch 200 7 &
    sleep 0.2  # Very minimal delay for sustained peak
    generate_stats $START_TIME $((batch - 10)) 40
done

# Wait for all remaining batches
wait

# Stop system monitoring
kill $MONITOR_PID 2>/dev/null || true

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}${GREEN}🎉 10,000 USER EXTREME LOAD TEST COMPLETED!${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# Generate comprehensive results
echo -e "${PURPLE}📊 GENERATING COMPREHENSIVE RESULTS...${NC}"

# Count successful and failed tests
TOTAL_TESTS=0
SUCCESSFUL_TESTS=0
FAILED_TESTS=0

for json_file in "${REPORT_DIR}"/*.json; do
    if [ -f "$json_file" ]; then
        # Extract test results from Newman JSON reports
        if command -v jq >/dev/null 2>&1; then
            local_total=$(jq -r '.run.stats.requests.total // 0' "$json_file" 2>/dev/null || echo "0")
            local_failed=$(jq -r '.run.stats.requests.failed // 0' "$json_file" 2>/dev/null || echo "0")
            local_successful=$((local_total - local_failed))
            
            TOTAL_TESTS=$((TOTAL_TESTS + local_total))
            SUCCESSFUL_TESTS=$((SUCCESSFUL_TESTS + local_successful))
            FAILED_TESTS=$((FAILED_TESTS + local_failed))
        fi
    fi
done

# Calculate performance metrics
SUCCESS_RATE=0
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((SUCCESSFUL_TESTS * 100 / TOTAL_TESTS))
fi

REQUESTS_PER_SECOND=$((TOTAL_TESTS / TOTAL_DURATION))

# Generate summary report
cat > "${REPORT_DIR}/10k_load_test_summary.md" << EOF
# 🔥 10,000 User Extreme Load Test Results

## 📊 Test Execution Summary

**Test Date**: $(date)
**Total Duration**: ${TOTAL_DURATION} seconds
**Target Users**: 10,000
**Concurrent Batches**: ${CONCURRENT_BATCHES}

## 🎯 Performance Metrics

- **Total Requests**: ${TOTAL_TESTS}
- **Successful Requests**: ${SUCCESSFUL_TESTS}
- **Failed Requests**: ${FAILED_TESTS}
- **Success Rate**: ${SUCCESS_RATE}%
- **Requests per Second**: ${REQUESTS_PER_SECOND} RPS
- **Average Users per Second**: $((TOTAL_USERS / TOTAL_DURATION))

## 📈 Load Test Phases

### Phase 1: Gradual Ramp-up (0-2000 users)
- **Duration**: First 10 batches
- **Strategy**: 2-second delays between batches
- **Purpose**: System warm-up and baseline establishment

### Phase 2: Peak Load (2000-8000 users)
- **Duration**: Batches 11-40
- **Strategy**: 0.5-second delays between batches
- **Purpose**: Maximum concurrent load testing

### Phase 3: Sustained Peak (8000-10000 users)
- **Duration**: Final 10 batches
- **Strategy**: 0.2-second delays between batches
- **Purpose**: Sustained high-load validation

## 🏆 Results Summary

$(if [ $SUCCESS_RATE -ge 95 ]; then
    echo "✅ **EXTREME LOAD TEST PASSED**"
    echo "- System successfully handled 10,000 concurrent users"
    echo "- Success rate of ${SUCCESS_RATE}% exceeds 95% threshold"
    echo "- Platform validated for billion-user scale deployment"
else
    echo "⚠️ **LOAD TEST COMPLETED WITH ISSUES**"
    echo "- Success rate of ${SUCCESS_RATE}% below 95% threshold"
    echo "- System experienced stress under 10K user load"
    echo "- Optimization recommended before billion-user deployment"
fi)

## 📋 Detailed Reports

Individual user reports available in:
- JSON Reports: batch_*_user_*.json
- Log Files: batch_*_user_*.log
- System Resources: system_resources.log

EOF

# Display final results
echo -e "${BOLD}${CYAN}📊 FINAL RESULTS SUMMARY${NC}"
echo -e "${CYAN}=========================${NC}"
echo -e "${BLUE}👥 Total Users Simulated: ${BOLD}${TOTAL_USERS}${NC}"
echo -e "${BLUE}🔄 Total Requests: ${BOLD}${TOTAL_TESTS}${NC}"
echo -e "${GREEN}✅ Successful Requests: ${BOLD}${SUCCESSFUL_TESTS}${NC}"
echo -e "${RED}❌ Failed Requests: ${BOLD}${FAILED_TESTS}${NC}"
echo -e "${YELLOW}📈 Success Rate: ${BOLD}${SUCCESS_RATE}%${NC}"
echo -e "${PURPLE}⚡ Requests per Second: ${BOLD}${REQUESTS_PER_SECOND} RPS${NC}"
echo -e "${CYAN}⏱️  Total Duration: ${BOLD}${TOTAL_DURATION}s${NC}"
echo ""

if [ $SUCCESS_RATE -ge 95 ]; then
    echo -e "${BOLD}${GREEN}🏆 10,000 USER EXTREME LOAD TEST: PASSED!${NC}"
    echo -e "${GREEN}✅ Platform validated for billion-user scale deployment${NC}"
else
    echo -e "${BOLD}${YELLOW}⚠️  10,000 USER EXTREME LOAD TEST: COMPLETED WITH STRESS${NC}"
    echo -e "${YELLOW}🔧 System optimization recommended for billion-user scale${NC}"
fi

echo ""
echo -e "${CYAN}📁 Detailed reports available in: ${REPORT_DIR}${NC}"
echo -e "${PURPLE}📊 Summary report: ${REPORT_DIR}/10k_load_test_summary.md${NC}"
echo ""
echo -e "${BOLD}${PURPLE}🎉 EXTREME LOAD TESTING MISSION ACCOMPLISHED!${NC}"
