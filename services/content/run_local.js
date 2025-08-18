#!/usr/bin/env node

/**
 * Local development runner for Content Service
 * 
 * This script ensures proper TypeScript path resolution and environment setup
 * for running the Content service locally.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const srcDir = path.join(projectRoot, 'src');

// Set default environment variables for local development
const envDefaults = {
    NODE_ENV: 'development',
    PORT: '8082',
    LOG_LEVEL: 'debug',
    
    // Database configurations (with fallback defaults)
    MONGODB_URI: 'mongodb://localhost:27017/content_dev',
    REDIS_URL: 'redis://localhost:6379',
    REDIS_DB: '2',
    ELASTICSEARCH_NODE: 'http://localhost:9200',
    ELASTICSEARCH_INDEX_PREFIX: 'content',
    
    // Auth configuration
    JWT_SECRET: 'your-development-jwt-secret',
    JWKS_URI: 'http://localhost:8081/.well-known/jwks.json',
    JWT_ISSUER: 'https://identity.suuupra.local',
    JWT_AUDIENCE: 'suuupra-api',
    
    // AWS/S3 configuration
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'minioadmin',
    AWS_SECRET_ACCESS_KEY: 'minioadmin',
    S3_BUCKET_NAME: 'suuupra-content-dev',
    S3_BUCKET_REGION: 'us-east-1',
    
    // Service URLs
    IDENTITY_SERVICE_URL: 'http://localhost:8081',
    NOTIFICATION_SERVICE_URL: 'http://localhost:8085',
    ANALYTICS_SERVICE_URL: 'http://localhost:8087',
    
    // Feature flags
    ENABLE_CONTENT_VERSIONING: 'true',
    ENABLE_APPROVAL_WORKFLOW: 'false',
    ENABLE_WEBHOOK_DELIVERY: 'false',
    ENABLE_CONTENT_MODERATION: 'false',
    ENABLE_BACKGROUND_JOBS: 'true',
    ENABLE_VIRUS_SCANNING: 'false',
    
    // CORS
    CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001'
};

// Apply default environment variables
for (const [key, value] of Object.entries(envDefaults)) {
    if (!process.env[key]) {
        process.env[key] = value;
    }
}

console.log('🚀 Starting Content Service in development mode...');
console.log(`📂 Project Root: ${projectRoot}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔌 Port: ${process.env.PORT}`);

// Check if node_modules exists
const nodeModulesPath = path.join(projectRoot, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('❌ node_modules not found. Please run: npm install');
    process.exit(1);
}

// Check if tsconfig.json exists
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
if (!fs.existsSync(tsconfigPath)) {
    console.log('❌ tsconfig.json not found. Please ensure you are in the correct directory.');
    process.exit(1);
}

// Check if src/server.ts exists
const serverPath = path.join(srcDir, 'server.ts');
if (!fs.existsSync(serverPath)) {
    console.log('❌ src/server.ts not found. Please ensure the source files are present.');
    process.exit(1);
}

// Check if required dependencies are installed
try {
    require.resolve('ts-node');
    require.resolve('tsconfig-paths');
} catch (error) {
    console.log('❌ Required dependencies not found. Please run: npm install');
    process.exit(1);
}

console.log('✅ Environment validation complete');
console.log('🔄 Starting TypeScript development server...');

// Start the development server
const child = spawn('npm', ['run', 'dev'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env
});

child.on('error', (error) => {
    console.error('❌ Failed to start development server:', error);
    process.exit(1);
});

child.on('exit', (code) => {
    console.log(`🛑 Development server exited with code ${code}`);
    process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    child.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    child.kill('SIGTERM');
});
