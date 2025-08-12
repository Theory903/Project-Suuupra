// Export all models
export { Content, IContent } from './Content';
export { Category, ICategory } from './Category';
export { UploadSession, IUploadSession } from './UploadSession';

// Database connection and initialization
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
      logger.info('Database already connected');
      return;
    }

    try {
      // Configure mongoose
      mongoose.set('strictQuery', false);
      
      // Connection options
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4
        retryWrites: true,
        retryReads: true,
        ...config.database.mongodb.options
      };

      // Connect to MongoDB
      await mongoose.connect(config.database.mongodb.uri, options);

      // Set up event listeners
      mongoose.connection.on('connected', () => {
        logger.info('MongoDB connected successfully');
        this.isConnected = true;
      });

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  public getConnectionState(): number {
    return mongoose.connection.readyState;
  }

  public isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // Create indexes for all models
  public async createIndexes(): Promise<void> {
    try {
      logger.info('Creating database indexes...');
      
      await Promise.all([
        Content.createIndexes(),
        Category.createIndexes(),
        UploadSession.createIndexes()
      ]);
      
      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Error creating database indexes:', error);
      throw error;
    }
  }

  // Health check for database
  public async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const state = this.getConnectionState();
      const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      
      if (state === 1) {
        // Test with a simple query
        await mongoose.connection.db.admin().ping();
        
        return {
          status: 'healthy',
          details: {
            state: stateNames[state] || 'unknown',
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
          }
        };
      } else {
        return {
          status: 'unhealthy',
          details: {
            state: stateNames[state] || 'unknown',
            message: 'Database not connected'
          }
        };
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
