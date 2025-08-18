import { FastifyInstance } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import jwt from 'jsonwebtoken';
import { AppDependencies } from '../app.js';
import { ChatManager } from '../services/chat-manager.js';
import { WhiteboardManager } from '../services/whiteboard-manager.js';
import { metrics } from '../middleware/metrics.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface WebSocketClient {
  id: string;
  userId: string;
  roomId: string;
  socket: SocketStream;
  isAlive: boolean;
  lastPing: Date;
}

export async function setupWebSocketHandlers(app: FastifyInstance, deps: AppDependencies) {
  const clients = new Map<string, WebSocketClient>();
  const chatManager = new ChatManager(deps.database, deps.redis);
  const whiteboardManager = new WhiteboardManager(deps.redis);

  // WebSocket route for room connections
  app.register(async function (fastify) {
    fastify.get('/ws/rooms/:roomId', { websocket: true }, async (connection, request) => {
      const { roomId } = request.params as { roomId: string };
      
      try {
        // Authenticate WebSocket connection
        const token = request.query.token as string;
        if (!token) {
          connection.socket.close(1008, 'Authentication required');
          return;
        }

        const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        const userId = decoded.id;

        // Check if user can access this room
        const room = await deps.database.client.room.findUnique({
          where: { id: roomId },
          include: { participants: true }
        });

        if (!room) {
          connection.socket.close(1008, 'Room not found');
          return;
        }

        const canAccess = room.instructorId === userId || 
                         room.participants.some(p => p.userId === userId);

        if (!canAccess) {
          connection.socket.close(1008, 'Access denied');
          return;
        }

        // Register client
        const clientId = require('uuid').v4();
        const client: WebSocketClient = {
          id: clientId,
          userId,
          roomId,
          socket: connection.socket,
          isAlive: true,
          lastPing: new Date()
        };

        clients.set(clientId, client);
        metrics.incrementConnections();

        logger.info('WebSocket client connected:', { clientId, userId, roomId });

        // Send welcome message
        connection.socket.send(JSON.stringify({
          type: 'connected',
          data: {
            clientId,
            roomId,
            timestamp: new Date().toISOString()
          }
        }));

        // Handle incoming messages
        connection.socket.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            await handleWebSocketMessage(client, data, {
              chatManager,
              whiteboardManager,
              clients,
              deps
            });
          } catch (error) {
            logger.error('Error handling WebSocket message:', error);
            connection.socket.send(JSON.stringify({
              type: 'error',
              data: { message: 'Invalid message format' }
            }));
          }
        });

        // Handle client disconnect
        connection.socket.on('close', () => {
          clients.delete(clientId);
          metrics.decrementConnections();
          logger.info('WebSocket client disconnected:', { clientId, userId, roomId });
        });

        // Ping/pong for connection health
        connection.socket.on('ping', () => {
          client.lastPing = new Date();
          client.isAlive = true;
          connection.socket.pong();
        });

      } catch (error) {
        logger.error('WebSocket connection error:', error);
        connection.socket.close(1011, 'Internal server error');
      }
    });
  });

  // Cleanup dead connections
  setInterval(() => {
    const now = new Date();
    for (const [clientId, client] of clients.entries()) {
      const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
      if (timeSinceLastPing > 60000) { // 60 seconds
        client.socket.close(1001, 'Connection timeout');
        clients.delete(clientId);
        metrics.decrementConnections();
      }
    }
  }, 30000); // Check every 30 seconds
}

async function handleWebSocketMessage(
  client: WebSocketClient,
  message: any,
  context: {
    chatManager: ChatManager;
    whiteboardManager: WhiteboardManager;
    clients: Map<string, WebSocketClient>;
    deps: AppDependencies;
  }
) {
  const { type, data } = message;

  switch (type) {
    case 'ping':
      client.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    case 'chat-message':
      await handleChatMessage(client, data, context);
      break;

    case 'whiteboard-update':
      await handleWhiteboardUpdate(client, data, context);
      break;

    case 'hand-raise':
      await handleHandRaise(client, data, context);
      break;

    case 'media-state-change':
      await handleMediaStateChange(client, data, context);
      break;

    case 'screen-share-start':
      await handleScreenShareStart(client, data, context);
      break;

    case 'screen-share-stop':
      await handleScreenShareStop(client, data, context);
      break;

    default:
      logger.warn('Unknown WebSocket message type:', { type, clientId: client.id });
  }
}

async function handleChatMessage(
  client: WebSocketClient,
  data: any,
  context: { chatManager: ChatManager; clients: Map<string, WebSocketClient> }
) {
  try {
    const chatMessage = await context.chatManager.sendMessage({
      roomId: client.roomId,
      userId: client.userId,
      message: data.message,
      type: data.type || 'text',
      metadata: data.metadata
    });

    // Broadcast to all clients in the room
    broadcastToRoom(client.roomId, {
      type: 'chat-message',
      data: chatMessage
    }, context.clients);

    metrics.chatMessagesSent.inc();
  } catch (error) {
    logger.error('Error handling chat message:', error);
    client.socket.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to send chat message' }
    }));
  }
}

async function handleWhiteboardUpdate(
  client: WebSocketClient,
  data: any,
  context: { whiteboardManager: WhiteboardManager; clients: Map<string, WebSocketClient> }
) {
  try {
    await context.whiteboardManager.updateWhiteboard(
      client.roomId,
      client.userId,
      data.elements,
      data.version
    );

    // Broadcast to all other clients in the room
    broadcastToRoom(client.roomId, {
      type: 'whiteboard-update',
      data: {
        elements: data.elements,
        version: data.version,
        updatedBy: client.userId,
        timestamp: new Date().toISOString()
      }
    }, context.clients, client.id);
  } catch (error) {
    logger.error('Error handling whiteboard update:', error);
  }
}

async function handleHandRaise(
  client: WebSocketClient,
  data: any,
  context: { clients: Map<string, WebSocketClient> }
) {
  try {
    const { isRaised } = data;

    // Broadcast to all clients in the room
    broadcastToRoom(client.roomId, {
      type: 'hand-raise',
      data: {
        userId: client.userId,
        isRaised,
        timestamp: new Date().toISOString()
      }
    }, context.clients);

    logger.info('Hand raise event:', { 
      userId: client.userId, 
      roomId: client.roomId, 
      isRaised 
    });
  } catch (error) {
    logger.error('Error handling hand raise:', error);
  }
}

async function handleMediaStateChange(
  client: WebSocketClient,
  data: any,
  context: { clients: Map<string, WebSocketClient> }
) {
  try {
    const { type: mediaType, enabled } = data; // 'audio' or 'video'

    // Broadcast to all other clients in the room
    broadcastToRoom(client.roomId, {
      type: 'media-state-change',
      data: {
        userId: client.userId,
        mediaType,
        enabled,
        timestamp: new Date().toISOString()
      }
    }, context.clients, client.id);

    logger.info('Media state change:', { 
      userId: client.userId, 
      roomId: client.roomId, 
      mediaType, 
      enabled 
    });
  } catch (error) {
    logger.error('Error handling media state change:', error);
  }
}

async function handleScreenShareStart(
  client: WebSocketClient,
  data: any,
  context: { clients: Map<string, WebSocketClient> }
) {
  try {
    // Broadcast to all other clients in the room
    broadcastToRoom(client.roomId, {
      type: 'screen-share-start',
      data: {
        userId: client.userId,
        timestamp: new Date().toISOString()
      }
    }, context.clients, client.id);

    logger.info('Screen share started:', { 
      userId: client.userId, 
      roomId: client.roomId 
    });
  } catch (error) {
    logger.error('Error handling screen share start:', error);
  }
}

async function handleScreenShareStop(
  client: WebSocketClient,
  data: any,
  context: { clients: Map<string, WebSocketClient> }
) {
  try {
    // Broadcast to all other clients in the room
    broadcastToRoom(client.roomId, {
      type: 'screen-share-stop',
      data: {
        userId: client.userId,
        timestamp: new Date().toISOString()
      }
    }, context.clients, client.id);

    logger.info('Screen share stopped:', { 
      userId: client.userId, 
      roomId: client.roomId 
    });
  } catch (error) {
    logger.error('Error handling screen share stop:', error);
  }
}

function broadcastToRoom(
  roomId: string,
  message: any,
  clients: Map<string, WebSocketClient>,
  excludeClientId?: string
) {
  const messageStr = JSON.stringify(message);
  
  for (const client of clients.values()) {
    if (client.roomId === roomId && client.id !== excludeClientId) {
      try {
        client.socket.send(messageStr);
      } catch (error) {
        logger.error('Error broadcasting to client:', { clientId: client.id, error });
      }
    }
  }
}
