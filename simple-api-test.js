#!/usr/bin/env node

/**
 * 🚀 Suuupra EdTech Platform - Simple API Testing Suite
 * Using built-in Node.js modules only
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Service configuration
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

class SimpleAPITester {
  constructor() {
    this.results = {
      services: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical_failures: 0,
        start_time: new Date()
      }
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logSuccess(message) {
    this.log(`✅ ${message}`, 'green');
  }

  logError(message) {
    this.log(`❌ ${message}`, 'red');
  }

  logInfo(message) {
    this.log(`ℹ️  ${message}`, 'cyan');
  }

  logHeader(message) {
    this.log(`\n🚀 ${message}`, 'bright');
    this.log('='.repeat(60), 'blue');
  }

  makeRequest(hostname, port, path, timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const options = {
        hostname,
        port,
        path,
        method: 'GET',
        timeout,
        headers: {
          'User-Agent': 'Suuupra-API-Test/1.0.0',
          'Accept': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);
          
          resolve({
            success: true,
            status: res.statusCode,
            data: data,
            duration,
            headers: res.headers
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        resolve({
          success: false,
          error: error.message,
          duration,
          status: 0
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        resolve({
          success: false,
          error: 'Request timeout',
          duration,
          status: 0
        });
      });

      req.end();
    });
  }

  async testService(serviceName, config) {
    const url = `http://localhost:${config.port}${config.path}`;
    this.logInfo(`Testing ${serviceName} at ${url}`);
    
    const result = await this.makeRequest('localhost', config.port, config.path);
    
    this.results.services[serviceName] = {
      ...result,
      critical: config.critical,
      url
    };

    if (result.success && result.status >= 200 && result.status < 300) {
      this.logSuccess(`${serviceName}: ${result.status} (${result.duration}ms)`);
      this.results.summary.passed++;
    } else {
      this.logError(`${serviceName}: ${result.error || `HTTP ${result.status}`} (${result.duration}ms)`);
      this.results.summary.failed++;
      if (config.critical) {
        this.results.summary.critical_failures++;
      }
    }
    
    this.results.summary.total++;
  }

  async testAPIGatewayRouting() {
    this.logHeader('Testing API Gateway Routing');
    
    const routes = [
      { path: '/identity/health', expectedService: 'identity' },
      { path: '/payments/health', expectedService: 'payments' },
      { path: '/commerce/health', expectedService: 'commerce' },
      { path: '/content/health', expectedService: 'content' }
    ];

    for (const route of routes) {
      this.logInfo(`Testing route: ${route.path} → ${route.expectedService}`);
      
      const result = await this.makeRequest('localhost', 8080, route.path);
      
      if (result.success && result.status >= 200 && result.status < 300) {
        this.logSuccess(`Route ${route.path}: ${result.status} (${result.duration}ms)`);
      } else {
        this.logError(`Route ${route.path}: ${result.error || `HTTP ${result.status}`} (${result.duration}ms)`);
      }
    }
  }

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
      const status = result.success && result.status >= 200 && result.status < 300 ? '🟢' : '🔴';
      const critical = result.critical ? '🚨' : '  ';
      const statusText = result.success ? `${result.status} (${result.duration}ms)` : result.error;
      this.log(`${status} ${critical} ${service.padEnd(20)} ${statusText}`);
    });
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'test-results', `simple-api-test-${Date.now()}.json`);
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
      return 0;
    } else {
      this.logError(`🚨 ${this.results.summary.critical_failures} critical service(s) are down!`);
      return 1;
    }
  }

  async run() {
    this.logHeader('Suuupra EdTech Platform - Simple API Test Suite');
    this.log('🚀 Starting API health checks...', 'bright');
    
    // Test all microservices
    this.logHeader('Testing Microservices Health');
    for (const [serviceName, config] of Object.entries(SERVICES)) {
      await this.testService(serviceName, config);
    }
    
    // Test API Gateway routing
    await this.testAPIGatewayRouting();
    
    // Generate final report
    return await this.generateReport();
  }
}

// Main execution
async function main() {
  const tester = new SimpleAPITester();
  
  try {
    const exitCode = await tester.run();
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}❌ Test suite failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SimpleAPITester;
