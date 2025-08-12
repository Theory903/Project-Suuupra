import request from 'supertest';
import express from 'express';
import { createRoutes } from '@/routes';
import { S3UploadService } from '@/services/s3-upload';
import { ElasticsearchService } from '@/services/elasticsearch';
import { WebSocketService } from '@/services/websocket';
import { createServer } from 'http';

// Mock services for integration tests
jest.mock('@/services/s3-upload');
jest.mock('@/services/elasticsearch');
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = global.integrationUtils.mockUser;
    next();
  },
  requireCreator: (req: any, res: any, next: any) => next(),
  requireModerator: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next()
}));

describe('Content API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let s3Service: jest.Mocked<S3UploadService>;
  let esService: jest.Mocked<ElasticsearchService>;
  let wsService: jest.Mocked<WebSocketService>;

  beforeAll(() => {
    // Create mocked services
    s3Service = new S3UploadService() as jest.Mocked<S3UploadService>;
    esService = new ElasticsearchService() as jest.Mocked<ElasticsearchService>;
    
    // Create HTTP server for WebSocket service
    app = express();
    server = createServer(app);
    wsService = new WebSocketService(server) as jest.Mocked<WebSocketService>;
    
    // Setup Express middleware
    app.use(express.json());
    app.use('/api/v1', createRoutes(s3Service, esService, wsService));
  });

  describe('POST /api/v1/content', () => {
    it('should create content successfully', async () => {
      const contentData = {
        title: 'Integration Test Content',
        description: 'Test description',
        contentType: 'article',
        tags: ['test', 'integration'],
        idempotencyKey: 'test-idempotency-key'
      };

      const response = await request(app)
        .post('/api/v1/content')
        .send(contentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(contentData.title);
      expect(response.body.data.contentType).toBe(contentData.contentType);
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.tenantId).toBe('test-tenant');
      expect(response.body.data.createdBy).toBe('integration-test-user');
    });

    it('should handle duplicate idempotency key', async () => {
      const contentData = {
        title: 'Test Content',
        contentType: 'article',
        idempotencyKey: 'duplicate-key'
      };

      // Create content first time
      await request(app)
        .post('/api/v1/content')
        .send(contentData)
        .expect(201);

      // Try to create with same idempotency key
      const response = await request(app)
        .post('/api/v1/content')
        .send(contentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(contentData.title);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/content')
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate content type enum', async () => {
      const response = await request(app)
        .post('/api/v1/content')
        .send({
          title: 'Test Content',
          contentType: 'invalid-type',
          idempotencyKey: 'test-key'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate title length', async () => {
      const response = await request(app)
        .post('/api/v1/content')
        .send({
          title: 'a'.repeat(256), // Exceeds max length
          contentType: 'article',
          idempotencyKey: 'test-key'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate tags array', async () => {
      const response = await request(app)
        .post('/api/v1/content')
        .send({
          title: 'Test Content',
          contentType: 'article',
          tags: new Array(21).fill('tag'), // Exceeds max items
          idempotencyKey: 'test-key'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/content/:id', () => {
    let testContent: any;

    beforeEach(async () => {
      testContent = await global.integrationUtils.createTestContent();
    });

    it('should get content by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/content/${testContent._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testContent._id);
      expect(response.body.data.title).toBe(testContent.title);
      
      // Check ETag header
      expect(response.headers.etag).toBeDefined();
      expect(response.headers['last-modified']).toBeDefined();
    });

    it('should return 304 for cached content', async () => {
      // First request to get ETag
      const firstResponse = await request(app)
        .get(`/api/v1/content/${testContent._id}`)
        .expect(200);

      const etag = firstResponse.headers.etag;

      // Second request with If-None-Match header
      await request(app)
        .get(`/api/v1/content/${testContent._id}`)
        .set('If-None-Match', etag)
        .expect(304);
    });

    it('should return 404 for non-existent content', async () => {
      const response = await request(app)
        .get('/api/v1/content/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should not return deleted content', async () => {
      // Soft delete the content
      testContent.deleted = true;
      await testContent.save();

      const response = await request(app)
        .get(`/api/v1/content/${testContent._id}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/content/:id', () => {
    let testContent: any;

    beforeEach(async () => {
      testContent = await global.integrationUtils.createTestContent();
    });

    it('should update content successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        versionBump: 'minor'
      };

      const response = await request(app)
        .put(`/api/v1/content/${testContent._id}`)
        .set('If-Match', `"${testContent.etag}"`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.version).toBe('1.1.0'); // Version bumped
      expect(response.body.data.etag).not.toBe(testContent.etag); // ETag changed
    });

    it('should handle optimistic concurrency with ETag', async () => {
      const response = await request(app)
        .put(`/api/v1/content/${testContent._id}`)
        .set('If-Match', '"wrong-etag"')
        .send({ title: 'Updated Title' })
        .expect(412);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PRECONDITION_FAILED');
    });

    it('should return 404 for non-existent content', async () => {
      const response = await request(app)
        .put('/api/v1/content/non-existent-id')
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put(`/api/v1/content/${testContent._id}`)
        .send({ title: 'a'.repeat(256) }) // Exceeds max length
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/content/:id', () => {
    let testContent: any;

    beforeEach(async () => {
      testContent = await global.integrationUtils.createTestContent();
    });

    it('should soft delete content', async () => {
      const response = await request(app)
        .delete(`/api/v1/content/${testContent._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);

      // Verify content is marked as deleted in database
      const { Content } = await import('@/models/Content');
      const deletedContent = await Content.findById(testContent._id);
      expect(deletedContent?.deleted).toBe(true);
      expect(deletedContent?.deletedAt).toBeInstanceOf(Date);
    });

    it('should return 404 for non-existent content', async () => {
      const response = await request(app)
        .delete('/api/v1/content/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/content', () => {
    beforeEach(async () => {
      // Create test content
      await global.integrationUtils.createTestContent({
        title: 'Article 1',
        contentType: 'article',
        status: 'published'
      });
      
      await global.integrationUtils.createTestContent({
        title: 'Video 1',
        contentType: 'video',
        status: 'draft'
      });
      
      await global.integrationUtils.createTestContent({
        title: 'Article 2',
        contentType: 'article',
        status: 'published'
      });
    });

    it('should list content with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/content?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should filter by content type', async () => {
      const response = await request(app)
        .get('/api/v1/content?contentType=article')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach((content: any) => {
        expect(content.contentType).toBe('article');
      });
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/content?status=published')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach((content: any) => {
        expect(content.status).toBe('published');
      });
    });

    it('should sort content', async () => {
      const response = await request(app)
        .get('/api/v1/content?sort=title&order=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const titles = response.body.data.map((c: any) => c.title);
      expect(titles).toEqual(['Article 1', 'Article 2', 'Video 1']);
    });
  });

  describe('File Upload Endpoints', () => {
    let testContent: any;

    beforeEach(async () => {
      testContent = await global.integrationUtils.createTestContent();
      
      // Mock S3 service methods
      s3Service.initiateUpload = jest.fn().mockResolvedValue({
        uploadId: 'test-upload-id',
        uploadSession: { id: 'test-session-id' },
        uploadParts: [
          {
            partNumber: 1,
            signedUrl: 'https://test-signed-url.com',
            expiresAt: new Date(Date.now() + 3600000)
          }
        ]
      });
      
      s3Service.completeUpload = jest.fn().mockResolvedValue({
        s3Key: 'test-key',
        cdnUrl: 'https://cdn.test.com/test-key',
        fileSize: 1048576,
        etag: 'test-etag'
      });
    });

    it('should initiate file upload', async () => {
      const uploadData = {
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        fileSize: 1048576,
        checksumSha256: 'a'.repeat(64)
      };

      const response = await request(app)
        .post(`/api/v1/content/${testContent._id}/upload`)
        .send(uploadData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('uploadId');
      expect(response.body.data).toHaveProperty('uploadParts');
      expect(response.body.data.uploadParts).toHaveLength(1);
      
      expect(s3Service.initiateUpload).toHaveBeenCalledWith({
        contentId: testContent._id,
        filename: uploadData.filename,
        contentType: uploadData.contentType,
        fileSize: uploadData.fileSize,
        checksumSha256: uploadData.checksumSha256,
        tenantId: 'test-tenant',
        userId: 'integration-test-user'
      });
    });

    it('should complete file upload', async () => {
      const parts = [
        { partNumber: 1, etag: 'test-etag-1' }
      ];

      const response = await request(app)
        .post(`/api/v1/content/${testContent._id}/upload/test-upload-id/complete`)
        .send({ parts })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('s3Key');
      expect(response.body.data).toHaveProperty('content');
      
      expect(s3Service.completeUpload).toHaveBeenCalledWith('test-upload-id', parts);
    });

    it('should validate upload data', async () => {
      const response = await request(app)
        .post(`/api/v1/content/${testContent._id}/upload`)
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate completion data', async () => {
      const response = await request(app)
        .post(`/api/v1/content/${testContent._id}/upload/test-upload-id/complete`)
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Admin Endpoints', () => {
    let testContent: any;

    beforeEach(async () => {
      testContent = await global.integrationUtils.createTestContent({
        status: 'pending_approval'
      });
    });

    it('should approve content', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/content/${testContent._id}/approve`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');

      // Verify in database
      const { Content } = await import('@/models/Content');
      const approvedContent = await Content.findById(testContent._id);
      expect(approvedContent?.status).toBe('approved');
    });

    it('should reject content', async () => {
      const rejectionData = {
        reason: 'Content needs revision'
      };

      const response = await request(app)
        .post(`/api/v1/admin/content/${testContent._id}/reject`)
        .send(rejectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.metadata.rejectionReason).toBe(rejectionData.reason);
    });

    it('should publish approved content', async () => {
      // First approve the content
      testContent.status = 'approved';
      await testContent.save();

      const response = await request(app)
        .post(`/api/v1/admin/content/${testContent._id}/publish`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('published');
      expect(response.body.data.publishedAt).toBeDefined();
    });

    it('should not publish unapproved content', async () => {
      testContent.status = 'draft';
      await testContent.save();

      const response = await request(app)
        .post(`/api/v1/admin/content/${testContent._id}/publish`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATUS');
    });
  });

  describe('Health Check', () => {
    it('should return service health', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('service');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/content')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.meta.requestId).toBeDefined();
    });
  });
});
