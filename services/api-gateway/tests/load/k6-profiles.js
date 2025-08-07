import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const latencyTrend = new Trend('latency');
const authFailures = new Counter('auth_failures');
const rateLimitHits = new Counter('rate_limit_hits');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const API_KEY = __ENV.API_KEY || '';

// Test profiles
export const profiles = {
  // Baseline load test - normal traffic patterns
  baseline: {
    stages: [
      { duration: '2m', target: 100 },  // Ramp up
      { duration: '10m', target: 100 }, // Steady state
      { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<150', 'p(99)<500'],
      http_req_failed: ['rate<0.01'], // <1% errors
      errors: ['rate<0.01'],
    },
  },

  // Stress test - find breaking point
  stress: {
    stages: [
      { duration: '5m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '5m', target: 400 },
      { duration: '5m', target: 800 },
      { duration: '5m', target: 1600 },
      { duration: '10m', target: 1600 }, // Stay at peak
      { duration: '5m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
      http_req_failed: ['rate<0.05'], // <5% errors acceptable under stress
    },
  },

  // Spike test - sudden traffic increases
  spike: {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '1m', target: 2000 }, // Sudden spike
      { duration: '2m', target: 2000 },
      { duration: '1m', target: 100 },  // Back to normal
      { duration: '5m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed: ['rate<0.1'], // <10% errors during spike
    },
  },

  // Soak test - extended duration
  soak: {
    stages: [
      { duration: '5m', target: 200 },
      { duration: '4h', target: 200 }, // Extended duration
      { duration: '5m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<200', 'p(99)<500'],
      http_req_failed: ['rate<0.01'],
    },
  },

  // AI-focused test - test AI endpoints specifically
  ai_focused: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '10m', target: 50 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<2000', 'p(99)<5000'], // AI endpoints are slower
      http_req_failed: ['rate<0.02'],
    },
  },
};

// Get current test profile
const PROFILE = __ENV.PROFILE || 'baseline';
export const options = profiles[PROFILE];

// Test data generators
function generateUser() {
  return {
    id: Math.floor(Math.random() * 10000),
    name: `user_${Math.floor(Math.random() * 1000)}`,
    email: `user${Math.floor(Math.random() * 1000)}@example.com`,
  };
}

function generateAIPrompt() {
  const prompts = [
    'Explain quantum computing in simple terms',
    'Write a Python function to sort an array',
    'What are the benefits of microservices architecture?',
    'How does machine learning work?',
    'Describe the process of photosynthesis',
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

function generateMediaRequest() {
  const types = ['video', 'audio', 'image'];
  const formats = ['mp4', 'webm', 'mp3', 'wav', 'jpg', 'png'];
  return {
    type: types[Math.floor(Math.random() * types.length)],
    format: formats[Math.floor(Math.random() * formats.length)],
    quality: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
  };
}

// Authentication helpers
function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'k6-load-test/1.0',
  };

  if (JWT_TOKEN) {
    headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
  } else if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  return headers;
}

// Test scenarios
export default function () {
  const scenario = __ENV.SCENARIO || 'mixed';
  
  switch (scenario) {
    case 'auth':
      testAuthentication();
      break;
    case 'api':
      testAPIEndpoints();
      break;
    case 'ai':
      testAIEndpoints();
      break;
    case 'streaming':
      testStreamingEndpoints();
      break;
    case 'websocket':
      testWebSocketEndpoints();
      break;
    case 'rate_limit':
      testRateLimiting();
      break;
    case 'circuit_breaker':
      testCircuitBreaker();
      break;
    default:
      testMixedWorkload();
  }
}

function testMixedWorkload() {
  const scenarios = [
    () => testAPIEndpoints(),
    () => testAIEndpoints(),
    () => testStreamingEndpoints(),
    () => testAuthentication(),
  ];
  
  // Randomly select a scenario weighted by typical usage
  const weights = [0.6, 0.2, 0.15, 0.05]; // API, AI, Streaming, Auth
  const random = Math.random();
  let cumulative = 0;
  
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) {
      scenarios[i]();
      break;
    }
  }
}

function testAuthentication() {
  const group = 'Authentication';
  
  // Test JWT authentication
  let response = http.get(`${BASE_URL}/api/v1/user/profile`, {
    headers: getAuthHeaders(),
    tags: { group, endpoint: 'profile' },
  });
  
  const success = check(response, {
    'auth status is 200 or 401': (r) => [200, 401].includes(r.status),
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  if (response.status === 401) {
    authFailures.add(1);
  }
  
  errorRate.add(!success);
  latencyTrend.add(response.timings.duration);
  
  sleep(1);
}

function testAPIEndpoints() {
  const group = 'API';
  const endpoints = [
    { path: '/api/v1/health', method: 'GET', weight: 0.3 },
    { path: '/api/v1/users', method: 'GET', weight: 0.2 },
    { path: '/api/v1/products', method: 'GET', weight: 0.2 },
    { path: '/api/v1/orders', method: 'POST', weight: 0.15 },
    { path: '/api/v1/analytics/events', method: 'POST', weight: 0.15 },
  ];
  
  // Select endpoint based on weights
  const random = Math.random();
  let cumulative = 0;
  let selectedEndpoint;
  
  for (const endpoint of endpoints) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      selectedEndpoint = endpoint;
      break;
    }
  }
  
  let response;
  const headers = getAuthHeaders();
  
  if (selectedEndpoint.method === 'POST') {
    const payload = selectedEndpoint.path.includes('orders') 
      ? { user: generateUser(), items: [{ id: 1, quantity: 2 }] }
      : { event: 'page_view', user_id: Math.floor(Math.random() * 10000) };
      
    response = http.post(`${BASE_URL}${selectedEndpoint.path}`, JSON.stringify(payload), {
      headers,
      tags: { group, endpoint: selectedEndpoint.path, method: selectedEndpoint.method },
    });
  } else {
    response = http.get(`${BASE_URL}${selectedEndpoint.path}`, {
      headers,
      tags: { group, endpoint: selectedEndpoint.path, method: selectedEndpoint.method },
    });
  }
  
  const success = check(response, {
    'status is 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has valid JSON response': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
  
  if (response.status === 429) {
    rateLimitHits.add(1);
  }
  
  errorRate.add(!success);
  latencyTrend.add(response.timings.duration);
  
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s between requests
}

function testAIEndpoints() {
  const group = 'AI';
  const aiEndpoints = [
    '/api/v1/ai/chat/completions',
    '/api/v1/ai/embeddings',
    '/api/v1/ai/image/generate',
    '/api/v1/ai/text/summarize',
  ];
  
  const endpoint = aiEndpoints[Math.floor(Math.random() * aiEndpoints.length)];
  const prompt = generateAIPrompt();
  
  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    stream: Math.random() < 0.3, // 30% streaming requests
  };
  
  const response = http.post(`${BASE_URL}${endpoint}`, JSON.stringify(payload), {
    headers: getAuthHeaders(),
    timeout: '30s', // AI endpoints can be slow
    tags: { group, endpoint, streaming: payload.stream },
  });
  
  const success = check(response, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response time < 10s': (r) => r.timings.duration < 10000,
    'has AI response': (r) => r.body && r.body.length > 0,
  });
  
  errorRate.add(!success);
  latencyTrend.add(response.timings.duration);
  
  sleep(Math.random() * 5 + 2); // 2-7s between AI requests
}

function testStreamingEndpoints() {
  const group = 'Streaming';
  const streamingEndpoints = [
    '/api/v1/stream/events',
    '/api/v1/stream/logs',
    '/api/v1/stream/metrics',
  ];
  
  const endpoint = streamingEndpoints[Math.floor(Math.random() * streamingEndpoints.length)];
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: {
      ...getAuthHeaders(),
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    tags: { group, endpoint, type: 'sse' },
  });
  
  const success = check(response, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'is SSE content': (r) => r.headers['Content-Type']?.includes('text/event-stream'),
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(!success);
  latencyTrend.add(response.timings.duration);
  
  sleep(Math.random() * 3 + 1);
}

function testWebSocketEndpoints() {
  const group = 'WebSocket';
  const wsUrl = BASE_URL.replace('http', 'ws') + '/ws';
  
  const response = ws.connect(wsUrl, {
    headers: getAuthHeaders(),
    tags: { group, type: 'websocket' },
  }, function (socket) {
    socket.on('open', () => {
      // Send a few messages
      for (let i = 0; i < 5; i++) {
        socket.send(JSON.stringify({
          type: 'message',
          data: `Test message ${i}`,
          timestamp: Date.now(),
        }));
        socket.setTimeout(() => {}, 100); // Small delay between messages
      }
    });
    
    socket.on('message', (data) => {
      check(data, {
        'received valid message': (d) => {
          try {
            JSON.parse(d);
            return true;
          } catch {
            return false;
          }
        },
      });
    });
    
    socket.on('error', (e) => {
      console.log('WebSocket error:', e);
      errorRate.add(1);
    });
    
    // Keep connection open for 5-10 seconds
    socket.setTimeout(() => {
      socket.close();
    }, Math.random() * 5000 + 5000);
  });
  
  sleep(Math.random() * 2 + 1);
}

function testRateLimiting() {
  const group = 'RateLimit';
  
  // Make rapid requests to trigger rate limiting
  for (let i = 0; i < 20; i++) {
    const response = http.get(`${BASE_URL}/api/v1/test/rate-limit`, {
      headers: getAuthHeaders(),
      tags: { group, attempt: i },
    });
    
    if (response.status === 429) {
      rateLimitHits.add(1);
      
      check(response, {
        'has retry-after header': (r) => r.headers['Retry-After'] !== undefined,
        'has rate limit headers': (r) => 
          r.headers['X-RateLimit-Limit'] !== undefined &&
          r.headers['X-RateLimit-Remaining'] !== undefined,
      });
      
      break; // Stop once rate limited
    }
    
    sleep(0.1); // Very short delay to trigger rate limiting
  }
  
  sleep(2); // Wait before next test
}

function testCircuitBreaker() {
  const group = 'CircuitBreaker';
  
  // Test endpoint that might trigger circuit breaker
  const response = http.get(`${BASE_URL}/api/v1/test/circuit-breaker`, {
    headers: getAuthHeaders(),
    tags: { group, type: 'circuit_test' },
  });
  
  if (response.status === 503) {
    circuitBreakerTrips.add(1);
    
    check(response, {
      'circuit breaker response': (r) => r.body.includes('Circuit breaker'),
      'has retry-after': (r) => r.headers['Retry-After'] !== undefined,
    });
  }
  
  const success = check(response, {
    'status is not 5xx or is expected 503': (r) => 
      r.status < 500 || r.status === 503,
  });
  
  errorRate.add(!success);
  latencyTrend.add(response.timings.duration);
  
  sleep(1);
}

// SLO validation functions
export function handleSummary(data) {
  const sloReport = generateSLOReport(data);
  
  return {
    'slo-report.json': JSON.stringify(sloReport, null, 2),
    'load-test-summary.json': JSON.stringify(data, null, 2),
  };
}

function generateSLOReport(data) {
  const metrics = data.metrics;
  
  // Extract key metrics
  const p95Latency = metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99Latency = metrics.http_req_duration?.values?.['p(99)'] || 0;
  const errorRate = metrics.http_req_failed?.values?.rate || 0;
  const totalRequests = metrics.http_reqs?.values?.count || 0;
  
  // Define SLO thresholds
  const slos = {
    availability: {
      target: 99.9, // 99.9% availability
      actual: (1 - errorRate) * 100,
      passed: (1 - errorRate) * 100 >= 99.9,
    },
    latency_p95: {
      target: 150, // 150ms P95 latency
      actual: p95Latency,
      passed: p95Latency <= 150,
    },
    latency_p99: {
      target: 500, // 500ms P99 latency
      actual: p99Latency,
      passed: p99Latency <= 500,
    },
  };
  
  // Calculate overall SLO compliance
  const slosPassed = Object.values(slos).filter(slo => slo.passed).length;
  const totalSlos = Object.keys(slos).length;
  const overallCompliance = (slosPassed / totalSlos) * 100;
  
  return {
    timestamp: new Date().toISOString(),
    profile: PROFILE,
    scenario: __ENV.SCENARIO || 'mixed',
    duration: data.state?.testRunDurationMs || 0,
    totalRequests,
    slos,
    overallCompliance,
    passed: overallCompliance === 100,
    recommendations: generateRecommendations(slos, metrics),
  };
}

function generateRecommendations(slos, metrics) {
  const recommendations = [];
  
  if (!slos.availability.passed) {
    recommendations.push({
      type: 'availability',
      severity: 'high',
      message: `Availability SLO not met: ${slos.availability.actual.toFixed(2)}% < ${slos.availability.target}%`,
      actions: [
        'Check error logs for 5xx responses',
        'Review circuit breaker configurations',
        'Verify downstream service health',
      ],
    });
  }
  
  if (!slos.latency_p95.passed) {
    recommendations.push({
      type: 'latency',
      severity: 'medium',
      message: `P95 latency SLO not met: ${slos.latency_p95.actual.toFixed(2)}ms > ${slos.latency_p95.target}ms`,
      actions: [
        'Profile application for performance bottlenecks',
        'Review database query performance',
        'Consider horizontal scaling',
      ],
    });
  }
  
  if (!slos.latency_p99.passed) {
    recommendations.push({
      type: 'latency',
      severity: 'high',
      message: `P99 latency SLO not met: ${slos.latency_p99.actual.toFixed(2)}ms > ${slos.latency_p99.target}ms`,
      actions: [
        'Investigate tail latency issues',
        'Check for resource contention',
        'Review timeout configurations',
      ],
    });
  }
  
  return recommendations;
}
