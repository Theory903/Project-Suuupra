const fs = require('fs');
const path = require('path');

class EnhancedTestOrchestrator {
    constructor() {
        this.services = {
            // Node.js Services
            'api-gateway': { type: 'node', port: 3000, framework: 'fastify', status: 'not_tested' },
            'admin': { type: 'node', port: 3001, framework: 'react', status: 'not_tested' },
            'bank-simulator': { type: 'node', port: 3002, framework: 'fastify', status: 'not_tested' },
            'content': { type: 'node', port: 3003, framework: 'express', status: 'not_tested' },
            'content-delivery': { type: 'node', port: 3004, framework: 'express', status: 'not_tested' },
            'creator-studio': { type: 'node', port: 3005, framework: 'react', status: 'not_tested' },
            'live-classes': { type: 'node', port: 3006, framework: 'fastify', status: 'not_tested' },
            
            // Python Services
            'analytics': { type: 'python', port: 8001, framework: 'fastapi', status: 'not_tested' },
            'commerce': { type: 'python', port: 8002, framework: 'fastapi', status: 'not_tested' },
            'llm-tutor': { type: 'python', port: 8003, framework: 'fastapi', status: 'not_tested' },
            'notifications': { type: 'python', port: 8004, framework: 'fastapi', status: 'not_tested' },
            'recommendations': { type: 'python', port: 8005, framework: 'fastapi', status: 'not_tested' },
            'vod': { type: 'python', port: 8006, framework: 'fastapi', status: 'not_tested' },
            
            // Go Services
            'counters': { type: 'go', port: 8101, framework: 'chi', status: 'not_tested' },
            'live-tracking': { type: 'rust', port: 8102, framework: 'axum', status: 'not_tested' },
            'mass-live': { type: 'go', port: 8103, framework: 'gin', status: 'not_tested' },
            'payments': { type: 'go', port: 8104, framework: 'gin', status: 'not_tested' },
            'search-crawler': { type: 'go', port: 8105, framework: 'gin', status: 'not_tested' },
            'upi-core': { type: 'go', port: 8106, framework: 'grpc', status: 'not_tested' },
            
            // Java Services
            'identity': { type: 'java', port: 8201, framework: 'spring-boot', status: 'not_tested' },
            'ledger': { type: 'java', port: 8202, framework: 'spring-boot', status: 'not_tested' }
        };
        this.testResults = {};
    }

    async runTests() {
        console.log('🚀 Starting Enhanced Suuupra Service Tests\n');
        console.log(`Testing ${Object.keys(this.services).length} services...\n`);
        
        for (const [serviceName, serviceConfig] of Object.entries(this.services)) {
            await this.testService(serviceName, serviceConfig);
        }
        
        this.generateReport();
    }

    async testService(serviceName, serviceConfig) {
        console.log(`🔍 Testing ${serviceName} (${serviceConfig.type}/${serviceConfig.framework})...`);
        
        const result = {
            service: serviceName,
            type: serviceConfig.type,
            framework: serviceConfig.framework,
            port: serviceConfig.port,
            tests: {},
            passed: 0,
            failed: 0,
            errors: [],
            status: 'tested',
            timestamp: new Date().toISOString()
        };

        try {
            // Test 1: Service directory structure
            await this.testServiceStructure(serviceName, serviceConfig, result);
            
            // Test 2: Configuration files
            await this.testConfigurationFiles(serviceName, serviceConfig, result);
            
            // Test 3: Source code structure
            await this.testSourceStructure(serviceName, serviceConfig, result);
            
            // Test 4: Documentation
            await this.testDocumentation(serviceName, serviceConfig, result);
            
            // Test 5: Infrastructure files
            await this.testInfrastructure(serviceName, serviceConfig, result);

        } catch (error) {
            result.errors.push(`Test execution failed: ${error.message}`);
            result.failed++;
            console.log(`  ❌ Error: ${error.message}`);
        }

        this.testResults[serviceName] = result;
        
        const status = result.failed === 0 ? '✅' : '❌';
        const percentage = result.passed + result.failed > 0 ? 
            Math.round((result.passed / (result.passed + result.failed)) * 100) : 0;
        console.log(`${status} ${serviceName}: ${result.passed} passed, ${result.failed} failed (${percentage}%)\n`);
    }

    async testServiceStructure(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        
        // Check if service directory exists
        if (fs.existsSync(servicePath)) {
            result.tests.directoryExists = true;
            result.passed++;
            console.log(`  ✅ Service directory exists`);
        } else {
            result.tests.directoryExists = false;
            result.failed++;
            result.errors.push('Service directory not found');
            console.log(`  ❌ Service directory missing`);
            return;
        }

        // Check for main application files
        const mainFiles = this.getMainFiles(serviceConfig.type);
        let mainFileFound = null;
        
        for (const file of mainFiles) {
            if (fs.existsSync(path.join(servicePath, file))) {
                mainFileFound = file;
                break;
            }
        }
        
        if (mainFileFound) {
            result.tests.mainFileExists = true;
            result.passed++;
            console.log(`  ✅ Main file found: ${mainFileFound}`);
        } else {
            result.tests.mainFileExists = false;
            result.failed++;
            result.errors.push('Main application file not found');
            console.log(`  ❌ Main file missing`);
        }
    }

    async testConfigurationFiles(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const configFiles = this.getConfigFiles(serviceConfig.type);
        
        let configFound = [];
        for (const file of configFiles) {
            if (fs.existsSync(path.join(servicePath, file))) {
                configFound.push(file);
            }
        }
        
        if (configFound.length > 0) {
            result.tests.configExists = true;
            result.passed++;
            console.log(`  ✅ Configuration found: ${configFound.join(', ')}`);
        } else {
            result.tests.configExists = false;
            result.failed++;
            result.errors.push('Configuration files not found');
            console.log(`  ❌ Configuration missing`);
        }
    }

    async testSourceStructure(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const srcPath = path.join(servicePath, 'src');
        
        if (fs.existsSync(srcPath)) {
            result.tests.sourceStructure = true;
            result.passed++;
            console.log(`  ✅ Source directory structure found`);
            
            // Check for API/routes
            const apiPaths = ['src/api', 'src/routes', 'src/controllers'];
            let apiFound = false;
            for (const apiPath of apiPaths) {
                if (fs.existsSync(path.join(servicePath, apiPath))) {
                    apiFound = true;
                    break;
                }
            }
            
            if (apiFound) {
                result.tests.apiStructure = true;
                result.passed++;
                console.log(`  ✅ API structure found`);
            } else {
                result.tests.apiStructure = false;
                result.failed++;
                result.errors.push('API structure not found');
                console.log(`  ❌ API structure missing`);
            }
        } else {
            result.tests.sourceStructure = false;
            result.failed++;
            result.errors.push('Source directory not found');
            console.log(`  ❌ Source structure missing`);
        }
    }

    async testDocumentation(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const docFiles = ['README.md', 'docs/', 'src/api/openapi.yaml', 'API.md'];
        
        let docsFound = [];
        for (const docFile of docFiles) {
            if (fs.existsSync(path.join(servicePath, docFile))) {
                docsFound.push(docFile);
            }
        }
        
        if (docsFound.length >= 2) {
            result.tests.documentation = true;
            result.passed++;
            console.log(`  ✅ Documentation found: ${docsFound.join(', ')}`);
        } else {
            result.tests.documentation = false;
            result.failed++;
            result.errors.push('Insufficient documentation');
            console.log(`  ❌ Documentation insufficient`);
        }
    }

    async testInfrastructure(serviceName, serviceConfig, result) {
        const servicePath = path.join(__dirname, 'services', serviceName);
        const infraFiles = ['Dockerfile', 'docker-compose.yml', 'k8s/', 'infrastructure/'];
        
        let infraFound = [];
        for (const infraFile of infraFiles) {
            if (fs.existsSync(path.join(servicePath, infraFile))) {
                infraFound.push(infraFile);
            }
        }
        
        if (infraFound.length >= 2) {
            result.tests.infrastructure = true;
            result.passed++;
            console.log(`  ✅ Infrastructure files found: ${infraFound.join(', ')}`);
        } else {
            result.tests.infrastructure = false;
            result.failed++;
            result.errors.push('Infrastructure files missing');
            console.log(`  ❌ Infrastructure incomplete`);
        }

        // Check for test directories
        const testDirs = ['tests/', 'test/', 'src/test/'];
        let testFound = false;
        for (const testDir of testDirs) {
            if (fs.existsSync(path.join(servicePath, testDir))) {
                testFound = true;
                break;
            }
        }
        
        if (testFound) {
            result.tests.testDirectory = true;
            result.passed++;
            console.log(`  ✅ Test directory found`);
        } else {
            result.tests.testDirectory = false;
            result.failed++;
            result.errors.push('Test directory not found');
            console.log(`  ❌ Test directory missing`);
        }
    }

    getMainFiles(type) {
        switch (type) {
            case 'node': 
                return [
                    'src/server.ts', 'src/server.js', 'src/index.ts', 'src/index.js', 
                    'index.js', 'server.js', 'src/app.ts', 'src/app.js'
                ];
            case 'python': 
                return [
                    'src/main.py', 'main.py', 'app.py', 'src/app.py', 
                    'server.py', 'src/server.py'
                ];
            case 'go': 
                return [
                    'main.go', 'cmd/main.go', 'cmd/server/main.go'
                ];
            case 'java': 
                return [
                    'src/main/java', 'pom.xml'
                ];
            case 'rust': 
                return [
                    'src/main.rs', 'Cargo.toml'
                ];
            default: 
                return [];
        }
    }

    getConfigFiles(type) {
        switch (type) {
            case 'node': 
                return ['package.json', 'tsconfig.json', '.env.example'];
            case 'python': 
                return ['requirements.txt', 'requirements_fixed.txt', 'pyproject.toml', 'setup.py'];
            case 'go': 
                return ['go.mod', 'go.sum'];
            case 'java': 
                return ['pom.xml', 'build.gradle', 'src/main/resources/application.yml'];
            case 'rust': 
                return ['Cargo.toml', 'Cargo.lock'];
            default: 
                return [];
        }
    }

    generateReport() {
        console.log('\n📊 Generating Enhanced Test Report...\n');
        
        const summary = {
            totalServices: Object.keys(this.testResults).length,
            passedServices: 0,
            failedServices: 0,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            servicesByType: {},
            servicesByStatus: { passed: [], failed: [] }
        };

        // Calculate statistics by service type
        Object.values(this.testResults).forEach(result => {
            summary.totalTests += result.passed + result.failed;
            summary.passedTests += result.passed;
            summary.failedTests += result.failed;
            
            // Track by service type
            if (!summary.servicesByType[result.type]) {
                summary.servicesByType[result.type] = { total: 0, passed: 0, failed: 0 };
            }
            summary.servicesByType[result.type].total++;
            
            if (result.failed === 0) {
                summary.passedServices++;
                summary.servicesByType[result.type].passed++;
                summary.servicesByStatus.passed.push(result.service);
            } else {
                summary.failedServices++;
                summary.servicesByType[result.type].failed++;
                summary.servicesByStatus.failed.push(result.service);
            }
        });

        const report = {
            timestamp: new Date().toISOString(),
            summary,
            services: this.testResults,
            metadata: {
                testDuration: '~5 minutes',
                testTypes: ['Structure', 'Configuration', 'Source Code', 'Documentation', 'Infrastructure'],
                coverage: 'Service architecture and setup validation'
            }
        };

        // Write JSON report
        fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));

        // Print enhanced summary
        console.log('='.repeat(80));
        console.log('🎯 SUUUPRA SERVICES ENHANCED TEST SUMMARY');
        console.log('='.repeat(80));
        console.log(`📅 Timestamp: ${report.timestamp}`);
        console.log(`🏢 Services Tested: ${summary.totalServices}`);
        console.log(`✅ Services Passed: ${summary.passedServices}`);
        console.log(`❌ Services Failed: ${summary.failedServices}`);
        console.log(`🧪 Total Tests: ${summary.totalTests}`);
        console.log(`✅ Tests Passed: ${summary.passedTests}`);
        console.log(`❌ Tests Failed: ${summary.failedTests}`);
        
        const successRate = summary.totalTests > 0 ? 
            ((summary.passedTests / summary.totalTests) * 100).toFixed(1) : 0;
        console.log(`📈 Success Rate: ${successRate}%`);
        
        // Print by service type
        console.log('\n📊 BY SERVICE TYPE:');
        Object.entries(summary.servicesByType).forEach(([type, stats]) => {
            const typeRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
            console.log(`  ${type.toUpperCase()}: ${stats.passed}/${stats.total} (${typeRate}%)`);
        });
        
        console.log('='.repeat(80));

        // Print failed services details
        if (summary.failedServices > 0) {
            console.log('\n❌ SERVICES NEEDING ATTENTION:\n');
            Object.entries(this.testResults).forEach(([serviceName, result]) => {
                if (result.failed > 0) {
                    console.log(`🔴 ${serviceName} (${result.type}/${result.framework}):`);
                    result.errors.forEach(error => {
                        console.log(`   • ${error}`);
                    });
                    console.log('');
                }
            });
        }

        // Print successful services
        if (summary.passedServices > 0) {
            console.log('\n✅ FULLY COMPLIANT SERVICES:\n');
            summary.servicesByStatus.passed.forEach(serviceName => {
                const result = this.testResults[serviceName];
                console.log(`🟢 ${serviceName} (${result.type}/${result.framework}) - ${result.passed} tests passed`);
            });
            console.log('');
        }

        console.log('📋 Detailed report saved to: test-results.json\n');
    }
}

// Run the enhanced tests
const orchestrator = new EnhancedTestOrchestrator();
orchestrator.runTests().catch(console.error);