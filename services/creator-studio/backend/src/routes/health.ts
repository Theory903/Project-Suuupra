import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../config/redis';
import { asyncHandler } from '../middleware/errorHandler';
import { analyticsQueue, moderationQueue, thumbnailQueue, videoProcessingQueue } from '../config/queues';
import * as os from 'os';

const router = Router();

// CPU usage tracking variables
let lastCPUTime = process.cpuUsage();
let lastCPUCheck = Date.now();

// Function to calculate CPU usage percentage
async function getCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime();
    
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const endTime = process.hrtime(startTime);
      
      // Calculate total time in microseconds
      const totalTime = endTime[0] * 1000000 + endTime[1] / 1000;
      
      // Calculate CPU time in microseconds
      const cpuTime = endUsage.user + endUsage.system;
      
      // Calculate CPU usage percentage
      const cpuPercent = (cpuTime / totalTime) * 100;
      
      resolve(Math.round(cpuPercent * 100) / 100);
    }, 100); // Sample over 100ms
  });
}

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

  // Check queue status with actual health checks
  let queueStatus = 'operational';
  let queueErrors: string[] = [];
  
  try {
    // Check video processing queue
    // Implement comprehensive queue health check
    const videoQueueWaiting = await videoProcessingQueue.getWaiting();
    const videoQueueActive = await videoProcessingQueue.getActive();
    const videoQueueCompleted = await videoProcessingQueue.getCompleted();
    const videoQueueFailed = await videoProcessingQueue.getFailed();
    
    // Health check based on queue metrics
    const totalJobs = videoQueueWaiting.length + videoQueueActive.length;
    const failureRate = videoQueueFailed.length / Math.max(videoQueueCompleted.length + videoQueueFailed.length, 1);
    
    // Determine queue health status
    let queueHealthStatus = 'healthy';
    if (failureRate > 0.1) { // >10% failure rate
      queueHealthStatus = 'degraded';
    }
    if (failureRate > 0.25 || totalJobs > 100) { // >25% failure rate or high backlog
      queueHealthStatus = 'unhealthy';
    }
    
    const videoQueueHealth = {
      status: queueHealthStatus,
      waiting: videoQueueWaiting.length,
      active: videoQueueActive.length,
      completed: videoQueueCompleted.length,
      failed: videoQueueFailed.length,
      failure_rate: Math.round(failureRate * 10000) / 100, // Percentage with 2 decimals
      total_backlog: totalJobs
    };
    
    if (videoQueueHealth.failed > 10) {
      queueErrors.push(`Video queue has ${videoQueueHealth.failed} failed jobs`);
      queueStatus = 'degraded';
    }
    
    if (videoQueueHealth.active > 50) {
      queueErrors.push(`Video queue has ${videoQueueHealth.active} active jobs (high load)`);
      if (queueStatus === 'operational') queueStatus = 'degraded';
    }
    
    // Check other queues
    const queues = [thumbnailQueue, analyticsQueue, moderationQueue];
    const queueNames = ['thumbnail', 'analytics', 'moderation'];
    
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];
      const queueName = queueNames[i];
      
      try {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const failed = await queue.getFailed();
        
        if (failed.length > 5) {
          queueErrors.push(`${queueName} queue has ${failed.length} failed jobs`);
          queueStatus = 'degraded';
        }
        
        if (waiting.length > 100) {
          queueErrors.push(`${queueName} queue has ${waiting.length} waiting jobs (backlog)`);
          if (queueStatus === 'operational') queueStatus = 'degraded';
        }
      } catch (queueError) {
        queueErrors.push(`${queueName} queue health check failed: ${queueError}`);
        queueStatus = 'error';
      }
    }
    
  } catch (error) {
    queueStatus = 'error';
    queueErrors.push(`Queue health check failed: ${error}`);
  }

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
        usage: await getCPUUsage(), // Implement CPU usage monitoring
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
