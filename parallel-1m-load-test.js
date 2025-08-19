#!/usr/bin/env node

const axios = require('axios');
const { performance } = require('perf_hooks');
const cluster = require('cluster');
const os = require('os');

const BASE_URL = 'http://localhost:8080'; // API Gateway
const TOTAL_REQUESTS = 1000000; // 1 Million requests
const CONCURRENCY_LIMIT = 2000; // Number of simultaneous requests per worker
const REQUEST_TIMEOUT = 30000; // 30 seconds timeout
const PROGRESS_INTERVAL = 5000; // Log progress every X requests
const NUM_WORKERS = os.cpus().length; // Use all CPU cores

const SERVICES = [
    { name: 'API Gateway', path: '/healthz' },
    { name: 'Identity', path: '/identity/actuator/health' },
    { name: 'Payments', path: '/payments/health' },
    { name: 'Commerce', path: '/commerce/health' },
    { name: 'Content', path: '/content/health' },
    { name: 'Bank Simulator', path: '/bank-simulator/api/banks' },
    { name: 'UPI Core', path: '/upi-core/health' },
    { name: 'Analytics', path: '/analytics/health' },
    { name: 'Notifications', path: '/notifications/health' },
    { name: 'Live Classes', path: '/live-classes/health' },
    { name: 'LLM Tutor', path: '/llm-tutor/health' },
    { name: 'Recommendations', path: '/recommendations/health' },
    { name: 'Admin Dashboard', path: '/admin/health' },
];

if (cluster.isMaster) {
    console.log('🚀 PARALLEL 1 MILLION USER LOAD TEST');
    console.log('====================================');
    console.log(`🎯 Target: ${TOTAL_REQUESTS.toLocaleString()} requests`);
    console.log(`⚡ Workers: ${NUM_WORKERS} (using all CPU cores)`);
    console.log(`🔥 Concurrency per worker: ${CONCURRENCY_LIMIT}`);
    console.log(`📊 Total concurrent connections: ${NUM_WORKERS * CONCURRENCY_LIMIT}`);
    console.log(`📡 Endpoints: ${SERVICES.length} different services`);
    console.log(`⏰ Timeout: ${REQUEST_TIMEOUT}ms`);
    console.log('');

    const requestsPerWorker = Math.floor(TOTAL_REQUESTS / NUM_WORKERS);
    const workers = [];
    const workerStats = {};
    
    let totalCompleted = 0;
    let totalSuccessful = 0;
    let totalResponseTime = 0;
    const startTime = performance.now();

    // Fork workers
    for (let i = 0; i < NUM_WORKERS; i++) {
        const worker = cluster.fork();
        workers.push(worker);
        workerStats[worker.process.pid] = {
            completed: 0,
            successful: 0,
            responseTime: 0
        };

        // Send work assignment to worker
        worker.send({
            workerId: i,
            requestsToProcess: requestsPerWorker,
            concurrencyLimit: CONCURRENCY_LIMIT
        });

        // Listen for progress updates from workers
        worker.on('message', (msg) => {
            if (msg.type === 'progress') {
                workerStats[worker.process.pid] = msg.stats;
                
                // Calculate totals
                totalCompleted = Object.values(workerStats).reduce((sum, stats) => sum + stats.completed, 0);
                totalSuccessful = Object.values(workerStats).reduce((sum, stats) => sum + stats.successful, 0);
                totalResponseTime = Object.values(workerStats).reduce((sum, stats) => sum + stats.responseTime, 0);
                
                if (totalCompleted % PROGRESS_INTERVAL === 0 || totalCompleted % 1000 === 0) {
                    const progress = (totalCompleted / TOTAL_REQUESTS) * 100;
                    const successRate = (totalSuccessful / totalCompleted) * 100;
                    const avgResponseTime = totalResponseTime / totalCompleted;
                    const elapsed = (performance.now() - startTime) / 1000;
                    const rps = totalCompleted / elapsed;
                    
                    console.log(`🔥 Progress: ${progress.toFixed(1)}% | Completed: ${totalCompleted.toLocaleString()}/${TOTAL_REQUESTS.toLocaleString()} | Success: ${successRate.toFixed(1)}% | Avg Response: ${avgResponseTime.toFixed(1)}ms | RPS: ${rps.toFixed(0)} | Workers: ${NUM_WORKERS}`);
                }
            }
        });
    }

    // Handle worker completion
    let completedWorkers = 0;
    cluster.on('exit', (worker, code, signal) => {
        completedWorkers++;
        console.log(`✅ Worker ${worker.process.pid} completed`);
        
        if (completedWorkers === NUM_WORKERS) {
            const endTime = performance.now();
            const totalDuration = (endTime - startTime) / 1000;
            const finalRPS = totalCompleted / totalDuration;
            const finalSuccessRate = (totalSuccessful / totalCompleted) * 100;
            const finalAvgResponseTime = totalResponseTime / totalCompleted;

            console.log('\n🏆 PARALLEL 1M USER LOAD TEST RESULTS');
            console.log('====================================');
            console.log(`📊 Total Requests: ${totalCompleted.toLocaleString()}`);
            console.log(`✅ Successful: ${totalSuccessful.toLocaleString()} (${finalSuccessRate.toFixed(1)}%)`);
            console.log(`❌ Failed: ${(totalCompleted - totalSuccessful).toLocaleString()} (${(100 - finalSuccessRate).toFixed(1)}%)`);
            console.log(`⏱️  Total Duration: ${totalDuration.toFixed(1)}s`);
            console.log(`⚡ Requests/Second: ${finalRPS.toFixed(0)} RPS`);
            console.log(`📈 Avg Response Time: ${finalAvgResponseTime.toFixed(1)}ms`);
            console.log(`🔧 Workers Used: ${NUM_WORKERS}`);
            console.log(`🔥 Max Concurrency: ${NUM_WORKERS * CONCURRENCY_LIMIT}`);

            if (finalSuccessRate < 50) {
                console.log('\n🚨 CRITICAL: System severely overloaded - major performance degradation');
            } else if (finalSuccessRate < 80) {
                console.log('\n⚠️  WARNING: System under extreme stress - performance issues detected');
            } else if (finalSuccessRate < 95) {
                console.log('\n📊 MODERATE: System handling load but showing stress signs');
            } else {
                console.log('\n🏆 EXCELLENT: System performing well under 1M user load!');
            }

            console.log('\n💡 TIP: Monitor Docker stats during this test:');
            console.log('   docker stats');
            
            process.exit(0);
        }
    });

} else {
    // Worker process
    let completedRequests = 0;
    let successfulRequests = 0;
    let totalResponseTime = 0;
    let activeRequests = 0;
    let workerId, requestsToProcess, concurrencyLimit;

    process.on('message', async (msg) => {
        workerId = msg.workerId;
        requestsToProcess = msg.requestsToProcess;
        concurrencyLimit = msg.concurrencyLimit;

        console.log(`🔧 Worker ${process.pid} starting: ${requestsToProcess.toLocaleString()} requests with ${concurrencyLimit} concurrency`);

        await runWorkerLoad();
        process.exit(0);
    });

    async function sendRequest(service) {
        activeRequests++;
        const start = performance.now();
        try {
            const response = await axios.get(`${BASE_URL}${service.path}`, { 
                timeout: REQUEST_TIMEOUT,
                headers: {
                    'User-Agent': `Parallel-1M-LoadTest-Worker-${workerId}`,
                    'X-Test-Type': 'Parallel-1M-User-Test',
                    'X-Worker-ID': workerId.toString(),
                    'Connection': 'keep-alive'
                }
            });
            const end = performance.now();
            const duration = end - start;

            completedRequests++;
            successfulRequests++;
            totalResponseTime += duration;

            // Send progress update every 100 requests
            if (completedRequests % 100 === 0) {
                process.send({
                    type: 'progress',
                    stats: {
                        completed: completedRequests,
                        successful: successfulRequests,
                        responseTime: totalResponseTime
                    }
                });
            }

            return { success: true, duration: duration, status: response.status };
        } catch (error) {
            const end = performance.now();
            const duration = end - start;
            completedRequests++;
            totalResponseTime += duration;

            if (completedRequests % 100 === 0) {
                process.send({
                    type: 'progress',
                    stats: {
                        completed: completedRequests,
                        successful: successfulRequests,
                        responseTime: totalResponseTime
                    }
                });
            }

            return { success: false, duration: duration, status: error.response ? error.response.status : 'N/A', message: error.message };
        } finally {
            activeRequests--;
        }
    }

    async function runWorkerLoad() {
        const promises = [];
        let serviceIndex = 0;

        for (let i = 0; i < requestsToProcess; i++) {
            const service = SERVICES[serviceIndex % SERVICES.length];
            promises.push(sendRequest(service));
            serviceIndex++;

            // Control concurrency
            if (activeRequests >= concurrencyLimit) {
                await Promise.race(promises.filter(p => p.then)); // Wait for at least one to finish
            }
        }

        await Promise.all(promises); // Wait for all requests to complete
        
        // Send final stats
        process.send({
            type: 'progress',
            stats: {
                completed: completedRequests,
                successful: successfulRequests,
                responseTime: totalResponseTime
            }
        });
    }
}
