#!/usr/bin/env node

/**
 * 🔥 REAL LOAD GENERATOR - Generate actual concurrent load on Docker containers
 * This will create real HTTP requests to stress the system
 */

const http = require('http');
const { performance } = require('perf_hooks');

// REAL LOAD CONFIGURATION
const CONCURRENT_REQUESTS = 1000;  // 1000 concurrent requests
const TOTAL_REQUESTS = 100000;     // 100K total requests
const TARGET_HOST = 'localhost';
const TARGET_PORT = 8080;
const REQUEST_TIMEOUT = 30000;     // 30 second timeout

// Service endpoints to test
const ENDPOINTS = [
    '/healthz',
    '/identity/actuator/health',
    '/payments/health',
    '/commerce/health',
    '/content/health',
    '/analytics/health',
    '/notifications/health',
    '/admin/health',
    '/bank-simulator/api/banks',
    '/upi-core/health',
    '/live-classes/health',
    '/llm-tutor/health',
    '/recommendations/health'
];

// Performance tracking
let completedRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let totalResponseTime = 0;
let minResponseTime = Infinity;
let maxResponseTime = 0;
let activeRequests = 0;

console.log('🔥 REAL LOAD GENERATOR STARTING');
console.log('================================');
console.log(`🎯 Target: ${TOTAL_REQUESTS} requests`);
console.log(`🚀 Concurrency: ${CONCURRENT_REQUESTS} simultaneous requests`);
console.log(`📡 Endpoints: ${ENDPOINTS.length} different services`);
console.log(`⏰ Timeout: ${REQUEST_TIMEOUT}ms`);
console.log('');

const startTime = performance.now();

// Function to make a single HTTP request
function makeRequest(endpoint) {
    return new Promise((resolve) => {
        activeRequests++;
        const requestStart = performance.now();
        
        const options = {
            hostname: TARGET_HOST,
            port: TARGET_PORT,
            path: endpoint,
            method: 'GET',
            timeout: REQUEST_TIMEOUT,
            headers: {
                'User-Agent': 'RealLoadGenerator/1.0',
                'X-Load-Test': 'true',
                'Connection': 'keep-alive'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const responseTime = performance.now() - requestStart;
                activeRequests--;
                completedRequests++;
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    successfulRequests++;
                } else {
                    failedRequests++;
                }
                
                totalResponseTime += responseTime;
                minResponseTime = Math.min(minResponseTime, responseTime);
                maxResponseTime = Math.max(maxResponseTime, responseTime);
                
                resolve({
                    success: res.statusCode >= 200 && res.statusCode < 300,
                    statusCode: res.statusCode,
                    responseTime: responseTime,
                    endpoint: endpoint
                });
            });
        });

        req.on('error', (err) => {
            const responseTime = performance.now() - requestStart;
            activeRequests--;
            completedRequests++;
            failedRequests++;
            totalResponseTime += responseTime;
            
            resolve({
                success: false,
                error: err.message,
                responseTime: responseTime,
                endpoint: endpoint
            });
        });

        req.on('timeout', () => {
            req.destroy();
            const responseTime = performance.now() - requestStart;
            activeRequests--;
            completedRequests++;
            failedRequests++;
            totalResponseTime += responseTime;
            
            resolve({
                success: false,
                error: 'timeout',
                responseTime: responseTime,
                endpoint: endpoint
            });
        });

        req.end();
    });
}

// Function to generate concurrent load
async function generateLoad() {
    const promises = [];
    let requestCount = 0;
    
    console.log('🚀 LAUNCHING CONCURRENT REQUESTS...');
    console.log('');
    
    // Launch requests in batches to maintain concurrency
    while (requestCount < TOTAL_REQUESTS) {
        // Launch a batch of concurrent requests
        const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - requestCount);
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
            const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
            batchPromises.push(makeRequest(endpoint));
            requestCount++;
        }
        
        // Wait for this batch to complete before launching the next
        await Promise.all(batchPromises);
        
        // Show progress
        const progress = (completedRequests / TOTAL_REQUESTS * 100).toFixed(1);
        const avgResponseTime = totalResponseTime / completedRequests;
        const successRate = (successfulRequests / completedRequests * 100).toFixed(1);
        
        console.log(`📊 Progress: ${progress}% | Completed: ${completedRequests}/${TOTAL_REQUESTS} | Success: ${successRate}% | Avg Response: ${avgResponseTime.toFixed(1)}ms | Active: ${activeRequests}`);
    }
}

// Function to display final results
function displayResults() {
    const endTime = performance.now();
    const totalDuration = (endTime - startTime) / 1000; // Convert to seconds
    const avgResponseTime = totalResponseTime / completedRequests;
    const requestsPerSecond = completedRequests / totalDuration;
    const successRate = (successfulRequests / completedRequests * 100);
    
    console.log('');
    console.log('🏆 REAL LOAD TEST RESULTS');
    console.log('========================');
    console.log(`📊 Total Requests: ${completedRequests}`);
    console.log(`✅ Successful: ${successfulRequests} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${failedRequests} (${(100 - successRate).toFixed(1)}%)`);
    console.log(`⏱️  Total Duration: ${totalDuration.toFixed(1)}s`);
    console.log(`⚡ Requests/Second: ${requestsPerSecond.toFixed(1)} RPS`);
    console.log(`📈 Avg Response Time: ${avgResponseTime.toFixed(1)}ms`);
    console.log(`📉 Min Response Time: ${minResponseTime.toFixed(1)}ms`);
    console.log(`📈 Max Response Time: ${maxResponseTime.toFixed(1)}ms`);
    console.log('');
    
    if (successRate >= 95) {
        console.log('🏆 EXCELLENT: System handled the load perfectly!');
    } else if (successRate >= 80) {
        console.log('✅ GOOD: System handled most requests successfully');
    } else if (successRate >= 50) {
        console.log('⚠️  WARNING: System showing stress under load');
    } else {
        console.log('🚨 CRITICAL: System breaking point reached');
    }
    
    console.log('');
    console.log('💡 TIP: Monitor your Docker stats during this test:');
    console.log('   docker stats');
    console.log('');
}

// Start the load test
generateLoad()
    .then(() => {
        displayResults();
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Load test failed:', error);
        displayResults();
        process.exit(1);
    });

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Load test interrupted by user');
    displayResults();
    process.exit(0);
});
