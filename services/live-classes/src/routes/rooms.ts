import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { requireRole, requirePermission } from '../middleware/auth.js';
import { RoomManager } from '../services/room-manager.js';
import { metrics } from '../middleware/metrics.js';
import { logger } from '../utils/logger.js';

const createRoomSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().max(500),
  scheduledAt: Joi.date().iso().required(),
  maxParticipants: Joi.number().min(1).max(1000).default(100),
  settings: Joi.object({
    allowChat: Joi.boolean().default(true),
    allowScreenShare: Joi.boolean().default(true),
    allowWhiteboard: Joi.boolean().default(true),
    allowBreakoutRooms: Joi.boolean().default(false),
    muteParticipantsOnJoin: Joi.boolean().default(false),
    requireApprovalToJoin: Joi.boolean().default(false),
    recordingEnabled: Joi.boolean().default(false)
  }).default({})
});

const updateRoomSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  description: Joi.string().max(500),
  scheduledAt: Joi.date().iso(),
  maxParticipants: Joi.number().min(1).max(1000),
  settings: Joi.object({
    allowChat: Joi.boolean(),
    allowScreenShare: Joi.boolean(),
    allowWhiteboard: Joi.boolean(),
    allowBreakoutRooms: Joi.boolean(),
    muteParticipantsOnJoin: Joi.boolean(),
    requireApprovalToJoin: Joi.boolean(),
    recordingEnabled: Joi.boolean()
  })
});

export async function roomRoutes(app: FastifyInstance) {
  const roomManager = new RoomManager(app.db, app.redis, app.mediaSoup);

  // Create a new room
  app.post('/create', {
    schema: {
      tags: ['rooms'],
      summary: 'Create a new live class room',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          scheduledAt: { type: 'string', format: 'date-time' },
          maxParticipants: { type: 'number' },
          settings: {
            type: 'object',
            properties: {
              allowChat: { type: 'boolean' },
              allowScreenShare: { type: 'boolean' },
              allowWhiteboard: { type: 'boolean' },
              allowBreakoutRooms: { type: 'boolean' },
              muteParticipantsOnJoin: { type: 'boolean' },
              requireApprovalToJoin: { type: 'boolean' },
              recordingEnabled: { type: 'boolean' }
            }
          }
        },
        required: ['name', 'scheduledAt']
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { error, value } = createRoomSchema.validate(request.body);
      if (error) {
        return reply.code(400).send({
          error: 'Validation Error',
          details: error.details
        });
      }

      const room = await roomManager.createRoom({
        ...value,
        instructorId: request.user!.id
      });

      metrics.recordRoomCreated.inc();
      logger.info('Room created:', { roomId: room.id, instructorId: request.user!.id });

      return reply.code(201).send({
        success: true,
        data: room
      });
    } catch (error) {
      logger.error('Error creating room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create room'
      });
    }
  });

  // Get room details
  app.get('/:roomId', {
    schema: {
      tags: ['rooms'],
      summary: 'Get room details',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      const room = await roomManager.getRoom(request.params.roomId);
      if (!room) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room not found'
        });
      }

      return reply.send({
        success: true,
        data: room
      });
    } catch (error) {
      logger.error('Error getting room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get room'
      });
    }
  });

  // Update room
  app.put('/:roomId', {
    schema: {
      tags: ['rooms'],
      summary: 'Update room details',
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
      const { error, value } = updateRoomSchema.validate(request.body);
      if (error) {
        return reply.code(400).send({
          error: 'Validation Error',
          details: error.details
        });
      }

      const room = await roomManager.updateRoom(request.params.roomId, value, request.user!.id);
      if (!room) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room not found or access denied'
        });
      }

      return reply.send({
        success: true,
        data: room
      });
    } catch (error) {
      logger.error('Error updating room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update room'
      });
    }
  });

  // Start room (go live)
  app.post('/:roomId/start', {
    schema: {
      tags: ['rooms'],
      summary: 'Start a live class room',
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
      const room = await roomManager.startRoom(request.params.roomId, request.user!.id);
      if (!room) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room not found or access denied'
        });
      }

      return reply.send({
        success: true,
        data: room,
        message: 'Room started successfully'
      });
    } catch (error) {
      logger.error('Error starting room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to start room'
      });
    }
  });

  // End room
  app.post('/:roomId/end', {
    schema: {
      tags: ['rooms'],
      summary: 'End a live class room',
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
      const room = await roomManager.endRoom(request.params.roomId, request.user!.id);
      if (!room) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room not found or access denied'
        });
      }

      metrics.recordRoomEnded.inc();

      return reply.send({
        success: true,
        data: room,
        message: 'Room ended successfully'
      });
    } catch (error) {
      logger.error('Error ending room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to end room'
      });
    }
  });

  // Join room
  app.post('/:roomId/join', {
    schema: {
      tags: ['rooms'],
      summary: 'Join a live class room',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      const result = await roomManager.joinRoom(request.params.roomId, request.user!);
      if (!result.success) {
        return reply.code(400).send({
          error: 'Join Failed',
          message: result.message
        });
      }

      metrics.recordParticipantJoined.inc();

      return reply.send({
        success: true,
        data: result.data,
        message: 'Joined room successfully'
      });
    } catch (error) {
      logger.error('Error joining room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to join room'
      });
    }
  });

  // Leave room
  app.post('/:roomId/leave', {
    schema: {
      tags: ['rooms'],
      summary: 'Leave a live class room',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      await roomManager.leaveRoom(request.params.roomId, request.user!.id);
      metrics.recordParticipantLeft.inc();

      return reply.send({
        success: true,
        message: 'Left room successfully'
      });
    } catch (error) {
      logger.error('Error leaving room:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to leave room'
      });
    }
  });

  // Get room participants
  app.get('/:roomId/participants', {
    schema: {
      tags: ['rooms'],
      summary: 'Get room participants',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      const participants = await roomManager.getRoomParticipants(request.params.roomId);
      
      return reply.send({
        success: true,
        data: participants
      });
    } catch (error) {
      logger.error('Error getting participants:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get participants'
      });
    }
  });

  // Get user's rooms
  app.get('/user/rooms', {
    schema: {
      tags: ['rooms'],
      summary: 'Get user rooms',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['scheduled', 'active', 'ended'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { 
      status?: 'scheduled' | 'active' | 'ended';
      limit?: number;
      offset?: number;
    } 
  }>, reply: FastifyReply) => {
    try {
      const { status, limit = 20, offset = 0 } = request.query;
      const rooms = await roomManager.getUserRooms(request.user!.id, { status, limit, offset });
      
      return reply.send({
        success: true,
        data: rooms
      });
    } catch (error) {
      logger.error('Error getting user rooms:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user rooms'
      });
    }
  });

  // Get WebRTC transport parameters
  app.post('/:roomId/webrtc/transport', {
    schema: {
      tags: ['rooms'],
      summary: 'Create WebRTC transport for room',
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
          type: { type: 'string', enum: ['producer', 'consumer'] }
        },
        required: ['type']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { roomId: string };
    Body: { type: 'producer' | 'consumer' }
  }>, reply: FastifyReply) => {
    try {
      const { roomId } = request.params;
      const { type } = request.body;
      
      const transportParams = await roomManager.createWebRtcTransport(
        roomId, 
        request.user!.id, 
        type
      );

      if (!transportParams) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room not found or user not in room'
        });
      }

      return reply.send({
        success: true,
        data: transportParams
      });
    } catch (error) {
      logger.error('Error creating WebRTC transport:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create WebRTC transport'
      });
    }
  });

  // Connect WebRTC transport
  app.post('/:roomId/webrtc/transport/connect', {
    schema: {
      tags: ['rooms'],
      summary: 'Connect WebRTC transport',
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
          transportId: { type: 'string' },
          dtlsParameters: { type: 'object' }
        },
        required: ['transportId', 'dtlsParameters']
      }
    }
  }, async (request: FastifyRequest<{
    Params: { roomId: string };
    Body: { transportId: string; dtlsParameters: any }
  }>, reply: FastifyReply) => {
    try {
      const { roomId } = request.params;
      const { transportId, dtlsParameters } = request.body;
      
      await roomManager.connectWebRtcTransport(
        roomId,
        request.user!.id,
        transportId,
        dtlsParameters
      );

      metrics.webrtcConnectionsEstablished.inc();

      return reply.send({
        success: true,
        message: 'Transport connected successfully'
      });
    } catch (error) {
      logger.error('Error connecting WebRTC transport:', error);
      metrics.webrtcConnectionsFailed.inc();
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to connect transport'
      });
    }
  });

  // Create producer (send media)
  app.post('/:roomId/webrtc/produce', {
    schema: {
      tags: ['rooms'],
      summary: 'Create media producer',
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
          transportId: { type: 'string' },
          kind: { type: 'string', enum: ['audio', 'video'] },
          rtpParameters: { type: 'object' }
        },
        required: ['transportId', 'kind', 'rtpParameters']
      }
    }
  }, async (request: FastifyRequest<{
    Params: { roomId: string };
    Body: { transportId: string; kind: 'audio' | 'video'; rtpParameters: any }
  }>, reply: FastifyReply) => {
    try {
      const { roomId } = request.params;
      const { transportId, kind, rtpParameters } = request.body;
      
      const producer = await roomManager.createProducer(
        roomId,
        request.user!.id,
        transportId,
        kind,
        rtpParameters
      );

      if (!producer) {
        return reply.code(400).send({
          error: 'Producer Creation Failed',
          message: 'Failed to create media producer'
        });
      }

      return reply.send({
        success: true,
        data: { producerId: producer.id }
      });
    } catch (error) {
      logger.error('Error creating producer:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create producer'
      });
    }
  });

  // Create consumer (receive media)
  app.post('/:roomId/webrtc/consume', {
    schema: {
      tags: ['rooms'],
      summary: 'Create media consumer',
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
          transportId: { type: 'string' },
          producerId: { type: 'string' },
          rtpCapabilities: { type: 'object' }
        },
        required: ['transportId', 'producerId', 'rtpCapabilities']
      }
    }
  }, async (request: FastifyRequest<{
    Params: { roomId: string };
    Body: { transportId: string; producerId: string; rtpCapabilities: any }
  }>, reply: FastifyReply) => {
    try {
      const { roomId } = request.params;
      const { transportId, producerId, rtpCapabilities } = request.body;
      
      const consumer = await roomManager.createConsumer(
        roomId,
        request.user!.id,
        transportId,
        producerId,
        rtpCapabilities
      );

      if (!consumer) {
        return reply.code(400).send({
          error: 'Consumer Creation Failed',
          message: 'Failed to create media consumer'
        });
      }

      return reply.send({
        success: true,
        data: {
          consumerId: consumer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        }
      });
    } catch (error) {
      logger.error('Error creating consumer:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create consumer'
      });
    }
  });

  // Get router RTP capabilities
  app.get('/:roomId/webrtc/capabilities', {
    schema: {
      tags: ['rooms'],
      summary: 'Get router RTP capabilities',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { roomId: string } }>, reply: FastifyReply) => {
    try {
      const capabilities = await roomManager.getRouterCapabilities(request.params.roomId);
      if (!capabilities) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Room not found'
        });
      }

      return reply.send({
        success: true,
        data: capabilities
      });
    } catch (error) {
      logger.error('Error getting router capabilities:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get router capabilities'
      });
    }
  });

  // List rooms
  app.get('/', {
    schema: {
      tags: ['rooms'],
      summary: 'List rooms',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['scheduled', 'active', 'ended'] },
          instructorId: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest<{
    Querystring: {
      status?: 'scheduled' | 'active' | 'ended';
      instructorId?: string;
      limit?: number;
      offset?: number;
    }
  }>, reply: FastifyReply) => {
    try {
      const { status, instructorId, limit = 20, offset = 0 } = request.query;
      const rooms = await roomManager.listRooms({ status, instructorId, limit, offset });
      
      return reply.send({
        success: true,
        data: rooms
      });
    } catch (error) {
      logger.error('Error listing rooms:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list rooms'
      });
    }
  });
}
