import { Request, Response, NextFunction } from 'express';
import { Content } from '@/models/Content';
import { Category } from '@/models/Category';
import { ApiResponse, PaginationQuery, NotFoundError, ValidationError, CourseMetadata, LessonMetadata } from '@/types';
import { logger, ContextLogger } from '@/utils/logger';
import semver from 'semver';
import { v4 as uuidv4 } from 'uuid';

export class LessonController {
  private contextLogger: ContextLogger;

  constructor() {
    this.contextLogger = new ContextLogger({ controller: 'lesson' });
  }

  // Create new lesson
  public createLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, description, categoryId, tags, metadata } = req.body;
      const user = req.user!;

      this.contextLogger.info('Creating new lesson', {
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

      // Validate courseId from metadata
      const courseId = metadata?.courseId;
      if (!courseId) {
        throw new ValidationError('Course ID is required for lessons');
      }

      const course = await Content.findOne({
        _id: courseId,
        tenantId: user.tenantId,
        contentType: 'course',
        deleted: false
      });

      if (!course) {
        throw new NotFoundError('Course', courseId);
      }

      // Create lesson content
      const lessonData: any = {
        _id: uuidv4(),
        tenantId: user.tenantId,
        title: title.trim(),
        description: description?.trim(),
        contentType: 'lesson',
        status: 'draft' as const,
        version: '1.0.0',
        categoryId,
        tags: tags || [],
        createdBy: user.userId,
        etag: uuidv4(),
        metadata: {
          courseId,
          lessonNumber: metadata?.lessonNumber || ((course.metadata as CourseMetadata)?.courseOutline?.length + 1) || 1,
          durationMinutes: metadata?.durationMinutes || 0,
          ...metadata
        }
      };

      const lesson = new Content(lessonData);
      await lesson.save();

      // Add lesson to course outline
      if (course.metadata && Array.isArray((course.metadata as CourseMetadata).courseOutline)) {
        (course.metadata as CourseMetadata).courseOutline.push({
          lessonId: lesson._id,
          title: lesson.title,
          order: (lesson.metadata as LessonMetadata).lessonNumber
        });
        course.markModified('metadata.courseOutline'); // Mark as modified for Mongoose
        await course.save();
      }

      this.contextLogger.info('Lesson created successfully', {
        requestId: user.requestId,
        lessonId: lesson._id,
        title: lesson.title,
        courseId
      });

      const response: ApiResponse = {
        success: true,
        data: lesson.toJSON(),
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

  // Get lesson by ID
  public getLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (!id) {
        throw new ValidationError('Lesson ID is required');
      }

      const lesson = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        contentType: 'lesson',
        deleted: false
      });

      if (!lesson) {
        throw new NotFoundError('Lesson', id);
      }

      res.json({
        success: true,
        data: lesson.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Update lesson
  public updateLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, description, categoryId, tags, metadata, versionBump = 'patch' } = req.body;
      const user = req.user!;
      const ifMatch = req.headers['if-match'];

      if (!id) {
        throw new ValidationError('Lesson ID is required');
      }

      this.contextLogger.info('Updating lesson', {
        requestId: user.requestId,
        lessonId: id,
        userId: user.userId
      });

      const lesson = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        contentType: 'lesson',
        deleted: false
      });

      if (!lesson) {
        throw new NotFoundError('Lesson', id);
      }

      // Check ownership or permissions
      if (!lesson.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to edit this lesson'
          }
        });
        return;
      }

      // Check ETag for optimistic concurrency
      if (ifMatch && ifMatch !== `"${lesson.etag}"`) {
        res.status(412).json({
          success: false,
          error: {
            code: 'PRECONDITION_FAILED',
            message: 'Lesson has been modified by another user',
            details: { currentETag: lesson.etag }
          }
        });
        return;
      }

      // Validate category if provided
      if (categoryId && categoryId !== lesson.categoryId) {
        const category = await Category.findOne({
          _id: categoryId,
          tenantId: user.tenantId
        });

        if (!category) {
          throw new ValidationError(`Category not found: ${categoryId}`);
        }
      }

      // Update version if content is published
      let newVersion = lesson.version;
      if (lesson.status === 'published') {
        newVersion = semver.inc(lesson.version, versionBump) || lesson.version;
      }

      // Update lesson
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
        updates.metadata = { ...lesson.metadata, ...metadata };
      }

      // Reset to draft if published content is modified significantly
      if (lesson.status === 'published' && (title || description || categoryId)) {
        updates.status = 'draft';
        updates.publishedAt = undefined;
      }

      Object.assign(lesson, updates);
      await lesson.save();

      this.contextLogger.info('Lesson updated successfully', {
        requestId: user.requestId,
        lessonId: lesson._id,
        newVersion
      });

      const response: ApiResponse = {
        success: true,
        data: lesson.toJSON(),
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

  // Delete lesson (soft delete)
  public deleteLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (!id) {
        throw new ValidationError('Lesson ID is required');
      }

      this.contextLogger.info('Deleting lesson', {
        requestId: user.requestId,
        lessonId: id,
        userId: user.userId
      });

      const lesson = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        contentType: 'lesson',
        deleted: false
      });

      if (!lesson) {
        throw new NotFoundError('Lesson', id);
      }

      // Check ownership or permissions
      if (!lesson.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to delete this lesson'
          }
        });
        return;
      }

      // Soft delete
      lesson.deleted = true;
      lesson.deletedAt = new Date();
      lesson.etag = uuidv4();
      await lesson.save();

      // Remove lesson from course outline
      const courseId = (lesson.metadata as LessonMetadata)?.courseId;
      if (courseId) {
        const course = await Content.findOne({
          _id: courseId,
          tenantId: user.tenantId,
          contentType: 'course',
          deleted: false
        });

        if (course && (course.metadata as CourseMetadata)?.courseOutline && Array.isArray((course.metadata as CourseMetadata).courseOutline)) {
          (course.metadata as CourseMetadata).courseOutline = (course.metadata as CourseMetadata).courseOutline.filter(
            (item: any) => item.lessonId !== lesson._id
          );
          course.markModified('metadata.courseOutline');
          await course.save();
        }
      }

      this.contextLogger.info('Lesson deleted successfully', {
        requestId: user.requestId,
        lessonId: lesson._id
      });

      const response: ApiResponse = {
        success: true,
        data: { id: lesson._id, deleted: true },
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

  // List lessons with pagination and filtering
  public listLessons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = req.query as PaginationQuery & any;
      
      // Build query
      const query: any = {
        tenantId: user.tenantId,
        contentType: 'lesson',
        deleted: false
      };

      // Build sort
      const sortObj: any = {};
      sortObj[sort] = order === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [lessons, total] = await Promise.all([
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
        data: lessons,
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