import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../config/redis';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: 'connected' | 'disconnected' | 'error';
      responseTime?: number;
    };
    redis: {
      status: 'connected' | 'disconnected' | 'error';
      responseTime?: number;
    };
    queues: {
      status: 'operational' | 'degraded' | 'down';
      details?: any;
    };
  };
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  let overallStatus: 'healthy' | 'unhealthy' = 'healthy';

  // Check database connection
  let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  let dbResponseTime: number | undefined;
  try {
    const dbStart = Date.now();
    await mongoose.connection.db.admin().ping();
    dbResponseTime = Date.now() - dbStart;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
    overallStatus = 'unhealthy';
  }

  // Check Redis connection
  let redisStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  let redisResponseTime: number | undefined;
  try {
    const redisStart = Date.now();
    await redisClient.ping();
    redisResponseTime = Date.now() - redisStart;
    redisStatus = 'connected';
  } catch (error) {
    redisStatus = 'error';
    overallStatus = 'unhealthy';
  }

  // Check queue status (simplified)
  const queueStatus = 'operational'; // TODO: Implement actual queue health check

  // Get system metrics
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const memoryPercentage = (usedMemory / totalMemory) * 100;

  const healthCheck: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      redis: {
        status: redisStatus,
        responseTime: redisResponseTime,
      },
      queues: {
        status: queueStatus,
      },
    },
    metrics: {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
      cpu: {
        usage: 0, // TODO: Implement CPU usage monitoring
      },
    },
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
}));

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}));

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  let isReady = true;
  const checks: any = {};

  // Check database readiness
  try {
    await mongoose.connection.db.admin().ping();
    checks.database = 'ready';
  } catch (error) {
    checks.database = 'not ready';
    isReady = false;
  }

  // Check Redis readiness
  try {
    await redisClient.ping();
    checks.redis = 'ready';
  } catch (error) {
    checks.redis = 'not ready';
    isReady = false;
  }

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    checks,
  });
}));

export default router;
