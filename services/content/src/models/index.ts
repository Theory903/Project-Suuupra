export * from './Content';
export * from './Category';
export * from './UploadSession';
export * from './MediaAsset';

import mongoose from 'mongoose';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await mongoose.connect(config.database.mongodb.uri, {
        ...config.database.mongodb.options,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      logger.info('Connected to MongoDB', {
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      });

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB', error as Error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB', error as Error);
      throw error;
    }
  }

  public async createIndexes(): Promise<void> {
    try {
      // Import models to trigger index creation
      const { Content } = await import('./Content');
      const { Category } = await import('./Category');
      const { UploadSession } = await import('./UploadSession');
      const { MediaAsset } = await import('./MediaAsset');

      // Create indexes
      await Promise.all([
        Content.createIndexes(),
        Category.createIndexes(),
        UploadSession.createIndexes(),
        MediaAsset.createIndexes()
      ]);

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Error creating database indexes', error as Error);
      throw error;
    }
  }

  public async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      if (mongoose.connection.readyState === 1) {
        // Connected
        return { status: 'healthy', details: { message: 'MongoDB connected' } };
      } else if (mongoose.connection.readyState === 2) {
        // Connecting
        return { status: 'degraded', details: { message: 'MongoDB connecting' } };
      } else {
        // Disconnected or other states
        return { status: 'unhealthy', details: { message: 'MongoDB disconnected' } };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

const dbManager = DatabaseManager.getInstance();

export const connectDB = async (): Promise<void> => {
  await dbManager.connect();
};

export const disconnectDB = async (): Promise<void> => {
  await dbManager.disconnect();
};
