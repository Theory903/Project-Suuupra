import { Router } from 'express';
import { ContentController } from '@/controllers/content';
import { CourseController } from '@/controllers/course';
import { LessonController } from '@/controllers/lesson';
import { SearchController } from '@/controllers/search';
import { S3UploadService } from '@/services/s3-upload';
import { ElasticsearchService } from '@/services/elasticsearch';
import { InvertedIndexService } from '@/services/inverted-index';
import { WebSocketService } from '@/services/websocket';
import { authenticate, requireCreator, requireModerator } from '@/middleware/auth';
import { validationMiddleware } from '@/utils/validation';
import rateLimit from 'express-rate-limit';
import { MediaAssetController } from '@/controllers/mediaAsset';
import { SimilarityController } from '@/controllers/similarity';

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
  wsService: WebSocketService,
  invertedIndex?: InvertedIndexService
): Router {
  const router = Router();
  
  // Initialize controllers
  const contentController = new ContentController(s3Service, wsService);
  const searchController = new SearchController(esService);
  const courseController = new CourseController();
  const lessonController = new LessonController();
  const mediaAssetController = new MediaAssetController();
  const simpleSearchController = invertedIndex ? new (require('@/controllers/simpleSearch').SimpleSearchController)(invertedIndex) : null;
  const similarityController = new SimilarityController(esService);

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

  // Media asset routes
  router.post('/content/:id/assets',
    authenticate,
    requireCreator,
    validationMiddleware('mediaAsset.create'),
    mediaAssetController.createAsset
  );

  router.get('/content/:id/assets',
    authenticate,
    mediaAssetController.listAssets
  );

  router.get('/assets/:assetId',
    authenticate,
    mediaAssetController.getAsset
  );

  router.delete('/assets/:assetId',
    authenticate,
    requireCreator,
    mediaAssetController.deleteAsset
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

  // Similar content
  router.get('/search/similar/:id',
    authenticate,
    similarityController.similarById
  );

  // Simple inverted-index search (learning/diagnostic)
  if (simpleSearchController) {
    router.get('/search/simple',
      searchRateLimit,
      authenticate,
      simpleSearchController.search
    );
  }

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

  // Course routes
  router.post('/courses',
    authenticate,
    requireCreator,
    validationMiddleware('content.create'), // Re-use content create validation
    courseController.createCourse
  );

  router.get('/courses',
    authenticate,
    validationMiddleware('query.pagination', 'query'),
    courseController.listCourses
  );

  router.get('/courses/:id',
    authenticate,
    validationMiddleware('query.idParam', 'params'),
    courseController.getCourse
  );

  router.put('/courses/:id',
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    validationMiddleware('content.update'), // Re-use content update validation
    courseController.updateCourse
  );

  router.delete('/courses/:id',
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    courseController.deleteCourse
  );

  // Lesson routes
  router.post('/lessons',
    authenticate,
    requireCreator,
    validationMiddleware('content.create'), // Re-use content create validation
    lessonController.createLesson
  );

  router.get('/lessons',
    authenticate,
    validationMiddleware('query.pagination', 'query'),
    lessonController.listLessons
  );

  router.get('/lessons/:id',
    authenticate,
    validationMiddleware('query.idParam', 'params'),
    lessonController.getLesson
  );

  router.put('/lessons/:id',
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    validationMiddleware('content.update'), // Re-use content update validation
    lessonController.updateLesson
  );

  router.delete('/lessons/:id',
    authenticate,
    requireCreator,
    validationMiddleware('query.idParam', 'params'),
    lessonController.deleteLesson
  );

  // Admin routes for content management
  router.post('/admin/content/:id/approve',
    authenticate,
    requireModerator,
    validationMiddleware('query.idParam', 'params'),
    contentController.approveContent
  );

  router.post('/admin/content/:id/reject',
    authenticate,
    requireModerator,
    validationMiddleware('query.idParam', 'params'),
    contentController.rejectContent
  );

  router.post('/admin/content/:id/publish',
    authenticate,
    requireModerator,
    validationMiddleware('query.idParam', 'params'),
    contentController.publishContent
  );

  // Admin: trigger ES reindex for tenant
  router.post('/admin/search/reindex',
    authenticate,
    requireModerator,
    async (req, res, next) => {
      try {
        const user = req.user!;
        const worker = await import('@/workers/reindex-elasticsearch');
        const stats = await worker.reindexTenant(esService, user.tenantId);
        res.json({ success: true, data: stats, meta: { requestId: user.requestId, timestamp: new Date().toISOString() } });
      } catch (e) {
        next(e);
      }
    }
  );

  // Admin: compute embeddings for tenant
  router.post('/admin/embeddings/rebuild',
    authenticate,
    requireModerator,
    async (req, res, next) => {
      try {
        const user = req.user!;
        const { computeEmbeddingsForTenant } = await import('@/workers/compute-embeddings');
        const stats = await computeEmbeddingsForTenant(user.tenantId);
        res.json({ success: true, data: stats, meta: { requestId: user.requestId, timestamp: new Date().toISOString() } });
      } catch (e) {
        next(e);
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
