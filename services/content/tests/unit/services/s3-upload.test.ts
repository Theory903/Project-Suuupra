import { S3UploadService } from '@/services/s3-upload';
import { UploadSession } from '@/models/UploadSession';
import { ValidationError, NotFoundError } from '@/types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

const mockS3Client = {
  send: jest.fn()
};

const mockGetSignedUrl = jest.fn();

// Mock the AWS SDK imports
jest.doMock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => mockS3Client),
  CreateMultipartUploadCommand: jest.fn(),
  UploadPartCommand: jest.fn(),
  CompleteMultipartUploadCommand: jest.fn(),
  AbortMultipartUploadCommand: jest.fn(),
  HeadObjectCommand: jest.fn()
}));

jest.doMock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}));

describe('S3UploadService', () => {
  let s3Service: S3UploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    s3Service = new S3UploadService();
  });

  describe('initiateUpload', () => {
    const validUploadParams = {
      contentId: 'test-content-id',
      filename: 'test-video.mp4',
      contentType: 'video/mp4',
      fileSize: 1048576, // 1MB
      checksumSha256: 'a'.repeat(64),
      tenantId: 'test-tenant',
      userId: 'test-user'
    };

    it('should initiate multipart upload successfully', async () => {
      const mockUploadId = 'test-upload-id';
      
      // Mock S3 CreateMultipartUpload response
      mockS3Client.send.mockResolvedValueOnce({
        UploadId: mockUploadId
      });

      // Mock getSignedUrl for parts
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com');

      const result = await s3Service.initiateUpload(validUploadParams);

      expect(result).toHaveProperty('uploadId');
      expect(result).toHaveProperty('uploadSession');
      expect(result).toHaveProperty('uploadParts');
      expect(result.uploadParts).toHaveLength(1); // 1MB file = 1 part
      expect(result.uploadParts[0]).toHaveProperty('partNumber', 1);
      expect(result.uploadParts[0]).toHaveProperty('signedUrl');
      expect(result.uploadParts[0]).toHaveProperty('expiresAt');
    });

    it('should validate file type', async () => {
      const invalidParams = {
        ...validUploadParams,
        contentType: 'application/exe' // not allowed
      };

      await expect(s3Service.initiateUpload(invalidParams))
        .rejects
        .toThrow(ValidationError);
    });

    it('should validate file size', async () => {
      const invalidParams = {
        ...validUploadParams,
        fileSize: 11 * 1024 * 1024 * 1024 // 11GB, exceeds limit
      };

      await expect(s3Service.initiateUpload(invalidParams))
        .rejects
        .toThrow(ValidationError);
    });

    it('should calculate correct number of parts for large files', async () => {
      const largeFileParams = {
        ...validUploadParams,
        fileSize: 100 * 1024 * 1024 // 100MB
      };

      mockS3Client.send.mockResolvedValueOnce({
        UploadId: 'test-upload-id'
      });
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com');

      const result = await s3Service.initiateUpload(largeFileParams);

      expect(result.uploadParts).toHaveLength(10); // 100MB / 10MB per part = 10 parts
    });

    it('should reject files with too many parts', async () => {
      const hugeFileParams = {
        ...validUploadParams,
        fileSize: 100 * 1024 * 1024 * 1024 * 1024 // 100TB
      };

      await expect(s3Service.initiateUpload(hugeFileParams))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle S3 errors', async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error('S3 Error'));

      await expect(s3Service.initiateUpload(validUploadParams))
        .rejects
        .toThrow('S3 Error');
    });
  });

  describe('completeUpload', () => {
    let uploadSession: any;

    beforeEach(async () => {
      // Create a test upload session
      uploadSession = new UploadSession({
        _id: 'test-upload-session-id',
        contentId: 'test-content-id',
        uploadId: 'test-s3-upload-id',
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        fileSize: 1048576,
        checksumSha256: 'a'.repeat(64),
        status: 'uploading',
        s3Metadata: {
          bucket: 'test-bucket',
          key: 'test-key',
          uploadId: 'test-s3-upload-id',
          parts: [],
          region: 'us-east-1'
        },
        progressData: {
          uploadedBytes: 0,
          uploadedParts: 0,
          totalParts: 1,
          startedAt: new Date(),
          lastActivityAt: new Date()
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      });
      await uploadSession.save();
    });

    it('should complete multipart upload successfully', async () => {
      const parts = [{ partNumber: 1, etag: 'test-etag-1' }];

      // Mock S3 CompleteMultipartUpload response
      mockS3Client.send.mockResolvedValueOnce({
        ETag: 'final-etag'
      });

      const result = await s3Service.completeUpload(uploadSession._id, parts);

      expect(result).toHaveProperty('s3Key');
      expect(result).toHaveProperty('fileSize');
      expect(result).toHaveProperty('etag', 'final-etag');

      // Verify upload session was updated
      const updatedSession = await UploadSession.findById(uploadSession._id);
      expect(updatedSession?.status).toBe('completed');
      expect(updatedSession?.completedAt).toBeInstanceOf(Date);
    });

    it('should validate part count', async () => {
      const parts = [
        { partNumber: 1, etag: 'test-etag-1' },
        { partNumber: 2, etag: 'test-etag-2' } // Too many parts
      ];

      await expect(s3Service.completeUpload(uploadSession._id, parts))
        .rejects
        .toThrow(ValidationError);
    });

    it('should validate part numbers are sequential', async () => {
      const parts = [{ partNumber: 2, etag: 'test-etag-2' }]; // Missing part 1

      await expect(s3Service.completeUpload(uploadSession._id, parts))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle non-existent upload session', async () => {
      const parts = [{ partNumber: 1, etag: 'test-etag-1' }];

      await expect(s3Service.completeUpload('non-existent-id', parts))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should handle already completed upload', async () => {
      uploadSession.status = 'completed';
      await uploadSession.save();

      const parts = [{ partNumber: 1, etag: 'test-etag-1' }];

      await expect(s3Service.completeUpload(uploadSession._id, parts))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle expired upload session', async () => {
      uploadSession.expiresAt = new Date(Date.now() - 1000); // Expired
      await uploadSession.save();

      const parts = [{ partNumber: 1, etag: 'test-etag-1' }];

      await expect(s3Service.completeUpload(uploadSession._id, parts))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle S3 completion errors', async () => {
      const parts = [{ partNumber: 1, etag: 'test-etag-1' }];

      mockS3Client.send.mockRejectedValueOnce(new Error('S3 Error'));

      await expect(s3Service.completeUpload(uploadSession._id, parts))
        .rejects
        .toThrow('S3 Error');

      // Verify upload session status was updated to failed
      const updatedSession = await UploadSession.findById(uploadSession._id);
      expect(updatedSession?.status).toBe('failed');
    });
  });

  describe('abortUpload', () => {
    let uploadSession: any;

    beforeEach(async () => {
      uploadSession = new UploadSession({
        _id: 'test-upload-session-id',
        contentId: 'test-content-id',
        uploadId: 'test-s3-upload-id',
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        fileSize: 1048576,
        checksumSha256: 'a'.repeat(64),
        status: 'uploading',
        s3Metadata: {
          bucket: 'test-bucket',
          key: 'test-key',
          uploadId: 'test-s3-upload-id',
          parts: [],
          region: 'us-east-1'
        },
        progressData: {
          uploadedBytes: 0,
          uploadedParts: 0,
          totalParts: 1,
          startedAt: new Date(),
          lastActivityAt: new Date()
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      await uploadSession.save();
    });

    it('should abort multipart upload successfully', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      await s3Service.abortUpload(uploadSession._id);

      // Verify upload session was updated
      const updatedSession = await UploadSession.findById(uploadSession._id);
      expect(updatedSession?.status).toBe('aborted');
    });

    it('should handle non-existent upload session', async () => {
      await expect(s3Service.abortUpload('non-existent-id'))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should handle S3 abort errors', async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error('S3 Error'));

      await expect(s3Service.abortUpload(uploadSession._id))
        .rejects
        .toThrow('S3 Error');
    });
  });

  describe('getUploadProgress', () => {
    it('should return upload progress', async () => {
      const uploadSession = new UploadSession({
        _id: 'test-upload-session-id',
        contentId: 'test-content-id',
        uploadId: 'test-s3-upload-id',
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        fileSize: 1048576,
        checksumSha256: 'a'.repeat(64),
        status: 'uploading',
        s3Metadata: {
          bucket: 'test-bucket',
          key: 'test-key',
          uploadId: 'test-s3-upload-id',
          parts: [{ partNumber: 1, etag: 'etag1', size: 524288 }],
          region: 'us-east-1'
        },
        progressData: {
          uploadedBytes: 524288,
          uploadedParts: 1,
          totalParts: 2,
          startedAt: new Date(),
          lastActivityAt: new Date()
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      await uploadSession.save();

      const progress = await s3Service.getUploadProgress(uploadSession._id);

      expect(progress).toHaveProperty('id', uploadSession._id);
      expect(progress).toHaveProperty('progress', 50); // 50% complete
      expect(progress).toHaveProperty('canResume', true);
    });

    it('should handle non-existent upload session', async () => {
      await expect(s3Service.getUploadProgress('non-existent-id'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('resumeUpload', () => {
    let uploadSession: any;

    beforeEach(async () => {
      uploadSession = new UploadSession({
        _id: 'test-upload-session-id',
        contentId: 'test-content-id',
        uploadId: 'test-s3-upload-id',
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        fileSize: 20971520, // 20MB
        checksumSha256: 'a'.repeat(64),
        status: 'uploading',
        s3Metadata: {
          bucket: 'test-bucket',
          key: 'test-key',
          uploadId: 'test-s3-upload-id',
          parts: [{ partNumber: 1, etag: 'etag1', size: 10485760 }], // First part completed
          region: 'us-east-1'
        },
        progressData: {
          uploadedBytes: 10485760,
          uploadedParts: 1,
          totalParts: 2,
          startedAt: new Date(),
          lastActivityAt: new Date()
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      await uploadSession.save();
    });

    it('should generate signed URLs for incomplete parts only', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com');

      const uploadParts = await s3Service.resumeUpload(uploadSession._id);

      expect(uploadParts).toHaveLength(1); // Only part 2 needs to be uploaded
      expect(uploadParts[0].partNumber).toBe(2);
      expect(uploadParts[0]).toHaveProperty('signedUrl');
      expect(uploadParts[0]).toHaveProperty('expiresAt');
    });

    it('should handle non-existent upload session', async () => {
      await expect(s3Service.resumeUpload('non-existent-id'))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should handle non-resumable upload session', async () => {
      uploadSession.status = 'completed';
      await uploadSession.save();

      await expect(s3Service.resumeUpload(uploadSession._id))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('cleanupExpiredUploads', () => {
    it('should abort expired upload sessions', async () => {
      // Create expired upload session
      const expiredSession = new UploadSession({
        _id: 'expired-session-id',
        contentId: 'test-content-id',
        uploadId: 'test-s3-upload-id',
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        fileSize: 1048576,
        checksumSha256: 'a'.repeat(64),
        status: 'uploading',
        s3Metadata: {
          bucket: 'test-bucket',
          key: 'test-key',
          uploadId: 'test-s3-upload-id',
          parts: [],
          region: 'us-east-1'
        },
        progressData: {
          uploadedBytes: 0,
          uploadedParts: 0,
          totalParts: 1,
          startedAt: new Date(),
          lastActivityAt: new Date()
        },
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      });
      await expiredSession.save();

      mockS3Client.send.mockResolvedValue({});

      await s3Service.cleanupExpiredUploads();

      // Verify session was updated to failed
      const updatedSession = await UploadSession.findById(expiredSession._id);
      expect(updatedSession?.status).toBe('failed');
      expect(updatedSession?.failureReason).toBe('Upload session expired');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when S3 is accessible', async () => {
      // Mock successful S3 head request (404 is expected for health-check object)
      mockS3Client.send.mockRejectedValueOnce({ name: 'NotFound' });

      const health = await s3Service.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('bucket');
      expect(health.details).toHaveProperty('region');
    });

    it('should return unhealthy status when S3 is not accessible', async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error('Connection failed'));

      const health = await s3Service.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details).toHaveProperty('error');
    });
  });
});
