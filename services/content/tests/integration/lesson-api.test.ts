/// <reference types="jest" />
import request from 'supertest';
import { app } from '../../src/server'; // Adjust path as needed
import { connectDB, disconnectDB } from '../../src/models'; // Adjust path as needed
import { Content } from '../../src/models/Content';
import { Category } from '../../src/models/Category';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Lesson API Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let userToken: string;
  let testTenantId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;

    // Mock config and logger for tests
    jest.mock('../../src/config', () => ({
      config: {
        service: { port: 3000, serviceName: 'content-test' },
        database: {
          mongodb: { uri: mongoUri, options: {} },
          elasticsearch: { node: 'http://localhost:9200', indexPrefix: 'test' },
          redis: { url: 'redis://localhost:6379', db: 0 }
        },
        auth: {
          jwksUri: 'http://localhost/jwks',
          issuer: 'test-issuer',
          audience: 'test-audience',
          jwtSecret: 'supersecretjwtkey'
        },
        s3: {
          region: 'us-east-1',
          accessKeyId: 'test',
          secretAccessKey: 'test',
          bucketName: 'test',
          bucketRegion: 'us-east-1',
          cloudfrontDomain: 'test.cloudfront.net'
        },
        upload: {
          maxFileSize: 100 * 1024 * 1024,
          allowedFileTypes: ['video/mp4'],
          multipartChunkSize: 5 * 1024 * 1024,
          uploadExpiryHours: 24
        }
      }
    }));
    jest.mock('../../src/utils/logger', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      ContextLogger: jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      })),
    }));

    await connectDB();

    testTenantId = 'integration-test-tenant';

    // Generate mock JWT tokens for admin and regular user
    adminToken = generateMockToken({
      userId: 'admin123',
      tenantId: testTenantId,
      roles: ['admin'],
      permissions: ['content:*']
    });
    userToken = generateMockToken({
      userId: 'user123',
      tenantId: testTenantId,
      roles: ['user'],
      permissions: ['content:read']
    });
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await Content.deleteMany({});
    await Category.deleteMany({});
  });

  // Helper to generate mock JWT
  function generateMockToken(payload: any): string {
    return `Bearer ${require('jsonwebtoken').sign(payload, 'supersecretjwtkey')}`;
  }

  describe('POST /api/lessons', () => {
    it('should create a new lesson as admin', async () => {
      const category = await Category.create({
        name: 'Programming',
        path: '/programming',
        tenantId: testTenantId
      });

      const newLesson = {
        title: 'Introduction to Express.js',
        description: 'Learn Express.js basics.',
        categoryId: category._id,
        tags: ['express', 'nodejs', 'javascript'],
        metadata: {
          courseId: 'course123',
          lessonNumber: 1,
          durationMinutes: 45,
          videoUrl: 'https://example.com/express-lesson.mp4'
        }
      };

      const res = await request(app)
        .post('/api/lessons')
        .set('Authorization', adminToken)
        .send(newLesson);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toEqual(newLesson.title);
      expect(res.body.data.contentType).toEqual('lesson');
      expect(res.body.data.createdBy).toEqual('admin123');

      const createdLesson = await Content.findById(res.body.data.id);
      expect(createdLesson).not.toBeNull();
      expect(createdLesson?.title).toEqual(newLesson.title);
    });

    it('should not create a lesson without authentication', async () => {
      const newLesson = {
        title: 'Unauthorized Lesson',
        description: 'Should not be created.'
      };

      const res = await request(app)
        .post('/api/lessons')
        .send(newLesson);

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toEqual('Authentication failed');
    });

    it('should not create a lesson with invalid input', async () => {
      const res = await request(app)
        .post('/api/lessons')
        .set('Authorization', adminToken)
        .send({ title: '' }); // Invalid title

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Validation Error');
    });
  });

  describe('GET /api/lessons/:id', () => {
    it('should retrieve a lesson by ID', async () => {
      const createdLesson = await Content.create({
        title: 'Lesson to Retrieve',
        description: 'Description',
        tenantId: testTenantId,
        createdBy: 'admin123',
        contentType: 'lesson',
        status: 'published'
      });

      const res = await request(app)
        .get(`/api/lessons/${createdLesson._id}`)
        .set('Authorization', userToken);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toEqual(createdLesson._id);
      expect(res.body.data.title).toEqual(createdLesson.title);
    });

    it('should return 404 for a nonexistent lesson ID', async () => {
      const res = await request(app)
        .get(`/api/lessons/nonexistentid`)
        .set('Authorization', userToken);

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not found');
    });
  });

  describe('PUT /api/lessons/:id', () => {
    it('should update an existing lesson as admin', async () => {
      const createdLesson = await Content.create({
        title: 'Lesson to Update',
        description: 'Original Description',
        tenantId: testTenantId,
        createdBy: 'admin123',
        contentType: 'lesson',
        status: 'draft',
        etag: 'initial-etag'
      });

      const updatedTitle = 'Updated Lesson Title';
      const res = await request(app)
        .put(`/api/lessons/${createdLesson._id}`)
        .set('Authorization', adminToken)
        .set('If-Match', `"${createdLesson.etag}"`)
        .send({ title: updatedTitle });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toEqual(updatedTitle);

      const fetchedLesson = await Content.findById(createdLesson._id);
      expect(fetchedLesson?.title).toEqual(updatedTitle);
    });

    it('should return 403 for unauthorized update', async () => {
      const createdLesson = await Content.create({
        title: 'Lesson to Update',
        description: 'Original Description',
        tenantId: testTenantId,
        createdBy: 'admin123',
        contentType: 'lesson',
        status: 'draft',
        etag: 'initial-etag'
      });

      const res = await request(app)
        .put(`/api/lessons/${createdLesson._id}`)
        .set('Authorization', userToken) // Regular user
        .set('If-Match', `"${createdLesson.etag}"`)
        .send({ title: 'Attempted Update' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 412 if ETag does not match', async () => {
      const createdLesson = await Content.create({
        title: 'Lesson to Update',
        description: 'Original Description',
        tenantId: testTenantId,
        createdBy: 'admin123',
        contentType: 'lesson',
        status: 'draft',
        etag: 'correct-etag'
      });

      const res = await request(app)
        .put(`/api/lessons/${createdLesson._id}`)
        .set('Authorization', adminToken)
        .set('If-Match', `"wrong-etag"`) // Mismatch ETag
        .send({ title: 'Attempted Update' });

      expect(res.statusCode).toEqual(412);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('PRECONDITION_FAILED');
    });
  });

  describe('DELETE /api/lessons/:id', () => {
    it('should soft delete a lesson as admin', async () => {
      const createdLesson = await Content.create({
        title: 'Lesson to Delete',
        description: 'Description',
        tenantId: testTenantId,
        createdBy: 'admin123',
        contentType: 'lesson',
        status: 'draft'
      });

      const res = await request(app)
        .delete(`/api/lessons/${createdLesson._id}`)
        .set('Authorization', adminToken);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      const fetchedLesson = await Content.findById(createdLesson._id);
      expect(fetchedLesson?.deleted).toBe(true);
    });

    it('should return 403 for unauthorized delete', async () => {
      const createdLesson = await Content.create({
        title: 'Lesson to Delete',
        description: 'Description',
        tenantId: testTenantId,
        createdBy: 'admin123',
        contentType: 'lesson',
        status: 'draft'
      });

      const res = await request(app)
        .delete(`/api/lessons/${createdLesson._id}`)
        .set('Authorization', userToken); // Regular user

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/lessons', () => {
    it('should list lessons with pagination', async () => {
      // Create multiple lessons for pagination test
      for (let i = 0; i < 5; i++) {
        await Content.create({
          title: `Lesson ${i}`,
          tenantId: testTenantId,
          createdBy: 'admin123',
          contentType: 'lesson',
          status: 'published',
          createdAt: new Date(Date.now() - i * 10000) // Different creation times
        });
      }

      const res = await request(app)
        .get(`/api/lessons?page=1&limit=2`)
        .set('Authorization', userToken);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toEqual(2);
      expect(res.body.meta.pagination.total).toEqual(5);
      expect(res.body.meta.pagination.page).toEqual(1);
      expect(res.body.meta.pagination.limit).toEqual(2);
    });
  });
});