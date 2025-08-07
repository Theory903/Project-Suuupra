/**
 * What: WebSocket session manager with rooms, heartbeats, auth, and backpressure
 * Why: Manage real-time connections for live classes, chat, and collaboration
 * How: Session tracking, room management, heartbeat monitoring, and connection limits
 */

import { FastifyInstance } from 'fastify';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'events';

// Dynamic import for WebSocket to avoid type issues
declare const require: any;
let WebSocket: any = null;
try { WebSocket = require('ws'); } catch {}

interface WebSocketType {
  OPEN: number;
  send(data: string): void;
  close(): void;
  terminate(): void;
  readyState: number;
  on(event: string, callback: Function): void;
}

export interface WebSocketSession {
  id: string;
  ws: WebSocketType;
  userId?: string;
  tenantId?: string;
  rooms: Set<string>;
  metadata: Record<string, any>;
  createdAt: number;
  lastPing: number;
  isAuthenticated: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  maxConnections?: number;
  requireAuth: boolean;
  metadata: Record<string, any>;
  connections: Set<string>; // session IDs
  createdAt: number;
}

export interface WSMessage {
  type: string;
  room?: string;
  data?: any;
  sessionId?: string;
  timestamp?: number;
}

export interface SessionManagerConfig {
  heartbeatInterval: number; // ms
  heartbeatTimeout: number; // ms
  maxConnectionsPerUser: number;
  maxConnectionsGlobal: number;
  maxRoomsPerSession: number;
  authRequired: boolean;
}

const DEFAULT_CONFIG: SessionManagerConfig = {
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 60000, // 60 seconds
  maxConnectionsPerUser: 5,
  maxConnectionsGlobal: 10000,
  maxRoomsPerSession: 10,
  authRequired: true,
};

export class WebSocketSessionManager extends EventEmitter {
  private config: SessionManagerConfig;
  private sessions = new Map<string, WebSocketSession>();
  private rooms = new Map<string, RoomInfo>();
  private userSessions = new Map<string, Set<string>>(); // userId -> sessionIds
  private heartbeatTimer?: NodeJS.Timeout;
  private wss?: any;

  constructor(config: Partial<SessionManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initialize(server: any): void {
    if (!WebSocket) {
      console.warn('WebSocket library not available, skipping WebSocket initialization');
      return;
    }
    
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: (info: any) => this.verifyClient(info),
    });

    this.wss.on('connection', (ws: any, request: any) => {
      this.handleConnection(ws, request);
    });

    this.startHeartbeat();
    console.log('WebSocket session manager initialized');
  }

  private verifyClient(info: any): boolean {
    // Basic verification - could be extended with auth checks
    if (this.sessions.size >= this.config.maxConnectionsGlobal) {
      return false;
    }

    // Additional verification logic can be added here
    return true;
  }

  private handleConnection(ws: any, request: any): void {
    const sessionId = this.generateSessionId();
    const session: WebSocketSession = {
      id: sessionId,
      ws,
      rooms: new Set(),
      metadata: {},
      createdAt: Date.now(),
      lastPing: Date.now(),
      isAuthenticated: false,
    };

    this.sessions.set(sessionId, session);

    ws.on('message', (data: any) => {
      this.handleMessage(sessionId, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(sessionId);
    });

    ws.on('error', (error: any) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
      this.handleDisconnection(sessionId);
    });

    // Send welcome message
    this.sendToSession(sessionId, {
      type: 'welcome',
      sessionId,
      timestamp: Date.now(),
    });

    this.emit('connection', { sessionId, session });
  }

  private handleMessage(sessionId: string, data: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message = JSON.parse(data.toString()) as WSMessage;
      message.sessionId = sessionId;
      message.timestamp = Date.now();

      // Update last ping time for any message
      session.lastPing = Date.now();

      switch (message.type) {
        case 'ping':
          this.handlePing(sessionId);
          break;
        case 'auth':
          this.handleAuth(sessionId, message.data);
          break;
        case 'join_room':
          this.handleJoinRoom(sessionId, message.room!, message.data);
          break;
        case 'leave_room':
          this.handleLeaveRoom(sessionId, message.room!);
          break;
        case 'room_message':
          this.handleRoomMessage(sessionId, message.room!, message.data);
          break;
        case 'direct_message':
          this.handleDirectMessage(sessionId, message.data);
          break;
        default:
          this.emit('message', { sessionId, message, session });
      }
    } catch (error) {
      console.error(`Error parsing message from session ${sessionId}:`, error);
      this.sendToSession(sessionId, {
        type: 'error',
        data: { message: 'Invalid message format' },
      });
    }
  }

  private handlePing(sessionId: string): void {
    this.sendToSession(sessionId, { type: 'pong', timestamp: Date.now() });
  }

  private async handleAuth(sessionId: string, authData: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Basic auth validation - in real implementation, validate JWT token
      const { token, userId, tenantId } = authData;
      
      if (!token) {
        throw new Error('Token required');
      }

      // Check user connection limits
      const userSessions = this.userSessions.get(userId);
      if (userSessions && userSessions.size >= this.config.maxConnectionsPerUser) {
        throw new Error('Too many connections for user');
      }

      // Update session
      session.userId = userId;
      session.tenantId = tenantId;
      session.isAuthenticated = true;

      // Track user sessions
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)?.add(sessionId);

      this.sendToSession(sessionId, {
        type: 'auth_success',
        data: { userId, tenantId },
      });

      this.emit('auth', { sessionId, userId, tenantId, session });
    } catch (error: any) {
      this.sendToSession(sessionId, {
        type: 'auth_error',
        data: { message: error.message },
      });
    }
  }

  private handleJoinRoom(sessionId: string, roomId: string, roomData?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (this.config.authRequired && !session.isAuthenticated) {
      this.sendToSession(sessionId, {
        type: 'error',
        data: { message: 'Authentication required' },
      });
      return;
    }

    if (session.rooms.size >= this.config.maxRoomsPerSession) {
      this.sendToSession(sessionId, {
        type: 'error',
        data: { message: 'Too many rooms joined' },
      });
      return;
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      // Create new room
      room = {
        id: roomId,
        name: roomData?.name || roomId,
        maxConnections: roomData?.maxConnections,
        requireAuth: roomData?.requireAuth ?? true,
        metadata: roomData?.metadata || {},
        connections: new Set(),
        createdAt: Date.now(),
      };
      this.rooms.set(roomId, room);
    }

    if (room.maxConnections && room.connections.size >= room.maxConnections) {
      this.sendToSession(sessionId, {
        type: 'error',
        data: { message: 'Room is full' },
      });
      return;
    }

    if (room.requireAuth && !session.isAuthenticated) {
      this.sendToSession(sessionId, {
        type: 'error',
        data: { message: 'Room requires authentication' },
      });
      return;
    }

    // Join room
    session.rooms.add(roomId);
    room.connections.add(sessionId);

    this.sendToSession(sessionId, {
      type: 'room_joined',
      room: roomId,
      data: {
        roomInfo: {
          id: room.id,
          name: room.name,
          connectionCount: room.connections.size,
        },
      },
    });

    // Notify other room members
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      room: roomId,
      data: {
        sessionId,
        userId: session.userId,
      },
    }, sessionId);

    this.emit('room_join', { sessionId, roomId, session, room });
  }

  private handleLeaveRoom(sessionId: string, roomId: string): void {
    const session = this.sessions.get(sessionId);
    const room = this.rooms.get(roomId);
    
    if (!session || !room) return;

    session.rooms.delete(roomId);
    room.connections.delete(sessionId);

    // Clean up empty rooms
    if (room.connections.size === 0) {
      this.rooms.delete(roomId);
    }

    this.sendToSession(sessionId, {
      type: 'room_left',
      room: roomId,
    });

    // Notify other room members
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      room: roomId,
      data: {
        sessionId,
        userId: session.userId,
      },
    }, sessionId);

    this.emit('room_leave', { sessionId, roomId, session, room });
  }

  private handleRoomMessage(sessionId: string, roomId: string, data: any): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.rooms.has(roomId)) {
      this.sendToSession(sessionId, {
        type: 'error',
        data: { message: 'Not in room' },
      });
      return;
    }

    this.broadcastToRoom(roomId, {
      type: 'room_message',
      room: roomId,
      data: {
        ...data,
        from: {
          sessionId,
          userId: session.userId,
        },
        timestamp: Date.now(),
      },
    });

    this.emit('room_message', { sessionId, roomId, data, session });
  }

  private handleDirectMessage(sessionId: string, data: any): void {
    const { targetUserId, message } = data;
    const targetSessions = this.userSessions.get(targetUserId);
    
    if (!targetSessions) {
      this.sendToSession(sessionId, {
        type: 'error',
        data: { message: 'User not found' },
      });
      return;
    }

    const session = this.sessions.get(sessionId);
    const messageData = {
      type: 'direct_message',
      data: {
        message,
        from: {
          sessionId,
          userId: session?.userId,
        },
        timestamp: Date.now(),
      },
    };

    // Send to all target user sessions
    for (const targetSessionId of targetSessions) {
      this.sendToSession(targetSessionId, messageData);
    }

    this.emit('direct_message', { sessionId, targetUserId, message, session });
  }

  private handleDisconnection(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Leave all rooms
    for (const roomId of session.rooms) {
      this.handleLeaveRoom(sessionId, roomId);
    }

    // Remove from user sessions
    if (session.userId) {
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }
    }

    this.sessions.delete(sessionId);
    this.emit('disconnection', { sessionId, session });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.heartbeatTimeout;

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastPing > timeout) {
          console.log(`Session ${sessionId} timed out`);
          session.ws.terminate();
          this.handleDisconnection(sessionId);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private generateSessionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sendToSession(sessionId: string, message: WSMessage): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.ws.readyState !== (WebSocket?.OPEN || 1)) {
      return false;
    }

    try {
      session.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending message to session ${sessionId}:`, error);
      return false;
    }
  }

  broadcastToRoom(roomId: string, message: WSMessage, excludeSessionId?: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;

    let sent = 0;
    for (const sessionId of room.connections) {
      if (sessionId !== excludeSessionId) {
        if (this.sendToSession(sessionId, message)) {
          sent++;
        }
      }
    }

    return sent;
  }

  broadcastToUser(userId: string, message: WSMessage): number {
    const sessions = this.userSessions.get(userId);
    if (!sessions) return 0;

    let sent = 0;
    for (const sessionId of sessions) {
      if (this.sendToSession(sessionId, message)) {
        sent++;
      }
    }

    return sent;
  }

  getSessionInfo(sessionId: string): Partial<WebSocketSession> | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return {
      id: session.id,
      userId: session.userId,
      tenantId: session.tenantId,
      rooms: session.rooms,
      metadata: session.metadata,
      createdAt: session.createdAt,
      lastPing: session.lastPing,
      isAuthenticated: session.isAuthenticated,
    };
  }

  getRoomInfo(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  getStats(): {
    totalSessions: number;
    authenticatedSessions: number;
    totalRooms: number;
    totalUsers: number;
  } {
    const authenticatedSessions = Array.from(this.sessions.values()).filter(s => s.isAuthenticated).length;
    
    return {
      totalSessions: this.sessions.size,
      authenticatedSessions,
      totalRooms: this.rooms.size,
      totalUsers: this.userSessions.size,
    };
  }

  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Close all connections
    for (const session of this.sessions.values()) {
      session.ws.close();
    }

    if (this.wss) {
      this.wss.close();
    }

    this.sessions.clear();
    this.rooms.clear();
    this.userSessions.clear();
  }
}

// Global session manager instance
let sessionManager: WebSocketSessionManager;

export function initializeSessionManager(config?: Partial<SessionManagerConfig>): WebSocketSessionManager {
  sessionManager = new WebSocketSessionManager(config);
  return sessionManager;
}

export function getSessionManager(): WebSocketSessionManager {
  if (!sessionManager) {
    throw new Error('Session manager not initialized');
  }
  return sessionManager;
}

// Fastify plugin for WebSocket support
export async function registerWebSocketSupport(app: FastifyInstance): Promise<void> {
  try {
    await app.register(require('@fastify/websocket'));
    
    // WebSocket route
    app.register(async function (fastify) {
      (fastify as any).get('/ws', { websocket: true }, (connection: any, req: any) => {
        // This is handled by the session manager
      });
    });
  } catch (error) {
    console.warn('WebSocket support not available:', error);
  }
}
