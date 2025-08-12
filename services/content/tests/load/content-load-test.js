import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const contentCreationTime = new Trend('content_creation_time');
const searchResponseTime = new Trend('search_response_time');
const uploadInitiationTime = new Trend('upload_initiation_time');
const requestsPerSecond = new Counter('requests_per_second');

// Test configuration
export const options = {
  scenarios: {
    // Baseline load test
    baseline: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      tags: { test_type: 'baseline' },
    },
    
    // Stress test - gradually increase load
    stress: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    
    // Spike test - sudden load increase
    spike: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '10s', target: 200 },
        { duration: '10s', target: 10 },
      ],
      tags: { test_type: 'spike' },
    },
    
    // Soak test - sustained load
    soak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      tags: { test_type: 'soak' },
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // 95% of requests under 200ms, 99% under 500ms
    http_req_failed: ['rate<0.01'], // Error rate under 1%
    error_rate: ['rate<0.01'],
    content_creation_time: ['p(95)<300'],
    search_response_time: ['p(95)<200'],
    upload_initiation_time: ['p(95)<1000'],
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8082';
const API_BASE = `${BASE_URL}/api/v1`;

// Mock JWT token for testing
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJ0ZW5hbnRfaWQiOiJ0ZXN0LXRlbmFudCIsInJvbGVzIjpbImNyZWF0b3IiLCJtb2RlcmF0b3IiXSwicGVybWlzc2lvbnMiOlsiY29udGVudC5jcmVhdGUiLCJjb250ZW50LnJlYWQiLCJjb250ZW50LnVwZGF0ZSJdLCJpYXQiOjE2MzAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.test-signature';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': AUTH_TOKEN,
};

// Test data generators
function generateContent() {
  const contentTypes = ['article', 'video', 'quiz', 'document'];
  const tags = ['tutorial', 'guide', 'beginner', 'advanced', 'javascript', 'nodejs', 'react', 'vue'];
  
  return {
    title: `Load Test Content ${Math.random().toString(36).substring(7)}`,
    description: `This is a load test content created at ${new Date().toISOString()}`,
    contentType: contentTypes[Math.floor(Math.random() * contentTypes.length)],
    tags: tags.slice(0, Math.floor(Math.random() * 3) + 1),
    metadata: {
      loadTest: true,
      timestamp: Date.now()
    },
    idempotencyKey: `load-test-${__VU}-${__ITER}-${Date.now()}`
  };
}

function generateUploadData() {
  const fileSizes = [1048576, 5242880, 10485760, 52428800]; // 1MB, 5MB, 10MB, 50MB
  const contentTypes = ['video/mp4', 'application/pdf', 'image/jpeg'];
  
  return {
    filename: `load-test-file-${Math.random().toString(36).substring(7)}.mp4`,
    contentType: contentTypes[Math.floor(Math.random() * contentTypes.length)],
    fileSize: fileSizes[Math.floor(Math.random() * fileSizes.length)],
    checksumSha256: 'a'.repeat(64) // Mock checksum
  };
}

// Test scenarios
export default function() {
  const testType = __ENV.TEST_TYPE || 'mixed';
  
  switch(testType) {
    case 'content_crud':
      testContentCRUD();
      break;
    case 'search':
      testSearch();
      break;
    case 'upload':
      testUpload();
      break;
    case 'admin':
      testAdminOperations();
      break;
    default:
      testMixedWorkload();
  }
  
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

function testContentCRUD() {
  const contentData = generateContent();
  
  // Create content
  const createStart = Date.now();
  const createResponse = http.post(`${API_BASE}/content`, JSON.stringify(contentData), { headers });
  const createDuration = Date.now() - createStart;
  
  contentCreationTime.add(createDuration);
  requestsPerSecond.add(1);
  
  const createSuccess = check(createResponse, {
    'content creation status is 201': (r) => r.status === 201,
    'content creation response has id': (r) => r.json('data.id') !== undefined,
    'content creation response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  if (!createSuccess) {
    errorRate.add(1);
    return;
  }
  
  const contentId = createResponse.json('data.id');
  
  // Read content
  const readResponse = http.get(`${API_BASE}/content/${contentId}`, { headers });
  const readSuccess = check(readResponse, {
    'content read status is 200': (r) => r.status === 200,
    'content read has correct id': (r) => r.json('data.id') === contentId,
    'content read response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  requestsPerSecond.add(1);
  if (!readSuccess) errorRate.add(1);
  
  // Update content
  const updateData = {
    title: `Updated ${contentData.title}`,
    versionBump: 'patch'
  };
  
  const etag = readResponse.headers['Etag'];
  const updateHeaders = { ...headers, 'If-Match': etag };
  
  const updateResponse = http.put(`${API_BASE}/content/${contentId}`, JSON.stringify(updateData), { headers: updateHeaders });
  const updateSuccess = check(updateResponse, {
    'content update status is 200': (r) => r.status === 200,
    'content update changed title': (r) => r.json('data.title').includes('Updated'),
    'content update response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  requestsPerSecond.add(1);
  if (!updateSuccess) errorRate.add(1);
  
  // List content
  const listResponse = http.get(`${API_BASE}/content?page=1&limit=10`, { headers });
  const listSuccess = check(listResponse, {
    'content list status is 200': (r) => r.status === 200,
    'content list has data array': (r) => Array.isArray(r.json('data')),
    'content list response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  requestsPerSecond.add(1);
  if (!listSuccess) errorRate.add(1);
}

function testSearch() {
  const searchQueries = [
    'javascript tutorial',
    'nodejs guide',
    'react components',
    'database design',
    'api development',
    'testing strategies',
    'performance optimization',
    'security best practices'
  ];
  
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const searchStart = Date.now();
  
  const searchResponse = http.get(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=20`, { headers });
  const searchDuration = Date.now() - searchStart;
  
  searchResponseTime.add(searchDuration);
  requestsPerSecond.add(1);
  
  const searchSuccess = check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search has results array': (r) => Array.isArray(r.json('data')),
    'search response time < 200ms': (r) => r.timings.duration < 200,
    'search has pagination': (r) => r.json('meta.pagination') !== undefined,
  });
  
  if (!searchSuccess) errorRate.add(1);
  
  // Test search suggestions
  const suggestResponse = http.get(`${API_BASE}/search/suggestions?q=${query.substring(0, 3)}`, { headers });
  const suggestSuccess = check(suggestResponse, {
    'suggestions status is 200': (r) => r.status === 200,
    'suggestions response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  requestsPerSecond.add(1);
  if (!suggestSuccess) errorRate.add(1);
}

function testUpload() {
  // First create content
  const contentData = generateContent();
  const createResponse = http.post(`${API_BASE}/content`, JSON.stringify(contentData), { headers });
  
  if (createResponse.status !== 201) {
    errorRate.add(1);
    return;
  }
  
  const contentId = createResponse.json('data.id');
  const uploadData = generateUploadData();
  
  // Initiate upload
  const uploadStart = Date.now();
  const uploadResponse = http.post(`${API_BASE}/content/${contentId}/upload`, JSON.stringify(uploadData), { headers });
  const uploadDuration = Date.now() - uploadStart;
  
  uploadInitiationTime.add(uploadDuration);
  requestsPerSecond.add(2); // Count both requests
  
  const uploadSuccess = check(uploadResponse, {
    'upload initiation status is 201': (r) => r.status === 201,
    'upload has uploadId': (r) => r.json('data.uploadId') !== undefined,
    'upload has uploadParts': (r) => Array.isArray(r.json('data.uploadParts')),
    'upload response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  if (!uploadSuccess) {
    errorRate.add(1);
    return;
  }
  
  const uploadId = uploadResponse.json('data.uploadId');
  
  // Get upload progress
  const progressResponse = http.get(`${API_BASE}/upload/${uploadId}/progress`, { headers });
  const progressSuccess = check(progressResponse, {
    'progress status is 200': (r) => r.status === 200,
    'progress has percentage': (r) => r.json('data.progress') !== undefined,
  });
  
  requestsPerSecond.add(1);
  if (!progressSuccess) errorRate.add(1);
}

function testAdminOperations() {
  // Create content for admin operations
  const contentData = generateContent();
  const createResponse = http.post(`${API_BASE}/content`, JSON.stringify(contentData), { headers });
  
  if (createResponse.status !== 201) {
    errorRate.add(1);
    return;
  }
  
  const contentId = createResponse.json('data.id');
  
  // Simulate content approval workflow
  const approveResponse = http.post(`${API_BASE}/admin/content/${contentId}/approve`, null, { headers });
  const approveSuccess = check(approveResponse, {
    'approve status is 200': (r) => r.status === 200,
    'content status is approved': (r) => r.json('data.status') === 'approved',
  });
  
  requestsPerSecond.add(2);
  if (!approveSuccess) errorRate.add(1);
  
  // Publish content
  const publishResponse = http.post(`${API_BASE}/admin/content/${contentId}/publish`, null, { headers });
  const publishSuccess = check(publishResponse, {
    'publish status is 200': (r) => r.status === 200,
    'content status is published': (r) => r.json('data.status') === 'published',
  });
  
  requestsPerSecond.add(1);
  if (!publishSuccess) errorRate.add(1);
}

function testMixedWorkload() {
  const workloadTypes = ['content_crud', 'search', 'upload', 'admin'];
  const selectedWorkload = workloadTypes[Math.floor(Math.random() * workloadTypes.length)];
  
  switch(selectedWorkload) {
    case 'content_crud':
      testContentCRUD();
      break;
    case 'search':
      testSearch();
      break;
    case 'upload':
      testUpload();
      break;
    case 'admin':
      testAdminOperations();
      break;
  }
}

// Setup and teardown
export function setup() {
  console.log('Starting load test setup...');
  
  // Health check
  const healthResponse = http.get(`${API_BASE}/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`Service health check failed: ${healthResponse.status}`);
  }
  
  console.log('Load test setup completed');
  return { baseUrl: API_BASE };
}

export function teardown(data) {
  console.log('Load test teardown completed');
}

// Handle summary
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
    'load-test-report.html': htmlReport(data),
  };
}

// Helper functions for reporting
function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  
  let summary = `${indent}Load Test Summary:\n`;
  summary += `${indent}==================\n`;
  summary += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%\n`;
  summary += `${indent}Average Response Time: ${data.metrics.http_req_duration.values.avg}ms\n`;
  summary += `${indent}95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms\n`;
  summary += `${indent}99th Percentile: ${data.metrics.http_req_duration.values['p(99)']}ms\n`;
  
  if (data.metrics.content_creation_time) {
    summary += `${indent}Content Creation (95th): ${data.metrics.content_creation_time.values['p(95)']}ms\n`;
  }
  
  if (data.metrics.search_response_time) {
    summary += `${indent}Search Response (95th): ${data.metrics.search_response_time.values['p(95)']}ms\n`;
  }
  
  return summary;
}

function htmlReport(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Content Service Load Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .metric { margin: 10px 0; }
            .passed { color: green; }
            .failed { color: red; }
        </style>
    </head>
    <body>
        <h1>Content Service Load Test Report</h1>
        <div class="metric">Total Requests: ${data.metrics.http_reqs.values.count}</div>
        <div class="metric">Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</div>
        <div class="metric">Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</div>
        <div class="metric">95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</div>
        <div class="metric">99th Percentile: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</div>
        <p>Generated at: ${new Date().toISOString()}</p>
    </body>
    </html>
  `;
}
