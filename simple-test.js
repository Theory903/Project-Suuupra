#!/usr/bin/env node

/**
 * Simple test to verify that all previously failing services now have proper structure
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} (missing)`);
    return false;
  }
}

function checkDirectory(dirPath, description) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    console.log(`✅ ${description}: ${dirPath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${dirPath} (missing)`);
    return false;
  }
}

console.log('🔍 Verifying fixes for previously failing services...\n');

let totalChecks = 0;
let passedChecks = 0;

// API Gateway
console.log('📊 API Gateway Structure:');
totalChecks += 1;
passedChecks += checkFile('services/api-gateway/src/api/openapi.yaml', 'API documentation') ? 1 : 0;
console.log();

// Bank Simulator
console.log('🏦 Bank Simulator Structure:');
totalChecks += 3;
passedChecks += checkFile('services/bank-simulator/src/api/openapi.yaml', 'API documentation') ? 1 : 0;
passedChecks += checkDirectory('services/bank-simulator/tests/unit', 'Unit tests directory') ? 1 : 0;
passedChecks += checkDirectory('services/bank-simulator/tests/integration', 'Integration tests directory') ? 1 : 0;
console.log();

// Content Delivery
console.log('🎬 Content Delivery Structure:');
totalChecks += 5;
passedChecks += checkDirectory('services/content-delivery/src', 'Source directory') ? 1 : 0;
passedChecks += checkFile('services/content-delivery/src/api/openapi.yaml', 'API documentation') ? 1 : 0;
passedChecks += checkDirectory('services/content-delivery/tests', 'Tests directory') ? 1 : 0;
passedChecks += checkDirectory('services/content-delivery/docs', 'Documentation directory') ? 1 : 0;
passedChecks += checkDirectory('services/content-delivery/infrastructure', 'Infrastructure directory') ? 1 : 0;
console.log();

// UPI Core
console.log('💳 UPI Core Structure:');
totalChecks += 4;
passedChecks += checkFile('services/upi-core/src/main.go', 'Main source file') ? 1 : 0;
passedChecks += checkDirectory('services/upi-core/tests/unit', 'Unit tests directory') ? 1 : 0;
passedChecks += checkDirectory('services/upi-core/tests/integration', 'Integration tests directory') ? 1 : 0;
passedChecks += checkDirectory('services/upi-core/infrastructure', 'Infrastructure directory') ? 1 : 0;
console.log();

// Identity Service
console.log('👤 Identity Service Structure:');
totalChecks += 3;
passedChecks += checkFile('services/identity/src/main/java/com/suuupra/identity/api/AuthController.java', 'Auth controller') ? 1 : 0;
passedChecks += checkFile('services/identity/src/main/java/com/suuupra/identity/api/UserController.java', 'User controller') ? 1 : 0;
passedChecks += checkFile('services/identity/docs/api-documentation.md', 'API documentation') ? 1 : 0;
console.log();

// Summary
console.log('📊 SUMMARY:');
console.log(`✅ Passed: ${passedChecks}/${totalChecks} checks`);
console.log(`📈 Success Rate: ${(passedChecks/totalChecks*100).toFixed(1)}%`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 All service structures are complete! All previously failing services have been fixed.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some service structures are still incomplete.');
  process.exit(1);
}