import { RedisManager } from '../core/redis.js';
import { WhiteboardState } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class WhiteboardManager {
  constructor(private redis: RedisManager) {}

  async updateWhiteboard(
    roomId: string,
    userId: string,
    elements: any[],
    version: number
  ): Promise<WhiteboardState> {
    try {
      const now = new Date();
      const whiteboardState: WhiteboardState = {
        roomId,
        elements,
        version,
        lastModified: now,
        modifiedBy: userId
      };

      // Store in Redis with optimistic locking
      const key = `whiteboard:${roomId}`;
      const currentStateStr = await this.redis.redis.get(key);
      
      if (currentStateStr) {
        const currentState = JSON.parse(currentStateStr);
        if (currentState.version >= version) {
          throw new Error('Whiteboard version conflict');
        }
      }

      await this.redis.redis.setex(key, 3600, JSON.stringify(whiteboardState)); // 1 hour TTL

      // Store version history
      await this.redis.redis.lpush(
        `whiteboard:${roomId}:history`,
        JSON.stringify({
          ...whiteboardState,
          timestamp: now
        })
      );

      // Keep last 100 versions
      await this.redis.redis.ltrim(`whiteboard:${roomId}:history`, 0, 99);

      logger.debug('Whiteboard updated:', { roomId, userId, version });
      return whiteboardState;
    } catch (error) {
      logger.error('Error updating whiteboard:', error);
      throw error;
    }
  }

  async getWhiteboardState(roomId: string): Promise<WhiteboardState | null> {
    try {
      const stateStr = await this.redis.redis.get(`whiteboard:${roomId}`);
      if (!stateStr) {
        // Return empty whiteboard
        return {
          roomId,
          elements: [],
          version: 0,
          lastModified: new Date(),
          modifiedBy: 'system'
        };
      }

      return JSON.parse(stateStr);
    } catch (error) {
      logger.error('Error getting whiteboard state:', error);
      return null;
    }
  }

  async clearWhiteboard(roomId: string, userId: string): Promise<WhiteboardState> {
    const clearedState = await this.updateWhiteboard(roomId, userId, [], Date.now());
    logger.info('Whiteboard cleared:', { roomId, userId });
    return clearedState;
  }

  async getWhiteboardHistory(roomId: string, limit: number = 10): Promise<WhiteboardState[]> {
    try {
      const historyStr = await this.redis.redis.lrange(
        `whiteboard:${roomId}:history`,
        0,
        limit - 1
      );

      return historyStr.map(str => JSON.parse(str));
    } catch (error) {
      logger.error('Error getting whiteboard history:', error);
      return [];
    }
  }

  async revertWhiteboard(roomId: string, version: number, userId: string): Promise<WhiteboardState | null> {
    try {
      const history = await this.getWhiteboardHistory(roomId, 100);
      const targetVersion = history.find(state => state.version === version);
      
      if (!targetVersion) {
        return null;
      }

      // Create new version with reverted elements
      const newVersion = Date.now();
      return await this.updateWhiteboard(
        roomId,
        userId,
        targetVersion.elements,
        newVersion
      );
    } catch (error) {
      logger.error('Error reverting whiteboard:', error);
      return null;
    }
  }
}
