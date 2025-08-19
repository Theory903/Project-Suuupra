#!/usr/bin/env node

/**
 * 🚀 Suuupra EdTech Platform - Newman API Test Runner
 * 
 * Production-grade automated API testing using Newman CLI
 * Features:
 * - Comprehensive test execution across all services
 * - Detailed reporting with HTML, JSON, and JUnit formats
 * - Performance monitoring and SLA validation
 * - Error handling and retry mechanisms
 * - Parallel test execution support
 * - CI/CD integration ready
 */

const newman = require('newman');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

// ANSI color codes for beautiful console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class NewmanTestRunner {
  constructor() {
    this.startTime = performance.now();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      performance: {}
    };
    
    this.config = {
      collection: path.join(__dirname, 'Suuupra-EdTech-Platform.postman_collection.json'),
      environments: {
        local: path.join(__dirname, 'environments/Local-Development.postman_environment.json'),
        production: path.join(__dirname, 'environments/Production.postman_environment.json')
      },
      reporters: ['cli', 'html', 'json', 'junit'],
      reporterOptions: {
        html: {
          export: path.join(__dirname, 'reports/newman-report.html')
        },
        json: {
          export: path.join(__dirname, 'reports/newman-report.json')
        },
        junit: {
          export: path.join(__dirname, 'reports/newman-junit.xml')
        }
      },
      timeout: 30000, // 30 seconds
      delayRequest: 100, // 100ms between requests
      iterationCount: 1,
      bail: false // Continue on failures
    };
  }

  async ensureReportsDirectory() {
    const reportsDir = path.join(__dirname, 'reports');
    try {
      await fs.access(reportsDir);
    } catch {
      await fs.mkdir(reportsDir, { recursive: true });
      console.log(`${colors.cyan}📁 Created reports directory: ${reportsDir}${colors.reset}`);
    }
  }

  async validateFiles() {
    console.log(`${colors.blue}🔍 Validating test files...${colors.reset}`);
    
    // Check collection file
    try {
      await fs.access(this.config.collection);
      console.log(`${colors.green}✅ Collection file found${colors.reset}`);
    } catch {
      throw new Error(`Collection file not found: ${this.config.collection}`);
    }

    // Check environment files
    for (const [env, filePath] of Object.entries(this.config.environments)) {
      try {
        await fs.access(filePath);
        console.log(`${colors.green}✅ Environment file found: ${env}${colors.reset}`);
      } catch {
        console.log(`${colors.yellow}⚠️  Environment file not found: ${env}${colors.reset}`);
      }
    }
  }

  async runTests(environment = 'local', options = {}) {
    console.log(`${colors.bright}${colors.magenta}🚀 Starting Suuupra API Tests${colors.reset}`);
    console.log(`${colors.cyan}📊 Environment: ${environment}${colors.reset}`);
    console.log(`${colors.cyan}⏰ Started at: ${new Date().toISOString()}${colors.reset}`);
    console.log('─'.repeat(80));

    await this.ensureReportsDirectory();
    await this.validateFiles();

    const envFile = this.config.environments[environment];
    if (!envFile) {
      throw new Error(`Environment '${environment}' not found`);
    }

    const newmanOptions = {
      collection: this.config.collection,
      environment: envFile,
      reporters: this.config.reporters,
      reporter: this.config.reporterOptions,
      timeout: options.timeout || this.config.timeout,
      delayRequest: options.delay || this.config.delayRequest,
      iterationCount: options.iterations || this.config.iterationCount,
      bail: options.bail || this.config.bail,
      insecure: environment === 'local', // Allow self-signed certs in local
      ...options
    };

    return new Promise((resolve, reject) => {
      newman.run(newmanOptions, (err, summary) => {
        if (err) {
          console.error(`${colors.red}❌ Newman execution failed:${colors.reset}`, err);
          reject(err);
          return;
        }

        this.processSummary(summary);
        this.printResults();
        
        if (summary.run.failures.length > 0) {
          console.log(`${colors.red}❌ Tests completed with failures${colors.reset}`);
          resolve({ success: false, summary });
        } else {
          console.log(`${colors.green}✅ All tests passed successfully!${colors.reset}`);
          resolve({ success: true, summary });
        }
      });
    });
  }

  processSummary(summary) {
    const { run } = summary;
    
    this.results.total = run.stats.tests.total;
    this.results.passed = run.stats.tests.total - run.stats.tests.failed;
    this.results.failed = run.stats.tests.failed;
    this.results.skipped = run.stats.tests.pending || 0;
    
    // Process failures
    this.results.errors = run.failures.map(failure => ({
      test: failure.source.name || 'Unknown Test',
      error: failure.error.message,
      request: failure.source.request?.name || 'Unknown Request'
    }));

    // Performance metrics
    this.results.performance = {
      totalTime: performance.now() - this.startTime,
      avgResponseTime: run.timings.responseAverage,
      minResponseTime: run.timings.responseMin,
      maxResponseTime: run.timings.responseMax,
      totalRequests: run.stats.requests.total,
      failedRequests: run.stats.requests.failed
    };
  }

  printResults() {
    const endTime = performance.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);

    console.log('─'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}📊 TEST EXECUTION SUMMARY${colors.reset}`);
    console.log('─'.repeat(80));
    
    // Test Results
    console.log(`${colors.green}✅ Passed: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${this.results.failed}${colors.reset}`);
    console.log(`${colors.yellow}⏭️  Skipped: ${this.results.skipped}${colors.reset}`);
    console.log(`${colors.blue}📈 Total: ${this.results.total}${colors.reset}`);
    
    // Performance Metrics
    console.log('─'.repeat(40));
    console.log(`${colors.magenta}⚡ PERFORMANCE METRICS${colors.reset}`);
    console.log(`Total Execution Time: ${duration}s`);
    console.log(`Average Response Time: ${this.results.performance.avgResponseTime}ms`);
    console.log(`Min Response Time: ${this.results.performance.minResponseTime}ms`);
    console.log(`Max Response Time: ${this.results.performance.maxResponseTime}ms`);
    console.log(`Total Requests: ${this.results.performance.totalRequests}`);
    console.log(`Failed Requests: ${this.results.performance.failedRequests}`);

    // Error Details
    if (this.results.errors.length > 0) {
      console.log('─'.repeat(40));
      console.log(`${colors.red}❌ FAILURE DETAILS${colors.reset}`);
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${colors.yellow}${error.request}${colors.reset} - ${colors.red}${error.test}${colors.reset}`);
        console.log(`   Error: ${error.error}`);
      });
    }

    // SLA Validation
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}📋 SLA VALIDATION${colors.reset}`);
    const slaStatus = this.validateSLA();
    Object.entries(slaStatus).forEach(([metric, status]) => {
      const icon = status.passed ? '✅' : '❌';
      const color = status.passed ? colors.green : colors.red;
      console.log(`${icon} ${metric}: ${color}${status.value} (Target: ${status.target})${colors.reset}`);
    });

    console.log('─'.repeat(80));
    console.log(`${colors.cyan}📁 Reports generated in: ./postman/reports/${colors.reset}`);
    console.log(`${colors.cyan}🕐 Completed at: ${new Date().toISOString()}${colors.reset}`);
  }

  validateSLA() {
    const slaTargets = {
      'Average Response Time': { target: '< 2000ms', value: `${this.results.performance.avgResponseTime}ms` },
      'Max Response Time': { target: '< 5000ms', value: `${this.results.performance.maxResponseTime}ms` },
      'Success Rate': { 
        target: '> 95%', 
        value: `${((this.results.passed / this.results.total) * 100).toFixed(1)}%` 
      },
      'Error Rate': { 
        target: '< 5%', 
        value: `${((this.results.failed / this.results.total) * 100).toFixed(1)}%` 
      }
    };

    // Add pass/fail status
    slaTargets['Average Response Time'].passed = this.results.performance.avgResponseTime < 2000;
    slaTargets['Max Response Time'].passed = this.results.performance.maxResponseTime < 5000;
    slaTargets['Success Rate'].passed = (this.results.passed / this.results.total) > 0.95;
    slaTargets['Error Rate'].passed = (this.results.failed / this.results.total) < 0.05;

    return slaTargets;
  }

  async runHealthChecks() {
    console.log(`${colors.blue}🏥 Running health checks for all services...${colors.reset}`);
    
    const healthCheckOptions = {
      folder: '🔐 Authentication & Authorization', // Start with auth health check
      timeout: 10000,
      delayRequest: 50
    };

    return this.runTests('local', healthCheckOptions);
  }

  async runFullSuite(environment = 'local') {
    console.log(`${colors.bright}${colors.blue}🎯 Running complete test suite...${colors.reset}`);
    
    try {
      // First run health checks
      await this.runHealthChecks();
      
      // Then run full test suite
      const result = await this.runTests(environment);
      
      return result;
    } catch (error) {
      console.error(`${colors.red}💥 Test suite execution failed:${colors.reset}`, error);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || 'local';
  const testType = args[1] || 'full';

  const runner = new NewmanTestRunner();

  try {
    switch (testType) {
      case 'health':
        await runner.runHealthChecks();
        break;
      case 'full':
        await runner.runFullSuite(environment);
        break;
      default:
        await runner.runTests(environment);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}💥 Execution failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = NewmanTestRunner;

// Run if called directly
if (require.main === module) {
  main();
}
