// Force TypeScript re-evaluation
import { Request, Response, NextFunction } from 'express';
import { ContentController } from '../../../src/controllers/content';
import { Content } from '../../../src/models/Content';
import { Category } from '../../../src/models/Category';
import { ApiResponse, NotFoundError, ValidationError, ForbiddenError } from '../../../src/types';
import { S3UploadService } from '../../../src/services/s3-upload';
import { WebSocketService } from '../../../src/services/websocket';

jest.mock('../../../src/models/Content');
jest.mock('../../../src/models/Category');
jest.mock('../../../src/services/s3-upload');
jest.mock('../../../src/services/websocket');

describe('ContentController Admin Actions', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let contentController: ContentController;

  beforeEach(() => {
    mockRequest = {
      user: {
        userId: 'adminUser',
        tenantId: 'testTenantId',
        roles: ['admin'],
        permissions: ['content:approve', 'content:reject', 'content:publish'],
        requestId: 'testRequestId',
        clientId: 'testClientId',
        sessionId: 'testSessionId'
      }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    
    // Mock service instances
    const mockS3Service = new S3UploadService() as jest.Mocked<S3UploadService>;
    const mockWsService = new WebSocketService({} as any) as jest.Mocked<WebSocketService>; // Pass a dummy server object

    contentController = new ContentController(mockS3Service, mockWsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('approveContent', () => {
    it('should approve content and return 200 status', async () => {
      const mockContent = {
        _id: 'content1', title: 'Test Content', status: 'pending_approval',
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: 'content1', title: 'Test Content', status: 'approved' }),
        publishedAt: new Date() // Add publishedAt for content.test.ts
      } as any; // Cast to any to satisfy TS for partial mock
      (Content.findOne as any).mockResolvedValue(mockContent as any);
      mockRequest.params = { id: 'content1' };

      await contentController.approveContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'content1', tenantId: 'testTenantId', deleted: false })
      );
      expect(mockContent.status).toBe('approved');
      expect(mockContent.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'content1', title: 'Test Content', status: 'approved' }
        })
      );
    });

    it('should call next with NotFoundError if content not found', async () => {
      (Content.findOne as any).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };

      await contentController.approveContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 403 if user has insufficient privileges', async () => {
      const mockContent = {
        _id: 'content1', title: 'Test Content', status: 'pending_approval',
        canBeEditedBy: jest.fn().mockReturnValue(false),
        save: jest.fn(),
        publishedAt: undefined // Add publishedAt
      } as any;
      (Content.findOne as any).mockResolvedValue(mockContent as any);
      mockRequest.params = { id: 'content1' };
      mockRequest.user!.roles = ['user']; // User without admin/moderator role

      await contentController.approveContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('rejectContent', () => {
    it('should reject content and return 200 status', async () => {
      const mockContent = {
        _id: 'content1', title: 'Test Content', status: 'pending_approval',
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: 'content1', title: 'Test Content', status: 'draft' }),
        publishedAt: undefined // Add publishedAt
      } as any;
      (Content.findOne as any).mockResolvedValue(mockContent as any);
      mockRequest.params = { id: 'content1' };

      await contentController.rejectContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'content1', tenantId: 'testTenantId', deleted: false })
      );
      expect(mockContent.status).toBe('draft');
      expect(mockContent.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'content1', title: 'Test Content', status: 'draft' }
        })
      );
    });

    it('should call next with NotFoundError if content not found', async () => {
      (Content.findOne as any).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };

      await contentController.rejectContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 403 if user has insufficient privileges', async () => {
      const mockContent = {
        _id: 'content1', title: 'Test Content', status: 'pending_approval',
        canBeEditedBy: jest.fn().mockReturnValue(false),
        save: jest.fn(),
        publishedAt: undefined // Add publishedAt
      } as any;
      (Content.findOne as any).mockResolvedValue(mockContent as any);
      mockRequest.params = { id: 'content1' };
      mockRequest.user!.roles = ['user']; // User without admin/moderator role

      await contentController.rejectContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('publishContent', () => {
    it('should publish content and return 200 status', async () => {
      const mockContent = {
        _id: 'content1', title: 'Test Content', status: 'approved',
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: 'content1', title: 'Test Content', status: 'published' }),
        publishedAt: new Date() // Add publishedAt
      } as any;
      (Content.findOne as any).mockResolvedValue(mockContent as any);
      mockRequest.params = { id: 'content1' };

      await contentController.publishContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'content1', tenantId: 'testTenantId', deleted: false })
      );
      expect(mockContent.status).toBe('published');
      expect(mockContent.publishedAt).toBeInstanceOf(Date);
      expect(mockContent.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'content1', title: 'Test Content', status: 'published' }
        })
      );
    });

    it('should call next with NotFoundError if content not found', async () => {
      (Content.findOne as any).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };

      await contentController.publishContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 403 if user has insufficient privileges', async () => {
      const mockContent = {
        _id: 'content1', title: 'Test Content', status: 'approved',
        canBeEditedBy: jest.fn().mockReturnValue(false),
        save: jest.fn(),
        publishedAt: undefined // Add publishedAt
      } as any;
      (Content.findOne as any).mockResolvedValue(mockContent as any);
      mockRequest.params = { id: 'content1' };
      mockRequest.user!.roles = ['user']; // User without admin/moderator role

      await contentController.publishContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 400 if content is not approved', async () => {
      const mockContent = {
        _id: 'content1', title: 'Test Content', status: 'draft', // Not approved
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn(),
        publishedAt: undefined // Add publishedAt
      } as any;
      (Content.findOne as any).mockResolvedValue(mockContent as any);
      mockRequest.params = { id: 'content1' };

      await contentController.publishContent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});