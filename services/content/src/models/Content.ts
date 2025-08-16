import mongoose, { Schema, Document, Types } from 'mongoose';
import { ContentType, ContentStatus, FileInfo, ContentMetadata } from '@/types';

export interface IContent extends Document {
  _id: string;
  tenantId: string;
  title: string;
  description?: string;
  contentType: ContentType;
  status: ContentStatus;
  version: string;
  categoryId?: string;
  tags: string[];
  metadata: ContentMetadata;
  fileInfo?: FileInfo;
  embedding?: number[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  etag: string;
  deleted: boolean;
  deletedAt?: Date;
  
  // Virtual fields
  id: string;
  
  // Instance methods
  generateETag(): string;
  canBeEditedBy(userId: string, roles: string[]): boolean;
  toSearchDocument(): any;
}

const FileInfoSchema = new Schema({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  s3Key: { type: String, required: true },
  cdnUrl: String,
  checksumSha256: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const ContentSchema = new Schema<IContent>({
  _id: { 
    type: String, 
    default: () => new Types.ObjectId().toString() 
  },
  tenantId: { 
    type: String, 
    required: true, 
    index: true 
  },
  title: { 
    type: String, 
    required: true, 
    maxlength: 255,
    trim: true
  },
  description: { 
    type: String, 
    maxlength: 2000,
    trim: true
  },
  contentType: {
    type: String,
    required: true,
    // Include course and lesson to align with controllers and types
    enum: ['video', 'article', 'quiz', 'document', 'course', 'lesson'],
    index: true
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['draft', 'pending_approval', 'approved', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  version: { 
    type: String, 
    required: true, 
    default: '1.0.0',
    match: /^\d+\.\d+\.\d+$/
  },
  categoryId: { 
    type: String, 
    index: true 
  },
  tags: [{ 
    type: String, 
    maxlength: 50,
    trim: true,
    lowercase: true
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  fileInfo: {
    type: FileInfoSchema,
    required: false // Make fileInfo optional in schema
  },
  embedding: {
    type: [Number],
    required: false,
    default: undefined
  },
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  publishedAt: { 
    type: Date, 
    index: true 
  },
  etag: { 
    type: String, 
    required: true,
    default: () => new Types.ObjectId().toString()
  },
  deleted: { 
    type: Boolean, 
    default: false, 
    index: true 
  },
  deletedAt: Date
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  versionKey: false,
  collection: 'contents'
});

// Compound indexes for common queries
ContentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
ContentSchema.index({ tenantId: 1, contentType: 1, createdAt: -1 });
ContentSchema.index({ tenantId: 1, categoryId: 1, createdAt: -1 });
ContentSchema.index({ tenantId: 1, tags: 1, createdAt: -1 });
ContentSchema.index({ tenantId: 1, createdBy: 1, createdAt: -1 });
ContentSchema.index({ tenantId: 1, deleted: 1, createdAt: -1 });
ContentSchema.index({ tenantId: 1, publishedAt: -1 }, { 
  partialFilterExpression: { status: 'published', deleted: false } 
});

// Text search index
ContentSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text' 
}, {
  weights: { title: 10, description: 5, tags: 1 },
  name: 'content_text_index'
});

// Virtual for id field
ContentSchema.virtual('id').get(function() {
  return this._id;
});

// Pre-save middleware
ContentSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.etag = this.generateETag();
    this.updatedAt = new Date();
  }
  
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Normalize tags
  if (this.isModified('tags')) {
    this.tags = [...new Set(this.tags.filter(tag => tag.trim().length > 0))];
  }
  
  next();
});

// Instance methods
ContentSchema.methods.generateETag = function(): string {
  return new Types.ObjectId().toString();
};

ContentSchema.methods.canBeEditedBy = function(userId: string, roles: string[]): boolean {
  // Content creator can always edit their own content
  if (this.createdBy === userId) {
    return true;
  }
  
  // Admins and moderators can edit any content
  if (roles.includes('admin') || roles.includes('moderator')) {
    return true;
  }
  
  return false;
};

ContentSchema.methods.toSearchDocument = function() {
  return {
    id: this._id,
    tenant_id: this.tenantId,
    title: this.title,
    description: this.description,
    content_type: this.contentType,
    status: this.status,
    version: this.version,
    tags: this.tags,
    metadata: this.metadata,
    file_info: this.fileInfo ? {
      filename: this.fileInfo.filename,
      content_type: this.fileInfo.contentType,
      file_size: this.fileInfo.fileSize,
      duration: this.metadata?.duration
    } : undefined,
    created_by: this.createdBy,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
    published_at: this.publishedAt,
    view_count: this.metadata?.viewCount || 0,
    engagement_score: this.metadata?.engagementScore || 0.0
  };
};

// Transform output
ContentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Content = mongoose.model<IContent>('Content', ContentSchema);
