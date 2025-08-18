import { DatabaseManager } from '../core/database.js';
import { RedisManager } from '../core/redis.js';
import { RoomAnalytics } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface AnalyticsEvent {
  event: string;
  userId: string;
  properties: any;
  roomId?: string;
  timestamp: Date;
}

export class AnalyticsManager {
  constructor(
    private db: DatabaseManager,
    private redis: RedisManager
  ) {}

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Store in database
      await this.db.client.analyticsEvent.create({
        data: {
          id: require('uuid').v4(),
          event: event.event,
          userId: event.userId,
          properties: event.properties,
          roomId: event.roomId,
          timestamp: event.timestamp
        }
      });

      // Store in Redis for real-time analytics
      const redisKey = `analytics:${event.roomId || 'global'}:${event.event}`;
      await this.redis.redis.incr(redisKey);
      await this.redis.redis.expire(redisKey, 86400); // 24 hours TTL

      logger.debug('Event tracked:', event);
    } catch (error) {
      logger.error('Error tracking event:', error);
    }
  }

  async getRoomAnalytics(roomId: string): Promise<RoomAnalytics | null> {
    try {
      const room = await this.db.client.room.findUnique({
        where: { id: roomId },
        include: {
          participants: true,
          chatMessages: true,
          recordings: true
        }
      });

      if (!room) {
        return null;
      }

      const participantEngagement = room.participants.map(p => ({
        userId: p.userId,
        joinTime: p.joinedAt,
        leaveTime: p.leftAt || undefined,
        audioTime: 0, // Would be calculated from events
        videoTime: 0, // Would be calculated from events
        chatMessages: room.chatMessages?.filter(m => m.userId === p.userId).length || 0
      }));

      const analytics: RoomAnalytics = {
        roomId,
        totalParticipants: room.participants.length,
        peakParticipants: await this.getPeakParticipants(roomId),
        duration: room.endedAt && room.startedAt 
          ? Math.floor((room.endedAt.getTime() - room.startedAt.getTime()) / 1000)
          : 0,
        chatMessages: room.chatMessages?.length || 0,
        screenShareSessions: await this.getScreenShareSessions(roomId),
        recordingDuration: room.recordings?.[0]?.duration,
        participantEngagement
      };

      return analytics;
    } catch (error) {
      logger.error('Error getting room analytics:', error);
      return null;
    }
  }

  async getInstructorAnalytics(
    instructorId: string,
    options: {
      period: 'day' | 'week' | 'month';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<any> {
    try {
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      let startDate: Date;

      switch (options.period) {
        case 'day':
          startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      if (options.startDate) {
        startDate = new Date(options.startDate);
      }

      const rooms = await this.db.client.room.findMany({
        where: {
          instructorId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          participants: true,
          chatMessages: true,
          recordings: true
        }
      });

      const totalRooms = rooms.length;
      const totalParticipants = rooms.reduce((sum, room) => sum + room.participants.length, 0);
      const totalDuration = rooms.reduce((sum, room) => {
        if (room.startedAt && room.endedAt) {
          return sum + (room.endedAt.getTime() - room.startedAt.getTime()) / 1000;
        }
        return sum;
      }, 0);
      const totalChatMessages = rooms.reduce((sum, room) => sum + (room.chatMessages?.length || 0), 0);
      const totalRecordings = rooms.reduce((sum, room) => sum + (room.recordings?.length || 0), 0);

      const averageParticipants = totalRooms > 0 ? totalParticipants / totalRooms : 0;
      const averageDuration = totalRooms > 0 ? totalDuration / totalRooms : 0;

      return {
        period: options.period,
        startDate,
        endDate,
        summary: {
          totalRooms,
          totalParticipants,
          averageParticipants: Math.round(averageParticipants * 100) / 100,
          totalDuration: Math.round(totalDuration),
          averageDuration: Math.round(averageDuration),
          totalChatMessages,
          totalRecordings
        },
        rooms: rooms.map(room => ({
          id: room.id,
          name: room.name,
          status: room.status,
          participantCount: room.participants.length,
          duration: room.startedAt && room.endedAt
            ? Math.floor((room.endedAt.getTime() - room.startedAt.getTime()) / 1000)
            : 0,
          chatMessages: room.chatMessages?.length || 0,
          hasRecording: (room.recordings?.length || 0) > 0,
          scheduledAt: room.scheduledAt
        }))
      };
    } catch (error) {
      logger.error('Error getting instructor analytics:', error);
      return null;
    }
  }

  async getPlatformAnalytics(period: 'day' | 'week' | 'month'): Promise<any> {
    try {
      const endDate = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const [
        totalRooms,
        activeRooms,
        totalUsers,
        totalParticipants,
        totalRecordings,
        totalChatMessages
      ] = await Promise.all([
        this.db.client.room.count({
          where: { createdAt: { gte: startDate, lte: endDate } }
        }),
        this.db.client.room.count({
          where: { status: 'active' }
        }),
        this.db.client.user.count(),
        this.db.client.participant.count({
          where: { joinedAt: { gte: startDate, lte: endDate } }
        }),
        this.db.client.recording.count({
          where: { startTime: { gte: startDate, lte: endDate } }
        }),
        this.db.client.chatMessage.count({
          where: { timestamp: { gte: startDate, lte: endDate } }
        })
      ]);

      return {
        period,
        startDate,
        endDate,
        summary: {
          totalRooms,
          activeRooms,
          totalUsers,
          totalParticipants,
          totalRecordings,
          totalChatMessages
        }
      };
    } catch (error) {
      logger.error('Error getting platform analytics:', error);
      return null;
    }
  }

  async getRealTimeRoomStats(roomId: string): Promise<any> {
    try {
      const room = await this.db.client.room.findUnique({
        where: { id: roomId },
        include: {
          participants: {
            where: { leftAt: null }
          }
        }
      });

      if (!room) {
        return null;
      }

      const activeParticipants = room.participants.length;
      const duration = room.startedAt 
        ? Math.floor((Date.now() - room.startedAt.getTime()) / 1000)
        : 0;

      return {
        roomId,
        status: room.status,
        activeParticipants,
        maxParticipants: room.maxParticipants,
        duration,
        isRecording: room.isRecording,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting real-time room stats:', error);
      return null;
    }
  }

  async getParticipantEngagement(roomId: string): Promise<any> {
    try {
      const participants = await this.db.client.participant.findMany({
        where: { roomId },
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      });

      const chatMessages = await this.db.client.chatMessage.findMany({
        where: { roomId },
        select: { userId: true }
      });

      const chatCounts = chatMessages.reduce((acc, msg) => {
        acc[msg.userId] = (acc[msg.userId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return participants.map(p => ({
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        role: p.role,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        duration: p.leftAt 
          ? Math.floor((p.leftAt.getTime() - p.joinedAt.getTime()) / 1000)
          : Math.floor((Date.now() - p.joinedAt.getTime()) / 1000),
        chatMessages: chatCounts[p.userId] || 0,
        isActive: !p.leftAt
      }));
    } catch (error) {
      logger.error('Error getting participant engagement:', error);
      return [];
    }
  }

  async getUserEngagement(userId: string): Promise<any> {
    try {
      const participations = await this.db.client.participant.findMany({
        where: { userId },
        include: {
          room: {
            select: {
              name: true,
              scheduledAt: true,
              status: true
            }
          }
        },
        orderBy: { joinedAt: 'desc' },
        take: 50
      });

      const totalSessions = participations.length;
      const totalDuration = participations.reduce((sum, p) => {
        if (p.leftAt) {
          return sum + (p.leftAt.getTime() - p.joinedAt.getTime()) / 1000;
        }
        return sum;
      }, 0);

      const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

      return {
        userId,
        totalSessions,
        totalDuration: Math.round(totalDuration),
        averageDuration: Math.round(averageDuration),
        recentSessions: participations.slice(0, 10).map(p => ({
          roomId: p.roomId,
          roomName: p.room.name,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          duration: p.leftAt 
            ? Math.floor((p.leftAt.getTime() - p.joinedAt.getTime()) / 1000)
            : null,
          roomStatus: p.room.status
        }))
      };
    } catch (error) {
      logger.error('Error getting user engagement:', error);
      return null;
    }
  }

  async exportRoomData(roomId: string, format: 'json' | 'csv'): Promise<string | null> {
    try {
      const room = await this.db.client.room.findUnique({
        where: { id: roomId },
        include: {
          participants: {
            include: {
              user: {
                select: { name: true, email: true }
              }
            }
          },
          chatMessages: true,
          recordings: true
        }
      });

      if (!room) {
        return null;
      }

      const data = {
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          status: room.status,
          scheduledAt: room.scheduledAt,
          startedAt: room.startedAt,
          endedAt: room.endedAt,
          duration: room.startedAt && room.endedAt
            ? Math.floor((room.endedAt.getTime() - room.startedAt.getTime()) / 1000)
            : null
        },
        participants: room.participants.map(p => ({
          userId: p.userId,
          name: p.user.name,
          email: p.user.email,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          duration: p.leftAt
            ? Math.floor((p.leftAt.getTime() - p.joinedAt.getTime()) / 1000)
            : null
        })),
        chatMessages: room.chatMessages?.map(m => ({
          id: m.id,
          userId: m.userId,
          userName: m.userName,
          message: m.message,
          timestamp: m.timestamp,
          type: m.type
        })) || [],
        recordings: room.recordings?.map(r => ({
          id: r.id,
          startTime: r.startTime,
          endTime: r.endTime,
          status: r.status,
          duration: r.duration,
          fileSize: r.fileSize?.toString()
        })) || []
      };

      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      } else {
        // Convert to CSV format
        const csvLines = [
          'Type,ID,Name,Email,Role,JoinedAt,LeftAt,Duration,ChatMessages',
          ...data.participants.map(p => 
            `Participant,${p.userId},${p.name},${p.email},${p.role},${p.joinedAt},${p.leftAt || ''},${p.duration || ''},${data.chatMessages.filter(m => m.userId === p.userId).length}`
          ),
          '',
          'ChatMessage,ID,UserID,UserName,Message,Timestamp,Type',
          ...data.chatMessages.map(m => 
            `ChatMessage,${m.id},${m.userId},${m.userName},"${m.message.replace(/"/g, '""')}",${m.timestamp},${m.type}`
          )
        ];
        return csvLines.join('\n');
      }
    } catch (error) {
      logger.error('Error exporting room data:', error);
      return null;
    }
  }

  private async getPeakParticipants(roomId: string): Promise<number> {
    try {
      // This would require more sophisticated tracking in a real implementation
      // For now, return the total participants count
      const count = await this.db.client.participant.count({
        where: { roomId }
      });
      return count;
    } catch (error) {
      logger.error('Error getting peak participants:', error);
      return 0;
    }
  }

  private async getScreenShareSessions(roomId: string): Promise<number> {
    try {
      const count = await this.db.client.screenShareSession.count({
        where: { roomId }
      });
      return count;
    } catch (error) {
      logger.error('Error getting screen share sessions:', error);
      return 0;
    }
  }
}