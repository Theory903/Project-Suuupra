import mongoose, { Schema, Document, Types } from 'mongoose';
import { UploadStatus, MultipartUploadPart } from '@/types';

export interface IUploadSession extends Document {
  _id: string;
  contentId: string;
  uploadId: string;
  filename: string;
  contentType: string;
  fileSize: number;
  checksumSha256: string;
  status: UploadStatus;
  s3Metadata: {
    bucket: string;
    key: string;
    uploadId: string;
    parts: MultipartUploadPart[];
    region: string;
  };
  progressData: {
    uploadedBytes: number;
    uploadedParts: number;
    totalParts: number;
    startedAt: Date;
    lastActivityAt: Date;
  };
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
  failureReason?: string;
  
  // Virtual fields
  id: string;
  
  // Instance methods
  calculateProgress(): number;
  estimateTimeRemaining(): number | null;
  canBeResumed(): boolean;
  markPartComplete(partNumber: number, etag: string, size: number): void;
}

const MultipartPartSchema = new Schema({
  partNumber: { type: Number, required: true },
  etag: { type: String, required: true },
  size: { type: Number, required: true }
}, { _id: false });

const S3MetadataSchema = new Schema({
  bucket: { type: String, required: true },
  key: { type: String, required: true },
  uploadId: { type: String, required: true },
  parts: [MultipartPartSchema],
  region: { type: String, required: true }
}, { _id: false });

const ProgressDataSchema = new Schema({
  uploadedBytes: { type: Number, default: 0 },
  uploadedParts: { type: Number, default: 0 },
  totalParts: { type: Number, required: true },
  startedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now }
}, { _id: false });

const UploadSessionSchema = new Schema<IUploadSession>({
  _id: { 
    type: String, 
    default: () => new Types.ObjectId().toString() 
  },
  contentId: { 
    type: String, 
    required: true, 
    index: true 
  },
  uploadId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  filename: { 
    type: String, 
    required: true,
    maxlength: 255
  },
  contentType: { 
    type: String, 
    required: true,
    match: /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/
  },
  fileSize: { 
    type: Number, 
    required: true,
    min: 1,
    max: 10737418240 // 10GB max
  },
  checksumSha256: { 
    type: String, 
    required: true,
    match: /^[a-fA-F0-9]{64}$/
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['initiated', 'uploading', 'completed', 'failed', 'aborted'],
    default: 'initiated',
    index: true
  },
  s3Metadata: {
    type: S3MetadataSchema,
    required: true
  },
  progressData: {
    type: ProgressDataSchema,
    required: true
  },
  expiresAt: { 
    type: Date, 
    required: true, 
    index: { expireAfterSeconds: 0 }
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  completedAt: Date,
  failureReason: {
    type: String,
    maxlength: 500
  }
}, {
  versionKey: false,
  collection: 'upload_sessions'
});

// Additional indexes
UploadSessionSchema.index({ status: 1, expiresAt: 1 });
UploadSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 7 }); // Auto-delete after 7 days

// Virtual for id field
UploadSessionSchema.virtual('id').get(function() {
  return this._id;
});

// Pre-save middleware
UploadSessionSchema.pre('save', function(next) {
  if (this.isModified('progressData')) {
    this.progressData.lastActivityAt = new Date();
  }
  
  // Set completion time when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Instance methods
UploadSessionSchema.methods.calculateProgress = function(): number {
  if (this.fileSize === 0) return 0;
  return Math.round((this.progressData.uploadedBytes / this.fileSize) * 100);
};

UploadSessionSchema.methods.estimateTimeRemaining = function(): number | null {
  const now = new Date();
  const elapsedMs = now.getTime() - this.progressData.startedAt.getTime();
  const uploadedBytes = this.progressData.uploadedBytes;
  
  if (elapsedMs < 1000 || uploadedBytes === 0) {
    return null; // Not enough data
  }
  
  const bytesPerMs = uploadedBytes / elapsedMs;
  const remainingBytes = this.fileSize - uploadedBytes;
  
  return Math.round(remainingBytes / bytesPerMs);
};

UploadSessionSchema.methods.canBeResumed = function(): boolean {
  const now = new Date();
  const isNotExpired = this.expiresAt > now;
  const canResume = ['initiated', 'uploading', 'failed'].includes(this.status);
  
  return isNotExpired && canResume;
};

UploadSessionSchema.methods.markPartComplete = function(
  partNumber: number, 
  etag: string, 
  size: number
): void {
  // Check if part already exists
  const existingPartIndex = this.s3Metadata.parts.findIndex(
    part => part.partNumber === partNumber
  );
  
  if (existingPartIndex >= 0) {
    // Update existing part
    this.s3Metadata.parts[existingPartIndex] = { partNumber, etag, size };
  } else {
    // Add new part
    this.s3Metadata.parts.push({ partNumber, etag, size });
  }
  
  // Update progress
  this.progressData.uploadedParts = this.s3Metadata.parts.length;
  this.progressData.uploadedBytes = this.s3Metadata.parts.reduce(
    (total, part) => total + part.size, 
    0
  );
  
  // Update status
  if (this.status === 'initiated') {
    this.status = 'uploading';
  }
  
  // Sort parts by part number for consistency
  this.s3Metadata.parts.sort((a, b) => a.partNumber - b.partNumber);
};

// Static methods
UploadSessionSchema.statics.findActiveUploads = function(contentId: string) {
  return this.find({
    contentId,
    status: { $in: ['initiated', 'uploading'] },
    expiresAt: { $gt: new Date() }
  });
};

UploadSessionSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      status: { $in: ['initiated', 'uploading'] },
      expiresAt: { $lt: new Date() }
    },
    {
      $set: {
        status: 'failed',
        failureReason: 'Upload session expired'
      }
    }
  );
};

// Transform output
UploadSessionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Add computed fields
    ret.progress = doc.calculateProgress();
    ret.estimatedTimeRemaining = doc.estimateTimeRemaining();
    ret.canResume = doc.canBeResumed();
    
    return ret;
  }
});

export const UploadSession = mongoose.model<IUploadSession>('UploadSession', UploadSessionSchema);
