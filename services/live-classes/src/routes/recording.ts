import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import { RecordingManager } from '../services/recording-manager.js';
import { metrics } from '../middleware/metrics.js';
import { logger } from '../utils/logger.js';

export async function recordingRoutes(app: FastifyInstance) {
  const recordingManager = new RecordingManager(app.db, app.redis);

  // Start recording
  app.post('/:roomId/start', {
    schema: {
      tags: ['recording'],
      summary: 'Start recording a live class',
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
      const recording = await recordingManager.startRecording(
        request.params.roomId,
        request.user!.id
      );

      if (!recording) {
        return reply.code(400).send({
          error: 'Recording Failed',
          message: 'Unable to start recording. Room may not be active or recording may already be in progress.'
        });
      }

      metrics.recordingStarted.inc();
      logger.info('Recording started:', { roomId: request.params.roomId, recordingId: recording.id });

      return reply.send({
        success: true,
        data: recording,
        message: 'Recording started successfully'
      });
    } catch (error) {
      logger.error('Error starting recording:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to start recording'
      });
    }
  });

  // Stop recording
  app.post('/:roomId/stop', {
    schema: {
      tags: ['recording'],
      summary: 'Stop recording a live class',
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
      const recording = await recordingManager.stopRecording(
        request.params.roomId,
        request.user!.id
      );

      if (!recording) {
        return reply.code(400).send({
          error: 'Recording Failed',
          message: 'No active recording found for this room'
        });
      }

      metrics.recordingStopped.inc();
      logger.info('Recording stopped:', { roomId: request.params.roomId, recordingId: recording.id });

      return reply.send({
        success: true,
        data: recording,
        message: 'Recording stopped successfully'
      });
    } catch (error) {
      logger.error('Error stopping recording:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to stop recording'
      });
    }
  });

  // Get recording status
  app.get('/:roomId/status', {
    schema: {
      tags: ['recording'],
      summary: 'Get recording status for a room',
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
      const recording = await recordingManager.getActiveRecording(request.params.roomId);
      
      return reply.send({
        success: true,
        data: {
          isRecording: !!recording,
          recording: recording || null
        }
      });
    } catch (error) {
      logger.error('Error getting recording status:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get recording status'
      });
    }
  });

  // List recordings for a room
  app.get('/:roomId/list', {
    schema: {
      tags: ['recording'],
      summary: 'List recordings for a room',
      params: {
        type: 'object',
        properties: {
          roomId: { type: 'string', format: 'uuid' }
        },
        required: ['roomId']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest<{
    Params: { roomId: string };
    Querystring: { limit?: number; offset?: number }
  }>, reply: FastifyReply) => {
    try {
      const { limit = 20, offset = 0 } = request.query;
      const recordings = await recordingManager.getRoomRecordings(
        request.params.roomId,
        { limit, offset }
      );

      return reply.send({
        success: true,
        data: recordings
      });
    } catch (error) {
      logger.error('Error listing recordings:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list recordings'
      });
    }
  });

  // Get recording details
  app.get('/details/:recordingId', {
    schema: {
      tags: ['recording'],
      summary: 'Get recording details',
      params: {
        type: 'object',
        properties: {
          recordingId: { type: 'string', format: 'uuid' }
        },
        required: ['recordingId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { recordingId: string } }>, reply: FastifyReply) => {
    try {
      const recording = await recordingManager.getRecording(request.params.recordingId);
      
      if (!recording) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Recording not found'
        });
      }

      return reply.send({
        success: true,
        data: recording
      });
    } catch (error) {
      logger.error('Error getting recording details:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get recording details'
      });
    }
  });

  // Delete recording
  app.delete('/:recordingId', {
    schema: {
      tags: ['recording'],
      summary: 'Delete a recording',
      params: {
        type: 'object',
        properties: {
          recordingId: { type: 'string', format: 'uuid' }
        },
        required: ['recordingId']
      }
    },
    preHandler: [requireRole(['instructor', 'admin'])]
  }, async (request: FastifyRequest<{ Params: { recordingId: string } }>, reply: FastifyReply) => {
    try {
      const success = await recordingManager.deleteRecording(
        request.params.recordingId,
        request.user!.id
      );

      if (!success) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Recording not found or access denied'
        });
      }

      logger.info('Recording deleted:', { recordingId: request.params.recordingId });

      return reply.send({
        success: true,
        message: 'Recording deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting recording:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete recording'
      });
    }
  });

  // Get user's recordings
  app.get('/user/recordings', {
    schema: {
      tags: ['recording'],
      summary: 'Get user recordings',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['recording', 'processing', 'completed', 'failed'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: {
      status?: 'recording' | 'processing' | 'completed' | 'failed';
      limit?: number;
      offset?: number;
    }
  }>, reply: FastifyReply) => {
    try {
      const { status, limit = 20, offset = 0 } = request.query;
      const recordings = await recordingManager.getUserRecordings(
        request.user!.id,
        { status, limit, offset }
      );

      return reply.send({
        success: true,
        data: recordings
      });
    } catch (error) {
      logger.error('Error getting user recordings:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user recordings'
      });
    }
  });
}
