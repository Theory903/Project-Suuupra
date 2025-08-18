import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../core/database.js';
import { RedisManager } from '../core/redis.js';
import { ChatMessage } from '../types/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class ChatManager {
  constructor(
    private db: DatabaseManager,
    private redis: RedisManager
  ) {}

  async sendMessage(data: {
    roomId: string;
    userId: string;
    message: string;
    type: 'text' | 'file' | 'system';
    metadata?: any;
  }): Promise<ChatMessage> {
    const messageId = uuidv4();
    const now = new Date();

    // Get user info
    const user = await this.db.client.user.findUnique({
      where: { id: data.userId },
      select: { name: true }
    });

    const chatMessage: ChatMessage = {
      id: messageId,
      roomId: data.roomId,
      userId: data.userId,
      userName: user?.name || 'Unknown User',
      message: data.message,
      timestamp: now,
      type: data.type,
      metadata: data.metadata
    };

    // Save to database
    await this.db.client.chatMessage.create({
      data: {
        id: messageId,
        roomId: data.roomId,
        userId: data.userId,
        userName: chatMessage.userName,
        message: data.message,
        type: data.type,
        metadata: data.metadata,
        timestamp: now
      }
    });

    // Cache recent messages in Redis
    await this.redis.redis.lpush(
      `room:${data.roomId}:chat`,
      JSON.stringify(chatMessage)
    );

    // Keep only recent messages in cache
    await this.redis.redis.ltrim(`room:${data.roomId}:chat`, 0, config.chat.messageLimit - 1);

    logger.info('Chat message sent:', { 
      messageId, 
      roomId: data.roomId, 
      userId: data.userId 
    });

    return chatMessage;
  }

  async getRoomChatHistory(
    roomId: string, 
    options: { limit: number; offset: number }
  ): Promise<ChatMessage[]> {
    try {
      // Try Redis cache first for recent messages
      if (options.offset === 0) {
        const cachedMessages = await this.redis.redis.lrange(
          `room:${roomId}:chat`,
          0,
          Math.min(options.limit - 1, config.chat.messageLimit - 1)
        );

        if (cachedMessages.length > 0) {
          return cachedMessages.map(msg => JSON.parse(msg));
        }
      }

      // Fall back to database
      const dbMessages = await this.db.client.chatMessage.findMany({
        where: { roomId },
        orderBy: { timestamp: 'desc' },
        take: options.limit,
        skip: options.offset
      });

      return dbMessages.map(msg => ({
        id: msg.id,
        roomId: msg.roomId,
        userId: msg.userId,
        userName: msg.userName,
        message: msg.message,
        timestamp: msg.timestamp,
        type: msg.type as any,
        metadata: msg.metadata
      }));
    } catch (error) {
      logger.error('Error getting chat history:', error);
      return [];
    }
  }

  async deleteMessage(messageId: string, userId: string, isAdmin: boolean = false): Promise<boolean> {
    try {
      const message = await this.db.client.chatMessage.findUnique({
        where: { id: messageId }
      });

      if (!message) {
        return false;
      }

      // Only allow deletion by message author or admin
      if (message.userId !== userId && !isAdmin) {
        return false;
      }

      // Soft delete in database
      await this.db.client.chatMessage.update({
        where: { id: messageId },
        data: {
          message: '[Message deleted]',
          type: 'system',
          metadata: { deletedAt: new Date(), deletedBy: userId }
        }
      });

      // Remove from Redis cache
      const cachedMessages = await this.redis.redis.lrange(`room:${message.roomId}:chat`, 0, -1);
      const updatedMessages = cachedMessages
        .map(msg => JSON.parse(msg))
        .map(msg => msg.id === messageId 
          ? { ...msg, message: '[Message deleted]', type: 'system' }
          : msg
        );

      await this.redis.redis.del(`room:${message.roomId}:chat`);
      for (const msg of updatedMessages.reverse()) {
        await this.redis.redis.lpush(`room:${message.roomId}:chat`, JSON.stringify(msg));
      }

      logger.info('Chat message deleted:', { messageId, deletedBy: userId });
      return true;
    } catch (error) {
      logger.error('Error deleting chat message:', error);
      return false;
    }
  }

  async moderateMessage(messageId: string, action: 'approve' | 'reject', moderatorId: string): Promise<boolean> {
    try {
      await this.db.client.chatMessage.update({
        where: { id: messageId },
        data: {
          metadata: {
            moderated: true,
            moderatedBy: moderatorId,
            moderatedAt: new Date(),
            action
          }
        }
      });

      if (action === 'reject') {
        await this.deleteMessage(messageId, moderatorId, true);
      }

      logger.info('Chat message moderated:', { messageId, action, moderatorId });
      return true;
    } catch (error) {
      logger.error('Error moderating chat message:', error);
      return false;
    }
  }

  async getChatAnalytics(roomId: string): Promise<any> {
    try {
      const messages = await this.db.client.chatMessage.findMany({
        where: { roomId },
        select: {
          userId: true,
          timestamp: true,
          type: true
        }
      });

      const userMessageCounts = messages.reduce((acc, msg) => {
        acc[msg.userId] = (acc[msg.userId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const messagesByHour = messages.reduce((acc, msg) => {
        const hour = msg.timestamp.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      return {
        totalMessages: messages.length,
        uniqueParticipants: Object.keys(userMessageCounts).length,
        messagesPerUser: userMessageCounts,
        messagesByHour,
        averageMessagesPerUser: messages.length / Math.max(1, Object.keys(userMessageCounts).length)
      };
    } catch (error) {
      logger.error('Error getting chat analytics:', error);
      return null;
    }
  }
}
