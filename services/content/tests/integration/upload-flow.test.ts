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

describe('Upload flow', () => {
  let app: express.Application;
  let server: any;
  let s3Service: jest.Mocked<S3UploadService>;
  let esService: jest.Mocked<ElasticsearchService>;
  let wsService: jest.Mocked<WebSocketService>;

  beforeAll(() => {
    s3Service = new S3UploadService() as jest.Mocked<S3UploadService>;
    // Mock methods
    // @ts-ignore partial
    s3Service.initiateUpload.mockResolvedValue({ uploadId: 'u1', uploadParts: [{ partNumber: 1 }], uploadSession: { id: 'sess1' } } as any);
    // @ts-ignore partial
    s3Service.getUploadSession.mockResolvedValue({ filename: 'f.mp4', contentType: 'video/mp4', fileSize: 1024, checksumSha256: 'a'.repeat(64) } as any);
    // @ts-ignore partial
    s3Service.completeUpload.mockResolvedValue({ s3Key: 'key', cdnUrl: 'http://cdn/x', fileSize: 1024 } as any);

    esService = new ElasticsearchService() as jest.Mocked<ElasticsearchService>;
    app = express();
    server = createServer(app);
    wsService = new WebSocketService(server) as jest.Mocked<WebSocketService>;
    app.use(express.json());
    app.use('/api/v1', createRoutes(s3Service, esService, wsService));
  });

  it('initiates and completes an upload', async () => {
    // Create content
    const createRes = await request(app)
      .post('/api/v1/content')
      .send({ title: 'Upload Test', contentType: 'video', idempotencyKey: 'upload-1' })
      .expect(201);
    const id = createRes.body.data.id;

    // Initiate
    const initRes = await request(app)
      .post(`/api/v1/content/${id}/upload`)
      .send({ filename: 'f.mp4', contentType: 'video/mp4', fileSize: 1024, checksumSha256: 'a'.repeat(64) })
      .expect(201);
    const uploadId = initRes.body.data.uploadId;
    expect(uploadId).toBeDefined();

    // Complete
    const completeRes = await request(app)
      .post(`/api/v1/content/${id}/upload/${uploadId}/complete`)
      .send({ parts: [{ partNumber: 1, etag: 'etag1' }] })
      .expect(200);
    expect(completeRes.body.success).toBe(true);
  });
});

