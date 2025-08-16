import { Request, Response, NextFunction } from 'express';
import { Content } from '@/models/Content';
import { Category } from '@/models/Category';
import { S3UploadService } from '@/services/s3-upload';
import { WebSocketService } from '@/services/websocket';
import { validate, validationMiddleware } from '@/utils/validation';
import { ApiResponse, PaginationQuery, ContentFilters, NotFoundError, ConflictError, ValidationError } from '@/types';
import { logger, ContextLogger } from '@/utils/logger';
import semver from 'semver';
import { v4 as uuidv4 } from 'uuid';

export class ContentController {
  private s3Service: S3UploadService;
  private wsService: WebSocketService;
  private contextLogger: ContextLogger;

  constructor(s3Service: S3UploadService, wsService: WebSocketService) {
    this.s3Service = s3Service;
    this.wsService = wsService;
    this.contextLogger = new ContextLogger({ controller: 'content' });
  }

  // Create new content
  public createContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, description, contentType, categoryId, tags, metadata, idempotencyKey } = req.body;
      const user = req.user!;

      this.contextLogger.info('Creating new content', {
        requestId: user.requestId,
        userId: user.userId,
        tenantId: user.tenantId,
        title,
        contentType
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

      // Create content
      const contentData: any = {
        _id: uuidv4(),
        tenantId: user.tenantId,
        title: title.trim(),
        description: description?.trim(),
        contentType,
        status: 'draft' as const,
        version: '1.0.0',
        categoryId,
        tags: tags || [],
        createdBy: user.userId,
        etag: uuidv4()
      };

      // Handle metadata based on content type
      if (contentType === 'course') {
        contentData.metadata = {
          instructorId: user.userId, // Default to creator as instructor
          courseOutline: [],
          durationMinutes: 0,
          difficulty: 'beginner',
          language: 'en',
          prerequisites: [],
          learningOutcomes: [],
          price: 0,
          currency: 'USD',
          ...metadata
        };
      } else if (contentType === 'lesson') {
        contentData.metadata = {
          courseId: metadata?.courseId,
          lessonNumber: metadata?.lessonNumber || 1,
          durationMinutes: metadata?.durationMinutes || 0,
          ...metadata
        };
      } else {
        contentData.metadata = metadata || {};
      }

      const content = new Content(contentData);
      await content.save();

      this.contextLogger.info('Content created successfully', {
        requestId: user.requestId,
        contentId: content._id,
        title: content.title
      });

      // Send notification
      this.wsService.sendUserNotification(user.userId, 'content:created', {
        contentId: content._id,
        title: content.title
      });

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
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

  // Get content by ID
  public getContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (!id) {
        throw new ValidationError('Content ID is required');
      }

      const content = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        throw new NotFoundError('Content', id);
      }

      // Set ETag header
      res.set('ETag', `"${content.etag}"`);
      res.set('Last-Modified', content.updatedAt.toUTCString());

      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag && clientETag === `"${content.etag}"`) {
        res.status(304).end();
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
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

  // Update content
  public updateContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, description, categoryId, tags, metadata, versionBump = 'patch' } = req.body;
      const user = req.user!;
      const ifMatch = req.headers['if-match'];

      if (!id) {
        throw new ValidationError('Content ID is required');
      }

      this.contextLogger.info('Updating content', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId
      });

      const content = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        throw new NotFoundError('Content', id);
      }

      // Check ownership or permissions
      if (!content.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to edit this content'
          }
        });
        return;
      }

      // Check ETag for optimistic concurrency
      if (ifMatch && ifMatch !== `"${content.etag}"`) {
        res.status(412).json({
          success: false,
          error: {
            code: 'PRECONDITION_FAILED',
            message: 'Content has been modified by another user',
            details: { currentETag: content.etag }
          }
        });
        return;
      }

      // Validate category if provided
      if (categoryId && categoryId !== content.categoryId) {
        const category = await Category.findOne({
          _id: categoryId,
          tenantId: user.tenantId
        });

        if (!category) {
          throw new ValidationError(`Category not found: ${categoryId}`);
        }
      }

      // Update version if content is published
      let newVersion = content.version;
      if (content.status === 'published') {
        newVersion = semver.inc(content.version, versionBump) || content.version;
      }

      // Update content
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
        updates.metadata = { ...content.metadata, ...metadata };
      }

      // Reset to draft if published content is modified significantly
      if (content.status === 'published' && (title || description || categoryId)) {
        updates.status = 'draft';
        updates.publishedAt = undefined;
      }

      Object.assign(content, updates);
      await content.save();

      this.contextLogger.info('Content updated successfully', {
        requestId: user.requestId,
        contentId: content._id,
        newVersion
      });

      // Send notification
      this.wsService.sendUserNotification(user.userId, 'content:updated', {
        contentId: content._id,
        title: content.title,
        version: newVersion
      });

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
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

  // Delete content (soft delete)
  public deleteContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (!id) {
        throw new ValidationError('Content ID is required');
      }

      this.contextLogger.info('Deleting content', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId
      });

      const content = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        throw new NotFoundError('Content', id);
      }

      // Check ownership or permissions
      if (!content.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to delete this content'
          }
        });
        return;
      }

      // Soft delete
      content.deleted = true;
      content.deletedAt = new Date();
      content.etag = uuidv4();
      await content.save();

      this.contextLogger.info('Content deleted successfully', {
        requestId: user.requestId,
        contentId: content._id
      });

      // Send notification
      this.wsService.sendUserNotification(user.userId, 'content:deleted', {
        contentId: content._id,
        title: content.title
      });

      const response: ApiResponse = {
        success: true,
        data: { id: content._id, deleted: true },
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

  // List content with pagination and filtering
  public listContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query as PaginationQuery & any;
      
      // Parse filters
      const filters: ContentFilters = {};
      if (req.query.status) {
        filters.status = Array.isArray(req.query.status) ? req.query.status as any : [req.query.status as any];
      }
      if (req.query.contentType) {
        filters.contentType = Array.isArray(req.query.contentType) ? req.query.contentType as any : [req.query.contentType as any];
      }
      if (req.query.category) {
        filters.category = Array.isArray(req.query.category) ? req.query.category as string[] : [req.query.category as string];
      }
      if (req.query.tags) {
        filters.tags = Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string];
      }
      if (req.query.createdBy) {
        filters.createdBy = req.query.createdBy as string;
      }

      // Build query
      const query: any = {
        tenantId: user.tenantId,
        deleted: false
      };

      // Apply filters
      if (filters.status) {
        query.status = { $in: filters.status };
      }
      if (filters.contentType) {
        query.contentType = { $in: filters.contentType };
      }
      if (filters.category) {
        query.categoryId = { $in: filters.category };
      }
      if (filters.tags) {
        query.tags = { $in: filters.tags };
      }
      if (filters.createdBy) {
        query.createdBy = filters.createdBy;
      }

      // Build sort
      const sortObj: any = {};
      sortObj[sort] = order === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [contents, total] = await Promise.all([
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
        data: contents,
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

  // Initiate file upload
  public initiateUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { filename, contentType, fileSize, checksumSha256 } = req.body;
      const user = req.user!;

      if (!id) {
        throw new ValidationError('Content ID is required');
      }

      this.contextLogger.info('Initiating file upload', {
        requestId: user.requestId,
        contentId: id,
        filename,
        fileSize
      });

      // Verify content exists and user has access
      const content = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        throw new NotFoundError('Content', id);
      }

      if (!content.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to upload files for this content'
          }
        });
        return;
      }

      // Check for existing active uploads
      const existingUploads = await this.s3Service.constructor.name === 'S3UploadService' ? 
        [] : []; // Placeholder - would use UploadSession.findActiveUploads(id)

      if (existingUploads.length > 0) {
        throw new ConflictError('An active upload already exists for this content');
      }

      // Initiate upload
      const uploadResult = await this.s3Service.initiateUpload({
        contentId: id,
        filename,
        contentType,
        fileSize,
        checksumSha256,
        tenantId: user.tenantId,
        userId: user.userId
      });

      this.contextLogger.info('File upload initiated successfully', {
        requestId: user.requestId,
        contentId: id,
        uploadId: uploadResult.uploadId
      });

      const response: ApiResponse = {
        success: true,
        data: {
          uploadId: uploadResult.uploadId,
          uploadParts: uploadResult.uploadParts,
          uploadSession: uploadResult.uploadSession
        },
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

  // Complete file upload
  public completeUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, uploadId } = req.params;
      const { parts } = req.body;
      const user = req.user!;

      if (!id || !uploadId) {
        throw new ValidationError('Content ID and Upload ID are required');
      }

      this.contextLogger.info('Completing file upload', {
        requestId: user.requestId,
        contentId: id,
        uploadId,
        partsCount: parts.length
      });

      // Verify content exists and user has access
      const content = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        throw new NotFoundError('Content', id);
      }

      if (!content.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to complete upload for this content'
          }
        });
        return;
      }
      
      // Retrieve upload session to get original file info
      const uploadSession = await this.s3Service.getUploadSession(uploadId);
      if (!uploadSession) {
        throw new NotFoundError('UploadSession', uploadId);
      }

      // Complete upload
      const uploadResult = await this.s3Service.completeUpload(uploadId, parts);

      // Update content with file information
      content.fileInfo = {
        filename: uploadSession.filename,
        contentType: uploadSession.contentType,
        fileSize: uploadSession.fileSize,
        s3Key: uploadResult.s3Key,
        cdnUrl: uploadResult.cdnUrl, // Explicitly assign as string | undefined
        checksumSha256: uploadSession.checksumSha256,
        uploadedAt: new Date()
      };
      content.etag = uuidv4();
      await content.save();

      // Broadcast upload completion
      this.wsService.broadcastUploadComplete(uploadId, {
        contentId: id,
        s3Key: uploadResult.s3Key,
        cdnUrl: uploadResult.cdnUrl
      });

      this.contextLogger.info('File upload completed successfully', {
        requestId: user.requestId,
        contentId: id,
        uploadId,
        s3Key: uploadResult.s3Key
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...uploadResult,
          content: content.toJSON()
        },
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      // Broadcast upload error
      this.wsService.broadcastUploadError(uploadId || '', error as Error); // Ensure uploadId is string
      next(error);
    }
  };

  // Get upload progress
  public getUploadProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const user = req.user!;

      if (!uploadId) {
        throw new ValidationError('Upload ID is required');
      }

      const progress = await this.s3Service.getUploadProgress(uploadId);

      const response: ApiResponse = {
        success: true,
        data: progress,
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

  // Resume upload
  public resumeUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const user = req.user!;

      if (!uploadId) {
        throw new ValidationError('Upload ID is required');
      }

      this.contextLogger.info('Resuming file upload', {
        requestId: user.requestId,
        uploadId
      });

      const uploadParts = await this.s3Service.resumeUpload(uploadId);

      const response: ApiResponse = {
        success: true,
        data: { uploadParts },
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

  // Abort upload
  public abortUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const user = req.user!;

      if (!uploadId) {
        throw new ValidationError('Upload ID is required');
      }

      this.contextLogger.info('Aborting file upload', {
        requestId: user.requestId,
        uploadId
      });

      await this.s3Service.abortUpload(uploadId);

      const response: ApiResponse = {
        success: true,
        data: { uploadId, aborted: true },
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
}
