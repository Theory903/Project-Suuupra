import { Request, Response, NextFunction } from 'express';
import { Content } from '@/models/Content';
import { Category } from '@/models/Category';
import { ApiResponse, PaginationQuery, NotFoundError, ValidationError } from '@/types';
import { logger, ContextLogger } from '@/utils/logger';
import semver from 'semver';
import { v4 as uuidv4 } from 'uuid';

export class CourseController {
  private contextLogger: ContextLogger;

  constructor() {
    this.contextLogger = new ContextLogger({ controller: 'course' });
  }

  // Create new course
  public createCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, description, categoryId, tags, metadata } = req.body;
      const user = req.user!;

      this.contextLogger.info('Creating new course', {
        requestId: user.requestId,
        userId: user.userId,
        tenantId: user.tenantId,
        title
      });

      // Validate category if provided
      if (categoryId) {
        const category = await Category.findOne({
          _id: categoryId,
          tenantId: user.tenantId
        });

        if (!category) {
          throw new ValidationError(`Category not found: ${categoryId}`);
        }
      }

      // Create course content
      const courseData: any = {
        _id: uuidv4(),
        tenantId: user.tenantId,
        title: title.trim(),
        description: description?.trim(),
        contentType: 'course',
        status: 'draft' as const,
        version: '1.0.0',
        categoryId,
        tags: tags || [],
        createdBy: user.userId,
        etag: uuidv4(),
        metadata: {
          instructorId: user.userId,
          courseOutline: [],
          durationMinutes: 0,
          difficulty: 'beginner',
          language: 'en',
          prerequisites: [],
          learningOutcomes: [],
          price: 0,
          currency: 'USD',
          ...metadata
        }
      };

      const course = new Content(courseData);
      await course.save();

      this.contextLogger.info('Course created successfully', {
        requestId: user.requestId,
        courseId: course._id,
        title: course.title
      });

      const response: ApiResponse = {
        success: true,
        data: course.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Get course by ID
  public getCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (!id) {
        throw new ValidationError('Course ID is required');
      }

      const course = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        contentType: 'course',
        deleted: false
      });

      if (!course) {
        throw new NotFoundError('Course', id);
      }

      res.json({
        success: true,
        data: course.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Update course
  public updateCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, description, categoryId, tags, metadata, versionBump = 'patch' } = req.body;
      const user = req.user!;
      const ifMatch = req.headers['if-match'];

      if (!id) {
        throw new ValidationError('Course ID is required');
      }

      this.contextLogger.info('Updating course', {
        requestId: user.requestId,
        courseId: id,
        userId: user.userId
      });

      const course = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        contentType: 'course',
        deleted: false
      });

      if (!course) {
        throw new NotFoundError('Course', id);
      }

      // Check ownership or permissions
      if (!course.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to edit this course'
          }
        });
        return;
      }

      // Check ETag for optimistic concurrency
      if (ifMatch && ifMatch !== `"${course.etag}"`) {
        res.status(412).json({
          success: false,
          error: {
            code: 'PRECONDITION_FAILED',
            message: 'Course has been modified by another user',
            details: { currentETag: course.etag }
          }
        });
        return;
      }

      // Validate category if provided
      if (categoryId && categoryId !== course.categoryId) {
        const category = await Category.findOne({
          _id: categoryId,
          tenantId: user.tenantId
        });

        if (!category) {
          throw new ValidationError(`Category not found: ${categoryId}`);
        }
      }

      // Update version if content is published
      let newVersion = course.version;
      if (course.status === 'published') {
        // Semantic versioning for courses
        newVersion = semver.inc(course.version, versionBump) || course.version;
      }

      // Update course
      const updates: any = {
        updatedAt: new Date(),
        etag: uuidv4(),
        version: newVersion
      };

      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description?.trim();
      if (categoryId !== undefined) updates.categoryId = categoryId;
      if (tags !== undefined) updates.tags = tags;
      if (metadata !== undefined) {
        updates.metadata = { ...course.metadata, ...metadata };
      }

      // Reset to draft if published content is modified significantly
      if (course.status === 'published' && (title || description || categoryId)) {
        updates.status = 'draft';
        updates.publishedAt = undefined;
      }

      Object.assign(course, updates);
      await course.save();

      this.contextLogger.info('Course updated successfully', {
        requestId: user.requestId,
        courseId: course._id,
        newVersion
      });

      const response: ApiResponse = {
        success: true,
        data: course.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Delete course (soft delete)
  public deleteCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (!id) {
        throw new ValidationError('Course ID is required');
      }

      this.contextLogger.info('Deleting course', {
        requestId: user.requestId,
        courseId: id,
        userId: user.userId
      });

      const course = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        contentType: 'course',
        deleted: false
      });

      if (!course) {
        throw new NotFoundError('Course', id);
      }

      // Check ownership or permissions
      if (!course.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to delete this course'
          }
        });
        return;
      }

      // Soft delete
      course.deleted = true;
      course.deletedAt = new Date();
      course.etag = uuidv4();
      await course.save();

      this.contextLogger.info('Course deleted successfully', {
        requestId: user.requestId,
        courseId: course._id
      });

      const response: ApiResponse = {
        success: true,
        data: { id: course._id, deleted: true },
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // List courses with pagination and filtering
  public listCourses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = req.query as PaginationQuery & any;
      
      // Build query
      const query: any = {
        tenantId: user.tenantId,
        contentType: 'course',
        deleted: false
      };

      // Build sort
      const sortObj: any = {};
      sortObj[sort] = order === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [courses, total] = await Promise.all([
        Content.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        Content.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      const response: ApiResponse = {
        success: true,
        data: courses,
        meta: {
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          },
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}