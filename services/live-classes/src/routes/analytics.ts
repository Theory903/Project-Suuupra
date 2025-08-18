import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import { AnalyticsManager } from '../services/analytics-manager.js';
import { logger } from '../utils/logger.js';

export async function analyticsRoutes(app: FastifyInstance) {
  const analyticsManager = new AnalyticsManager(app.db, app.redis);

  // Get room analytics
  app.get('/rooms/:roomId', {
    schema: {
      tags: ['analytics'],
      summary: 'Get room analytics',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      const analytics = await analyticsManager.getRoomAnalytics(request.params.roomId);
      
      if (!analytics) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room analytics not found'
        });
      }

      return reply.send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting room analytics:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get room analytics'
      });
    }
  });

  // Get instructor analytics
  app.get('/instructor/dashboard', {
    schema: {
      tags: ['analytics'],
      summary: 'Get instructor dashboard analytics',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month'], default: 'week' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest<{
    Querystring: {
      period?: 'day' | 'week' | 'month';
      startDate?: string;
      endDate?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { period = 'week', startDate, endDate } = request.query;
      const analytics = await analyticsManager.getInstructorAnalytics(
        request.user!.id,
        { period, startDate, endDate }
      );

      return reply.send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting instructor analytics:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get instructor analytics'
      });
    }
  });

  // Get platform analytics (admin only)
  app.get('/platform/overview', {
    schema: {
      tags: ['analytics'],
      summary: 'Get platform analytics overview',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month'], default: 'week' }
        }
      }
    },
    preHandler: [requireRole(['admin'])]
  }, async (request: FastifyRequest<{
    Querystring: { period?: 'day' | 'week' | 'month' }
  }>, reply: FastifyReply) => {
    try {
      const { period = 'week' } = request.query;
      const analytics = await analyticsManager.getPlatformAnalytics(period);

      return reply.send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting platform analytics:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get platform analytics'
      });
    }
  });

  // Get real-time room stats
  app.get('/rooms/:roomId/realtime', {
    schema: {
      tags: ['analytics'],
      summary: 'Get real-time room statistics',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      const stats = await analyticsManager.getRealTimeRoomStats(request.params.roomId);
      
      if (!stats) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room not found or not active'
        });
      }

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting real-time room stats:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get real-time room stats'
      });
    }
  });

  // Get participant engagement metrics
  app.get('/rooms/:roomId/engagement', {
    schema: {
      tags: ['analytics'],
      summary: 'Get participant engagement metrics',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      const engagement = await analyticsManager.getParticipantEngagement(request.params.roomId);

      return reply.send({
        success: true,
        data: engagement
      });
    } catch (error) {
      logger.error('Error getting participant engagement:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get participant engagement'
      });
    }
  });

  // Track custom event
  app.post('/events/track', {
    schema: {
      tags: ['analytics'],
      summary: 'Track custom analytics event',
      body: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          properties: { type: 'object' },
          roomId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['event']
      }
    }
  }, async (request: FastifyRequest<{
    Body: {
      event: string;
      properties?: any;
      roomId?: string;
      timestamp?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { event, properties, roomId, timestamp } = request.body;
      
      await analyticsManager.trackEvent({
        event,
        userId: request.user!.id,
        properties: properties || {},
        roomId,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      });

      return reply.send({
        success: true,
        message: 'Event tracked successfully'
      });
    } catch (error) {
      logger.error('Error tracking event:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to track event'
      });
    }
  });
}
