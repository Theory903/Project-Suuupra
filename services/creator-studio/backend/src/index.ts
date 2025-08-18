import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { register } from 'prom-client';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import { redisClient } from './config/redis';
import { initializeQueues } from './config/queues';
import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import analyticsRoutes from './routes/analytics';
import monetizationRoutes from './routes/monetization';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { metricsMiddleware } from './middleware/metrics';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8089;

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    }
  } : undefined,
});

// HTTP logger middleware
app.use(pinoHttp({ logger }));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Metrics middleware
app.use(metricsMiddleware);

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Creator Studio API',
      version: '1.0.0',
      description: 'API for Creator Studio - Content Management, Analytics, and Monetization',
    },
    servers: [
      {
        url: process.env.API_BASE_URL || `http://localhost:${PORT}`,
        description: 'Creator Studio API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/models/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/content', authMiddleware, contentRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/monetization', authMiddleware, monetizationRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Creator Studio Backend',
    version: '1.0.0',
    status: 'running',
    documentation: '/api-docs',
    health: '/health',
    metrics: '/metrics',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('Connected to MongoDB');

    // Connect to Redis
    await redisClient.ping();
    logger.info('Connected to Redis');

    // Initialize job queues
    await initializeQueues();
    logger.info('Job queues initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Creator Studio Backend listening on port ${PORT}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

startServer();