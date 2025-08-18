import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class RedisManager {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor() {
    const redisConfig = {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };

    this.client = new Redis(config.redis.url, redisConfig);
    this.subscriber = new Redis(config.redis.url, redisConfig);
    this.publisher = new Redis(config.redis.url, redisConfig);
  }

  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscriber.connect();
      await this.publisher.connect();
      
      logger.info('Redis connections established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    await this.subscriber.disconnect();
    await this.publisher.disconnect();
    logger.info('Redis connections closed');
  }

  get redis(): Redis {
    return this.client;
  }

  get sub(): Redis {
    return this.subscriber;
  }

  get pub(): Redis {
    return this.publisher;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // Session management
  async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    await this.client.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  // Room management
  async addUserToRoom(roomId: string, userId: string, userData: any): Promise<void> {
    await this.client.hset(`room:${roomId}:users`, userId, JSON.stringify(userData));
    await this.client.sadd(`user:${userId}:rooms`, roomId);
  }

  async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
    await this.client.hdel(`room:${roomId}:users`, userId);
    await this.client.srem(`user:${userId}:rooms`, roomId);
  }

  async getRoomUsers(roomId: string): Promise<Record<string, any>> {
    const users = await this.client.hgetall(`room:${roomId}:users`);
    const result: Record<string, any> = {};
    
    for (const [userId, userData] of Object.entries(users)) {
      result[userId] = JSON.parse(userData);
    }
    
    return result;
  }

  async getUserRooms(userId: string): Promise<string[]> {
    return await this.client.smembers(`user:${userId}:rooms`);
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, Math.ceil(window / 1000));
    }
    return current <= limit;
  }
}
