import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger, ContextLogger } from '@/utils/logger';
import { UploadSession } from '@/models/UploadSession';
import { AuthUser } from '@/types';
import { Content } from '@/models/Content';

export interface SocketUser extends AuthUser {
  socketId: string;
}

export interface UploadProgressData {
  uploadId: string;
  contentId: string;
  filename: string;
  totalSize: number;
  uploadedSize: number;
  percentage: number;
  status: string;
  partsCompleted: number;
  totalParts: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private contextLogger: ContextLogger;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>
  private socketUsers = new Map<string, SocketUser>(); // socketId -> SocketUser
  private uploadSessions = new Map<string, Set<string>>(); // uploadId -> Set<socketId>

  constructor(server: HTTPServer) {
    this.contextLogger = new ContextLogger({ service: 'websocket' });
    
    // Initialize Socket.IO server
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.service.cors.origin,
        credentials: config.service.cors.credentials
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      allowEIO3: true
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  // Setup authentication middleware
  private setupMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify JWT token (simplified - in production use proper JWKS verification)
        const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        
        const user: SocketUser = {
          socketId: socket.id,
          requestId: this.generateRequestId(),
          userId: decoded.sub,
          tenantId: decoded.tenant_id || decoded.tid,
          roles: decoded.roles || [],
          permissions: decoded.permissions || decoded.perms || [],
          clientId: decoded.client_id || decoded.azp,
          sessionId: decoded.sid
        };

        // Validate required fields
        if (!user.userId || !user.tenantId) {
          return next(new Error('Invalid token'));
        }

        // Store user info
        socket.data.user = user;
        this.socketUsers.set(socket.id, user);

        this.contextLogger.debug('WebSocket user authenticated', {
          socketId: socket.id,
          userId: user.userId,
          tenantId: user.tenantId
        });

        next();
      } catch (error) {
        this.contextLogger.warn('WebSocket authentication failed', {
          socketId: socket.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  // Setup event handlers
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user as SocketUser;
      
      this.contextLogger.info('WebSocket client connected', {
        socketId: socket.id,
        userId: user.userId,
        tenantId: user.tenantId
      });

      // Add to connected users
      if (!this.connectedUsers.has(user.userId)) {
        this.connectedUsers.set(user.userId, new Set());
      }
      this.connectedUsers.get(user.userId)!.add(socket.id);

      // Join tenant room
      socket.join(`tenant:${user.tenantId}`);
      socket.join(`user:${user.userId}`);

      // Handle upload subscription
      socket.on('subscribe:upload', (uploadId: string) => {
        this.handleUploadSubscription(socket, uploadId);
      });

      // Handle upload unsubscription
      socket.on('unsubscribe:upload', (uploadId: string) => {
        this.handleUploadUnsubscription(socket, uploadId);
      });

      // Handle upload progress update (from client)
      socket.on('upload:progress', (data: any) => {
        this.handleUploadProgressUpdate(socket, data);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle errors
      socket.on('error', (error) => {
        this.contextLogger.error('WebSocket error', error, {
          socketId: socket.id,
          userId: user.userId
        });
      });

      // Send welcome message
      socket.emit('connected', {
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Handle upload subscription
  private async handleUploadSubscription(socket: Socket, uploadId: string): Promise<void> {
    try {
      const user = socket.data.user as SocketUser;
      
      this.contextLogger.debug('Client subscribing to upload', {
        socketId: socket.id,
        userId: user.userId,
        uploadId
      });

      // Verify user has access to this upload
      const uploadSession = await UploadSession.findById(uploadId);
      if (!uploadSession) {
        socket.emit('error', { message: 'Upload session not found', uploadId });
        return;
      }

      // Check if user has access (owner or admin/moderator)
      const hasAccess = await this.verifyUploadAccess(uploadSession.contentId, user);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied', uploadId });
        return;
      }

      // Add to upload subscription
      if (!this.uploadSessions.has(uploadId)) {
        this.uploadSessions.set(uploadId, new Set());
      }
      this.uploadSessions.get(uploadId)!.add(socket.id);

      // Join upload room
      socket.join(`upload:${uploadId}`);

      // Send current upload status
      const progressData = this.formatUploadProgress(uploadSession);
      socket.emit('upload:status', progressData);

      this.contextLogger.debug('Client subscribed to upload', {
        socketId: socket.id,
        uploadId
      });

    } catch (error) {
      this.contextLogger.error('Failed to handle upload subscription', error as Error, {
        socketId: socket.id,
        uploadId
      });
      
      socket.emit('error', { 
        message: 'Failed to subscribe to upload', 
        uploadId 
      });
    }
  }

  // Handle upload unsubscription
  private handleUploadUnsubscription(socket: Socket, uploadId: string): void {
    try {
      this.contextLogger.debug('Client unsubscribing from upload', {
        socketId: socket.id,
        uploadId
      });

      // Remove from upload subscription
      if (this.uploadSessions.has(uploadId)) {
        this.uploadSessions.get(uploadId)!.delete(socket.id);
        
        // Clean up empty sets
        if (this.uploadSessions.get(uploadId)!.size === 0) {
          this.uploadSessions.delete(uploadId);
        }
      }

      // Leave upload room
      socket.leave(`upload:${uploadId}`);

      socket.emit('unsubscribed', { uploadId });

    } catch (error) {
      this.contextLogger.error('Failed to handle upload unsubscription', error as Error, {
        socketId: socket.id,
        uploadId
      });
    }
  }

  // Handle upload progress update from client
  private async handleUploadProgressUpdate(socket: Socket, data: any): Promise<void> {
    try {
      const { uploadId, partNumber, etag, size } = data;
      
      if (!uploadId || !partNumber || !etag || !size) {
        socket.emit('error', { message: 'Invalid progress data' });
        return;
      }

      // Update upload session in database
      const uploadSession = await UploadSession.findById(uploadId);
      if (!uploadSession) {
        socket.emit('error', { message: 'Upload session not found', uploadId });
        return;
      }

      // Update part completion
      uploadSession.markPartComplete(partNumber, etag, size);
      await uploadSession.save();

      // Broadcast progress to all subscribers
      const progressData = this.formatUploadProgress(uploadSession);
      this.broadcastUploadProgress(uploadId, progressData);

      this.contextLogger.debug('Upload progress updated', {
        uploadId,
        partNumber,
        progress: progressData.percentage
      });

    } catch (error) {
      this.contextLogger.error('Failed to handle upload progress update', error as Error, {
        socketId: socket.id,
        uploadId: data?.uploadId
      });
      
      socket.emit('error', { 
        message: 'Failed to update upload progress' 
      });
    }
  }

  // Handle client disconnection
  private handleDisconnection(socket: Socket, reason: string): void {
    const user = socket.data.user as SocketUser;
    
    this.contextLogger.info('WebSocket client disconnected', {
      socketId: socket.id,
      userId: user?.userId,
      reason
    });

    if (user) {
      // Remove from connected users
      if (this.connectedUsers.has(user.userId)) {
        this.connectedUsers.get(user.userId)!.delete(socket.id);
        
        // Clean up empty sets
        if (this.connectedUsers.get(user.userId)!.size === 0) {
          this.connectedUsers.delete(user.userId);
        }
      }

      // Remove from socket users
      this.socketUsers.delete(socket.id);

      // Clean up upload subscriptions
      for (const [uploadId, socketIds] of this.uploadSessions.entries()) {
        if (socketIds.has(socket.id)) {
          socketIds.delete(socket.id);
          
          // Clean up empty sets
          if (socketIds.size === 0) {
            this.uploadSessions.delete(uploadId);
          }
        }
      }
    }
  }

  // Broadcast upload progress to subscribers
  public async broadcastUploadProgress(uploadId: string, progressData?: UploadProgressData): Promise<void> {
    try {
      // Get progress data if not provided
      if (!progressData) {
        const uploadSession = await UploadSession.findById(uploadId);
        if (!uploadSession) {
          return;
        }
        progressData = this.formatUploadProgress(uploadSession);
      }

      // Broadcast to upload room
      this.io.to(`upload:${uploadId}`).emit('upload:progress', progressData);

      this.contextLogger.debug('Upload progress broadcasted', {
        uploadId,
        percentage: progressData.percentage,
        subscriberCount: this.uploadSessions.get(uploadId)?.size || 0
      });

    } catch (error) {
      this.contextLogger.error('Failed to broadcast upload progress', error as Error, {
        uploadId
      });
    }
  }

  // Broadcast upload completion
  public async broadcastUploadComplete(uploadId: string, result: any): Promise<void> {
    try {
      const uploadSession = await UploadSession.findById(uploadId);
      if (!uploadSession) {
        return;
      }

      const progressData = this.formatUploadProgress(uploadSession);
      progressData.status = 'completed';

      // Broadcast to upload room
      this.io.to(`upload:${uploadId}`).emit('upload:complete', {
        ...progressData,
        result
      });

      this.contextLogger.info('Upload completion broadcasted', {
        uploadId,
        subscriberCount: this.uploadSessions.get(uploadId)?.size || 0
      });

    } catch (error) {
      this.contextLogger.error('Failed to broadcast upload completion', error as Error, {
        uploadId
      });
    }
  }

  // Broadcast upload error
  public async broadcastUploadError(uploadId: string, error: Error): Promise<void> {
    try {
      const uploadSession = await UploadSession.findById(uploadId);
      if (!uploadSession) {
        return;
      }

      const progressData = this.formatUploadProgress(uploadSession);
      progressData.status = 'failed';
      progressData.error = error.message;

      // Broadcast to upload room
      this.io.to(`upload:${uploadId}`).emit('upload:error', progressData);

      this.contextLogger.info('Upload error broadcasted', {
        uploadId,
        error: error.message,
        subscriberCount: this.uploadSessions.get(uploadId)?.size || 0
      });

    } catch (broadcastError) {
      this.contextLogger.error('Failed to broadcast upload error', broadcastError as Error, {
        uploadId
      });
    }
  }

  // Send notification to specific user
  public sendUserNotification(userId: string, type: string, data: any): void {
    try {
      const userSockets = this.connectedUsers.get(userId);
      if (!userSockets || userSockets.size === 0) {
        return; // User not connected
      }

      // Send to all user's sockets
      this.io.to(`user:${userId}`).emit('notification', {
        type,
        data,
        timestamp: new Date().toISOString()
      });

      this.contextLogger.debug('User notification sent', {
        userId,
        type,
        socketCount: userSockets.size
      });

    } catch (error) {
      this.contextLogger.error('Failed to send user notification', error as Error, {
        userId,
        type
      });
    }
  }

  // Send notification to tenant
  public sendTenantNotification(tenantId: string, type: string, data: any): void {
    try {
      // Send to tenant room
      this.io.to(`tenant:${tenantId}`).emit('notification', {
        type,
        data,
        timestamp: new Date().toISOString()
      });

      this.contextLogger.debug('Tenant notification sent', {
        tenantId,
        type
      });

    } catch (error) {
      this.contextLogger.error('Failed to send tenant notification', error as Error, {
        tenantId,
        type
      });
    }
  }

  // Format upload progress data
  private formatUploadProgress(uploadSession: any): UploadProgressData {
    return {
      uploadId: uploadSession._id,
      contentId: uploadSession.contentId,
      filename: uploadSession.filename,
      totalSize: uploadSession.fileSize,
      uploadedSize: uploadSession.progressData.uploadedBytes,
      percentage: uploadSession.calculateProgress(),
      status: uploadSession.status,
      partsCompleted: uploadSession.progressData.uploadedParts,
      totalParts: uploadSession.progressData.totalParts,
      estimatedTimeRemaining: uploadSession.estimateTimeRemaining()
    };
  }

  // Verify user has access to upload
  private async verifyUploadAccess(contentId: string, user: SocketUser): Promise<boolean> {
    try {
      // In a real implementation, you would check if the user owns the content
      // or has appropriate roles to access it
      // For now, we'll do a basic check
      
      // Allow if user has admin/moderator role
      if (user.roles.includes('admin') || user.roles.includes('moderator')) {
        return true;
      }

      // Check if user owns the content
      try {
        const content = await Content.findById(contentId);
        
        if (!content) {
          this.contextLogger.warn('Content not found for upload access check', {
            contentId,
            userId: user.userId
          });
          return false;
        }
        
        // Check if user owns the content
        if (content.createdBy === user.userId) {
          return true;
        }
        
        // For now, skip collaborator check (would need proper model implementation)
        // TODO: Implement proper collaborator check with a dedicated model
        
        return false;
        
      } catch (error) {
        this.contextLogger.error('Database error during upload access check', error as Error, {
          contentId,
          userId: user.userId
        });
        return false;
      }
    } catch (error) {
      this.contextLogger.error('Failed to verify upload access', error as Error, {
        contentId,
        userId: user.userId
      });
      return false;
    }
  }

  // Get connection stats
  public getStats(): any {
    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections: this.socketUsers.size,
      activeUploads: this.uploadSessions.size,
      rooms: Object.keys(this.io.sockets.adapter.rooms).length
    };
  }

  // Health check
  public healthCheck(): { status: string; details: any } {
    try {
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        details: {
          ...stats,
          engine: this.io.engine.clientsCount,
          transports: ['websocket', 'polling']
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

  // Generate request ID
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // Cleanup method
  public cleanup(): void {
    this.connectedUsers.clear();
    this.socketUsers.clear();
    this.uploadSessions.clear();
  }
}
