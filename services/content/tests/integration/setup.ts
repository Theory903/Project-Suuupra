import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import { DatabaseManager } from '@/models';

let dbManager: DatabaseManager;
let redis: Redis;

beforeAll(async () => {
  // Use test database
  process.env.MONGODB_URI = 'mongodb://localhost:27017/content_integration_test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.REDIS_DB = '1'; // Use different DB for integration tests
  
  // Initialize database
  dbManager = DatabaseManager.getInstance();
  await dbManager.connect();
  await dbManager.createIndexes();
  
  // Initialize Redis
  redis = new Redis({
    host: 'localhost',
    port: 6379,
    db: 1,
    maxRetriesPerRequest: 1,
    retryDelayOnFailover: 100,
    lazyConnect: true
  });
  
  try {
    await redis.connect();
  } catch (error) {
    console.warn('Redis not available for integration tests');
  }
}, 30000);

afterAll(async () => {
  // Clean up
  await dbManager.disconnect();
  
  if (redis) {
    redis.disconnect();
  }
}, 10000);

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  
  // Clear Redis
  try {
    await redis.flushdb();
  } catch (error) {
    // Redis might not be available
  }
});

// Global test utilities for integration tests
global.integrationUtils = {
  createTestContent: async (overrides = {}) => {
    const { Content } = await import('@/models/Content');
    
    const contentData = {
      tenantId: 'test-tenant',
      title: 'Integration Test Content',
      description: 'Test description for integration',
      contentType: 'article',
      createdBy: 'test-user',
      ...overrides
    };
    
    const content = new Content(contentData);
    await content.save();
    return content;
  },
  
  createTestCategory: async (overrides = {}) => {
    const { Category } = await import('@/models/Category');
    
    const categoryData = {
      tenantId: 'test-tenant',
      name: 'Test Category',
      slug: 'test-category',
      ...overrides
    };
    
    const category = new Category(categoryData);
    await category.save();
    return category;
  },
  
  createTestUploadSession: async (overrides = {}) => {
    const { UploadSession } = await import('@/models/UploadSession');
    
    const sessionData = {
      contentId: 'test-content-id',
      uploadId: 'test-upload-id',
      filename: 'test-file.mp4',
      contentType: 'video/mp4',
      fileSize: 1048576,
      checksumSha256: 'a'.repeat(64),
      status: 'initiated',
      s3Metadata: {
        bucket: 'test-bucket',
        key: 'test-key',
        uploadId: 'test-s3-upload-id',
        parts: [],
        region: 'us-east-1'
      },
      progressData: {
        uploadedBytes: 0,
        uploadedParts: 0,
        totalParts: 1,
        startedAt: new Date(),
        lastActivityAt: new Date()
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides
    };
    
    const session = new UploadSession(sessionData);
    await session.save();
    return session;
  },
  
  createAuthToken: () => {
    // In a real integration test, you would create a valid JWT token
    // For now, return a mock token
    return 'Bearer mock-jwt-token';
  },
  
  mockUser: {
    requestId: 'integration-test-request',
    userId: 'integration-test-user',
    tenantId: 'test-tenant',
    roles: ['creator', 'moderator'],
    permissions: ['content.create', 'content.read', 'content.update', 'content.delete'],
    clientId: 'integration-test-client',
    sessionId: 'integration-test-session'
  }
};

declare global {
  var integrationUtils: {
    createTestContent: (overrides?: any) => Promise<any>;
    createTestCategory: (overrides?: any) => Promise<any>;
    createTestUploadSession: (overrides?: any) => Promise<any>;
    createAuthToken: () => string;
    mockUser: any;
  };
}
