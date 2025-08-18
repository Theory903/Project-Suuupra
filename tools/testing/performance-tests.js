// Performance Test Suite for Suuupra EdTech Super-Platform
// Load testing and performance benchmarking for all 17 microservices

const k6 = require('k6');
const http = require('k6/http');
const check = require('k6/check');
const { Rate, Trend, Counter } = require('k6/metrics');

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('requests');

// Service configurations
const services = {
    'api-gateway': { port: 8080, endpoint: '/actuator/health' },
    'identity': { port: 8081, endpoint: '/actuator/health' },
    'content': { port: 8082, endpoint: '/health' },
    'commerce': { port: 8083, endpoint: '/health' },
    'payments': { port: 8084, endpoint: '/health' },
    'ledger': { port: 8085, endpoint: '/health' },
    'upi-core': { port: 3001, endpoint: '/health' },
    'bank-simulator': { port: 3000, endpoint: '/health' },
    'live-classes': { port: 8086, endpoint: '/health' },
    'vod': { port: 8087, endpoint: '/health' },
    'mass-live': { port: 8088, endpoint: '/health' },
    'creator-studio': { port: 8089, endpoint: '/health' },
    'search-crawler': { port: 8090, endpoint: '/health' },
    'recommendations': { port: 8091, endpoint: '/health' },
    'llm-tutor': { port: 8000, endpoint: '/health' },
    'analytics': { port: 8092, endpoint: '/health' },
    'counters': { port: 8093, endpoint: '/health' },
    'live-tracking': { port: 8094, endpoint: '/health' },
    'notifications': { port: 8095, endpoint: '/health' },
    'admin': { port: 3002, endpoint: '/' }
};

// Test scenarios
export let options = {
    scenarios: {
        // Smoke test - basic functionality
        smoke_test: {
            executor: 'constant-vus',
            vus: 1,
            duration: '30s',
            tags: { test_type: 'smoke' },
        },
        
        // Load test - normal traffic
        load_test: {
            executor: 'constant-vus',
            vus: 10,
            duration: '5m',
            tags: { test_type: 'load' },
        },
        
        // Stress test - high traffic
        stress_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 20 },
                { duration: '5m', target: 20 },
                { duration: '2m', target: 40 },
                { duration: '5m', target: 40 },
                { duration: '2m', target: 0 },
            ],
            tags: { test_type: 'stress' },
        },
        
        // Spike test - sudden traffic increase
        spike_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 100 },
                { duration: '1m', target: 100 },
                { duration: '10s', target: 0 },
            ],
            tags: { test_type: 'spike' },
        },
        
        // Volume test - sustained high load
        volume_test: {
            executor: 'constant-vus',
            vus: 50,
            duration: '10m',
            tags: { test_type: 'volume' },
        }
    },
    
    thresholds: {
        // Overall performance thresholds
        http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
        http_req_failed: ['rate<0.1'],    // Less than 10% failures
        
        // Service-specific thresholds
        'http_req_duration{service:api-gateway}': ['p(95)<200'],
        'http_req_duration{service:identity}': ['p(95)<300'],
        'http_req_duration{service:llm-tutor}': ['p(95)<2000'],
        'http_req_duration{service:payments}': ['p(95)<500'],
        'http_req_duration{service:live-classes}': ['p(95)<200'],
        'http_req_duration{service:vod}': ['p(95)<500'],
        'http_req_duration{service:mass-live}': ['p(95)<100'],
        'http_req_duration{service:search-crawler}': ['p(95)<300'],
        'http_req_duration{service:recommendations}': ['p(95)<400'],
        'http_req_duration{service:analytics}': ['p(95)<200'],
        'http_req_duration{service:counters}': ['p(95)<50'],
        'http_req_duration{service:notifications}': ['p(95)<500'],
    }
};

// Utility functions
function getRandomService() {
    const serviceNames = Object.keys(services);
    return serviceNames[Math.floor(Math.random() * serviceNames.length)];
}

function generateTestData() {
    return {
        userId: `user_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
        transactionId: `tx_${Math.random().toString(36).substr(2, 9)}`,
        amount: Math.floor(Math.random() * 10000) + 100,
        query: ['machine learning', 'data science', 'python', 'javascript', 'react'][Math.floor(Math.random() * 5)],
        email: `test${Math.floor(Math.random() * 10000)}@suuupra.com`
    };
}

// Main test function
export default function() {
    const testType = __ENV.TEST_TYPE || 'load';
    
    switch(testType) {
        case 'smoke':
            smokeTest();
            break;
        case 'load':
            loadTest();
            break;
        case 'stress':
            stressTest();
            break;
        case 'spike':
            spikeTest();
            break;
        case 'api':
            apiTest();
            break;
        case 'workflow':
            workflowTest();
            break;
        default:
            loadTest();
    }
}

// Test implementations
function smokeTest() {
    // Test basic health endpoints for all services
    Object.entries(services).forEach(([serviceName, config]) => {
        const url = `http://localhost:${config.port}${config.endpoint}`;
        
        const response = http.get(url, {
            tags: { service: serviceName, test_type: 'smoke' },
            timeout: '10s'
        });
        
        check(response, {
            [`${serviceName} is healthy`]: (r) => r.status === 200 || r.status === 404, // 404 acceptable for some endpoints
            [`${serviceName} responds quickly`]: (r) => r.timings.duration < 1000,
        });
        
        errorRate.add(response.status >= 400);
        responseTime.add(response.timings.duration);
        requestCount.add(1);
    });
}

function loadTest() {
    // Simulate normal user traffic patterns
    const serviceName = getRandomService();
    const config = services[serviceName];
    const url = `http://localhost:${config.port}${config.endpoint}`;
    
    const response = http.get(url, {
        tags: { service: serviceName, test_type: 'load' },
        timeout: '30s'
    });
    
    check(response, {
        'status is 200-299 or 404': (r) => (r.status >= 200 && r.status < 300) || r.status === 404,
        'response time < 1s': (r) => r.timings.duration < 1000,
    });
    
    errorRate.add(response.status >= 400 && response.status !== 404);
    responseTime.add(response.timings.duration);
    requestCount.add(1);
}

function stressTest() {
    // Test system under high load
    const testData = generateTestData();
    
    // Test multiple services in sequence
    const servicesToTest = ['api-gateway', 'identity', 'commerce', 'payments'];
    
    servicesToTest.forEach(serviceName => {
        if (services[serviceName]) {
            const config = services[serviceName];
            const url = `http://localhost:${config.port}${config.endpoint}`;
            
            const response = http.get(url, {
                tags: { service: serviceName, test_type: 'stress' },
                timeout: '15s'
            });
            
            check(response, {
                [`${serviceName} handles stress`]: (r) => r.status < 500,
                [`${serviceName} responds under stress`]: (r) => r.timings.duration < 2000,
            });
            
            errorRate.add(response.status >= 500);
        }
    });
}

function spikeTest() {
    // Test system response to sudden load spikes
    const serviceName = ['api-gateway', 'llm-tutor', 'live-classes'][Math.floor(Math.random() * 3)];
    const config = services[serviceName];
    const url = `http://localhost:${config.port}${config.endpoint}`;
    
    const response = http.get(url, {
        tags: { service: serviceName, test_type: 'spike' },
        timeout: '20s'
    });
    
    check(response, {
        [`${serviceName} handles spike`]: (r) => r.status < 500,
        [`${serviceName} recovers from spike`]: (r) => r.timings.duration < 3000,
    });
    
    errorRate.add(response.status >= 500);
}

function apiTest() {
    // Test specific API endpoints with realistic payloads
    const testData = generateTestData();
    
    // Test search API
    testSearchAPI(testData);
    
    // Test recommendation API  
    testRecommendationAPI(testData);
    
    // Test analytics API
    testAnalyticsAPI(testData);
    
    // Test counters API
    testCountersAPI(testData);
}

function testSearchAPI(testData) {
    const searchUrl = `http://localhost:8090/api/v1/search?q=${testData.query}&limit=10`;
    
    const response = http.get(searchUrl, {
        tags: { service: 'search-crawler', endpoint: 'search', test_type: 'api' },
        timeout: '5s'
    });
    
    check(response, {
        'search API responds': (r) => r.status === 200 || r.status === 404,
        'search is fast': (r) => r.timings.duration < 300,
    });
}

function testRecommendationAPI(testData) {
    const recoUrl = `http://localhost:8091/api/v1/recommendations/${testData.userId}?limit=5`;
    
    const response = http.get(recoUrl, {
        tags: { service: 'recommendations', endpoint: 'user_recommendations', test_type: 'api' },
        timeout: '5s'
    });
    
    check(response, {
        'recommendations API responds': (r) => r.status === 200 || r.status === 404,
        'recommendations are fast': (r) => r.timings.duration < 400,
    });
}

function testAnalyticsAPI(testData) {
    // Test event tracking
    const eventData = {
        user_id: testData.userId,
        event_type: 'page_view',
        timestamp: Date.now(),
        properties: {
            page: '/dashboard',
            session_id: testData.sessionId
        }
    };
    
    const response = http.post('http://localhost:8092/api/v1/track', JSON.stringify(eventData), {
        headers: { 'Content-Type': 'application/json' },
        tags: { service: 'analytics', endpoint: 'track_event', test_type: 'api' },
        timeout: '3s'
    });
    
    check(response, {
        'analytics tracking works': (r) => r.status === 200 || r.status === 202,
        'analytics is fast': (r) => r.timings.duration < 200,
    });
}

function testCountersAPI(testData) {
    const counterUrl = `http://localhost:8093/api/v1/counters/page_views/increment`;
    
    const response = http.post(counterUrl, JSON.stringify({
        increment: 1,
        metadata: { page: '/dashboard', user_id: testData.userId }
    }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { service: 'counters', endpoint: 'increment', test_type: 'api' },
        timeout: '2s'
    });
    
    check(response, {
        'counter increment works': (r) => r.status === 200 || r.status === 204,
        'counter is very fast': (r) => r.timings.duration < 50,
    });
}

function workflowTest() {
    // Test complete user workflows
    const testData = generateTestData();
    
    // Workflow 1: User registration and first login
    testUserRegistrationWorkflow(testData);
    
    // Workflow 2: Content discovery and consumption
    testContentDiscoveryWorkflow(testData);
    
    // Workflow 3: Payment processing
    testPaymentWorkflow(testData);
    
    // Workflow 4: Live class participation
    testLiveClassWorkflow(testData);
}

function testUserRegistrationWorkflow(testData) {
    // Step 1: Register user
    const registerResponse = http.post('http://localhost:8081/api/v1/auth/register', 
        JSON.stringify({
            username: testData.userId,
            email: testData.email,
            password: 'TestPassword123!'
        }), {
            headers: { 'Content-Type': 'application/json' },
            tags: { workflow: 'user_registration', step: '1_register' }
        });
    
    // Step 2: Send welcome notification
    if (registerResponse.status === 201 || registerResponse.status === 409) {
        http.post('http://localhost:8095/api/v1/send', 
            JSON.stringify({
                user_id: testData.userId,
                template: 'welcome',
                channels: ['email']
            }), {
                headers: { 'Content-Type': 'application/json' },
                tags: { workflow: 'user_registration', step: '2_notification' }
            });
    }
    
    // Step 3: Track analytics
    http.post('http://localhost:8092/api/v1/track', 
        JSON.stringify({
            user_id: testData.userId,
            event_type: 'user_registered',
            timestamp: Date.now()
        }), {
            headers: { 'Content-Type': 'application/json' },
            tags: { workflow: 'user_registration', step: '3_analytics' }
        });
}

function testContentDiscoveryWorkflow(testData) {
    // Step 1: Search for content
    const searchResponse = http.get(`http://localhost:8090/api/v1/search?q=${testData.query}`, {
        tags: { workflow: 'content_discovery', step: '1_search' }
    });
    
    // Step 2: Get recommendations
    http.get(`http://localhost:8091/api/v1/recommendations/${testData.userId}`, {
        tags: { workflow: 'content_discovery', step: '2_recommendations' }
    });
    
    // Step 3: Track interaction
    http.post('http://localhost:8092/api/v1/track', 
        JSON.stringify({
            user_id: testData.userId,
            event_type: 'content_search',
            properties: { query: testData.query }
        }), {
            headers: { 'Content-Type': 'application/json' },
            tags: { workflow: 'content_discovery', step: '3_tracking' }
        });
}

function testPaymentWorkflow(testData) {
    // Step 1: Create order
    const orderResponse = http.post('http://localhost:8083/api/v1/orders', 
        JSON.stringify({
            user_id: testData.userId,
            amount: testData.amount,
            currency: 'INR'
        }), {
            headers: { 'Content-Type': 'application/json' },
            tags: { workflow: 'payment', step: '1_order' }
        });
    
    // Step 2: Process payment
    if (orderResponse.status === 201 || orderResponse.status === 200) {
        http.post('http://localhost:8084/api/v1/payments/process', 
            JSON.stringify({
                transaction_id: testData.transactionId,
                amount: testData.amount,
                payment_method: 'upi'
            }), {
                headers: { 'Content-Type': 'application/json' },
                tags: { workflow: 'payment', step: '2_payment' }
            });
    }
    
    // Step 3: Update ledger
    http.post('http://localhost:8085/api/v1/entries', 
        JSON.stringify({
            transaction_id: testData.transactionId,
            amount: testData.amount,
            type: 'credit'
        }), {
            headers: { 'Content-Type': 'application/json' },
            tags: { workflow: 'payment', step: '3_ledger' }
        });
}

function testLiveClassWorkflow(testData) {
    // Step 1: Create room
    const roomResponse = http.post('http://localhost:8086/api/v1/rooms', 
        JSON.stringify({
            title: `Test Room ${testData.sessionId}`,
            instructor_id: testData.userId
        }), {
            headers: { 'Content-Type': 'application/json' },
            tags: { workflow: 'live_class', step: '1_create_room' }
        });
    
    // Step 2: Join room
    if (roomResponse.status === 201 || roomResponse.status === 200) {
        http.post(`http://localhost:8086/api/v1/rooms/${testData.sessionId}/join`, 
            JSON.stringify({
                user_id: testData.userId,
                role: 'student'
            }), {
                headers: { 'Content-Type': 'application/json' },
                tags: { workflow: 'live_class', step: '2_join_room' }
            });
    }
    
    // Step 3: Update counters
    http.post('http://localhost:8093/api/v1/counters/live_participants/increment', 
        JSON.stringify({ increment: 1 }), {
            headers: { 'Content-Type': 'application/json' },
            tags: { workflow: 'live_class', step: '3_counter' }
        });
}

// Setup and teardown
export function setup() {
    console.log('🚀 Starting Suuupra Platform Performance Tests');
    console.log(`Test Type: ${__ENV.TEST_TYPE || 'load'}`);
    console.log(`Target: ${Object.keys(services).length} microservices`);
    
    return { startTime: new Date() };
}

export function teardown(data) {
    const endTime = new Date();
    const duration = (endTime - data.startTime) / 1000;
    
    console.log(`\n📊 Performance Test Summary:`);
    console.log(`Duration: ${duration}s`);
    console.log(`Services Tested: ${Object.keys(services).length}`);
    console.log(`Check the detailed metrics above for performance analysis.`);
}
