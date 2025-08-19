#!/usr/bin/env node

/**
 * Comprehensive Service Report Generator
 * Analyzes all services in the Suuupra microservices ecosystem
 */

const fs = require('fs');
const path = require('path');

class ServiceAnalyzer {
  constructor() {
    this.services = [];
    this.servicesDir = './services';
  }

  analyzeService(serviceName) {
    const servicePath = path.join(this.servicesDir, serviceName);
    
    if (!fs.existsSync(servicePath)) {
      return null;
    }

    const analysis = {
      name: serviceName,
      path: servicePath,
      type: this.detectServiceType(servicePath),
      structure: this.analyzeStructure(servicePath),
      api: this.analyzeAPI(servicePath),
      tests: this.analyzeTests(servicePath),
      documentation: this.analyzeDocumentation(servicePath),
      infrastructure: this.analyzeInfrastructure(servicePath),
      dependencies: this.analyzeDependencies(servicePath),
      completeness: 0,
      status: 'unknown'
    };

    analysis.completeness = this.calculateCompleteness(analysis);
    analysis.status = this.determineStatus(analysis);

    return analysis;
  }

  detectServiceType(servicePath) {
    if (fs.existsSync(path.join(servicePath, 'package.json'))) return 'Node.js';
    if (fs.existsSync(path.join(servicePath, 'requirements.txt'))) return 'Python';
    if (fs.existsSync(path.join(servicePath, 'go.mod'))) return 'Go';
    if (fs.existsSync(path.join(servicePath, 'pom.xml'))) return 'Java (Maven)';
    if (fs.existsSync(path.join(servicePath, 'build.gradle'))) return 'Java (Gradle)';
    if (fs.existsSync(path.join(servicePath, 'Cargo.toml'))) return 'Rust';
    return 'Unknown';
  }

  analyzeStructure(servicePath) {
    const structure = {
      hasSource: false,
      sourceDir: null,
      hasConfig: false,
      hasDockerfile: false,
      hasReadme: false
    };

    // Check for source directories
    const possibleSrcDirs = ['src', 'lib', 'app', 'main'];
    for (const dir of possibleSrcDirs) {
      if (fs.existsSync(path.join(servicePath, dir))) {
        structure.hasSource = true;
        structure.sourceDir = dir;
        break;
      }
    }

    // Check for configuration
    const configFiles = ['config', '.env', 'config.json', 'config.yaml'];
    structure.hasConfig = configFiles.some(file => 
      fs.existsSync(path.join(servicePath, file))
    );

    structure.hasDockerfile = fs.existsSync(path.join(servicePath, 'Dockerfile'));
    structure.hasReadme = fs.existsSync(path.join(servicePath, 'README.md'));

    return structure;
  }

  analyzeAPI(servicePath) {
    const api = {
      hasOpenAPI: false,
      hasGraphQL: false,
      hasREST: false,
      hasGRPC: false,
      apiFiles: []
    };

    // Check for OpenAPI/Swagger
    const apiPaths = [
      'src/api/openapi.yaml',
      'src/api/swagger.yaml',
      'api/openapi.yaml',
      'openapi.yaml',
      'swagger.yaml'
    ];

    for (const apiPath of apiPaths) {
      if (fs.existsSync(path.join(servicePath, apiPath))) {
        api.hasOpenAPI = true;
        api.hasREST = true;
        api.apiFiles.push(apiPath);
      }
    }

    // Check for gRPC
    const grpcPaths = ['proto', 'src/proto', 'pkg/pb'];
    for (const grpcPath of grpcPaths) {
      if (fs.existsSync(path.join(servicePath, grpcPath))) {
        api.hasGRPC = true;
        api.apiFiles.push(grpcPath);
      }
    }

    // Check for GraphQL
    if (fs.existsSync(path.join(servicePath, 'schema.graphql')) ||
        fs.existsSync(path.join(servicePath, 'src/schema.graphql'))) {
      api.hasGraphQL = true;
    }

    return api;
  }

  analyzeTests(servicePath) {
    const tests = {
      hasTests: false,
      hasUnit: false,
      hasIntegration: false,
      hasE2E: false,
      testDirs: [],
      testFiles: []
    };

    const testDirs = ['tests', 'test', '__tests__', 'spec'];
    for (const testDir of testDirs) {
      const testPath = path.join(servicePath, testDir);
      if (fs.existsSync(testPath)) {
        tests.hasTests = true;
        tests.testDirs.push(testDir);

        // Check for specific test types
        if (fs.existsSync(path.join(testPath, 'unit'))) tests.hasUnit = true;
        if (fs.existsSync(path.join(testPath, 'integration'))) tests.hasIntegration = true;
        if (fs.existsSync(path.join(testPath, 'e2e'))) tests.hasE2E = true;
      }
    }

    // Check for test files in root
    try {
      const files = fs.readdirSync(servicePath);
      const testFiles = files.filter(file => 
        file.includes('test') || file.includes('spec')
      );
      if (testFiles.length > 0) {
        tests.hasTests = true;
        tests.testFiles = testFiles;
      }
    } catch (e) {
      // Ignore errors
    }

    return tests;
  }

  analyzeDocumentation(servicePath) {
    const docs = {
      hasReadme: false,
      hasAPIDoc: false,
      hasArchitectureDoc: false,
      hasDeploymentDoc: false,
      docFiles: []
    };

    const docFiles = ['README.md', 'ARCHITECTURE.md', 'DEPLOYMENT.md', 'API.md'];
    for (const docFile of docFiles) {
      if (fs.existsSync(path.join(servicePath, docFile))) {
        docs.docFiles.push(docFile);
        if (docFile === 'README.md') docs.hasReadme = true;
        if (docFile === 'API.md') docs.hasAPIDoc = true;
        if (docFile === 'ARCHITECTURE.md') docs.hasArchitectureDoc = true;
        if (docFile === 'DEPLOYMENT.md') docs.hasDeploymentDoc = true;
      }
    }

    // Check docs directory
    const docsPath = path.join(servicePath, 'docs');
    if (fs.existsSync(docsPath)) {
      try {
        const docsDirFiles = fs.readdirSync(docsPath);
        docs.docFiles.push(`docs/ (${docsDirFiles.length} files)`);
        docs.hasAPIDoc = true; // Assume docs dir has API documentation
      } catch (e) {
        // Ignore errors
      }
    }

    return docs;
  }

  analyzeInfrastructure(servicePath) {
    const infra = {
      hasDocker: false,
      hasKubernetes: false,
      hasTerraform: false,
      hasHelm: false,
      infraFiles: []
    };

    // Docker
    if (fs.existsSync(path.join(servicePath, 'Dockerfile'))) {
      infra.hasDocker = true;
      infra.infraFiles.push('Dockerfile');
    }

    // Kubernetes
    const k8sPaths = ['k8s', 'kubernetes', 'manifests', 'infrastructure/kubernetes'];
    for (const k8sPath of k8sPaths) {
      if (fs.existsSync(path.join(servicePath, k8sPath))) {
        infra.hasKubernetes = true;
        infra.infraFiles.push(k8sPath);
      }
    }

    // Terraform
    const terraformPaths = ['terraform', 'infrastructure/terraform'];
    for (const tfPath of terraformPaths) {
      if (fs.existsSync(path.join(servicePath, tfPath))) {
        infra.hasTerraform = true;
        infra.infraFiles.push(tfPath);
      }
    }

    // Helm
    if (fs.existsSync(path.join(servicePath, 'Chart.yaml'))) {
      infra.hasHelm = true;
      infra.infraFiles.push('Chart.yaml');
    }

    return infra;
  }

  analyzeDependencies(servicePath) {
    const deps = {
      hasDependencies: false,
      dependencyFiles: [],
      packageManager: null
    };

    const depFiles = [
      { file: 'package.json', manager: 'npm/yarn' },
      { file: 'requirements.txt', manager: 'pip' },
      { file: 'go.mod', manager: 'go modules' },
      { file: 'pom.xml', manager: 'maven' },
      { file: 'Cargo.toml', manager: 'cargo' },
      { file: 'composer.json', manager: 'composer' }
    ];

    for (const dep of depFiles) {
      if (fs.existsSync(path.join(servicePath, dep.file))) {
        deps.hasDependencies = true;
        deps.dependencyFiles.push(dep.file);
        deps.packageManager = dep.manager;
      }
    }

    return deps;
  }

  calculateCompleteness(analysis) {
    let score = 0;
    let maxScore = 0;

    // Source code (20 points)
    maxScore += 20;
    if (analysis.structure.hasSource) score += 20;

    // API documentation (15 points)
    maxScore += 15;
    if (analysis.api.hasOpenAPI || analysis.api.hasGRPC) score += 15;

    // Tests (15 points)
    maxScore += 15;
    if (analysis.tests.hasTests) {
      score += 5;
      if (analysis.tests.hasUnit) score += 5;
      if (analysis.tests.hasIntegration) score += 5;
    }

    // Documentation (10 points)
    maxScore += 10;
    if (analysis.documentation.hasReadme) score += 5;
    if (analysis.documentation.hasAPIDoc) score += 5;

    // Infrastructure (15 points)
    maxScore += 15;
    if (analysis.infrastructure.hasDocker) score += 10;
    if (analysis.infrastructure.hasKubernetes) score += 5;

    // Dependencies (10 points)
    maxScore += 10;
    if (analysis.dependencies.hasDependencies) score += 10;

    // Configuration (10 points)
    maxScore += 10;
    if (analysis.structure.hasConfig) score += 10;

    // Dockerfile (5 points)
    maxScore += 5;
    if (analysis.structure.hasDockerfile) score += 5;

    return Math.round((score / maxScore) * 100);
  }

  determineStatus(analysis) {
    if (analysis.completeness >= 90) return '🟢 Excellent';
    if (analysis.completeness >= 75) return '🟡 Good';
    if (analysis.completeness >= 50) return '🟠 Fair';
    if (analysis.completeness >= 25) return '🔴 Poor';
    return '⚫ Critical';
  }

  generateReport() {
    console.log('🚀 SUUUPRA MICROSERVICES ECOSYSTEM REPORT');
    console.log('=' * 60);
    console.log(`📅 Generated: ${new Date().toISOString()}`);
    console.log(`🔍 Analysis Date: ${new Date().toLocaleDateString()}\n`);

    // Discover all services
    try {
      const serviceDirs = fs.readdirSync(this.servicesDir)
        .filter(item => fs.statSync(path.join(this.servicesDir, item)).isDirectory());
      
      console.log(`📊 Found ${serviceDirs.length} services in the ecosystem\n`);

      // Analyze each service
      for (const serviceDir of serviceDirs) {
        const analysis = this.analyzeService(serviceDir);
        if (analysis) {
          this.services.push(analysis);
        }
      }

      // Sort by completeness
      this.services.sort((a, b) => b.completeness - a.completeness);

      this.printExecutiveSummary();
      this.printDetailedAnalysis();
      this.printRecommendations();

    } catch (error) {
      console.error('❌ Error analyzing services:', error.message);
    }
  }

  printExecutiveSummary() {
    console.log('📋 EXECUTIVE SUMMARY');
    console.log('-'.repeat(40));

    const totalServices = this.services.length;
    const excellentServices = this.services.filter(s => s.completeness >= 90).length;
    const goodServices = this.services.filter(s => s.completeness >= 75 && s.completeness < 90).length;
    const fairServices = this.services.filter(s => s.completeness >= 50 && s.completeness < 75).length;
    const poorServices = this.services.filter(s => s.completeness < 50).length;

    const avgCompleteness = Math.round(
      this.services.reduce((sum, s) => sum + s.completeness, 0) / totalServices
    );

    console.log(`📈 Overall Health Score: ${avgCompleteness}%`);
    console.log(`🎯 Total Services: ${totalServices}`);
    console.log(`🟢 Excellent (90%+): ${excellentServices} services`);
    console.log(`🟡 Good (75-89%): ${goodServices} services`);
    console.log(`🟠 Fair (50-74%): ${fairServices} services`);
    console.log(`🔴 Poor (<50%): ${poorServices} services\n`);

    // Technology breakdown
    const techBreakdown = {};
    this.services.forEach(service => {
      techBreakdown[service.type] = (techBreakdown[service.type] || 0) + 1;
    });

    console.log('💻 Technology Stack Distribution:');
    Object.entries(techBreakdown).forEach(([tech, count]) => {
      console.log(`   ${tech}: ${count} services`);
    });
    console.log();
  }

  printDetailedAnalysis() {
    console.log('🔍 DETAILED SERVICE ANALYSIS');
    console.log('-'.repeat(60));

    this.services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name.toUpperCase()} ${service.status}`);
      console.log(`   📊 Completeness: ${service.completeness}%`);
      console.log(`   💻 Technology: ${service.type}`);
      
      // Structure
      console.log(`   📁 Structure: ${service.structure.hasSource ? '✅' : '❌'} Source, ${service.structure.hasDockerfile ? '✅' : '❌'} Docker, ${service.structure.hasConfig ? '✅' : '❌'} Config`);
      
      // API
      const apiStatus = service.api.hasOpenAPI ? '✅ OpenAPI' : 
                       service.api.hasGRPC ? '✅ gRPC' : '❌ No API';
      console.log(`   🌐 API: ${apiStatus}`);
      
      // Tests
      const testStatus = service.tests.hasTests ? 
        `✅ Tests (${service.tests.hasUnit ? 'Unit' : ''}${service.tests.hasIntegration ? ' Integration' : ''}${service.tests.hasE2E ? ' E2E' : ''})` : 
        '❌ No Tests';
      console.log(`   🧪 Testing: ${testStatus}`);
      
      // Documentation
      const docStatus = service.documentation.hasReadme ? '✅ Documented' : '❌ No Docs';
      console.log(`   📚 Documentation: ${docStatus}`);
      
      // Infrastructure
      const infraStatus = service.infrastructure.hasDocker ? 
        `✅ Infrastructure (${service.infrastructure.hasKubernetes ? 'K8s' : 'Docker'})` : 
        '❌ No Infrastructure';
      console.log(`   🏗️  Infrastructure: ${infraStatus}`);
      
      console.log();
    });
  }

  printRecommendations() {
    console.log('💡 RECOMMENDATIONS & ACTION ITEMS');
    console.log('-'.repeat(50));

    const criticalServices = this.services.filter(s => s.completeness < 50);
    const servicesWithoutTests = this.services.filter(s => !s.tests.hasTests);
    const servicesWithoutAPI = this.services.filter(s => !s.api.hasOpenAPI && !s.api.hasGRPC);
    const servicesWithoutDocs = this.services.filter(s => !s.documentation.hasReadme);

    if (criticalServices.length > 0) {
      console.log(`🚨 CRITICAL: ${criticalServices.length} services need immediate attention:`);
      criticalServices.forEach(s => console.log(`   - ${s.name} (${s.completeness}%)`));
      console.log();
    }

    if (servicesWithoutTests.length > 0) {
      console.log(`🧪 TESTING: ${servicesWithoutTests.length} services need test coverage:`);
      servicesWithoutTests.slice(0, 5).forEach(s => console.log(`   - ${s.name}`));
      if (servicesWithoutTests.length > 5) console.log(`   ... and ${servicesWithoutTests.length - 5} more`);
      console.log();
    }

    if (servicesWithoutAPI.length > 0) {
      console.log(`📝 API DOCUMENTATION: ${servicesWithoutAPI.length} services need API specs:`);
      servicesWithoutAPI.slice(0, 5).forEach(s => console.log(`   - ${s.name}`));
      if (servicesWithoutAPI.length > 5) console.log(`   ... and ${servicesWithoutAPI.length - 5} more`);
      console.log();
    }

    if (servicesWithoutDocs.length > 0) {
      console.log(`📚 DOCUMENTATION: ${servicesWithoutDocs.length} services need README files:`);
      servicesWithoutDocs.slice(0, 5).forEach(s => console.log(`   - ${s.name}`));
      if (servicesWithoutDocs.length > 5) console.log(`   ... and ${servicesWithoutDocs.length - 5} more`);
      console.log();
    }

    console.log('🎯 NEXT STEPS:');
    console.log('1. Address critical services with completeness < 50%');
    console.log('2. Add comprehensive test coverage to all services');
    console.log('3. Create API documentation for all exposed services');
    console.log('4. Standardize documentation across all services');
    console.log('5. Implement infrastructure as code for remaining services');
    console.log();

    const excellentServicesCount = this.services.filter(s => s.completeness >= 90).length;
    
    console.log('✨ ACHIEVEMENTS:');
    console.log(`- ${excellentServicesCount} services are production-ready (90%+ completeness)`);
    console.log(`- ${this.services.filter(s => s.api.hasOpenAPI).length} services have OpenAPI specifications`);
    console.log(`- ${this.services.filter(s => s.tests.hasTests).length} services have test coverage`);
    console.log(`- ${this.services.filter(s => s.infrastructure.hasDocker).length} services are containerized`);
  }
}

// Generate the report
const analyzer = new ServiceAnalyzer();
analyzer.generateReport();