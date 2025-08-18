import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export async function adminRoutes(app: FastifyInstance) {
  // Get system status
  app.get('/system/status', {
    schema: {
      tags: ['admin'],
      summary: 'Get system status and health'
    },
    preHandler: [requireRole(['admin'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const workerStats = await app.mediaSoup.getWorkerStats();
      const redisInfo = await app.redis.redis.info();
      
      // Get active rooms count
      const activeRoomsCount = await app.db.client.room.count({
        where: { status: 'active' }
      });

      // Get total participants
      const totalParticipants = await app.db.client.participant.count({
        where: { leftAt: null }
      });

      const systemStatus = {
        timestamp: new Date().toISOString(),
        service: 'live-classes',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        mediasoup: {
          workers: workerStats.length,
          workerStats
        },
        redis: {
          status: app.redis.redis.status,
          info: redisInfo
        },
        database: {
          status: await app.db.healthCheck() ? 'connected' : 'disconnected'
        },
        rooms: {
          active: activeRoomsCount,
          totalParticipants
        }
      };

      return reply.send({
        success: true,
        data: systemStatus
      });
    } catch (error) {
      logger.error('Error getting system status:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get system status'
      });
    }
  });

  // Get all rooms (admin view)
  app.get('/rooms', {
    schema: {
      tags: ['admin'],
      summary: 'Get all rooms (admin view)',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['scheduled', 'active', 'ended'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      }
    },
    preHandler: [requireRole(['admin'])]
  }, async (request: FastifyRequest<{
    Querystring: {
      status?: 'scheduled' | 'active' | 'ended';
      limit?: number;
      offset?: number;
    }
  }>, reply: FastifyReply) => {
    try {
      const { status, limit = 50, offset = 0 } = request.query;
      
      const whereClause: any = {};
      if (status) {
        whereClause.status = status;
      }

      const rooms = await app.db.client.room.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          participants: {
            select: {
              userId: true,
              name: true,
              role: true,
              joinedAt: true,
              leftAt: true
            }
          },
          recordings: {
            select: {
              id: true,
              status: true,
              duration: true,
              fileSize: true
            }
          }
        }
      });

      const total = await app.db.client.room.count({ where: whereClause });

      return reply.send({
        success: true,
        data: {
          rooms,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
          }
        }
      });
    } catch (error) {
      logger.error('Error getting admin rooms:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get rooms'
      });
    }
  });

  // Force end room
  app.post('/rooms/:roomId/force-end', {
    schema: {
      tags: ['admin'],
      summary: 'Force end a room (admin only)',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string' }
        }
      }
    },
    preHandler: [requireRole(['admin'])]
  }, async (request: FastifyRequest<{
    Params: { roomId: string };
    Body: { reason?: string }
  }>, reply: FastifyReply) => {
    try {
      const { roomId } = request.params;
      const { reason } = request.body;

      // Update room status
      const room = await app.db.client.room.update({
        where: { id: roomId },
        data: {
          status: 'ended',
          endedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Log admin action
      await this.trackEvent({
        event: 'admin_force_end_room',
        userId: request.user!.id,
        properties: {
          roomId,
          reason: reason || 'No reason provided',
          originalInstructorId: room.instructorId
        },
        timestamp: new Date()
      });

      logger.warn('Room force-ended by admin:', { 
        roomId, 
        adminId: request.user!.id, 
        reason 
      });

      return reply.send({
        success: true,
        message: 'Room ended successfully'
      });
    } catch (error) {
      logger.error('Error force-ending room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to end room'
      });
    }
  });

  // Get user details
  app.get('/users/:userId', {
    schema: {
      tags: ['admin'],
      summary: 'Get user details (admin only)',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' }
        },
        required: ['userId']
      }
    },
    preHandler: [requireRole(['admin'])]
  }, async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    try {
      const user = await app.db.client.user.findUnique({
        where: { id: request.params.userId },
        include: {
          createdRooms: {
            select: {
              id: true,
              name: true,
              status: true,
              scheduledAt: true,
              participantCount: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          participations: {
            select: {
              roomId: true,
              joinedAt: true,
              leftAt: true,
              room: {
                select: {
                  name: true,
                  status: true
                }
              }
            },
            orderBy: { joinedAt: 'desc' },
            take: 10
          }
        }
      });

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          createdAt: user.createdAt,
          stats: {
            roomsCreated: user.createdRooms.length,
            roomsJoined: user.participations.length
          },
          recentActivity: {
            createdRooms: user.createdRooms,
            joinedRooms: user.participations
          }
        }
      });
    } catch (error) {
      logger.error('Error getting user details:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user details'
      });
    }
  });

  // Update user role/permissions
  app.put('/users/:userId/role', {
    schema: {
      tags: ['admin'],
      summary: 'Update user role and permissions',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' }
        },
        required: ['userId']
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['student', 'instructor', 'admin'] },
          permissions: { type: 'array', items: { type: 'string' } }
        },
        required: ['role']
      }
    },
    preHandler: [requireRole(['admin'])]
  }, async (request: FastifyRequest<{
    Params: { userId: string };
    Body: { role: string; permissions?: string[] }
  }>, reply: FastifyReply) => {
    try {
      const { userId } = request.params;
      const { role, permissions } = request.body;

      const defaultPermissions = {
        student: ['join_room'],
        instructor: ['create_room', 'manage_room', 'join_room'],
        admin: ['create_room', 'manage_room', 'join_room', 'admin_access', 'force_end_room']
      };

      const user = await app.db.client.user.update({
        where: { id: userId },
        data: {
          role,
          permissions: permissions || defaultPermissions[role as keyof typeof defaultPermissions],
          updatedAt: new Date()
        }
      });

      // Log admin action
      await this.trackEvent({
        event: 'admin_update_user_role',
        userId: request.user!.id,
        properties: {
          targetUserId: userId,
          newRole: role,
          newPermissions: permissions || defaultPermissions[role as keyof typeof defaultPermissions]
        },
        timestamp: new Date()
      });

      logger.info('User role updated by admin:', { 
        userId, 
        newRole: role, 
        adminId: request.user!.id 
      });

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions
        },
        message: 'User role updated successfully'
      });
    } catch (error) {
      logger.error('Error updating user role:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user role'
      });
    }
  });

  // Get system metrics
  app.get('/metrics/detailed', {
    schema: {
      tags: ['admin'],
      summary: 'Get detailed system metrics'
    },
    preHandler: [requireRole(['admin'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          platform: process.platform,
          nodeVersion: process.version
        },
        database: {
          isHealthy: await app.db.healthCheck(),
          totalRooms: await app.db.client.room.count(),
          activeRooms: await app.db.client.room.count({ where: { status: 'active' } }),
          totalUsers: await app.db.client.user.count(),
          totalRecordings: await app.db.client.recording.count()
        },
        redis: {
          status: app.redis.redis.status,
          memory: await app.redis.redis.info('memory')
        },
        mediasoup: await app.mediaSoup.getWorkerStats()
      };

      return reply.send({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting detailed metrics:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get system metrics'
      });
    }
  });

  private async trackEvent(event: any): Promise<void> {
    try {
      await app.db.client.analyticsEvent.create({
        data: {
          id: require('uuid').v4(),
          event: event.event,
          userId: event.userId,
          properties: event.properties,
          roomId: event.roomId,
          timestamp: event.timestamp
        }
      });
    } catch (error) {
      logger.error('Error tracking admin event:', error);
    }
  }
}
