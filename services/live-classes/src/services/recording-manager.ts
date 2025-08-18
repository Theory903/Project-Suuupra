import { v4 as uuidv4 } from 'uuid';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DatabaseManager } from '../core/database.js';
import { RedisManager } from '../core/redis.js';
import { Recording } from '../types/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class RecordingManager {
  private s3Client: S3Client;
  private activeRecordings: Map<string, Recording> = new Map();

  constructor(
    private db: DatabaseManager,
    private redis: RedisManager
  ) {
    this.s3Client = new S3Client({
      region: config.recording.s3.region,
      credentials: {
        accessKeyId: config.recording.s3.accessKeyId,
        secretAccessKey: config.recording.s3.secretAccessKey
      }
    });
  }

  async startRecording(roomId: string, instructorId: string): Promise<Recording | null> {
    try {
      // Check if room exists and is active
      const room = await this.db.client.room.findUnique({
        where: { id: roomId }
      });

      if (!room || room.status !== 'active' || room.instructorId !== instructorId) {
        return null;
      }

      // Check if recording is already active
      const existingRecording = this.activeRecordings.get(roomId);
      if (existingRecording) {
        return existingRecording;
      }

      const recordingId = uuidv4();
      const now = new Date();
      
      const recording: Recording = {
        id: recordingId,
        roomId,
        instructorId,
        startTime: now,
        status: 'recording'
      };

      // Save to database
      await this.db.client.recording.create({
        data: {
          id: recordingId,
          roomId,
          instructorId,
          startTime: now,
          status: 'recording'
        }
      });

      // Update room recording status
      await this.db.client.room.update({
        where: { id: roomId },
        data: { isRecording: true }
      });

      this.activeRecordings.set(roomId, recording);

      // Start FFmpeg recording process
      await this.startFFmpegRecording(roomId, recordingId);

      logger.info('Recording started:', { roomId, recordingId, instructorId });
      return recording;
    } catch (error) {
      logger.error('Error starting recording:', error);
      return null;
    }
  }

  async stopRecording(roomId: string, instructorId: string): Promise<Recording | null> {
    try {
      const recording = this.activeRecordings.get(roomId);
      if (!recording || recording.instructorId !== instructorId) {
        return null;
      }

      const now = new Date();
      recording.endTime = now;
      recording.status = 'processing';
      recording.duration = Math.floor((now.getTime() - recording.startTime.getTime()) / 1000);

      // Update database
      await this.db.client.recording.update({
        where: { id: recording.id },
        data: {
          endTime: now,
          status: 'processing',
          duration: recording.duration
        }
      });

      // Update room recording status
      await this.db.client.room.update({
        where: { id: roomId },
        data: { isRecording: false }
      });

      // Stop FFmpeg process and start post-processing
      await this.stopFFmpegRecording(roomId, recording.id);

      this.activeRecordings.delete(roomId);
      logger.info('Recording stopped:', { roomId, recordingId: recording.id });

      return recording;
    } catch (error) {
      logger.error('Error stopping recording:', error);
      return null;
    }
  }

  async getActiveRecording(roomId: string): Promise<Recording | null> {
    return this.activeRecordings.get(roomId) || null;
  }

  async getRecording(recordingId: string): Promise<Recording | null> {
    try {
      const dbRecording = await this.db.client.recording.findUnique({
        where: { id: recordingId }
      });

      if (!dbRecording) {
        return null;
      }

      return {
        id: dbRecording.id,
        roomId: dbRecording.roomId,
        instructorId: dbRecording.instructorId,
        startTime: dbRecording.startTime,
        endTime: dbRecording.endTime || undefined,
        status: dbRecording.status as any,
        filePath: dbRecording.filePath || undefined,
        s3Url: dbRecording.s3Url || undefined,
        duration: dbRecording.duration || undefined,
        fileSize: dbRecording.fileSize || undefined
      };
    } catch (error) {
      logger.error('Error getting recording:', error);
      return null;
    }
  }

  async getRoomRecordings(roomId: string, options: { limit: number; offset: number }): Promise<Recording[]> {
    try {
      const dbRecordings = await this.db.client.recording.findMany({
        where: { roomId },
        orderBy: { startTime: 'desc' },
        take: options.limit,
        skip: options.offset
      });

      return dbRecordings.map(dbRecording => ({
        id: dbRecording.id,
        roomId: dbRecording.roomId,
        instructorId: dbRecording.instructorId,
        startTime: dbRecording.startTime,
        endTime: dbRecording.endTime || undefined,
        status: dbRecording.status as any,
        filePath: dbRecording.filePath || undefined,
        s3Url: dbRecording.s3Url || undefined,
        duration: dbRecording.duration || undefined,
        fileSize: dbRecording.fileSize || undefined
      }));
    } catch (error) {
      logger.error('Error getting room recordings:', error);
      return [];
    }
  }

  async getUserRecordings(
    userId: string, 
    options: { 
      status?: 'recording' | 'processing' | 'completed' | 'failed';
      limit: number; 
      offset: number 
    }
  ): Promise<Recording[]> {
    try {
      const whereClause: any = { instructorId: userId };
      if (options.status) {
        whereClause.status = options.status;
      }

      const dbRecordings = await this.db.client.recording.findMany({
        where: whereClause,
        orderBy: { startTime: 'desc' },
        take: options.limit,
        skip: options.offset
      });

      return dbRecordings.map(dbRecording => ({
        id: dbRecording.id,
        roomId: dbRecording.roomId,
        instructorId: dbRecording.instructorId,
        startTime: dbRecording.startTime,
        endTime: dbRecording.endTime || undefined,
        status: dbRecording.status as any,
        filePath: dbRecording.filePath || undefined,
        s3Url: dbRecording.s3Url || undefined,
        duration: dbRecording.duration || undefined,
        fileSize: dbRecording.fileSize || undefined
      }));
    } catch (error) {
      logger.error('Error getting user recordings:', error);
      return [];
    }
  }

  async deleteRecording(recordingId: string, userId: string): Promise<boolean> {
    try {
      const recording = await this.getRecording(recordingId);
      if (!recording || recording.instructorId !== userId) {
        return false;
      }

      // Delete from S3 if exists
      if (recording.s3Url) {
        const key = recording.s3Url.split('/').pop();
        if (key) {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: config.recording.s3.bucket,
            Key: key
          }));
        }
      }

      // Delete local file if exists
      if (recording.filePath) {
        try {
          await fs.unlink(recording.filePath);
        } catch (error) {
          logger.warn('Failed to delete local recording file:', error);
        }
      }

      // Delete from database
      await this.db.client.recording.delete({
        where: { id: recordingId }
      });

      logger.info('Recording deleted:', { recordingId });
      return true;
    } catch (error) {
      logger.error('Error deleting recording:', error);
      return false;
    }
  }

  private async startFFmpegRecording(roomId: string, recordingId: string): Promise<void> {
    // In a real implementation, this would:
    // 1. Set up FFmpeg to record the MediaSoup router output
    // 2. Configure recording parameters (resolution, bitrate, format)
    // 3. Start the recording process
    
    const outputPath = path.join(config.recording.storagePath, `${recordingId}.mp4`);
    
    // Ensure recording directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // For now, create a placeholder file
    await fs.writeFile(outputPath, '');
    
    logger.info('FFmpeg recording started:', { roomId, recordingId, outputPath });
  }

  private async stopFFmpegRecording(roomId: string, recordingId: string): Promise<void> {
    try {
      const filePath = path.join(config.recording.storagePath, `${recordingId}.mp4`);
      
      // Get file stats
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Upload to S3
      const s3Key = `recordings/${roomId}/${recordingId}.mp4`;
      const fileContent = await fs.readFile(filePath);
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: config.recording.s3.bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'video/mp4'
      }));

      const s3Url = `https://${config.recording.s3.bucket}.s3.${config.recording.s3.region}.amazonaws.com/${s3Key}`;

      // Update recording in database
      await this.db.client.recording.update({
        where: { id: recordingId },
        data: {
          status: 'completed',
          filePath,
          s3Url,
          fileSize
        }
      });

      // Clean up local file
      await fs.unlink(filePath);

      logger.info('Recording processed and uploaded:', { recordingId, s3Url });
    } catch (error) {
      logger.error('Error processing recording:', error);
      
      // Mark recording as failed
      await this.db.client.recording.update({
        where: { id: recordingId },
        data: { status: 'failed' }
      });
    }
  }
}
