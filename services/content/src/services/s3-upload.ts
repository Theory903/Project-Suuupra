import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand, HeadObjectCommand, CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@/config';
import { UploadSession, IUploadSession } from '@/models/UploadSession';
import { logger, ContextLogger } from '@/utils/logger';
import { ValidationError, NotFoundError } from '@/types';
import crypto from 'crypto';

export interface InitiateUploadParams {
  contentId: string;
  filename: string;
  contentType: string;
  fileSize: number;
  checksumSha256: string;
  tenantId: string;
  userId: string;
}

export interface UploadPart {
  partNumber: number;
  signedUrl: string;
  expiresAt: Date;
}

export interface CompleteUploadParams {
  uploadId: string;
  parts: Array<{
    partNumber: number;
    etag: string;
  }>;
}

export class S3UploadService {
  private s3Client: S3Client;
  private contextLogger: ContextLogger;
  private bucketName: string;
  private bucketRegion: string;
  private cloudfrontDomain?: string;

  constructor() {
    this.bucketName = config.s3.bucketName;
    this.bucketRegion = config.s3.bucketRegion;
    if (config.s3.cloudfrontDomain) {
      this.cloudfrontDomain = config.s3.cloudfrontDomain;
    }
    this.contextLogger = new ContextLogger({ service: 's3-upload' });

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey
      },
      maxAttempts: 3
    });
  }

  // Initiate multipart upload
  public async initiateUpload(params: InitiateUploadParams): Promise<{
    uploadId: string;
    uploadSession: any;
    uploadParts: UploadPart[];
  }> {
    try {
      this.contextLogger.info('Initiating multipart upload', {
        contentId: params.contentId,
        filename: params.filename,
        fileSize: params.fileSize
      });

      // Validate file type
      if (!config.upload.allowedFileTypes.includes(params.contentType)) {
        throw new ValidationError(`File type not allowed: ${params.contentType}`);
      }

      // Validate file size
      if (params.fileSize > config.upload.maxFileSize) {
        throw new ValidationError(`File size exceeds maximum allowed: ${params.fileSize} bytes`);
      }

      // Generate S3 key
      const s3Key = this.generateS3Key(params.tenantId, params.contentId, params.filename);

      // Calculate number of parts (10MB per part)
      const partSize = config.upload.multipartChunkSize;
      const totalParts = Math.ceil(params.fileSize / partSize);

      if (totalParts > 10000) {
        throw new ValidationError('File too large for multipart upload (max 10,000 parts)');
      }

      // Create multipart upload in S3
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: params.contentType,
        Metadata: {
          'original-filename': params.filename,
          'content-id': params.contentId,
          'tenant-id': params.tenantId,
          'uploaded-by': params.userId,
          'checksum-sha256': params.checksumSha256
        },
        ServerSideEncryption: 'AES256'
      });

      const createResponse = await this.s3Client.send(createCommand);
      
      if (!createResponse.UploadId) {
        throw new Error('Failed to create multipart upload');
      }

      // Generate upload session ID
      const uploadSessionId = crypto.randomUUID();

      // Create upload session in database
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + config.upload.uploadExpiryHours);

      const uploadSession = new UploadSession({
        _id: uploadSessionId,
        contentId: params.contentId,
        uploadId: createResponse.UploadId,
        filename: params.filename,
        contentType: params.contentType,
        fileSize: params.fileSize,
        checksumSha256: params.checksumSha256,
        status: 'initiated',
        s3Metadata: {
          bucket: this.bucketName,
          key: s3Key,
          uploadId: createResponse.UploadId,
          parts: [],
          region: this.bucketRegion
        },
        progressData: {
          uploadedBytes: 0,
          uploadedParts: 0,
          totalParts: totalParts,
          startedAt: new Date(),
          lastActivityAt: new Date()
        },
        expiresAt
      });

      await uploadSession.save();

      // Generate pre-signed URLs for all parts
      const uploadParts = await this.generatePartUrls(
        s3Key, 
        createResponse.UploadId, 
        totalParts, 
        partSize,
        params.fileSize
      );

      this.contextLogger.info('Multipart upload initiated successfully', {
        contentId: params.contentId,
        uploadId: createResponse.UploadId,
        totalParts,
        uploadSessionId
      });

      return {
        uploadId: uploadSessionId,
        uploadSession: uploadSession.toJSON(),
        uploadParts
      };

    } catch (error) {
      this.contextLogger.error('Failed to initiate multipart upload', error as Error, {
        contentId: params.contentId,
        filename: params.filename
      });
      throw error;
    }
  }

  // Generate pre-signed URLs for upload parts
  private async generatePartUrls(
    s3Key: string, 
    s3UploadId: string, 
    totalParts: number, 
    partSize: number,
    totalFileSize: number
  ): Promise<UploadPart[]> {
    const uploadParts: UploadPart[] = [];
    const expiresIn = 3600; // 1 hour

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      // Calculate part size (last part might be smaller)
      const currentPartSize = partNumber === totalParts 
        ? totalFileSize - (partNumber - 1) * partSize
        : partSize;

      const command = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        PartNumber: partNumber,
        UploadId: s3UploadId,
        ContentLength: currentPartSize
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn,
        signableHeaders: new Set(['content-length'])
      });

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      uploadParts.push({
        partNumber,
        signedUrl,
        expiresAt
      });
    }

    return uploadParts;
  }

  // Complete multipart upload
  public async completeUpload(uploadSessionId: string, parts: CompleteUploadParams['parts']): Promise<{
    s3Key: string;
    cdnUrl?: string;
    fileSize: number;
    etag: string;
  }> {
    try {
      this.contextLogger.info('Completing multipart upload', {
        uploadSessionId,
        partsCount: parts.length
      });

      // Get upload session
      const uploadSession = await UploadSession.findById(uploadSessionId);
      if (!uploadSession) {
        throw new NotFoundError('Upload session', uploadSessionId);
      }

      if (uploadSession.status === 'completed') {
        throw new ValidationError('Upload already completed');
      }

      if (!uploadSession.canBeResumed()) {
        throw new ValidationError('Upload session expired or cannot be completed');
      }

      // Validate parts
      const expectedParts = uploadSession.progressData.totalParts;
      if (parts.length !== expectedParts) {
        throw new ValidationError(`Expected ${expectedParts} parts, received ${parts.length}`);
      }

      // Sort parts by part number
      const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);

      // Validate part numbers are sequential
      for (let i = 0; i < sortedParts.length; i++) {
        if (sortedParts[i].partNumber !== i + 1) {
          throw new ValidationError(`Missing or invalid part number: ${i + 1}`);
        }
      }

      // Complete multipart upload in S3
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: uploadSession.s3Metadata.key,
        UploadId: uploadSession.s3Metadata.uploadId,
        MultipartUpload: {
          Parts: sortedParts.map(part => ({
            ETag: part.etag,
            PartNumber: part.partNumber
          }))
        }
      });

      const completeResponse = await this.s3Client.send(completeCommand);

      if (!completeResponse.ETag) {
        throw new Error('Failed to complete multipart upload');
      }

      // Update upload session
      uploadSession.status = 'completed';
      uploadSession.completedAt = new Date();
      uploadSession.s3Metadata.parts = sortedParts.map(part => ({
        partNumber: part.partNumber,
        etag: part.etag,
        size: 0 // Size will be calculated if needed
      }));
      uploadSession.progressData.uploadedParts = parts.length;
      uploadSession.progressData.uploadedBytes = uploadSession.fileSize;

      await uploadSession.save();

      // Generate CDN URL if CloudFront is configured
      const cdnUrl = this.cloudfrontDomain 
        ? `https://${this.cloudfrontDomain}/${uploadSession.s3Metadata.key}`
        : undefined;

      this.contextLogger.info('Multipart upload completed successfully', {
        uploadSessionId,
        s3Key: uploadSession.s3Metadata.key,
        etag: completeResponse.ETag
      });

      const result: { s3Key: string; cdnUrl?: string; fileSize: number; etag: string } = {
        s3Key: uploadSession.s3Metadata.key,
        fileSize: uploadSession.fileSize,
        etag: completeResponse.ETag
      };
      if (cdnUrl) result.cdnUrl = cdnUrl;
      return result;

    } catch (error) {
      this.contextLogger.error('Failed to complete multipart upload', error as Error, {
        uploadSessionId
      });

      // Update upload session status to failed
      try {
        await UploadSession.findByIdAndUpdate(uploadSessionId, {
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (updateError) {
        this.contextLogger.error('Failed to update upload session status', updateError as Error);
      }

      throw error;
    }
  }

  // Abort multipart upload
  public async abortUpload(uploadSessionId: string): Promise<void> {
    try {
      this.contextLogger.info('Aborting multipart upload', { uploadSessionId });

      // Get upload session
      const uploadSession = await UploadSession.findById(uploadSessionId);
      if (!uploadSession) {
        throw new NotFoundError('Upload session', uploadSessionId);
      }

      // Abort multipart upload in S3
      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: uploadSession.s3Metadata.key,
        UploadId: uploadSession.s3Metadata.uploadId
      });

      await this.s3Client.send(abortCommand);

      // Update upload session
      uploadSession.status = 'aborted';
      await uploadSession.save();

      this.contextLogger.info('Multipart upload aborted successfully', {
        uploadSessionId,
        s3Key: uploadSession.s3Metadata.key
      });

    } catch (error) {
      this.contextLogger.error('Failed to abort multipart upload', error as Error, {
        uploadSessionId
      });
      throw error;
    }
  }

  // Get upload session
  public async getUploadSession(uploadSessionId: string): Promise<IUploadSession | null> {
    try {
      const uploadSession = await UploadSession.findById(uploadSessionId);
      if (!uploadSession) {
        return null;
      }

      return uploadSession;
    } catch (error) {
      this.contextLogger.error('Failed to get upload session', error as Error, {
        uploadSessionId
      });
      throw error;
    }
  }

  // Resume upload (get new signed URLs)
  public async resumeUpload(uploadSessionId: string): Promise<UploadPart[]> {
    try {
      this.contextLogger.info('Resuming multipart upload', { uploadSessionId });

      const uploadSession = await UploadSession.findById(uploadSessionId);
      if (!uploadSession) {
        throw new NotFoundError('Upload session', uploadSessionId);
      }

      if (!uploadSession.canBeResumed()) {
        throw new ValidationError('Upload session cannot be resumed');
      }

      // Get completed parts
      const completedParts = new Set(
        uploadSession.s3Metadata.parts.map(part => part.partNumber)
      );

      // Generate new signed URLs for incomplete parts
      const totalParts = uploadSession.progressData.totalParts;
      const partSize = config.upload.multipartChunkSize;
      const uploadParts: UploadPart[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (completedParts.has(partNumber)) {
          continue; // Skip completed parts
        }

        // Calculate part size (last part might be smaller)
        const currentPartSize = partNumber === totalParts 
          ? uploadSession.fileSize - (partNumber - 1) * partSize
          : partSize;

        const command = new UploadPartCommand({
          Bucket: this.bucketName,
          Key: uploadSession.s3Metadata.key,
          PartNumber: partNumber,
          UploadId: uploadSession.s3Metadata.uploadId,
          ContentLength: currentPartSize
        });

        const signedUrl = await getSignedUrl(this.s3Client, command, { 
          expiresIn: 3600,
          signableHeaders: new Set(['content-length'])
        });

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        uploadParts.push({
          partNumber,
          signedUrl,
          expiresAt
        });
      }

      this.contextLogger.info('Upload resumed successfully', {
        uploadSessionId,
        remainingParts: uploadParts.length
      });

      return uploadParts;

    } catch (error) {
      this.contextLogger.error('Failed to resume upload', error as Error, {
        uploadSessionId
      });
      throw error;
    }
  }

  // Update part completion
  public async updatePartCompletion(
    uploadSessionId: string, 
    partNumber: number, 
    etag: string, 
    size: number
  ): Promise<void> {
    try {
      const uploadSession = await UploadSession.findById(uploadSessionId);
      if (!uploadSession) {
        throw new NotFoundError('Upload session', uploadSessionId);
      }

      // Mark part as complete
      uploadSession.markPartComplete(partNumber, etag, size);
      await uploadSession.save();

      this.contextLogger.debug('Part completion updated', {
        uploadSessionId,
        partNumber,
        progress: uploadSession.calculateProgress()
      });

    } catch (error) {
      this.contextLogger.error('Failed to update part completion', error as Error, {
        uploadSessionId,
        partNumber
      });
      throw error;
    }
  }

  // Generate S3 key for file
  private generateS3Key(tenantId: string, contentId: string, filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Sanitize filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    return `content/${tenantId}/${year}/${month}/${day}/${contentId}/${sanitizedFilename}`;
  }

  // Verify file integrity
  public async verifyFileIntegrity(s3Key: string, expectedChecksum: string): Promise<boolean> {
    try {
      // Get object metadata
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const response = await this.s3Client.send(headCommand);
      
      // Check if checksum matches
      const s3Checksum = response.Metadata?.['checksum-sha256'];
      
      return s3Checksum === expectedChecksum;

    } catch (error) {
      this.contextLogger.error('Failed to verify file integrity', error as Error, { s3Key });
      return false;
    }
  }

  // Clean up expired upload sessions
  public async cleanupExpiredUploads(): Promise<void> {
    try {
      this.contextLogger.info('Cleaning up expired upload sessions');

      // Find expired sessions
      const expiredSessions = await UploadSession.find({
        status: { $in: ['initiated', 'uploading'] },
        expiresAt: { $lt: new Date() }
      });

      for (const session of expiredSessions) {
        try {
          // Abort S3 multipart upload
          const abortCommand = new AbortMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: session.s3Metadata.key,
            UploadId: session.s3Metadata.uploadId
          });

          await this.s3Client.send(abortCommand);

          // Update session status
          session.status = 'failed';
          session.failureReason = 'Upload session expired';
          await session.save();

        } catch (error) {
          this.contextLogger.error('Failed to cleanup expired upload session', error as Error, {
            sessionId: session._id
          });
        }
      }

      this.contextLogger.info('Expired upload sessions cleaned up', {
        count: expiredSessions.length
      });

    } catch (error) {
      this.contextLogger.error('Failed to cleanup expired uploads', error as Error);
    }
  }

  // Health check
  public async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      // Test S3 connectivity by listing bucket
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: 'health-check'
      });

      try {
        await this.s3Client.send(headCommand);
      } catch (error: any) {
        // 404 is expected if health-check object doesn't exist
        if (error.name !== 'NotFound') {
          throw error;
        }
      }

      return {
        status: 'healthy',
        details: {
          bucket: this.bucketName,
          region: this.bucketRegion
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
}
