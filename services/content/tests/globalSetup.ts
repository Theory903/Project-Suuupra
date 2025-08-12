import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Mock environment variables
  process.env.MONGODB_URI = 'mongodb://localhost:27017/content_test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWKS_URI = 'http://localhost:8081/.well-known/jwks.json';
  process.env.JWT_ISSUER = 'test-issuer';
  process.env.JWT_AUDIENCE = 'test-audience';
  process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.S3_BUCKET_NAME = 'test-bucket';
  process.env.S3_BUCKET_REGION = 'us-east-1';
  
  // Disable features that require external services
  process.env.ENABLE_BACKGROUND_JOBS = 'false';
  process.env.ENABLE_WEBHOOK_DELIVERY = 'false';
  process.env.ENABLE_CONTENT_MODERATION = 'false';
  
  console.log('Global test setup completed');
}
