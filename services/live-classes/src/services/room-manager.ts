import { v4 as uuidv4 } from 'uuid';
import * as mediasoup from 'mediasoup';
import { DatabaseManager } from '../core/database.js';
import { RedisManager } from '../core/redis.js';
import { MediaSoupManager } from '../core/mediasoup.js';
import { Room, Participant, RoomSettings } from '../types/index.js';
import { AuthUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class RoomManager {
  private activeRooms: Map<string, Room> = new Map();

  constructor(
    private db: DatabaseManager,
    private redis: RedisManager,
    private mediaSoup: MediaSoupManager
  ) {}

  async createRoom(data: {
    name: string;
    description?: string;
    instructorId: string;
    scheduledAt: Date;
    maxParticipants: number;
    settings: RoomSettings;
  }): Promise<Room> {
    const roomId = uuidv4();
    const now = new Date();

    const room: Room = {
      id: roomId,
      name: data.name,
      description: data.description,
      instructorId: data.instructorId,
      status: 'scheduled',
      maxParticipants: data.maxParticipants,
      scheduledAt: data.scheduledAt,
      isRecording: false,
      settings: data.settings,
      participants: new Map(),
      createdAt: now,
      updatedAt: now
    };

    // Save to database
    await this.db.client.room.create({
      data: {
        id: roomId,
        name: data.name,
        description: data.description,
        instructorId: data.instructorId,
        status: 'scheduled',
        maxParticipants: data.maxParticipants,
        scheduledAt: data.scheduledAt,
        settings: data.settings as any,
        createdAt: now,
        updatedAt: now
      }
    });

    // Cache in Redis
    await this.redis.redis.setex(
      `room:${roomId}`,
      3600, // 1 hour TTL
      JSON.stringify(room)
    );

    this.activeRooms.set(roomId, room);
    logger.info('Room created:', { roomId, instructorId: data.instructorId });

    return room;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    // Try cache first
    let room = this.activeRooms.get(roomId);
    if (room) {
      return room;
    }

    // Try Redis
    const cachedRoom = await this.redis.redis.get(`room:${roomId}`);
    if (cachedRoom) {
      room = JSON.parse(cachedRoom);
      this.activeRooms.set(roomId, room!);
      return room!;
    }

    // Try database
    const dbRoom = await this.db.client.room.findUnique({
      where: { id: roomId },
      include: {
        participants: true,
        recordings: true
      }
    });

    if (!dbRoom) {
      return null;
    }

    // Convert DB room to Room object
    room = {
      id: dbRoom.id,
      name: dbRoom.name,
      description: dbRoom.description || undefined,
      instructorId: dbRoom.instructorId,
      status: dbRoom.status as any,
      maxParticipants: dbRoom.maxParticipants,
      scheduledAt: dbRoom.scheduledAt,
      startedAt: dbRoom.startedAt || undefined,
      endedAt: dbRoom.endedAt || undefined,
      isRecording: dbRoom.isRecording,
      recordingUrl: dbRoom.recordingUrl || undefined,
      settings: dbRoom.settings as any,
      participants: new Map(),
      createdAt: dbRoom.createdAt,
      updatedAt: dbRoom.updatedAt
    };

    this.activeRooms.set(roomId, room);
    return room;
  }

  async updateRoom(roomId: string, updates: Partial<Room>, userId: string): Promise<Room | null> {
    const room = await this.getRoom(roomId);
    if (!room || room.instructorId !== userId) {
      return null;
    }

    const updatedData = { ...updates, updatedAt: new Date() };
    
    // Update database
    await this.db.client.room.update({
      where: { id: roomId },
      data: updatedData as any
    });

    // Update cache
    Object.assign(room, updatedData);
    await this.redis.redis.setex(
      `room:${roomId}`,
      3600,
      JSON.stringify(room)
    );

    this.activeRooms.set(roomId, room);
    return room;
  }

  async startRoom(roomId: string, userId: string): Promise<Room | null> {
    const room = await this.getRoom(roomId);
    if (!room || room.instructorId !== userId) {
      return null;
    }

    if (room.status !== 'scheduled') {
      throw new Error('Room is not in scheduled status');
    }

    // Create MediaSoup router
    const router = await this.mediaSoup.createRouter(roomId);
    room.router = router;
    room.status = 'active';
    room.startedAt = new Date();
    room.updatedAt = new Date();

    // Update database
    await this.db.client.room.update({
      where: { id: roomId },
      data: {
        status: 'active',
        startedAt: room.startedAt,
        updatedAt: room.updatedAt
      }
    });

    this.activeRooms.set(roomId, room);
    logger.info('Room started:', { roomId, instructorId: userId });

    return room;
  }

  async endRoom(roomId: string, userId: string): Promise<Room | null> {
    const room = await this.getRoom(roomId);
    if (!room || room.instructorId !== userId) {
      return null;
    }

    if (room.status !== 'active') {
      throw new Error('Room is not active');
    }

    // Close MediaSoup router
    if (room.router) {
      room.router.close();
    }

    room.status = 'ended';
    room.endedAt = new Date();
    room.updatedAt = new Date();

    // Update database
    await this.db.client.room.update({
      where: { id: roomId },
      data: {
        status: 'ended',
        endedAt: room.endedAt,
        updatedAt: room.updatedAt
      }
    });

    // Clear participants
    for (const participant of room.participants.values()) {
      await this.redis.removeUserFromRoom(roomId, participant.userId);
    }
    room.participants.clear();

    this.activeRooms.set(roomId, room);
    logger.info('Room ended:', { roomId, instructorId: userId });

    return room;
  }

  async joinRoom(roomId: string, user: AuthUser): Promise<{ success: boolean; message: string; data?: any }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { success: false, message: 'Room not found' };
    }

    if (room.status !== 'active') {
      return { success: false, message: 'Room is not active' };
    }

    if (room.participants.size >= room.maxParticipants) {
      return { success: false, message: 'Room is full' };
    }

    // Check if user is already in room
    if (room.participants.has(user.id)) {
      return { success: false, message: 'User already in room' };
    }

    const participant: Participant = {
      id: uuidv4(),
      userId: user.id,
      name: user.email, // In a real app, this would be the user's display name
      email: user.email,
      role: user.role === 'instructor' ? 'instructor' : 'student',
      joinedAt: new Date(),
      isAudioEnabled: !room.settings.muteParticipantsOnJoin,
      isVideoEnabled: false,
      isScreenSharing: false,
      isHandRaised: false,
      connectionStatus: 'connecting',
      producers: new Map(),
      consumers: new Map()
    };

    room.participants.set(user.id, participant);
    await this.redis.addUserToRoom(roomId, user.id, participant);

    // Save to database
    await this.db.client.participant.create({
      data: {
        id: participant.id,
        roomId,
        userId: user.id,
        name: participant.name,
        email: participant.email,
        role: participant.role,
        joinedAt: participant.joinedAt
      }
    });

    logger.info('User joined room:', { roomId, userId: user.id });

    return {
      success: true,
      message: 'Joined room successfully',
      data: {
        room: {
          id: room.id,
          name: room.name,
          settings: room.settings
        },
        participant,
        rtpCapabilities: room.router?.rtpCapabilities
      }
    };
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      return;
    }

    const participant = room.participants.get(userId);
    if (!participant) {
      return;
    }

    // Close producers and consumers
    for (const producer of participant.producers.values()) {
      producer.close();
    }
    for (const consumer of participant.consumers.values()) {
      consumer.close();
    }

    // Close transports
    if (participant.transport?.producer) {
      participant.transport.producer.close();
    }
    if (participant.transport?.consumer) {
      participant.transport.consumer.close();
    }

    room.participants.delete(userId);
    await this.redis.removeUserFromRoom(roomId, userId);

    // Update database
    await this.db.client.participant.update({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      },
      data: {
        leftAt: new Date()
      }
    });

    logger.info('User left room:', { roomId, userId });
  }

  async getRoomParticipants(roomId: string): Promise<Participant[]> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      return [];
    }

    return Array.from(room.participants.values());
  }

  async getUserRooms(userId: string, filters: {
    status?: 'scheduled' | 'active' | 'ended';
    limit: number;
    offset: number;
  }): Promise<Room[]> {
    const whereClause: any = {
      OR: [
        { instructorId: userId },
        { participants: { some: { userId } } }
      ]
    };

    if (filters.status) {
      whereClause.status = filters.status;
    }

    const dbRooms = await this.db.client.room.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
      include: {
        participants: true
      }
    });

    return dbRooms.map(dbRoom => ({
      id: dbRoom.id,
      name: dbRoom.name,
      description: dbRoom.description || undefined,
      instructorId: dbRoom.instructorId,
      status: dbRoom.status as any,
      maxParticipants: dbRoom.maxParticipants,
      scheduledAt: dbRoom.scheduledAt,
      startedAt: dbRoom.startedAt || undefined,
      endedAt: dbRoom.endedAt || undefined,
      isRecording: dbRoom.isRecording,
      recordingUrl: dbRoom.recordingUrl || undefined,
      settings: dbRoom.settings as any,
      participants: new Map(),
      createdAt: dbRoom.createdAt,
      updatedAt: dbRoom.updatedAt
    }));
  }

  async listRooms(filters: {
    status?: 'scheduled' | 'active' | 'ended';
    instructorId?: string;
    limit: number;
    offset: number;
  }): Promise<Room[]> {
    const whereClause: any = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }
    if (filters.instructorId) {
      whereClause.instructorId = filters.instructorId;
    }

    const dbRooms = await this.db.client.room.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
      include: {
        participants: true
      }
    });

    return dbRooms.map(dbRoom => ({
      id: dbRoom.id,
      name: dbRoom.name,
      description: dbRoom.description || undefined,
      instructorId: dbRoom.instructorId,
      status: dbRoom.status as any,
      maxParticipants: dbRoom.maxParticipants,
      scheduledAt: dbRoom.scheduledAt,
      startedAt: dbRoom.startedAt || undefined,
      endedAt: dbRoom.endedAt || undefined,
      isRecording: dbRoom.isRecording,
      recordingUrl: dbRoom.recordingUrl || undefined,
      settings: dbRoom.settings as any,
      participants: new Map(),
      createdAt: dbRoom.createdAt,
      updatedAt: dbRoom.updatedAt
    }));
  }

  async createWebRtcTransport(
    roomId: string, 
    userId: string, 
    type: 'producer' | 'consumer'
  ): Promise<any | null> {
    const room = this.activeRooms.get(roomId);
    if (!room || !room.router) {
      return null;
    }

    const participant = room.participants.get(userId);
    if (!participant) {
      return null;
    }

    try {
      const transport = await this.mediaSoup.createWebRtcTransport(room.router);
      
      if (!participant.transport) {
        participant.transport = {};
      }
      
      if (type === 'producer') {
        participant.transport.producer = transport;
      } else {
        participant.transport.consumer = transport;
      }

      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      };
    } catch (error) {
      logger.error('Error creating WebRTC transport:', error);
      return null;
    }
  }

  async connectWebRtcTransport(
    roomId: string,
    userId: string,
    transportId: string,
    dtlsParameters: any
  ): Promise<void> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const participant = room.participants.get(userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    // Find the transport
    let transport: mediasoup.types.WebRtcTransport | undefined;
    if (participant.transport?.producer?.id === transportId) {
      transport = participant.transport.producer;
    } else if (participant.transport?.consumer?.id === transportId) {
      transport = participant.transport.consumer;
    }

    if (!transport) {
      throw new Error('Transport not found');
    }

    await transport.connect({ dtlsParameters });
    participant.connectionStatus = 'connected';
    
    logger.info('WebRTC transport connected:', { roomId, userId, transportId });
  }

  async createProducer(
    roomId: string,
    userId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: any
  ): Promise<mediasoup.types.Producer | null> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      return null;
    }

    const participant = room.participants.get(userId);
    if (!participant || !participant.transport?.producer) {
      return null;
    }

    try {
      const producer = await participant.transport.producer.produce({
        kind,
        rtpParameters
      });

      participant.producers.set(producer.id, producer);
      
      if (kind === 'audio') {
        participant.isAudioEnabled = true;
      } else if (kind === 'video') {
        participant.isVideoEnabled = true;
      }

      // Notify other participants about new producer
      this.notifyParticipants(roomId, {
        type: 'newProducer',
        data: {
          userId,
          producerId: producer.id,
          kind
        }
      }, userId);

      logger.info('Producer created:', { roomId, userId, producerId: producer.id, kind });
      return producer;
    } catch (error) {
      logger.error('Error creating producer:', error);
      return null;
    }
  }

  async createConsumer(
    roomId: string,
    userId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: any
  ): Promise<mediasoup.types.Consumer | null> {
    const room = this.activeRooms.get(roomId);
    if (!room || !room.router) {
      return null;
    }

    const participant = room.participants.get(userId);
    if (!participant || !participant.transport?.consumer) {
      return null;
    }

    try {
      // Check if router can consume the producer
      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        return null;
      }

      const consumer = await participant.transport.consumer.consume({
        producerId,
        rtpCapabilities,
        paused: true // Start paused
      });

      participant.consumers.set(consumer.id, consumer);

      logger.info('Consumer created:', { roomId, userId, consumerId: consumer.id, producerId });
      return consumer;
    } catch (error) {
      logger.error('Error creating consumer:', error);
      return null;
    }
  }

  async getRouterCapabilities(roomId: string): Promise<any | null> {
    const room = this.activeRooms.get(roomId);
    if (!room || !room.router) {
      return null;
    }

    return room.router.rtpCapabilities;
  }

  private async notifyParticipants(roomId: string, message: any, excludeUserId?: string): Promise<void> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      return;
    }

    for (const participant of room.participants.values()) {
      if (excludeUserId && participant.userId === excludeUserId) {
        continue;
      }

      // In a real implementation, this would use WebSocket connections
      // For now, we'll use Redis pub/sub
      await this.redis.pub.publish(
        `room:${roomId}:user:${participant.userId}`,
        JSON.stringify(message)
      );
    }
  }

  // Room statistics
  async getRoomStats(roomId: string): Promise<any> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      roomId,
      status: room.status,
      participantCount: room.participants.size,
      isRecording: room.isRecording,
      duration: room.startedAt ? Date.now() - room.startedAt.getTime() : 0,
      producers: Array.from(room.participants.values()).reduce(
        (acc, p) => acc + p.producers.size, 0
      ),
      consumers: Array.from(room.participants.values()).reduce(
        (acc, p) => acc + p.consumers.size, 0
      )
    };
  }
}
