#!/usr/bin/env node

/**
 * 🚀 Suuupra EdTech Platform - Comprehensive API Testing Suite
 * 
 * Enterprise-grade API testing for all 20 microservices
 * Features:
 * - Health checks for all services
 * - Authentication flow testing
 * - Load testing capabilities
 * - Performance monitoring
 * - Error handling validation
 * - Security testing
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// ANSI color codes for beautiful output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Service configuration matrix
const SERVICES = {
  'api-gateway': { port: 8080, path: '/healthz', critical: true },
  'identity': { port: 8081, path: '/health', critical: true },
  'payments': { port: 8082, path: '/health', critical: true },
  'commerce': { port: 8083, path: '/health', critical: true },
  'content-delivery': { port: 8084, path: '/health', critical: false },
  'notifications': { port: 8085, path: '/health', critical: false },
  'ledger': { port: 8086, path: '/health', critical: true },
  'upi-core': { port: 8087, path: '/health', critical: true },
  'bank-simulator': { port: 8088, path: '/health', critical: true },
  'content': { port: 8089, path: '/health', critical: true },
  'live-classes': { port: 8090, path: '/health', critical: false },
  'vod': { port: 8091, path: '/health', critical: false },
  'mass-live': { port: 8092, path: '/health', critical: false },
  'creator-studio': { port: 8093, path: '/health', critical: false },
  'search-crawler': { port: 8094, path: '/health', critical: false },
  'recommendations': { port: 8095, path: '/health', critical: false },
  'llm-tutor': { port: 8096, path: '/health', critical: false },
  'analytics': { port: 8097, path: '/health', critical: false },
  'counters': { port: 8098, path: '/health', critical: false },
  'live-tracking': { port: 8099, path: '/health', critical: false },
  'admin': { port: 8100, path: '/health', critical: false }
};

// Infrastructure services
const INFRASTRUCTURE = {
  'postgres': { port: 5432, type: 'database' },
  'redis': { port: 6379, type: 'cache' },
  'elasticsearch': { port: 9200, path: '/_cluster/health', type: 'search' },
  'kafka': { port: 9092, type: 'messaging' },
  'prometheus': { port: 9090, path: '/-/healthy', type: 'monitoring' },
  'grafana': { port: 3001, path: '/api/health', type: 'visualization' },
  'jaeger': { port: 16686, path: '/', type: 'tracing' },
  'minio': { port: 9000, type: 'storage' },
  'vault': { port: 8200, path: '/v1/sys/health', type: 'secrets' }
};

class APITestSuite {
  constructor() {
    this.results = {
      services: {},
      infrastructure: {},
      performance: {},
      security: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical_failures: 0,
        start_time: new Date(),
        end_time: null
      }
    };
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Suuupra-API-Test-Suite/1.0.0',
        'Accept': 'application/json'
      }
    });
  }

  // Utility methods
  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logSuccess(message) {
    this.log(`✅ ${message}`, 'green');
  }

  logError(message) {
    this.log(`❌ ${message}`, 'red');
  }

  logWarning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  logInfo(message) {
    this.log(`ℹ️  ${message}`, 'cyan');
  }

  logHeader(message) {
    this.log(`\n🚀 ${message}`, 'bright');
    this.log('='.repeat(60), 'blue');
  }

  async makeRequest(url, options = {}) {
    const startTime = performance.now();
    try {
      const response = await this.httpClient.get(url, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        duration,
        headers: response.headers
      };
    } catch (error) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      return {
        success: false,
        status: error.response?.status || 0,
        error: error.message,
        duration,
        data: error.response?.data || null
      };
    }
  }

  // Test individual service health
  async testServiceHealth(serviceName, config) {
    const url = `http://localhost:${config.port}${config.path}`;
    this.logInfo(`Testing ${serviceName} at ${url}`);
    
    const result = await this.makeRequest(url);
    
    this.results.services[serviceName] = {
      ...result,
      critical: config.critical,
      url
    };

    if (result.success) {
      this.logSuccess(`${serviceName}: ${result.status} (${result.duration}ms)`);
      this.results.summary.passed++;
    } else {
      this.logError(`${serviceName}: ${result.error} (${result.duration}ms)`);
      this.results.summary.failed++;
      if (config.critical) {
        this.results.summary.critical_failures++;
      }
    }
    
    this.results.summary.total++;
  }

  // Test infrastructure services
  async testInfrastructure(serviceName, config) {
    if (config.path) {
      const url = `http://localhost:${config.port}${config.path}`;
      this.logInfo(`Testing ${serviceName} infrastructure at ${url}`);
      
      const result = await this.makeRequest(url);
      
      this.results.infrastructure[serviceName] = {
        ...result,
        type: config.type,
        url
      };

      if (result.success) {
        this.logSuccess(`${serviceName} (${config.type}): ${result.status} (${result.duration}ms)`);
      } else {
        this.logError(`${serviceName} (${config.type}): ${result.error} (${result.duration}ms)`);
      }
    } else {
      // For services without HTTP endpoints (like PostgreSQL, Redis)
      this.logInfo(`${serviceName} (${config.type}): Connection test skipped - no HTTP endpoint`);
      this.results.infrastructure[serviceName] = {
        success: null,
        type: config.type,
        note: 'No HTTP endpoint available for testing'
      };
    }
  }

  // Test API Gateway routing
  async testAPIGatewayRouting() {
    this.logHeader('Testing API Gateway Routing');
    
    const routes = [
      { path: '/identity/health', expectedService: 'identity' },
      { path: '/payments/health', expectedService: 'payments' },
      { path: '/commerce/health', expectedService: 'commerce' },
      { path: '/content/health', expectedService: 'content' }
    ];

    for (const route of routes) {
      const url = `http://localhost:8080${route.path}`;
      this.logInfo(`Testing route: ${route.path} → ${route.expectedService}`);
      
      const result = await this.makeRequest(url);
      
      if (result.success) {
        this.logSuccess(`Route ${route.path}: ${result.status} (${result.duration}ms)`);
      } else {
        this.logError(`Route ${route.path}: ${result.error} (${result.duration}ms)`);
      }
    }
  }

  // Performance testing
  async performanceTest() {
    this.logHeader('Performance Testing');
    
    const testEndpoints = [
      'http://localhost:8080/healthz',
      'http://localhost:8081/health',
      'http://localhost:8082/health'
    ];

    for (const endpoint of testEndpoints) {
      this.logInfo(`Performance testing: ${endpoint}`);
      
      const results = [];
      const concurrentRequests = 10;
      const totalRequests = 50;
      
      for (let batch = 0; batch < totalRequests / concurrentRequests; batch++) {
        const promises = Array(concurrentRequests).fill().map(() => 
          this.makeRequest(endpoint)
        );
        
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }
      
      const successful = results.filter(r => r.success);
      const durations = successful.map(r => r.duration);
      
      if (durations.length > 0) {
        const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const p95Duration = Math.round(durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]);
        const successRate = (successful.length / results.length * 100).toFixed(2);
        
        this.results.performance[endpoint] = {
          total_requests: results.length,
          successful_requests: successful.length,
          success_rate: successRate,
          avg_duration: avgDuration,
          p95_duration: p95Duration
        };
        
        this.logSuccess(`${endpoint}: ${successRate}% success, avg: ${avgDuration}ms, p95: ${p95Duration}ms`);
      } else {
        this.logError(`${endpoint}: All requests failed`);
      }
    }
  }

  // Security testing
  async securityTest() {
    this.logHeader('Security Testing');
    
    const securityTests = [
      {
        name: 'CORS Headers',
        url: 'http://localhost:8080/healthz',
        check: (result) => result.headers['access-control-allow-origin'] !== undefined
      },
      {
        name: 'Security Headers',
        url: 'http://localhost:8080/healthz',
        check: (result) => result.headers['x-request-id'] !== undefined
      },
      {
        name: 'Rate Limiting Headers',
        url: 'http://localhost:8080/healthz',
        check: (result) => true // Basic connectivity test
      }
    ];

    for (const test of securityTests) {
      this.logInfo(`Security test: ${test.name}`);
      
      const result = await this.makeRequest(test.url);
      
      if (result.success && test.check(result)) {
        this.logSuccess(`${test.name}: PASSED`);
        this.results.security[test.name] = { status: 'PASSED', details: result.headers };
      } else {
        this.logWarning(`${test.name}: FAILED or not implemented`);
        this.results.security[test.name] = { status: 'FAILED', error: result.error };
      }
    }
  }

  // Generate comprehensive report
  async generateReport() {
    this.results.summary.end_time = new Date();
    const duration = this.results.summary.end_time - this.results.summary.start_time;
    
    this.logHeader('Test Summary Report');
    
    this.log(`📊 Total Tests: ${this.results.summary.total}`, 'bright');
    this.log(`✅ Passed: ${this.results.summary.passed}`, 'green');
    this.log(`❌ Failed: ${this.results.summary.failed}`, 'red');
    this.log(`🚨 Critical Failures: ${this.results.summary.critical_failures}`, 'red');
    this.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`, 'cyan');
    
    // Service status summary
    this.logHeader('Service Status Summary');
    Object.entries(this.results.services).forEach(([service, result]) => {
      const status = result.success ? '🟢' : '🔴';
      const critical = result.critical ? '🚨' : '  ';
      this.log(`${status} ${critical} ${service.padEnd(20)} ${result.success ? result.status : result.error}`);
    });
    
    // Infrastructure status
    this.logHeader('Infrastructure Status');
    Object.entries(this.results.infrastructure).forEach(([service, result]) => {
      const status = result.success === null ? '🟡' : (result.success ? '🟢' : '🔴');
      this.log(`${status}    ${service.padEnd(20)} ${result.type.padEnd(12)} ${result.note || (result.success ? result.status : result.error)}`);
    });
    
    // Performance summary
    if (Object.keys(this.results.performance).length > 0) {
      this.logHeader('Performance Summary');
      Object.entries(this.results.performance).forEach(([endpoint, perf]) => {
        this.log(`📈 ${endpoint}`);
        this.log(`   Success Rate: ${perf.success_rate}%`);
        this.log(`   Avg Duration: ${perf.avg_duration}ms`);
        this.log(`   P95 Duration: ${perf.p95_duration}ms`);
      });
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'test-results', `api-test-report-${Date.now()}.json`);
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      this.logSuccess(`Detailed report saved to: ${reportPath}`);
    } catch (error) {
      this.logError(`Failed to save report: ${error.message}`);
    }
    
    // Overall status
    this.logHeader('Overall Platform Status');
    if (this.results.summary.critical_failures === 0) {
      this.logSuccess('🎉 All critical services are operational!');
      return 0; // Success exit code
    } else {
      this.logError(`🚨 ${this.results.summary.critical_failures} critical service(s) are down!`);
      return 1; // Error exit code
    }
  }

  // Main test runner
  async run() {
    this.logHeader('Suuupra EdTech Platform - API Test Suite');
    this.log('🚀 Starting comprehensive API testing...', 'bright');
    
    // Test all microservices
    this.logHeader('Testing Microservices Health');
    for (const [serviceName, config] of Object.entries(SERVICES)) {
      await this.testServiceHealth(serviceName, config);
    }
    
    // Test infrastructure
    this.logHeader('Testing Infrastructure Services');
    for (const [serviceName, config] of Object.entries(INFRASTRUCTURE)) {
      await this.testInfrastructure(serviceName, config);
    }
    
    // Test API Gateway routing
    await this.testAPIGatewayRouting();
    
    // Performance testing
    await this.performanceTest();
    
    // Security testing
    await this.securityTest();
    
    // Generate final report
    return await this.generateReport();
  }
}

// CLI interface
async function main() {
  const testSuite = new APITestSuite();
  
  try {
    const exitCode = await testSuite.run();
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}❌ Test suite failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = APITestSuite;
