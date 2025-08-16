// Force TypeScript re-evaluation
import { Request, Response, NextFunction } from 'express';
import { LessonController } from '../../../src/controllers/lesson';
import { Content } from '../../../src/models/Content';
import { Category } from '../../../src/models/Category';
import { NotFoundError, ValidationError } from '../../../src/types';

jest.mock('../../../src/models/Content');
jest.mock('../../../src/models/Category');

describe('LessonController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let lessonController: LessonController;

  beforeEach(() => {
    mockRequest = {
      user: {
        userId: 'testUserId',
        tenantId: 'testTenantId',
        roles: ['admin'],
        permissions: ['lesson:create'],
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
    lessonController = new LessonController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createLesson', () => {
    it('should create a lesson and return 201 status', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Test Lesson', toJSON: () => ({ id: 'lesson1', title: 'Test Lesson' }),
        canBeEditedBy: jest.fn().mockReturnValue(true)
      };
      (Content as jest.Mock).mockImplementation(() => mockLesson);
      (Category.findOne as jest.Mock).mockResolvedValue({}); // Mock category exists

      mockRequest.body = {
        title: 'Test Lesson',
        description: 'Lesson Description',
        categoryId: 'cat1',
        metadata: {
          courseId: 'course1',
          lessonNumber: 1,
          durationMinutes: 30,
          videoUrl: 'http://example.com/video.mp4'
        }
      };

      await lessonController.createLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Lesson',
          tenantId: 'testTenantId',
          createdBy: 'testUserId',
          contentType: 'lesson'
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'lesson1', title: 'Test Lesson' }
        })
      );
    });

    it('should call next with ValidationError if input is invalid', async () => {
      mockRequest.body = { title: '' }; // Invalid input

      await lessonController.createLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should call next with ValidationError if category not found', async () => {
      (Category.findOne as jest.Mock).mockResolvedValue(null);
      mockRequest.body = { title: 'Test Lesson', categoryId: 'nonexistent' };

      await lessonController.createLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should call next with error if Content.save throws', async () => {
      const error = new Error('Database error');
      (Content as jest.Mock).mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error),
        canBeEditedBy: jest.fn().mockReturnValue(true)
      }));
      (Category.findOne as jest.Mock).mockResolvedValue({});
      mockRequest.body = { title: 'Valid Title', metadata: {} };

      await lessonController.createLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getLesson', () => {
    it('should return a lesson if found', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Test Lesson', toJSON: () => ({ id: 'lesson1', title: 'Test Lesson' })
      };
      (Content.findOne as jest.Mock).mockResolvedValue(mockLesson);
      mockRequest.params = { id: 'lesson1' };

      await lessonController.getLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'lesson1', tenantId: 'testTenantId', contentType: 'lesson' })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'lesson1', title: 'Test Lesson' }
        })
      );
    });

    it('should call next with NotFoundError if lesson is not found', async () => {
      (Content.findOne as jest.Mock).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };

      await lessonController.getLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should call next with ValidationError if ID is missing', async () => {
      mockRequest.params = {};

      await lessonController.getLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('updateLesson', () => {
    it('should update a lesson and return 200 status', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Old Title', etag: 'old-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'lesson1', title: 'Updated Lesson' }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn(),
        isModified: jest.fn().mockReturnValue(true) // Mock isModified for version bump
      };
      (Content.findOne as jest.Mock).mockResolvedValue(mockLesson);
      (Category.findOne as jest.Mock).mockResolvedValue({}); // Mock category exists
      mockRequest.params = { id: 'lesson1' };
      mockRequest.headers = { 'if-match': '"old-etag"' };
      mockRequest.body = { title: 'Updated Lesson', versionBump: 'patch' };

      await lessonController.updateLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'lesson1', tenantId: 'testTenantId', contentType: 'lesson' })
      );
      expect(mockLesson.save).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'lesson1', title: 'Updated Lesson' }
        })
      );
    });

    it('should call next with NotFoundError if lesson to update is not found', async () => {
      (Content.findOne as jest.Mock).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { title: 'Updated Lesson' };

      await lessonController.updateLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 403 if user has insufficient privileges', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Old Title', etag: 'old-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'lesson1', title: 'Updated Lesson' }),
        canBeEditedBy: jest.fn().mockReturnValue(false),
        save: jest.fn()
      };
      (Content.findOne as jest.Mock).mockResolvedValue(mockLesson);
      mockRequest.params = { id: 'lesson1' };
      mockRequest.user!.roles = ['user']; // User without admin/moderator role

      await lessonController.updateLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 412 if ETag does not match', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Old Title', etag: 'current-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'lesson1', title: 'Updated Lesson' }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn()
      };
      (Content.findOne as jest.Mock).mockResolvedValue(mockLesson);
      mockRequest.params = { id: 'lesson1' };
      mockRequest.headers = { 'if-match': '"wrong-etag"' }; // Mismatch ETag
      mockRequest.body = { title: 'Updated Lesson' };

      await lessonController.updateLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(412);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next with ValidationError if category not found during update', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Old Title', etag: 'old-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'lesson1', title: 'Updated Lesson' }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn(),
        isModified: jest.fn().mockReturnValue(true)
      };
      (Content.findOne as jest.Mock).mockResolvedValue(mockLesson);
      (Category.findOne as jest.Mock).mockResolvedValue(null); // Category not found
      mockRequest.params = { id: 'lesson1' };
      mockRequest.headers = { 'if-match': '"old-etag"' };
      mockRequest.body = { title: 'Updated Lesson', categoryId: 'nonexistent' };

      await lessonController.updateLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('deleteLesson', () => {
    it('should delete a lesson and return 200 status (soft delete)', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Test Lesson',
        toJSON: () => ({ id: 'lesson1', deleted: true }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn()
      };
      (Content.findOne as jest.Mock).mockResolvedValue(mockLesson);
      mockRequest.params = { id: 'lesson1' };

      await lessonController.deleteLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'lesson1', tenantId: 'testTenantId', contentType: 'lesson' })
      );
      expect(mockLesson.save).toHaveBeenCalled();
      expect(mockLesson.deleted).toBe(true);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'lesson1', deleted: true }
        })
      );
    });

    it('should call next with NotFoundError if lesson to delete is not found', async () => {
      (Content.findOne as jest.Mock).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };

      await lessonController.deleteLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 403 if user has insufficient privileges to delete', async () => {
      const mockLesson = {
        _id: 'lesson1', title: 'Test Lesson',
        toJSON: () => ({ id: 'lesson1', deleted: true }),
        canBeEditedBy: jest.fn().mockReturnValue(false),
        save: jest.fn()
      };
      (Content.findOne as jest.Mock).mockResolvedValue(mockLesson);
      mockRequest.params = { id: 'lesson1' };
      mockRequest.user!.roles = ['user']; // User without admin/moderator role

      await lessonController.deleteLesson(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('listLessons', () => {
    it('should return a list of lessons', async () => {
      const mockLessons = [{ _id: 'lesson1', title: 'Lesson 1', toJSON: () => ({ id: 'lesson1', title: 'Lesson 1' }) }];
      (Content.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockLessons),
        lean: jest.fn().mockResolvedValue(mockLessons)
      });
      (Content.countDocuments as jest.Mock).mockResolvedValue(1);
      mockRequest.query = { page: '1', limit: '10' };

      await lessonController.listLessons(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.find).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'testTenantId', contentType: 'lesson', deleted: false })
      );
      expect(Content.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'testTenantId', contentType: 'lesson', deleted: false })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [{ id: 'lesson1', title: 'Lesson 1' }],
          meta: {
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false }
          }
        })
      );
    });
  });
});