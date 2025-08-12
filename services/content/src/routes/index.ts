import { Router } from 'express';
import { ContentController } from '@/controllers/content';
import { SearchController } from '@/controllers/search';
import { S3UploadService } from '@/services/s3-upload';
import { ElasticsearchService } from '@/services/elasticsearch';
import { WebSocketService } from '@/services/websocket';
import { authenticate, requireCreator, requireModerator } from '@/middleware/auth';
import { validationMiddleware } from '@/utils/validation';
import rateLimit from 'express-rate-limit';

// Rate limiting configurations
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 upload initiations per hour
  message: 'Too many upload requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 searches per minute
  message: 'Too many search requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export function createRoutes(
  s3Service: S3UploadService,
  esService: ElasticsearchService,
  wsService: WebSocketService
): Router {
  const router = Router();
  
  // Initialize controllers
  const contentController = new ContentController(s3Service, wsService);
  const searchController = new SearchController(esService);

  // Apply general rate limiting to all routes
  router.use(generalRateLimit);

  // Health check route (no authentication required)
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'content-service',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  });

  // Content routes
  router.post('/content',
    authenticate,
    requireCreator,
    validationMiddleware('content.create'),
    contentController.createContent
  );

  router.get('/content',
    authenticate,
    validationMiddleware('query.pagination', 'query'),
    contentController.listContent
  );

  router.get('/content/:id',
    authenticate,
    validationMiddleware('query.idParam', 'params'),
    contentController.getContent
  );

  router.put('/content/:id',
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    validationMiddleware('content.update'),
    contentController.updateContent
  );

  router.delete('/content/:id',
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    contentController.deleteContent
  );

  // File upload routes
  router.post('/content/:id/upload',
    uploadRateLimit,
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    validationMiddleware('upload.initiate'),
    contentController.initiateUpload
  );

  router.post('/content/:id/upload/:uploadId/complete',
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    validationMiddleware('upload.complete'),
    contentController.completeUpload
  );

  router.get('/upload/:uploadId/progress',
    authenticate,
    contentController.getUploadProgress
  );

  router.post('/upload/:uploadId/resume',
    authenticate,
    requireCreator,
    contentController.resumeUpload
  );

  router.delete('/upload/:uploadId',
    authenticate,
    requireCreator,
    contentController.abortUpload
  );

  // Search routes
  router.get('/search',
    searchRateLimit,
    authenticate,
    validationMiddleware('content.search', 'query'),
    searchController.searchContent
  );

  router.get('/search/suggestions',
    searchRateLimit,
    authenticate,
    searchController.getSuggestions
  );

  router.get('/search/aggregations',
    authenticate,
    searchController.getAggregations
  );

  // Category routes (basic implementation)
  router.get('/categories', authenticate, async (req, res, next) => {
    try {
      const { Category } = await import('@/models/Category');
      const user = req.user!;
      
      const categories = await Category.find({ 
        tenantId: user.tenantId 
      }).sort({ name: 1 });

      res.json({
        success: true,
        data: categories,
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/categories',
    authenticate,
    requireModerator,
    validationMiddleware('category.create'),
    async (req, res, next) => {
      try {
        const { Category } = await import('@/models/Category');
        const user = req.user!;
        const { name, slug, parentId, description, metadata } = req.body;

        const category = new Category({
          tenantId: user.tenantId,
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
          parentId,
          description,
          metadata: metadata || {}
        });

        await category.save();

        res.status(201).json({
          success: true,
          data: category.toJSON(),
          meta: {
            requestId: user.requestId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Admin routes for content management
  router.post('/admin/content/:id/approve',
    authenticate,
    requireModerator,
    validationMiddleware('query.idParam', 'params'),
    async (req, res, next) => {
      try {
        const { Content } = await import('@/models/Content');
        const { id } = req.params;
        const user = req.user!;

        const content = await Content.findOne({
          _id: id,
          tenantId: user.tenantId,
          deleted: false
        });

        if (!content) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Content not found'
            }
          });
        }

        if (content.status !== 'pending_approval') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Content is not pending approval'
            }
          });
        }

        content.status = 'approved';
        content.etag = require('uuid').v4();
        await content.save();

        // Send notification to content creator
        wsService.sendUserNotification(content.createdBy, 'content:approved', {
          contentId: content._id,
          title: content.title,
          approvedBy: user.userId
        });

        res.json({
          success: true,
          data: content.toJSON(),
          meta: {
            requestId: user.requestId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/admin/content/:id/reject',
    authenticate,
    requireModerator,
    validationMiddleware('query.idParam', 'params'),
    async (req, res, next) => {
      try {
        const { Content } = await import('@/models/Content');
        const { id } = req.params;
        const { reason } = req.body;
        const user = req.user!;

        const content = await Content.findOne({
          _id: id,
          tenantId: user.tenantId,
          deleted: false
        });

        if (!content) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Content not found'
            }
          });
        }

        if (content.status !== 'pending_approval') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Content is not pending approval'
            }
          });
        }

        content.status = 'draft';
        content.metadata = {
          ...content.metadata,
          rejectionReason: reason,
          rejectedBy: user.userId,
          rejectedAt: new Date()
        };
        content.etag = require('uuid').v4();
        await content.save();

        // Send notification to content creator
        wsService.sendUserNotification(content.createdBy, 'content:rejected', {
          contentId: content._id,
          title: content.title,
          reason,
          rejectedBy: user.userId
        });

        res.json({
          success: true,
          data: content.toJSON(),
          meta: {
            requestId: user.requestId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/admin/content/:id/publish',
    authenticate,
    requireModerator,
    validationMiddleware('query.idParam', 'params'),
    async (req, res, next) => {
      try {
        const { Content } = await import('@/models/Content');
        const { id } = req.params;
        const user = req.user!;

        const content = await Content.findOne({
          _id: id,
          tenantId: user.tenantId,
          deleted: false
        });

        if (!content) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Content not found'
            }
          });
        }

        if (content.status !== 'approved') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Content must be approved before publishing'
            }
          });
        }

        content.status = 'published';
        content.publishedAt = new Date();
        content.etag = require('uuid').v4();
        await content.save();

        // Send notification to content creator
        wsService.sendUserNotification(content.createdBy, 'content:published', {
          contentId: content._id,
          title: content.title,
          publishedBy: user.userId
        });

        // Send tenant notification
        wsService.sendTenantNotification(user.tenantId, 'content:published', {
          contentId: content._id,
          title: content.title,
          contentType: content.contentType
        });

        res.json({
          success: true,
          data: content.toJSON(),
          meta: {
            requestId: user.requestId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((error: any, req: any, res: any, next: any) => {
    const requestId = req.user?.requestId || req.requestId || 'unknown';
    
    // Log error
    if (error.statusCode >= 500) {
      console.error('Server error:', error);
    }

    // Handle different error types
    let statusCode = error.statusCode || 500;
    let errorCode = error.code || 'INTERNAL_ERROR';
    let message = error.message || 'Internal server error';

    // Validation errors
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    }

    // MongoDB duplicate key errors
    if (error.code === 11000) {
      statusCode = 409;
      errorCode = 'DUPLICATE_KEY';
      message = 'Resource already exists';
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError') {
      statusCode = 401;
      errorCode = 'INVALID_TOKEN';
      message = 'Invalid authentication token';
    }

    if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      errorCode = 'TOKEN_EXPIRED';
      message = 'Authentication token has expired';
    }

    const response = {
      success: false,
      error: {
        code: errorCode,
        message,
        details: error.details
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    res.status(statusCode).json(response);
  });

  return router;
}
