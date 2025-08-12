import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Redis } from 'ioredis';

// Global test setup
let mongoServer: MongoMemoryServer;
let redis: Redis;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  // Setup Redis mock or use redis-mock
  redis = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: 1,
    retryDelayOnFailover: 100,
    lazyConnect: true
  });
  
  // Mock external services
  jest.mock('@/services/s3-upload');
  jest.mock('@/services/elasticsearch');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  
  if (redis) {
    redis.disconnect();
  }
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  
  // Clear Redis
  try {
    await redis.flushall();
  } catch (error) {
    // Redis might not be available in test environment
  }
});

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    requestId: 'test-request-id',
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    roles: ['creator'],
    permissions: ['content.create', 'content.read', 'content.update'],
    clientId: 'test-client',
    sessionId: 'test-session'
  }),
  
  createMockContent: (overrides = {}) => ({
    title: 'Test Content',
    description: 'Test description',
    contentType: 'article',
    categoryId: 'test-category-id',
    tags: ['test', 'content'],
    metadata: {},
    idempotencyKey: 'test-idempotency-key',
    ...overrides
  }),
  
  createMockUploadData: (overrides = {}) => ({
    filename: 'test-file.mp4',
    contentType: 'video/mp4',
    fileSize: 1048576, // 1MB
    checksumSha256: 'a'.repeat(64),
    ...overrides
  })
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidObjectId(): R;
      toBeValidISOString(): R;
    }
  }
  
  var testUtils: {
    createMockUser: () => any;
    createMockContent: (overrides?: any) => any;
    createMockUploadData: (overrides?: any) => any;
  };
}

expect.extend({
  toBeValidObjectId(received: string) {
    const pass = /^[0-9a-fA-F]{24}$/.test(received) || 
                 /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(received);
    
    return {
      message: () => `expected ${received} to be a valid ObjectId`,
      pass
    };
  },
  
  toBeValidISOString(received: string) {
    const pass = !isNaN(Date.parse(received));
    
    return {
      message: () => `expected ${received} to be a valid ISO string`,
      pass
    };
  }
});
