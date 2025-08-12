export default async function globalSetup() {
  console.log('Setting up integration tests...');
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Database configuration for integration tests
  process.env.MONGODB_URI = 'mongodb://localhost:27017/content_integration_test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.REDIS_DB = '1';
  process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
  
  // Mock external service configurations
  process.env.JWT_SECRET = 'integration-test-jwt-secret';
  process.env.JWKS_URI = 'http://localhost:8081/.well-known/jwks.json';
  process.env.JWT_ISSUER = 'integration-test-issuer';
  process.env.JWT_AUDIENCE = 'integration-test-audience';
  
  // S3 configuration (can use MinIO for integration tests)
  process.env.AWS_ACCESS_KEY_ID = 'minioadmin';
  process.env.AWS_SECRET_ACCESS_KEY = 'minioadmin';
  process.env.S3_BUCKET_NAME = 'integration-test-bucket';
  process.env.S3_BUCKET_REGION = 'us-east-1';
  
  // Disable features that might interfere with tests
  process.env.ENABLE_BACKGROUND_JOBS = 'false';
  process.env.ENABLE_WEBHOOK_DELIVERY = 'false';
  process.env.ENABLE_CONTENT_MODERATION = 'false';
  
  console.log('Integration test environment configured');
}
