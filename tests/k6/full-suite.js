import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for industry-grade monitoring
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const requestCounter = new Counter('requests_total');

export const options = {
  // Industry-grade performance thresholds
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    http_req_duration: ['p(95)<1000', 'p(99)<3000', 'avg<500'], // Response time SLAs
    errors: ['rate<0.01'], // Custom error rate
    response_time: ['p(95)<1000'], // Custom response time
  },
  
  // Multi-phase load testing scenarios
  scenarios: {
    // Warm-up phase
    warmup: {
      executor: 'constant-arrival-rate',
      rate: 25,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      tags: { phase: 'warmup' },
    },
    
    // Baseline load
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 200,
      maxVUs: 400,
      tags: { phase: 'baseline' },
      startTime: '1m',
    },
    
    // Sustained load
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 250,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 500,
      maxVUs: 800,
      tags: { phase: 'sustained' },
      startTime: '3m',
    },
    
    // Peak spike
    spike: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 800,
      maxVUs: 1200,
      tags: { phase: 'spike' },
      startTime: '6m',
    },
    
    // Breaking point test
    breaking_point: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 1500,
      maxVUs: 2000,
      tags: { phase: 'breaking_point' },
      startTime: '8m',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Industry-grade service endpoints with weights
const services = [
  { path: '/healthz', weight: 15, name: 'api_gateway' },
  { path: '/identity/actuator/health', weight: 12, name: 'identity' },
  { path: '/payments/health', weight: 15, name: 'payments' },
  { path: '/bank-simulator/api/banks', weight: 12, name: 'banking' },
  { path: '/upi-core/health', weight: 10, name: 'upi' },
  { path: '/content/health', weight: 10, name: 'content' },
  { path: '/live-classes/health', weight: 8, name: 'live_classes' },
  { path: '/commerce/health', weight: 8, name: 'commerce' },
  { path: '/analytics/health', weight: 5, name: 'analytics' },
  { path: '/notifications/health', weight: 5, name: 'notifications' },
  { path: '/admin/health', weight: 3, name: 'admin' },
  { path: '/llm-tutor/health', weight: 3, name: 'llm_tutor' },
  { path: '/recommendations/health', weight: 2, name: 'recommendations' },
];

// Weighted random selection for realistic traffic distribution
function selectService() {
  const totalWeight = services.reduce((sum, service) => sum + service.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const service of services) {
    random -= service.weight;
    if (random <= 0) {
      return service;
    }
  }
  return services[0]; // Fallback
}

export default function () {
  const service = selectService();
  const url = BASE_URL + service.path;
  
  // Industry-grade request headers
  const params = {
    headers: {
      'User-Agent': 'k6-IndustryGrade/1.0',
      'X-Test-Type': 'Industry-Performance-Test',
      'X-Service': service.name,
      'Accept': 'application/json',
      'Connection': 'keep-alive',
    },
    timeout: '30s',
  };
  
  const startTime = Date.now();
  const response = http.get(url, params);
  const endTime = Date.now();
  
  // Custom metrics tracking
  requestCounter.add(1, { service: service.name });
  responseTimeTrend.add(endTime - startTime, { service: service.name });
  
  // Industry-grade checks
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
    'response time < 3000ms': (r) => r.timings.duration < 3000,
    'has content-type header': (r) => r.headers['Content-Type'] !== undefined,
    'response body exists': (r) => r.body && r.body.length > 0,
  }, { service: service.name });
  
  // Track errors
  errorRate.add(!success, { service: service.name });
  
  // Realistic user behavior - small pause between requests
  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}

// Setup function for test initialization
export function setup() {
  console.log('🚀 Starting Industry-Grade Performance Test Suite');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`🎯 Services: ${services.length} endpoints`);
  console.log(`⏱️  Duration: 9 minutes total`);
  console.log(`🔥 Max Load: 1000 RPS`);
  
  // Warm-up check
  const response = http.get(BASE_URL + '/healthz');
  if (response.status !== 200) {
    throw new Error(`Setup failed: API Gateway not responding (${response.status})`);
  }
  
  return { timestamp: Date.now() };
}

// Teardown function for test cleanup
export function teardown(data) {
  console.log('✅ Industry-Grade Performance Test Completed');
  console.log(`📊 Test Duration: ${(Date.now() - data.timestamp) / 1000}s`);
}
