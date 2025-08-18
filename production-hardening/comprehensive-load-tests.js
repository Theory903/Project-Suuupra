// ===================================================================
// COMPREHENSIVE LOAD TESTING FRAMEWORK - PHASE 4
// Advanced K6 Performance Testing for Production Readiness
// ===================================================================

import http from 'k6/http';
import ws from 'k6/ws';
import { check, group, sleep, fail } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';
import { randomIntBetween, randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import encoding from 'k6/encoding';

// ===================================================================
// CUSTOM METRICS FOR COMPREHENSIVE MONITORING
// ===================================================================

// Performance metrics
const requestDuration = new Trend('suuupra_request_duration', true);
const requestRate = new Rate('suuupra_request_success_rate');
const databaseResponseTime = new Trend('suuupra_database_response_time');
const cacheHitRate = new Rate('suuupra_cache_hit_rate');

// Business metrics  
const userRegistrations = new Counter('suuupra_user_registrations');
const courseEnrollments = new Counter('suuupra_course_enrollments');
const paymentTransactions = new Counter('suuupra_payment_transactions');
const liveSessionJoins = new Counter('suuupra_live_session_joins');

// System metrics
const circuitBreakerTrips = new Counter('suuupra_circuit_breaker_trips');
const rateLimitHits = new Counter('suuupra_rate_limit_hits');
const errorsByType = new Counter('suuupra_errors_by_type');
const concurrentUsers = new Gauge('suuupra_concurrent_users');

// SLO metrics
const sloLatencyP95 = new Trend('suuupra_slo_latency_p95');
const sloAvailability = new Rate('suuupra_slo_availability');
const sloThroughput = new Rate('suuupra_slo_throughput');

// ===================================================================
// CONFIGURATION AND TEST SCENARIOS
// ===================================================================

// Base configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';
const REGION = __ENV.REGION || 'us-east-1';
const TEST_PROFILE = __ENV.TEST_PROFILE || 'baseline';

// Authentication tokens for different user types
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';
const USER_TOKEN = __ENV.USER_TOKEN || '';
const INSTRUCTOR_TOKEN = __ENV.INSTRUCTOR_TOKEN || '';

// Load test profiles with different intensity levels
const profiles = {
  // Smoke test - minimal load to verify basic functionality
  smoke: {
    executor: 'constant-vus',
    vus: 5,
    duration: '1m',
    tags: { test_type: 'smoke' },
  },
  
  // Baseline test - normal expected load
  baseline: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },   // Ramp up
      { duration: '5m', target: 100 },   // Stay at 100 users
      { duration: '2m', target: 200 },   // Ramp to 200 users
      { duration: '10m', target: 200 },  // Stay at 200 users
      { duration: '3m', target: 0 },     // Ramp down
    ],
    tags: { test_type: 'baseline' },
  },

  // Stress test - find breaking point
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '5m', target: 500 },   // Ramp to 500
      { duration: '10m', target: 500 },  // Stay at 500
      { duration: '5m', target: 1000 },  // Ramp to 1000
      { duration: '10m', target: 1000 }, // Stay at 1000
      { duration: '5m', target: 1500 },  // Push to 1500
      { duration: '10m', target: 1500 }, // Stay at 1500
      { duration: '5m', target: 0 },     // Ramp down
    ],
    tags: { test_type: 'stress' },
  },

  // Spike test - sudden traffic increases
  spike: {
    executor: 'ramping-vus',
    startVUs: 100,
    stages: [
      { duration: '2m', target: 100 },   // Normal load
      { duration: '1m', target: 2000 },  // Spike!
      { duration: '3m', target: 2000 },  // Hold spike
      { duration: '1m', target: 100 },   // Drop back
      { duration: '5m', target: 100 },   // Recover
      { duration: '1m', target: 0 },     // End
    ],
    tags: { test_type: 'spike' },
  },

  // Soak test - extended duration at moderate load
  soak: {
    executor: 'constant-vus',
    vus: 300,
    duration: '60m',  // 1 hour soak
    tags: { test_type: 'soak' },
  },

  // Peak load test - simulate Black Friday/high-demand scenarios
  peak: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10m', target: 1000 },  // Ramp to 1K
      { duration: '30m', target: 1000 },  // Hold 1K
      { duration: '10m', target: 2000 },  // Peak to 2K
      { duration: '20m', target: 2000 },  // Hold peak
      { duration: '10m', target: 500 },   // Drop to 500
      { duration: '10m', target: 0 },     // End
    ],
    tags: { test_type: 'peak' },
  }
};

// Test configuration
export let options = {
  scenarios: {
    [TEST_PROFILE]: profiles[TEST_PROFILE] || profiles.baseline,
  },
  
  // Global thresholds for SLA compliance
  thresholds: {
    // Performance SLOs
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    'http_req_duration{group:::api_gateway}': ['p(95)<200'],  // Gateway: 95% < 200ms
    'http_req_duration{group:::database}': ['p(95)<100'],     // Database: 95% < 100ms
    'http_req_duration{group:::payment}': ['p(95)<300'],      // Payment: 95% < 300ms
    
    // Availability SLOs
    'http_req_failed': ['rate<0.01'],     // Error rate < 1%
    'http_req_failed{group:::critical}': ['rate<0.001'], // Critical endpoints < 0.1%
    
    // Throughput SLOs
    'http_reqs': ['rate>100'],            // At least 100 RPS
    'suuupra_request_success_rate': ['rate>0.99'], // Success rate > 99%
    
    // Circuit breaker and rate limiting
    'suuupra_circuit_breaker_trips': ['count<10'],
    'suuupra_rate_limit_hits': ['rate<0.05'], // Rate limit hits < 5%
    
    // WebSocket performance
    'ws_connect_duration': ['p(95)<1000'], // WebSocket connection < 1s
    'ws_msg_duration': ['p(95)<100'],      // Message latency < 100ms
  },

  // Global settings
  userAgent: 'Suuupra-LoadTest/1.0.0 K6',
  insecureSkipTLS: __ENV.NODE_ENV === 'development',
  
  // Configure for different environments
  hosts: {
    'api.suuupra.io': __ENV.TARGET_IP || '127.0.0.1:3001',
  }
};

// ===================================================================
// TEST DATA GENERATION
// ===================================================================

// Generate realistic user data
function generateUser() {
  const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Tom', 'Emma', 'Chris', 'Anna'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  return {
    email: `${randomString(8)}@example.com`,
    username: `user_${randomString(6)}`,
    firstName: randomItem(firstNames),
    lastName: randomItem(lastNames),
    password: 'TestPassword123!',
    tier: randomItem(['free', 'premium', 'enterprise']),
    region: REGION,
  };
}

// Generate course data
function generateCourse() {
  const subjects = ['JavaScript', 'Python', 'React', 'Machine Learning', 'DevOps', 'Kubernetes', 'AWS', 'Data Science'];
  const levels = ['beginner', 'intermediate', 'advanced'];
  
  return {
    title: `Complete ${randomItem(subjects)} Course`,
    description: `Learn ${randomItem(subjects)} from scratch to advanced level`,
    level: randomItem(levels),
    price: randomIntBetween(29, 299),
    currency: 'USD',
    category: 'technology',
    tags: [randomItem(subjects).toLowerCase(), randomItem(['web', 'backend', 'frontend', 'fullstack'])],
  };
}

// Generate payment data  
function generatePayment() {
  return {
    amount: randomIntBetween(29, 299),
    currency: 'USD',
    paymentMethod: 'card',
    billingAddress: {
      country: randomItem(['US', 'UK', 'CA', 'DE', 'FR']),
      state: randomItem(['CA', 'NY', 'TX', 'FL', 'WA']),
      city: randomItem(['San Francisco', 'New York', 'Austin', 'Miami', 'Seattle']),
      zipCode: randomString(5, '0123456789'),
    }
  };
}

// ===================================================================
// AUTHENTICATION HELPERS
// ===================================================================

function getAuthHeaders(token = USER_TOKEN) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Client-Version': '1.0.0',
    'X-Platform': 'load-test',
    'X-Region': REGION,
  };
}

function authenticateUser(userData) {
  const response = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: userData.email,
    password: userData.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_login', group: 'authentication' },
  });

  check(response, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== null,
  });

  return response.status === 200 ? response.json('token') : null;
}

// ===================================================================
// MAIN TEST SCENARIOS
// ===================================================================

export default function() {
  // Track concurrent users
  concurrentUsers.add(1);
  
  // User session simulation
  const user = generateUser();
  let userToken = null;
  
  group('User Journey - Authentication & Registration', () => {
    // Health check
    group('Health Check', () => {
      const response = http.get(`${BASE_URL}/health`, {
        tags: { name: 'health_check', group: 'system' },
      });
      
      const duration = response.timings.duration;
      requestDuration.add(duration);
      requestRate.add(response.status === 200);
      sloLatencyP95.add(duration);
      sloAvailability.add(response.status === 200);
      
      check(response, {
        'health check passed': (r) => r.status === 200,
        'response time < 100ms': (r) => r.timings.duration < 100,
      });
    });

    // User registration (20% of users)
    if (Math.random() < 0.2) {
      group('User Registration', () => {
        const response = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify(user), {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'user_registration', group: 'authentication' },
        });

        const success = check(response, {
          'registration successful': (r) => r.status === 201,
          'user ID returned': (r) => r.json('user.id') !== null,
        });

        if (success) {
          userRegistrations.add(1);
          userToken = response.json('token');
        }
        
        requestDuration.add(response.timings.duration);
        requestRate.add(response.status < 400);
      });
    }

    // User login (all users)
    if (!userToken) {
      group('User Login', () => {
        userToken = authenticateUser(user);
        sleep(0.5); // Brief pause after auth
      });
    }
  });

  // Skip remaining tests if authentication failed
  if (!userToken) {
    console.warn('Authentication failed, skipping user journey');
    return;
  }

  group('User Journey - Course Discovery & Enrollment', () => {
    // Browse course catalog
    group('Course Catalog', () => {
      const response = http.get(`${BASE_URL}/api/v1/courses?page=1&limit=20`, {
        headers: getAuthHeaders(userToken),
        tags: { name: 'course_catalog', group: 'content' },
      });

      const cacheHit = response.headers['X-Cache'] === 'HIT';
      cacheHitRate.add(cacheHit);
      
      check(response, {
        'catalog loaded': (r) => r.status === 200,
        'courses returned': (r) => r.json('courses').length > 0,
        'pagination present': (r) => r.json('pagination') !== null,
        'response cached': (r) => cacheHit,
      });

      requestDuration.add(response.timings.duration);
      requestRate.add(response.status === 200);
    });

    // Search courses (30% of users)
    if (Math.random() < 0.3) {
      group('Course Search', () => {
        const searchTerms = ['javascript', 'react', 'python', 'machine learning', 'aws'];
        const query = randomItem(searchTerms);
        
        const response = http.get(`${BASE_URL}/api/v1/courses/search?q=${query}`, {
          headers: getAuthHeaders(userToken),
          tags: { name: 'course_search', group: 'content' },
        });

        check(response, {
          'search results returned': (r) => r.status === 200,
          'search response time acceptable': (r) => r.timings.duration < 300,
        });

        requestDuration.add(response.timings.duration);
      });
    }

    // View course details
    group('Course Details', () => {
      const courseId = 'course-' + randomString(8); // Mock course ID
      const response = http.get(`${BASE_URL}/api/v1/courses/${courseId}`, {
        headers: getAuthHeaders(userToken),
        tags: { name: 'course_details', group: 'content' },
      });

      // Even if course doesn't exist, API should respond gracefully
      check(response, {
        'API responds': (r) => r.status === 200 || r.status === 404,
        'response time acceptable': (r) => r.timings.duration < 200,
      });

      requestDuration.add(response.timings.duration);
      requestRate.add(response.status < 500);
    });

    // Course enrollment (15% of users)
    if (Math.random() < 0.15) {
      group('Course Enrollment', () => {
        const course = generateCourse();
        const response = http.post(`${BASE_URL}/api/v1/enrollments`, JSON.stringify({
          courseId: 'course-' + randomString(8),
          paymentMethod: 'free_trial',
        }), {
          headers: getAuthHeaders(userToken),
          tags: { name: 'course_enrollment', group: 'commerce' },
        });

        const success = check(response, {
          'enrollment processed': (r) => r.status === 201 || r.status === 409, // 409 = already enrolled
          'enrollment ID returned': (r) => r.status === 201 ? r.json('enrollmentId') !== null : true,
        });

        if (success && response.status === 201) {
          courseEnrollments.add(1);
        }

        requestDuration.add(response.timings.duration);
        requestRate.add(response.status < 400);
      });
    }
  });

  group('User Journey - Payment Processing', () => {
    // Payment flow (10% of users)
    if (Math.random() < 0.1) {
      group('Payment Processing', () => {
        const payment = generatePayment();
        
        // Create order
        const orderResponse = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify({
          items: [{ courseId: 'course-' + randomString(8), price: payment.amount }],
          total: payment.amount,
          currency: payment.currency,
        }), {
          headers: getAuthHeaders(userToken),
          tags: { name: 'create_order', group: 'commerce' },
        });

        if (orderResponse.status === 201) {
          const orderId = orderResponse.json('orderId');
          
          // Process payment
          const paymentResponse = http.post(`${BASE_URL}/api/v1/payments`, JSON.stringify({
            orderId: orderId,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: 'card',
            billingAddress: payment.billingAddress,
          }), {
            headers: getAuthHeaders(userToken),
            tags: { name: 'process_payment', group: 'payment' },
          });

          const paymentSuccess = check(paymentResponse, {
            'payment processed': (r) => r.status === 200 || r.status === 201,
            'payment response time acceptable': (r) => r.timings.duration < 5000,
            'transaction ID returned': (r) => r.json('transactionId') !== null,
          });

          if (paymentSuccess) {
            paymentTransactions.add(1);
          }

          requestDuration.add(paymentResponse.timings.duration);
          requestRate.add(paymentResponse.status < 400);
        }
      });
    }
  });

  group('User Journey - Live Classes', () => {
    // Join live session (5% of users)
    if (Math.random() < 0.05) {
      group('Live Session Participation', () => {
        // Get live sessions
        const sessionsResponse = http.get(`${BASE_URL}/api/v1/live/sessions`, {
          headers: getAuthHeaders(userToken),
          tags: { name: 'live_sessions', group: 'live_classes' },
        });

        if (sessionsResponse.status === 200) {
          // Join WebSocket session
          const wsUrl = `${WS_URL}/ws/live?token=${userToken}`;
          const wsResponse = ws.connect(wsUrl, {
            tags: { name: 'websocket_connect', group: 'live_classes' },
          }, function(socket) {
            socket.on('open', () => {
              liveSessionJoins.add(1);
              
              // Send join message
              socket.send(JSON.stringify({
                type: 'join',
                sessionId: 'session-' + randomString(8),
                userId: user.email,
              }));
            });

            socket.on('message', (data) => {
              // Simulate user interaction
              if (Math.random() < 0.1) {
                socket.send(JSON.stringify({
                  type: 'chat',
                  message: 'Great explanation!',
                }));
              }
            });

            socket.setTimeout(() => {
              socket.close();
            }, 30000); // Stay connected for 30 seconds
          });

          check(wsResponse, {
            'WebSocket connection successful': (r) => r.status === 200,
          });
        }
      });
    }
  });

  group('Analytics & Tracking', () => {
    // Send analytics events (all users)
    const analyticsEvents = [
      { event: 'page_view', page: '/dashboard' },
      { event: 'course_view', courseId: 'course-' + randomString(8) },
      { event: 'video_progress', progress: randomIntBetween(10, 90) },
    ];

    analyticsEvents.forEach(event => {
      const response = http.post(`${BASE_URL}/api/v1/analytics/events`, JSON.stringify(event), {
        headers: getAuthHeaders(userToken),
        tags: { name: 'analytics_event', group: 'analytics' },
      });

      // Analytics should be fire-and-forget
      check(response, {
        'analytics accepted': (r) => r.status === 200 || r.status === 202,
        'analytics response fast': (r) => r.timings.duration < 100,
      });
    });
  });

  // Simulate user think time
  sleep(randomIntBetween(1, 5));
}

// ===================================================================
// TEARDOWN AND REPORTING
// ===================================================================

export function teardown(data) {
  console.log('Load test completed');
  console.log('Final metrics summary:');
  console.log(`- Concurrent users peak: ${concurrentUsers.value}`);
  console.log(`- Total registrations: ${userRegistrations.value}`);
  console.log(`- Total enrollments: ${courseEnrollments.value}`);
  console.log(`- Total payments: ${paymentTransactions.value}`);
  console.log(`- Circuit breaker trips: ${circuitBreakerTrips.value}`);
}

export function handleSummary(data) {
  // Generate comprehensive reports
  const report = {
    'performance-report.html': htmlReport(data),
    'performance-summary.txt': textSummary(data, { indent: ' ', enableColors: true }),
    'performance-results.json': JSON.stringify(data, null, 2),
  };

  // SLO compliance report
  const sloReport = generateSLOReport(data);
  report['slo-compliance-report.json'] = JSON.stringify(sloReport, null, 2);

  console.log('📊 Performance test completed!');
  console.log('📈 Reports generated:');
  Object.keys(report).forEach(file => {
    console.log(`   - ${file}`);
  });

  if (sloReport.overallCompliance < 95) {
    console.log('⚠️  SLO compliance below 95% - performance issues detected!');
  } else {
    console.log('✅ All SLOs met - system performing within targets!');
  }

  return report;
}

// Generate SLO compliance report
function generateSLOReport(data) {
  const sloTargets = {
    'latency_p95': { target: 500, unit: 'ms' },
    'latency_p99': { target: 1000, unit: 'ms' },
    'availability': { target: 99.9, unit: '%' },
    'error_rate': { target: 1, unit: '%' },
    'throughput': { target: 100, unit: 'rps' },
  };

  const sloResults = {};
  let totalScore = 0;
  let totalSLOs = Object.keys(sloTargets).length;

  // Calculate latency SLOs
  const latencyP95 = data.metrics.http_req_duration?.p95 || 0;
  const latencyP99 = data.metrics.http_req_duration?.p99 || 0;
  
  sloResults.latency_p95 = {
    target: sloTargets.latency_p95.target,
    actual: Math.round(latencyP95),
    passed: latencyP95 <= sloTargets.latency_p95.target,
    unit: sloTargets.latency_p95.unit
  };
  
  sloResults.latency_p99 = {
    target: sloTargets.latency_p99.target,
    actual: Math.round(latencyP99),
    passed: latencyP99 <= sloTargets.latency_p99.target,
    unit: sloTargets.latency_p99.unit
  };

  // Calculate availability SLO
  const errorRate = (data.metrics.http_req_failed?.rate || 0) * 100;
  const availability = 100 - errorRate;
  
  sloResults.availability = {
    target: sloTargets.availability.target,
    actual: Math.round(availability * 100) / 100,
    passed: availability >= sloTargets.availability.target,
    unit: sloTargets.availability.unit
  };

  // Calculate error rate SLO
  sloResults.error_rate = {
    target: sloTargets.error_rate.target,
    actual: Math.round(errorRate * 100) / 100,
    passed: errorRate <= sloTargets.error_rate.target,
    unit: sloTargets.error_rate.unit
  };

  // Calculate throughput SLO
  const throughput = data.metrics.http_reqs?.rate || 0;
  sloResults.throughput = {
    target: sloTargets.throughput.target,
    actual: Math.round(throughput * 100) / 100,
    passed: throughput >= sloTargets.throughput.target,
    unit: sloTargets.throughput.unit
  };

  // Calculate overall compliance
  Object.values(sloResults).forEach(slo => {
    if (slo.passed) totalScore++;
  });

  const overallCompliance = Math.round((totalScore / totalSLOs) * 100);

  return {
    timestamp: new Date().toISOString(),
    testProfile: TEST_PROFILE,
    region: REGION,
    overallCompliance: overallCompliance,
    slos: sloResults,
    passed: overallCompliance >= 95,
    recommendations: generateRecommendations(sloResults, data)
  };
}

// Generate performance recommendations
function generateRecommendations(sloResults, data) {
  const recommendations = [];

  if (!sloResults.latency_p95.passed) {
    recommendations.push({
      type: 'performance',
      severity: 'high',
      message: `P95 latency (${sloResults.latency_p95.actual}ms) exceeds target (${sloResults.latency_p95.target}ms). Consider optimizing slow queries or adding caching.`
    });
  }

  if (!sloResults.availability.passed) {
    recommendations.push({
      type: 'reliability',
      severity: 'critical',
      message: `Availability (${sloResults.availability.actual}%) below target (${sloResults.availability.target}%). Investigate error rates and implement better error handling.`
    });
  }

  if (!sloResults.throughput.passed) {
    recommendations.push({
      type: 'capacity',
      severity: 'medium',
      message: `Throughput (${sloResults.throughput.actual} RPS) below target (${sloResults.throughput.target} RPS). Consider horizontal scaling or performance optimization.`
    });
  }

  // Check for circuit breaker trips
  const circuitBreakerTrips = data.metrics.suuupra_circuit_breaker_trips?.count || 0;
  if (circuitBreakerTrips > 0) {
    recommendations.push({
      type: 'reliability',
      severity: 'high',
      message: `Circuit breaker tripped ${circuitBreakerTrips} times. Check downstream service health and consider adjusting thresholds.`
    });
  }

  // Check rate limiting
  const rateLimitHits = data.metrics.suuupra_rate_limit_hits?.rate || 0;
  if (rateLimitHits > 0.02) { // >2% rate limit hits
    recommendations.push({
      type: 'capacity',
      severity: 'medium',
      message: `Rate limiting affecting ${Math.round(rateLimitHits * 100)}% of requests. Consider increasing limits or implementing request queuing.`
    });
  }

  return recommendations;
}
