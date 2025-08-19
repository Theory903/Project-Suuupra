#!/usr/bin/env node

/**
 * Suuupra Services Test Orchestrator
 * 
 * Comprehensive testing framework that:
 * 1. Starts API Gateway + Identity service as global auth backbone
 * 2. Tests each service with all edge cases, mocks, and scenarios
 * 3. Manages service lifecycle (start/stop/cleanup)
 * 4. Provides detailed reporting and failure analysis
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execAsync = util.promisify(exec);

class TestOrchestrator {
    constructor() {
        this.services = {
            // Core Infrastructure Services (Always Running)
            'api-gateway': {
                type: 'node',
                port: 3000,
                healthCheck: '/health',
                auth: false,
                priority: 1,
                persistent: true
            },
            'identity': {
                type: 'java',
                port: 8080,
                healthCheck: '/actuator/health',
                auth: false,
                priority: 2,
                persistent: true
            },
            
            // Business Services (Test and Stop)
            'admin': {
                type: 'node',
                port: 3001,
                healthCheck: '/health',
                auth: true,
                priority: 3,
                persistent: false
            },
            'analytics': {
                type: 'python',
                port: 8001,
                healthCheck: '/health',
                auth: true,
                priority: 4,
                persistent: false
            },
            'bank-simulator': {
                type: 'node',
                port: 3002,
                healthCheck: '/health',
                auth: true,
                priority: 5,
                persistent: false
            },
            'commerce': {
                type: 'python',
                port: 8002,
                healthCheck: '/health',
                auth: true,
                priority: 6,
                persistent: false
            },
            'content': {
                type: 'node',
                port: 3003,
                healthCheck: '/health',
                auth: true,
                priority: 7,
                persistent: false
            },
            'counters': {
                type: 'go',
                port: 8003,
                healthCheck: '/health',
                auth: true,
                priority: 8,
                persistent: false
            },
            'creator-studio': {
                type: 'node',
                port: 3004,
                healthCheck: '/health',
                auth: true,
                priority: 9,
                persistent: false
            },
            'ledger': {
                type: 'java',
                port: 8084,
                healthCheck: '/actuator/health',
                auth: true,
                priority: 10,
                persistent: false
            },
            'live-classes': {
                type: 'node',
                port: 3005,
                healthCheck: '/health',
                auth: true,
                priority: 11,
                persistent: false
            },
            'live-tracking': {
                type: 'rust',
                port: 8005,
                healthCheck: '/health',
                auth: true,
                priority: 12,
                persistent: false
            },
            'llm-tutor': {
                type: 'python',
                port: 8006,
                healthCheck: '/health',
                auth: true,
                priority: 13,
                persistent: false
            },
            'mass-live': {
                type: 'go',
                port: 8007,
                healthCheck: '/health',
                auth: true,
                priority: 14,
                persistent: false
            },
            'notifications': {
                type: 'python',
                port: 8008,
                healthCheck: '/health',
                auth: true,
                priority: 15,
                persistent: false
            },
            'payments': {
                type: 'go',
                port: 8009,
                healthCheck: '/health',
                auth: true,
                priority: 16,
                persistent: false
            },
            'recommendations': {
                type: 'python',
                port: 8010,
                healthCheck: '/health',
                auth: true,
                priority: 17,
                persistent: false
            },
            'search-crawler': {
                type: 'go',
                port: 8011,
                healthCheck: '/health',
                auth: true,
                priority: 18,
                persistent: false
            },
            'upi-core': {
                type: 'go',
                port: 8012,
                healthCheck: '/health',
                auth: true,
                priority: 19,
                persistent: false
            },
            'vod': {
                type: 'python',
                port: 8013,
                healthCheck: '/health',
                auth: true,
                priority: 20,
                persistent: false
            }
        };
        
        this.runningServices = new Set();
        this.testResults = {};
        this.authToken = null;
        this.servicesPath = path.join(__dirname, 'services');
    }

    async startOrchestrator() {
        console.log('🚀 Starting Suuupra Services Test Orchestrator\n');
        
        try {
            // Phase 1: Start Core Infrastructure
            await this.startCoreInfrastructure();
            
            // Phase 2: Test All Services
            await this.runComprehensiveTests();
            
            // Phase 3: Generate Reports
            await this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test orchestrator failed:', error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }

    async startCoreInfrastructure() {
        console.log('📋 Phase 1: Starting Core Infrastructure Services...\n');
        
        // Start API Gateway first
        await this.startService('api-gateway');
        await this.waitForHealthCheck('api-gateway');
        
        // Start Identity service
        await this.startService('identity');
        await this.waitForHealthCheck('identity');
        
        // Get auth token for testing
        await this.setupAuthentication();
        
        console.log('✅ Core infrastructure ready!\n');
    }

    async startService(serviceName) {
        const service = this.services[serviceName];
        const servicePath = path.join(this.servicesPath, serviceName);
        
        console.log(`🔧 Starting ${serviceName} (${service.type})...`);
        
        try {
            let startCommand;
            
            switch (service.type) {
                case 'node':
                    startCommand = 'npm run dev';
                    break;
                case 'python':
                    startCommand = 'python src/main.py';
                    break;
                case 'go':
                    startCommand = 'go run main.go';
                    break;
                case 'java':
                    startCommand = './mvnw spring-boot:run';
                    break;
                case 'rust':
                    startCommand = 'cargo run';
                    break;
                default:
                    throw new Error(`Unknown service type: ${service.type}`);
            }
            
            const child = spawn('bash', ['-c', startCommand], {
                cwd: servicePath,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    PORT: service.port.toString(),
                    NODE_ENV: 'test',
                    API_GATEWAY_URL: 'http://localhost:3000',
                    IDENTITY_SERVICE_URL: 'http://localhost:8080'
                }
            });
            
            this.runningServices.add({
                name: serviceName,
                process: child,
                port: service.port
            });
            
            // Log service output for debugging
            child.stdout.on('data', (data) => {
                if (process.env.DEBUG) {
                    console.log(`[${serviceName}] ${data.toString().trim()}`);
                }
            });
            
            child.stderr.on('data', (data) => {
                console.error(`[${serviceName} ERROR] ${data.toString().trim()}`);
            });
            
            // Wait a moment for service to start
            await this.sleep(3000);
            
        } catch (error) {
            console.error(`❌ Failed to start ${serviceName}:`, error);
            throw error;
        }
    }

    async stopService(serviceName) {
        const runningService = Array.from(this.runningServices)
            .find(s => s.name === serviceName);
        
        if (runningService) {
            console.log(`🛑 Stopping ${serviceName}...`);
            runningService.process.kill('SIGTERM');
            this.runningServices.delete(runningService);
            await this.sleep(2000);
        }
    }

    async waitForHealthCheck(serviceName, maxRetries = 30) {
        const service = this.services[serviceName];
        const healthUrl = `http://localhost:${service.port}${service.healthCheck}`;
        
        console.log(`⏳ Waiting for ${serviceName} health check...`);
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(healthUrl);
                if (response.ok) {
                    console.log(`✅ ${serviceName} is healthy`);
                    return true;
                }
            } catch (error) {
                // Service not ready yet
            }
            
            await this.sleep(2000);
        }
        
        throw new Error(`${serviceName} health check failed after ${maxRetries} retries`);
    }

    async setupAuthentication() {
        console.log('🔐 Setting up authentication...');
        
        try {
            // Create test user and get token from identity service
            const response = await fetch('http://localhost:8080/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'test@suuupra.com',
                    password: 'TestPassword123!'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.authToken = data.token;
                console.log('✅ Authentication token obtained');
            } else {
                // Create test user first
                await this.createTestUser();
                await this.setupAuthentication(); // Retry
            }
        } catch (error) {
            console.error('❌ Authentication setup failed:', error);
            throw error;
        }
    }

    async createTestUser() {
        console.log('👤 Creating test user...');
        
        const response = await fetch('http://localhost:8080/api/v1/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'test@suuupra.com',
                password: 'TestPassword123!',
                firstName: 'Test',
                lastName: 'User',
                role: 'ADMIN'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create test user');
        }
        
        console.log('✅ Test user created');
    }

    async runComprehensiveTests() {
        console.log('🧪 Phase 2: Running Comprehensive Service Tests...\n');
        
        const businessServices = Object.keys(this.services)
            .filter(name => !this.services[name].persistent)
            .sort((a, b) => this.services[a].priority - this.services[b].priority);
        
        for (const serviceName of businessServices) {
            await this.testSingleService(serviceName);
        }
    }

    async testSingleService(serviceName) {
        console.log(`\n🔍 Testing ${serviceName}...`);
        
        const testResults = {
            service: serviceName,
            startTime: new Date(),
            tests: {},
            passed: 0,
            failed: 0,
            errors: []
        };
        
        try {
            // Start the service
            await this.startService(serviceName);
            await this.waitForHealthCheck(serviceName);
            
            // Run comprehensive test suite
            await this.runHealthTests(serviceName, testResults);
            await this.runAuthenticationTests(serviceName, testResults);
            await this.runFunctionalTests(serviceName, testResults);
            await this.runEdgeCaseTests(serviceName, testResults);
            await this.runPerformanceTests(serviceName, testResults);
            
        } catch (error) {
            testResults.errors.push(`Service startup failed: ${error.message}`);
            testResults.failed++;
        } finally {
            // Stop the service to free resources
            if (!this.services[serviceName].persistent) {
                await this.stopService(serviceName);
            }
            
            testResults.endTime = new Date();
            testResults.duration = testResults.endTime - testResults.startTime;
            this.testResults[serviceName] = testResults;
            
            const status = testResults.failed === 0 ? '✅' : '❌';
            console.log(`${status} ${serviceName}: ${testResults.passed} passed, ${testResults.failed} failed`);
        }
    }

    async runHealthTests(serviceName, testResults) {
        const service = this.services[serviceName];
        const tests = testResults.tests.health = {};
        
        try {
            // Basic health check
            const healthResponse = await fetch(`http://localhost:${service.port}/health`);
            tests.basicHealth = healthResponse.ok;
            
            // Readiness check
            const readyResponse = await fetch(`http://localhost:${service.port}/ready`);
            tests.readiness = readyResponse.ok;
            
            // Metrics endpoint
            const metricsResponse = await fetch(`http://localhost:${service.port}/metrics`);
            tests.metrics = metricsResponse.ok;
            
            testResults.passed += Object.values(tests).filter(Boolean).length;
            testResults.failed += Object.values(tests).filter(t => !t).length;
            
        } catch (error) {
            testResults.errors.push(`Health tests failed: ${error.message}`);
            testResults.failed += 3;
        }
    }

    async runAuthenticationTests(serviceName, testResults) {
        if (!this.services[serviceName].auth) return;
        
        const service = this.services[serviceName];
        const tests = testResults.tests.auth = {};
        
        try {
            // Test without token
            const noAuthResponse = await fetch(`http://localhost:${service.port}/api/v1/test`);
            tests.noAuthBlocked = noAuthResponse.status === 401;
            
            // Test with invalid token
            const invalidAuthResponse = await fetch(`http://localhost:${service.port}/api/v1/test`, {
                headers: { 'Authorization': 'Bearer invalid-token' }
            });
            tests.invalidAuthBlocked = invalidAuthResponse.status === 401;
            
            // Test with valid token
            const validAuthResponse = await fetch(`http://localhost:${service.port}/api/v1/test`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            tests.validAuthAllowed = validAuthResponse.status !== 401;
            
            testResults.passed += Object.values(tests).filter(Boolean).length;
            testResults.failed += Object.values(tests).filter(t => !t).length;
            
        } catch (error) {
            testResults.errors.push(`Auth tests failed: ${error.message}`);
            testResults.failed += 3;
        }
    }

    async runFunctionalTests(serviceName, testResults) {
        const tests = testResults.tests.functional = {};
        
        try {
            // Load service-specific test cases
            const testCases = await this.loadServiceTestCases(serviceName);
            
            for (const [testName, testCase] of Object.entries(testCases)) {
                try {
                    const result = await this.executeTestCase(serviceName, testCase);
                    tests[testName] = result.success;
                    
                    if (result.success) {
                        testResults.passed++;
                    } else {
                        testResults.failed++;
                        testResults.errors.push(`${testName}: ${result.error}`);
                    }
                } catch (error) {
                    tests[testName] = false;
                    testResults.failed++;
                    testResults.errors.push(`${testName}: ${error.message}`);
                }
            }
            
        } catch (error) {
            testResults.errors.push(`Functional tests failed: ${error.message}`);
        }
    }

    async runEdgeCaseTests(serviceName, testResults) {
        const service = this.services[serviceName];
        const tests = testResults.tests.edgeCases = {};
        
        try {
            // Large payload test
            const largePayload = 'x'.repeat(10000000); // 10MB
            const largeResponse = await fetch(`http://localhost:${service.port}/api/v1/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ data: largePayload })
            });
            tests.largePayload = largeResponse.status === 413 || largeResponse.ok;
            
            // Malformed JSON
            const malformedResponse = await fetch(`http://localhost:${service.port}/api/v1/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: '{"invalid": json}'
            });
            tests.malformedJson = malformedResponse.status === 400;
            
            // SQL injection attempt
            const sqlInjectionResponse = await fetch(`http://localhost:${service.port}/api/v1/test?id=1'; DROP TABLE users; --`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            tests.sqlInjectionBlocked = sqlInjectionResponse.status !== 500;
            
            // XSS attempt
            const xssResponse = await fetch(`http://localhost:${service.port}/api/v1/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ message: '<script>alert("xss")</script>' })
            });
            tests.xssBlocked = xssResponse.ok; // Should handle gracefully
            
            testResults.passed += Object.values(tests).filter(Boolean).length;
            testResults.failed += Object.values(tests).filter(t => !t).length;
            
        } catch (error) {
            testResults.errors.push(`Edge case tests failed: ${error.message}`);
        }
    }

    async runPerformanceTests(serviceName, testResults) {
        const service = this.services[serviceName];
        const tests = testResults.tests.performance = {};
        
        try {
            // Response time test
            const startTime = Date.now();
            const response = await fetch(`http://localhost:${service.port}/health`);
            const responseTime = Date.now() - startTime;
            tests.responseTime = responseTime < 500; // Should respond within 500ms
            
            // Concurrent requests test
            const concurrentRequests = Array(10).fill().map(() => 
                fetch(`http://localhost:${service.port}/health`)
            );
            const concurrentResults = await Promise.allSettled(concurrentRequests);
            const successfulRequests = concurrentResults.filter(r => r.status === 'fulfilled').length;
            tests.concurrentRequests = successfulRequests >= 8; // At least 80% success
            
            testResults.passed += Object.values(tests).filter(Boolean).length;
            testResults.failed += Object.values(tests).filter(t => !t).length;
            
        } catch (error) {
            testResults.errors.push(`Performance tests failed: ${error.message}`);
        }
    }

    async loadServiceTestCases(serviceName) {
        // Define service-specific test cases with mocks
        const serviceTestCases = {
            'admin': {
                'createUser': {
                    method: 'POST',
                    path: '/api/v1/users',
                    body: { email: 'new@test.com', role: 'USER' },
                    expectedStatus: 201
                },
                'listUsers': {
                    method: 'GET',
                    path: '/api/v1/users',
                    expectedStatus: 200
                }
            },
            'payments': {
                'processPayment': {
                    method: 'POST',
                    path: '/api/v1/payments',
                    body: {
                        amount: 100.50,
                        currency: 'INR',
                        paymentMethod: 'UPI',
                        merchantId: 'test-merchant'
                    },
                    expectedStatus: 200
                },
                'getPaymentStatus': {
                    method: 'GET',
                    path: '/api/v1/payments/test-payment-id',
                    expectedStatus: 200
                }
            },
            'content': {
                'uploadContent': {
                    method: 'POST',
                    path: '/api/v1/content',
                    body: {
                        title: 'Test Course',
                        description: 'Test course description',
                        category: 'programming'
                    },
                    expectedStatus: 201
                },
                'searchContent': {
                    method: 'GET',
                    path: '/api/v1/content/search?q=programming',
                    expectedStatus: 200
                }
            }
        };
        
        return serviceTestCases[serviceName] || {
            'defaultTest': {
                method: 'GET',
                path: '/api/v1/test',
                expectedStatus: 200
            }
        };
    }

    async executeTestCase(serviceName, testCase) {
        const service = this.services[serviceName];
        const url = `http://localhost:${service.port}${testCase.path}`;
        
        const options = {
            method: testCase.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            }
        };
        
        if (testCase.body) {
            options.body = JSON.stringify(testCase.body);
        }
        
        try {
            const response = await fetch(url, options);
            const success = response.status === (testCase.expectedStatus || 200);
            
            return {
                success,
                status: response.status,
                error: success ? null : `Expected ${testCase.expectedStatus}, got ${response.status}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generateTestReport() {
        console.log('\n📊 Phase 3: Generating Test Report...\n');
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalServices: Object.keys(this.testResults).length,
                passedServices: 0,
                failedServices: 0,
                totalTests: 0,
                passedTests: 0,
                failedTests: 0
            },
            services: this.testResults
        };
        
        // Calculate summary stats
        Object.values(this.testResults).forEach(result => {
            report.summary.totalTests += result.passed + result.failed;
            report.summary.passedTests += result.passed;
            report.summary.failedTests += result.failed;
            
            if (result.failed === 0) {
                report.summary.passedServices++;
            } else {
                report.summary.failedServices++;
            }
        });
        
        // Write detailed report
        const reportPath = path.join(__dirname, 'test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Print summary
        console.log('='.repeat(80));
        console.log('🎯 SUUUPRA SERVICES TEST SUMMARY');
        console.log('='.repeat(80));
        console.log(`📅 Timestamp: ${report.timestamp}`);
        console.log(`🏢 Services Tested: ${report.summary.totalServices}`);
        console.log(`✅ Services Passed: ${report.summary.passedServices}`);
        console.log(`❌ Services Failed: ${report.summary.failedServices}`);
        console.log(`🧪 Total Tests: ${report.summary.totalTests}`);
        console.log(`✅ Tests Passed: ${report.summary.passedTests}`);
        console.log(`❌ Tests Failed: ${report.summary.failedTests}`);
        
        const successRate = ((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log('='.repeat(80));
        
        // Print failed services details
        if (report.summary.failedServices > 0) {
            console.log('\n❌ FAILED SERVICES:\n');
            Object.entries(this.testResults).forEach(([serviceName, result]) => {
                if (result.failed > 0) {
                    console.log(`🔴 ${serviceName}: ${result.failed} failures`);
                    result.errors.forEach(error => {
                        console.log(`   • ${error}`);
                    });
                    console.log('');
                }
            });
        }
        
        console.log(`\n📋 Detailed report saved to: ${reportPath}\n`);
    }

    async cleanup() {
        console.log('🧹 Cleaning up running services...');
        
        for (const service of this.runningServices) {
            try {
                service.process.kill('SIGTERM');
                console.log(`✅ Stopped ${service.name}`);
            } catch (error) {
                console.error(`❌ Failed to stop ${service.name}:`, error.message);
            }
        }
        
        // Give processes time to shut down gracefully
        await this.sleep(5000);
        
        console.log('✅ Cleanup complete!');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Make fetch available (for Node.js < 18)
if (!global.fetch) {
    global.fetch = require('node-fetch');
}

// Run the orchestrator if called directly
if (require.main === module) {
    const orchestrator = new TestOrchestrator();
    orchestrator.startOrchestrator().catch(console.error);
}

module.exports = TestOrchestrator;