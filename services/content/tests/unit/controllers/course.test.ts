// Force TypeScript re-evaluation
import { Request, Response, NextFunction } from 'express';
import { CourseController } from '../../../src/controllers/course';
import { NotFoundError, ValidationError } from '../../../src/types';
import { Content } from '../../../src/models/Content';
import { Category } from '../../../src/models/Category';

// Mock Mongoose models
jest.mock('../../../src/models/Content');
jest.mock('../../../src/models/Category');

describe('CourseController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let courseController: CourseController;

  beforeEach(() => {
    mockRequest = {
      user: {
        userId: 'testUserId',
        tenantId: 'testTenantId',
        roles: ['admin'],
        permissions: ['course:create'],
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
    courseController = new CourseController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCourse', () => {
    it('should create a course and return 201 status', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Test Course', toJSON: () => ({ id: 'course1', title: 'Test Course' }),
        canBeEditedBy: jest.fn().mockReturnValue(true)
      };
      (Content as any).mockImplementation(() => mockCourse);
      (Category.findOne as any).mockResolvedValue({}); // Mock category exists

      mockRequest.body = {
        title: 'Test Course',
        description: 'Course Description',
        categoryId: 'cat1',
        metadata: {
          instructorId: 'instructor1',
          durationMinutes: 60,
          difficulty: 'beginner',
          language: 'English',
          prerequisites: [],
          learningOutcomes: [],
          price: 100,
          currency: 'USD'
        }
      };

      await courseController.createCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Course',
          tenantId: 'testTenantId',
          createdBy: 'testUserId'
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'course1', title: 'Test Course' }
        })
      );
    });

    it('should call next with ValidationError if input is invalid', async () => {
      mockRequest.body = { title: '' }; // Invalid input

      await courseController.createCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should call next with ValidationError if category not found', async () => {
      (Category.findOne as jest.Mock).mockResolvedValue(null);
      mockRequest.body = { title: 'Test Course', categoryId: 'nonexistent' };

      await courseController.createCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should call next with error if Content.save throws', async () => {
      const error = new Error('Database error');
      (Content as unknown as any).mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error),
        canBeEditedBy: jest.fn().mockReturnValue(true)
      }));
      (Category.findOne as any).mockResolvedValue({});
      mockRequest.body = { title: 'Valid Title', metadata: {} };

      await courseController.createCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getCourse', () => {
    it('should return a course if found', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Test Course', toJSON: () => ({ id: 'course1', title: 'Test Course' })
      };
      (Content.findOne as any).mockResolvedValue(mockCourse);
      mockRequest.params = { id: 'course1' };

      await courseController.getCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'course1', tenantId: 'testTenantId', contentType: 'course' })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'course1', title: 'Test Course' }
        })
      );
    });

    it('should call next with NotFoundError if course is not found', async () => {
      (Content.findOne as any).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };

      await courseController.getCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should call next with ValidationError if ID is missing', async () => {
      mockRequest.params = {};

      await courseController.getCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('updateCourse', () => {
    it('should update a course and return 200 status', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Old Title', etag: 'old-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'course1', title: 'Updated Course' }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn(),
        isModified: jest.fn().mockReturnValue(true) // Mock isModified for version bump
      };
      (Content.findOne as any).mockResolvedValue(mockCourse);
      (Category.findOne as any).mockResolvedValue({}); // Mock category exists
      mockRequest.params = { id: 'course1' };
      mockRequest.headers = { 'if-match': '"old-etag"' };
      mockRequest.body = { title: 'Updated Course', versionBump: 'patch' };

      await courseController.updateCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'course1', tenantId: 'testTenantId', contentType: 'course' })
      );
      expect(mockCourse.save).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'course1', title: 'Updated Course' }
        })
      );
    });

    it('should call next with NotFoundError if course to update is not found', async () => {
      (Content.findOne as jest.Mock).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { title: 'Updated Course' };

      await courseController.updateCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 403 if user has insufficient privileges', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Old Title', etag: 'old-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'course1', title: 'Updated Course' }),
        canBeEditedBy: jest.fn().mockReturnValue(false),
        save: jest.fn()
      };
      (Content.findOne as any).mockResolvedValue(mockCourse);
      mockRequest.params = { id: 'course1' };
      mockRequest.user!.roles = ['user']; // User without admin/moderator role

      await courseController.updateCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 412 if ETag does not match', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Old Title', etag: 'current-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'course1', title: 'Updated Course' }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn()
      };
      (Content.findOne as any).mockResolvedValue(mockCourse);
      mockRequest.params = { id: 'course1' };
      mockRequest.headers = { 'if-match': '"wrong-etag"' }; // Mismatch ETag
      mockRequest.body = { title: 'Updated Course' };

      await courseController.updateCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(412);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should call next with ValidationError if category not found during update', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Old Title', etag: 'old-etag', version: '1.0.0', status: 'draft',
        toJSON: () => ({ id: 'course1', title: 'Updated Course' }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn(),
        isModified: jest.fn().mockReturnValue(true)
      };
      (Content.findOne as any).mockResolvedValue(mockCourse);
      (Category.findOne as any).mockResolvedValue(null); // Category not found
      mockRequest.params = { id: 'course1' };
      mockRequest.headers = { 'if-match': '"old-etag"' };
      mockRequest.body = { title: 'Updated Course', categoryId: 'nonexistent' };

      await courseController.updateCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('deleteCourse', () => {
    it('should delete a course and return 200 status (soft delete)', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Test Course',
        toJSON: () => ({ id: 'course1', deleted: true }),
        canBeEditedBy: jest.fn().mockReturnValue(true),
        save: jest.fn()
      };
      (Content.findOne as any).mockResolvedValue(mockCourse);
      mockRequest.params = { id: 'course1' };

      await courseController.deleteCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'course1', tenantId: 'testTenantId', contentType: 'course' })
      );
      expect(mockCourse.save).toHaveBeenCalled();
      expect(mockCourse.deleted).toBe(true);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'course1', deleted: true }
        })
      );
    });

    it('should call next with NotFoundError if course to delete is not found', async () => {
      (Content.findOne as any).mockResolvedValue(null);
      mockRequest.params = { id: 'nonexistent' };

      await courseController.deleteCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should return 403 if user has insufficient privileges to delete', async () => {
      const mockCourse = {
        _id: 'course1', title: 'Test Course',
        toJSON: () => ({ id: 'course1', deleted: true }),
        canBeEditedBy: jest.fn().mockReturnValue(false),
        save: jest.fn()
      };
      (Content.findOne as any).mockResolvedValue(mockCourse);
      mockRequest.params = { id: 'course1' };
      mockRequest.user!.roles = ['user']; // User without admin/moderator role

      await courseController.deleteCourse(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('listCourses', () => {
    it('should return a list of courses', async () => {
      const mockCourses = [{ _id: 'course1', title: 'Course 1', toJSON: () => ({ id: 'course1', title: 'Course 1' }) }];
      (Content.find as any).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCourses),
        lean: jest.fn().mockResolvedValue(mockCourses)
      });
      (Content.countDocuments as any).mockResolvedValue(1);
      mockRequest.query = { page: '1', limit: '10' };

      await courseController.listCourses(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Content.find).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'testTenantId', contentType: 'course', deleted: false })
      );
      expect(Content.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'testTenantId', contentType: 'course', deleted: false })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [{ id: 'course1', title: 'Course 1' }],
          meta: {
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false }
          }
        })
      );
    });
  });
});