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
  authenticate: (req: any, _res: any, next: any) => {
    req.user = global.integrationUtils.mockUser;
    next();
  },
  requireCreator: (_req: any, _res: any, next: any) => next(),
  requireModerator: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next()
}));

describe('Media Asset API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let s3Service: jest.Mocked<S3UploadService>;
  let esService: jest.Mocked<ElasticsearchService>;
  let wsService: jest.Mocked<WebSocketService>;

  beforeAll(() => {
    s3Service = new S3UploadService() as jest.Mocked<S3UploadService>;
    esService = new ElasticsearchService() as jest.Mocked<ElasticsearchService>;
    
    app = express();
    server = createServer(app);
    wsService = new WebSocketService(server) as jest.Mocked<WebSocketService>;
    
    app.use(express.json());
    app.use('/api/v1', createRoutes(s3Service, esService, wsService));
  });

  describe('POST /api/v1/content/:id/assets', () => {
    it('creates a media asset for content', async () => {
      const content = await global.integrationUtils.createTestContent({ contentType: 'article' });

      const payload = {
        type: 'attachment',
        title: 'Resource PDF',
        description: 'Slides and notes',
        fileInfo: {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
          fileSize: 2048,
          s3Key: 'content/test-tenant/x/notes.pdf'
        },
        metadata: { pages: 12 }
      };

      const res = await request(app)
        .post(`/api/v1/content/${content._id}/assets`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.contentId).toBe(content._id);
      expect(res.body.data.type).toBe('attachment');
    });
  });

  describe('GET /api/v1/content/:id/assets', () => {
    it('lists media assets for content', async () => {
      const content = await global.integrationUtils.createTestContent({ contentType: 'article' });

      // Create an asset directly
      const { MediaAsset } = await import('@/models/MediaAsset');
      await MediaAsset.create({
        tenantId: 'test-tenant',
        contentId: content._id,
        type: 'image',
        fileInfo: {
          filename: 'cover.png',
          contentType: 'image/png',
          fileSize: 1024,
          s3Key: 'content/test-tenant/x/cover.png',
          uploadedAt: new Date()
        },
        metadata: {},
        createdBy: 'integration-test-user'
      });

      const res = await request(app)
        .get(`/api/v1/content/${content._id}/assets`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});

