#!/bin/bash

# 🔥 REAL DOCKER CONTAINER STRESS TEST
# This will generate actual parallel load to stress Docker containers

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# REAL STRESS TEST CONFIGURATION
CONCURRENT_PROCESSES=50    # 50 parallel processes
REQUESTS_PER_PROCESS=10000 # 10K requests per process = 500K total
TOTAL_REQUESTS=500000      # 500K concurrent requests
DELAY=0                    # Zero delay for maximum stress
TIMEOUT=60000             # 1 minute timeout

echo -e "${RED}${BOLD}🔥 REAL DOCKER CONTAINER STRESS TEST${NC}"
echo -e "${CYAN}====================================${NC}"
echo -e "${YELLOW}⚡ GENERATING REAL PARALLEL LOAD TO STRESS DOCKER CONTAINERS${NC}"
echo ""
echo -e "${BLUE}📊 Real Stress Configuration:${NC}"
echo -e "   🚀 Concurrent Processes: ${BOLD}${CONCURRENT_PROCESSES}${NC}"
echo -e "   🔄 Requests per Process: ${BOLD}${REQUESTS_PER_PROCESS}${NC}"
echo -e "   🎯 Total Concurrent Requests: ${BOLD}${TOTAL_REQUESTS}${NC}"
echo -e "   ⏱️  Delay: ${BOLD}${DELAY}ms${NC} (Maximum Stress)"
echo -e "   ⏰ Timeout: ${BOLD}${TIMEOUT}ms${NC}"
echo ""

# Create stress test reports directory
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="reports/docker-stress/test_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

echo -e "${CYAN}📁 Stress test reports: ${REPORT_DIR}${NC}"
echo ""

# Function to run parallel Newman process
run_parallel_stress() {
    local process_id=$1
    local requests=$2
    
    echo -e "${BLUE}🚀 Starting Process ${process_id}: ${requests} requests${NC}"
    
    # Run Newman with zero delay for maximum stress
    newman run Simple-API-Tests.postman_collection.json \
        -e environments/Local-Development.postman_environment.json \
        -n $requests \
        --delay-request $DELAY \
        --timeout $TIMEOUT \
        --reporter-json \
        --reporter-json-export "${REPORT_DIR}/stress_process_${process_id}.json" \
        --bail false \
        --silent > "${REPORT_DIR}/stress_process_${process_id}.log" 2>&1 &
    
    echo $! # Return process ID
}

# Function to monitor Docker container resources
monitor_docker_stress() {
    echo -e "${YELLOW}📊 Monitoring Docker container stress...${NC}"
    
    while true; do
        # Get Docker container stats
        if command -v docker >/dev/null 2>&1; then
            echo "$(date): Docker Stats:" >> "${REPORT_DIR}/docker_stress_monitoring.log"
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" >> "${REPORT_DIR}/docker_stress_monitoring.log" 2>/dev/null || echo "Docker stats unavailable" >> "${REPORT_DIR}/docker_stress_monitoring.log"
        fi
        
        # Get system stats
        local cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' || echo "N/A")
        local memory_pressure=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//' || echo "N/A")
        local load_avg=$(uptime | awk -F'load averages:' '{print $2}' | awk '{print $1}' || echo "N/A")
        
        echo "$(date): System - CPU: ${cpu_usage}%, Memory Free: ${memory_pressure}, Load: ${load_avg}" >> "${REPORT_DIR}/system_stress_monitoring.log"
        sleep 2
    done &
    
    MONITOR_PID=$!
    echo -e "${CYAN}🔍 Docker stress monitoring PID: ${MONITOR_PID}${NC}"
}

# Start monitoring
monitor_docker_stress

echo -e "${BOLD}${RED}🔥 LAUNCHING ${CONCURRENT_PROCESSES} PARALLEL PROCESSES${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

START_TIME=$(date +%s)
PROCESS_PIDS=()

# Launch all parallel processes simultaneously
for i in $(seq 1 $CONCURRENT_PROCESSES); do
    pid=$(run_parallel_stress $i $REQUESTS_PER_PROCESS)
    PROCESS_PIDS+=($pid)
    
    # Brief delay to prevent overwhelming the system startup
    sleep 0.1
done

echo -e "${YELLOW}⚡ ALL ${CONCURRENT_PROCESSES} PROCESSES LAUNCHED - MAXIMUM STRESS ACTIVE${NC}"
echo ""

# Monitor progress
completed_processes=0
while [ $completed_processes -lt $CONCURRENT_PROCESSES ]; do
    sleep 5
    completed_processes=0
    
    for pid in "${PROCESS_PIDS[@]}"; do
        if ! kill -0 $pid 2>/dev/null; then
            completed_processes=$((completed_processes + 1))
        fi
    done
    
    progress=$((completed_processes * 100 / CONCURRENT_PROCESSES))
    echo -e "${CYAN}📊 Progress: ${progress}% (${completed_processes}/${CONCURRENT_PROCESSES} processes completed)${NC}"
done

# Wait for all processes to complete
echo -e "${YELLOW}⏳ Waiting for all processes to complete...${NC}"
for pid in "${PROCESS_PIDS[@]}"; do
    wait $pid 2>/dev/null || true
done

# Stop monitoring
kill $MONITOR_PID 2>/dev/null || true

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}${CYAN}📊 REAL DOCKER STRESS TEST RESULTS${NC}"
echo -e "${CYAN}===================================${NC}"

# Analyze results
TOTAL_SUCCESSFUL=0
TOTAL_FAILED=0
MIN_RESPONSE_TIME=999999
MAX_RESPONSE_TIME=0
TOTAL_RESPONSE_TIME=0
RESPONSE_COUNT=0

echo -e "${PURPLE}📊 Analyzing results from ${CONCURRENT_PROCESSES} parallel processes...${NC}"

for json_file in "${REPORT_DIR}"/stress_process_*.json; do
    if [ -f "$json_file" ] && command -v jq >/dev/null 2>&1; then
        local_total=$(jq -r '.run.stats.requests.total // 0' "$json_file" 2>/dev/null || echo "0")
        local_failed=$(jq -r '.run.stats.requests.failed // 0' "$json_file" 2>/dev/null || echo "0")
        local_successful=$((local_total - local_failed))
        
        local_avg_time=$(jq -r '.run.timings.responseAverage // 0' "$json_file" 2>/dev/null || echo "0")
        local_min_time=$(jq -r '.run.timings.responseMin // 999999' "$json_file" 2>/dev/null || echo "999999")
        local_max_time=$(jq -r '.run.timings.responseMax // 0' "$json_file" 2>/dev/null || echo "0")
        
        TOTAL_SUCCESSFUL=$((TOTAL_SUCCESSFUL + local_successful))
        TOTAL_FAILED=$((TOTAL_FAILED + local_failed))
        
        if [ "$local_min_time" -lt "$MIN_RESPONSE_TIME" ] && [ "$local_min_time" -gt 0 ]; then
            MIN_RESPONSE_TIME=$local_min_time
        fi
        if [ "$local_max_time" -gt "$MAX_RESPONSE_TIME" ]; then
            MAX_RESPONSE_TIME=$local_max_time
        fi
        
        TOTAL_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME + local_avg_time))
        RESPONSE_COUNT=$((RESPONSE_COUNT + 1))
    fi
done

# Calculate metrics
TOTAL_REQUESTS_PROCESSED=$((TOTAL_SUCCESSFUL + TOTAL_FAILED))
SUCCESS_RATE=0
if [ $TOTAL_REQUESTS_PROCESSED -gt 0 ]; then
    SUCCESS_RATE=$((TOTAL_SUCCESSFUL * 100 / TOTAL_REQUESTS_PROCESSED))
fi

FAILURE_RATE=$((100 - SUCCESS_RATE))
AVG_RESPONSE_TIME=0
if [ $RESPONSE_COUNT -gt 0 ]; then
    AVG_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME / RESPONSE_COUNT))
fi

REQUESTS_PER_SECOND=0
if [ $TOTAL_DURATION -gt 0 ]; then
    REQUESTS_PER_SECOND=$((TOTAL_REQUESTS_PROCESSED / TOTAL_DURATION))
fi

echo -e "${BLUE}📊 REAL DOCKER STRESS TEST FINAL RESULTS:${NC}"
echo -e "${BLUE}   Target Requests: ${BOLD}${TOTAL_REQUESTS}${NC}"
echo -e "${BLUE}   Actual Requests Processed: ${BOLD}${TOTAL_REQUESTS_PROCESSED}${NC}"
echo -e "${GREEN}   Successful Requests: ${BOLD}${TOTAL_SUCCESSFUL}${NC}"
echo -e "${RED}   Failed Requests: ${BOLD}${TOTAL_FAILED}${NC}"
echo -e "${YELLOW}   Success Rate: ${BOLD}${SUCCESS_RATE}%${NC}"
echo -e "${RED}   Failure Rate: ${BOLD}${FAILURE_RATE}%${NC}"
echo -e "${PURPLE}   Average Response Time: ${BOLD}${AVG_RESPONSE_TIME}ms${NC}"
echo -e "${CYAN}   Response Time Range: ${BOLD}${MIN_RESPONSE_TIME}ms - ${MAX_RESPONSE_TIME}ms${NC}"
echo -e "${BLUE}   Test Duration: ${BOLD}${TOTAL_DURATION}s${NC}"
echo -e "${PURPLE}   Requests per Second: ${BOLD}${REQUESTS_PER_SECOND} RPS${NC}"
echo -e "${CYAN}   Concurrent Processes: ${BOLD}${CONCURRENT_PROCESSES}${NC}"

echo ""
if [ $SUCCESS_RATE -ge 95 ]; then
    echo -e "${BOLD}${GREEN}🏆 DOCKER STRESS TEST PASSED!${NC}"
    echo -e "${GREEN}✅ System handled ${CONCURRENT_PROCESSES} parallel processes successfully${NC}"
    echo -e "${GREEN}🚀 Docker containers performed excellently under real stress${NC}"
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${BOLD}${YELLOW}⚠️  DOCKER STRESS TEST: GOOD PERFORMANCE${NC}"
    echo -e "${YELLOW}🔧 System handled stress with ${SUCCESS_RATE}% success rate${NC}"
    echo -e "${YELLOW}📈 Docker containers show good resilience under load${NC}"
else
    echo -e "${BOLD}${RED}🔧 DOCKER STRESS TEST: BREAKING POINT FOUND${NC}"
    echo -e "${RED}   System reached limits with ${FAILURE_RATE}% failure rate${NC}"
    echo -e "${RED}   Docker containers require optimization for this load level${NC}"
fi

echo ""
echo -e "${CYAN}📁 Detailed stress reports: ${REPORT_DIR}${NC}"
echo -e "${PURPLE}📊 Docker monitoring: ${REPORT_DIR}/docker_stress_monitoring.log${NC}"
echo -e "${BLUE}📈 System monitoring: ${REPORT_DIR}/system_stress_monitoring.log${NC}"
echo ""
echo -e "${BOLD}${PURPLE}🎉 REAL DOCKER CONTAINER STRESS TEST COMPLETED!${NC}"
