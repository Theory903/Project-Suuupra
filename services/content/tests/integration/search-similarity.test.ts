import request from 'supertest';
import express from 'express';
import { createRoutes } from '@/routes';
import { S3UploadService } from '@/services/s3-upload';
import { ElasticsearchService } from '@/services/elasticsearch';
import { WebSocketService } from '@/services/websocket';
import { createServer } from 'http';
import { Content } from '@/models/Content';

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

describe('Similarity Search Integration', () => {
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

  it('returns similar content results', async () => {
    const c = await global.integrationUtils.createTestContent({ title: 'JavaScript Basics', description: 'Learn JS', tags: ['javascript', 'beginner'] });
    // @ts-ignore mocked method
    esService.similarByEmbedding.mockResolvedValue({
      data: [{ id: c._id, title: c.title, contentType: c.contentType, tags: c.tags, createdBy: c.createdBy, createdAt: new Date().toISOString(), _score: 1 }],
      meta: { queryTimeMs: 5, totalHits: 1, timestamp: new Date().toISOString(), requestId: 'test' }
    } as any);

    const res = await request(app).get(`/api/v1/search/similar/${c._id}`).expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

