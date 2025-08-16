import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from '@/config';
import { DatabaseManager } from '@/models';
import { ElasticsearchService } from '@/services/elasticsearch';
import { S3UploadService } from '@/services/s3-upload';
import { WebSocketService } from '@/services/websocket';
import { createRoutes } from '@/routes';
import { InvertedIndexService } from '@/services/inverted-index';
import { logger, requestLogger, errorLogger } from '@/utils/logger';
import { metricsMiddleware, register, initializeMetrics } from '@/utils/metrics';
import { initializeTracing, shutdownTracing, tracingMiddleware } from '@/utils/tracing';
import { Redis, RedisOptions } from 'ioredis';
import cron from 'node-cron';

class ContentService {
  public app: express.Application;
  private server: any;
  private dbManager: DatabaseManager;
  private redis: Redis;
  private esService: ElasticsearchService;
  private s3Service: S3UploadService;
  private wsService!: WebSocketService;
  private syncWorker: any;
  private invertedIndex?: InvertedIndexService;

  constructor() {
    this.app = express();
    this.dbManager = DatabaseManager.getInstance();
    const redisOptions: RedisOptions = {
      db: config.database.redis.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };
    if (config.database.redis.password) {
      redisOptions.password = config.database.redis.password;
    }
    this.redis = new Redis(config.database.redis.url, redisOptions);
    
    this.esService = new ElasticsearchService();
    this.s3Service = new S3UploadService();
    this.invertedIndex = new InvertedIndexService();
    // Lazy-load sync worker to avoid compile-time dependency issues
    this.syncWorker = null;
  }

  // Initialize the application
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Content Service...');

      // Initialize tracing
      initializeTracing();

      // Connect to databases
      await this.connectDatabases();

      // Initialize services
      await this.initializeServices();

      // Build simple inverted index on startup for a default tenant (learning/diagnostic)
      try {
        if (this.invertedIndex) {
          const tenantId = process.env.DEFAULT_TENANT_ID || 'default';
          await this.invertedIndex.build(tenantId);
          logger.info('Inverted index built on initialization', { tenantId });
        }
      } catch (e) {
        logger.warn('Skipping inverted index build on initialization', { error: (e as Error).message });
      }

      // Setup Express middleware
      this.setupMiddleware();
      // Metrics collection
      initializeMetrics();

      // Setup routes
      this.setupRoutes();

      // Create HTTP server and WebSocket service
      this.server = createServer(this.app);
      this.wsService = new WebSocketService(this.server);

      // Start background workers
      if (config.features.backgroundJobs) {
        await this.startBackgroundWorkers();
      }

    // Setup scheduled tasks
    this.setupScheduledTasks();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Content Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Content Service:', error);
      throw error;
    }
  }

  // Connect to databases
  private async connectDatabases(): Promise<void> {
    logger.info('Connecting to databases...');

    // Connect to MongoDB
    await this.dbManager.connect();
    await this.dbManager.createIndexes();

    // Connect to Redis
    await this.redis.connect();
    logger.info('Redis connected successfully');

    logger.info('Database connections established');
  }

  // Initialize services
  private async initializeServices(): Promise<void> {
    logger.info('Initializing services...');

    // Initialize Elasticsearch
    await this.esService.initialize();

    logger.info('Services initialized successfully');
  }

  // Setup Express middleware
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS
    this.app.use(cors({
      origin: config.service.cors.origin,
      credentials: config.service.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Tenant-ID', 'If-Match', 'If-None-Match']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    if (config.observability.enableRequestLogging) {
      this.app.use(requestLogger);
    }

    // Metrics middleware
    this.app.use(metricsMiddleware);

    // Tracing middleware
    this.app.use(tracingMiddleware);

    // Trust proxy (for rate limiting and IP detection)
    this.app.set('trust proxy', 1);
  }

  // Setup routes
  private setupRoutes(): void {
    // API routes
    this.app.use('/api/v1', createRoutes(this.s3Service, this.esService, this.wsService, this.invertedIndex));

    // Health check
    this.app.get('/health', async (req, res) => {
      const health = await this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Metrics endpoint (Prometheus)
    this.app.get('/metrics', async (_req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (err) {
        res.status(500).end((err as Error).message);
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        },
        meta: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    });

    // Error handling
    this.app.use(errorLogger);
  }

  // Start background workers
  private async startBackgroundWorkers(): Promise<void> {
    logger.info('Starting background workers...');

    // Start Elasticsearch sync worker
    if (!this.syncWorker) {
      const workerPath = '@/workers/' + 'elasticsearch-sync';
      const mod: any = await import(workerPath as any);
      this.syncWorker = new mod.ElasticsearchSyncWorker(this.redis, this.esService);
    }
    await this.syncWorker.start();

    logger.info('Background workers started successfully');
  }

  // Setup scheduled tasks
  private setupScheduledTasks(): void {
    logger.info('Setting up scheduled tasks...');

    // Cleanup expired upload sessions every hour
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Running cleanup task for expired uploads');
        await this.s3Service.cleanupExpiredUploads();
      } catch (error) {
        logger.error('Cleanup task failed:', error);
      }
    });

    // Process dead letter queue every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        logger.debug('Processing Elasticsearch sync DLQ');
        await this.syncWorker.processDLQ(10);
      } catch (error) {
        logger.error('DLQ processing failed:', error);
      }
    });

    // Soft-delete retention sweep daily
    cron.schedule('0 3 * * *', async () => {
      try {
        const retentionDays = parseInt(process.env.CONTENT_RETENTION_DAYS || '30', 10);
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const { Content } = await import('@/models/Content');
        const res = await Content.deleteMany({ deleted: true, deletedAt: { $lte: cutoff } });
        logger.info('Retention sweep completed', { deletedCount: res.deletedCount, retentionDays });
      } catch (error) {
        logger.error('Retention sweep failed:', error);
      }
    });

    // Rebuild simple inverted index daily at 2:30 AM
    cron.schedule('30 2 * * *', async () => {
      try {
        if (!this.invertedIndex) return;
        // For single-tenant per process; use a default or env
        const tenantId = process.env.DEFAULT_TENANT_ID || 'default';
        await this.invertedIndex.build(tenantId);
        logger.info('Inverted index rebuild completed', { tenantId });
      } catch (error) {
        logger.error('Inverted index rebuild failed:', error);
      }
    });

    // Health check and metrics collection every minute
    cron.schedule('* * * * *', async () => {
      try {
        const health = await this.getHealthStatus();
        if (health.status !== 'healthy') {
          logger.warn('Service health check failed', { health });
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    });

    logger.info('Scheduled tasks configured');
  }

  // Setup graceful shutdown
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        if (this.server) {
          this.server.close(() => {
            logger.info('HTTP server closed');
          });
        }

        // Stop background workers
        if (this.syncWorker) {
          await this.syncWorker.stop();
          logger.info('Background workers stopped');
        }

        // Close database connections
        await this.dbManager.disconnect();
        await this.redis.disconnect();
        logger.info('Database connections closed');

        // Shutdown tracing
        await shutdownTracing();

        // Cleanup WebSocket service
        if (this.wsService) {
          this.wsService.cleanup();
          logger.info('WebSocket service cleaned up');
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  // Get health status
  private async getHealthStatus(): Promise<any> {
    const checks = await Promise.allSettled([
      this.dbManager.healthCheck(),
      this.esService.healthCheck(),
      this.s3Service.healthCheck(),
      this.wsService.healthCheck(),
      this.getRedisHealth(),
      this.syncWorker ? this.syncWorker.getSyncStatus() : Promise.resolve({ status: 'idle' })
    ]);

    const [mongoHealth, esHealth, s3Health, wsHealth, redisHealth, syncStatus] = checks.map(
      (result) => result.status === 'fulfilled' ? result.value : { status: 'unhealthy', error: result.reason }
    );

    const allHealthy = [mongoHealth, esHealth, s3Health, wsHealth, redisHealth].every(
      (health) => health.status === 'healthy'
    );

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: {
        mongodb: mongoHealth,
        elasticsearch: esHealth,
        s3: s3Health,
        websocket: wsHealth,
        redis: redisHealth,
        syncWorker: syncStatus
      }
    };
  }

  // Get Redis health
  private async getRedisHealth(): Promise<{ status: string; details?: any }> {
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        details: {
          connected: this.redis.status === 'ready'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Start the server
  public async start(): Promise<void> {
    try {
      await this.initialize();

      const port = config.service.port;
      this.server.listen(port, () => {
        logger.info(`Content Service listening on port ${port}`, {
          environment: config.service.environment,
          version: process.env.npm_package_version || '1.0.0',
          features: config.features
        });
      });
    } catch (error) {
      logger.error('Failed to start Content Service:', error);
      process.exit(1);
    }
  }
}

// Start the service
export const app = new ContentService().app;

// Start the service if not in a test environment
if (process.env.NODE_ENV !== 'test') {
  const service = new ContentService();
  service.start().catch((error) => {
    console.error('Failed to start service:', error);
    process.exit(1);
  });
}
