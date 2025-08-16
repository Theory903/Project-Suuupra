import request from 'supertest';
import express from 'express';
import { createRoutes } from '@/routes';
import { S3UploadService } from '@/services/s3-upload';
import { ElasticsearchService } from '@/services/elasticsearch';
import { WebSocketService } from '@/services/websocket';
import { createServer } from 'http';

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

describe('Full flow: create → approve → publish → embeddings → reindex → search → similar', () => {
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

  it('runs the end-to-end flow with mocked ES', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/v1/content')
      .send({ title: 'Flow Test', contentType: 'article', idempotencyKey: 'flow-1' })
      .expect(201);
    const id = createRes.body.data.id;

    // Approve
    await request(app).post(`/api/v1/admin/content/${id}/approve`).expect(200);
    // Publish
    await request(app).post(`/api/v1/admin/content/${id}/publish`).expect(200);

    // Compute embeddings
    await request(app).post('/api/v1/admin/embeddings/rebuild').expect(200);
    // Reindex (esService.index is mocked by class mock)
    await request(app).post('/api/v1/admin/search/reindex').expect(200);

    // Search mocked
    // @ts-ignore
    esService.search.mockResolvedValue({ data: [{ id, title: 'Flow Test', contentType: 'article', _score: 1 }], meta: { totalHits: 1, queryTimeMs: 2 } });
    const searchRes = await request(app).get('/api/v1/search?q=Flow').expect(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);

    // Similar mocked
    // @ts-ignore
    esService.similarByEmbedding.mockResolvedValue({ data: [{ id, title: 'Flow Test', contentType: 'article', _score: 1 }], meta: { totalHits: 1, queryTimeMs: 2 } });
    const simRes = await request(app).get(`/api/v1/search/similar/${id}`).expect(200);
    expect(simRes.body.data.length).toBeGreaterThan(0);
  });
});

