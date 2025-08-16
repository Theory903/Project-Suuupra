import mongoose, { Schema, Document, Types } from 'mongoose';

export type MediaAssetType = 'video' | 'audio' | 'image' | 'document' | 'transcript' | 'subtitle' | 'attachment';

export interface IMediaAsset extends Document {
  _id: string;
  tenantId: string;
  contentId: string;
  type: MediaAssetType;
  title?: string;
  description?: string;
  fileInfo: {
    filename: string;
    contentType: string;
    fileSize: number;
    s3Key: string;
    cdnUrl?: string;
    checksumSha256?: string;
    uploadedAt: Date;
  };
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  id: string; // virtual
}

const FileInfoSchema = new Schema({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  s3Key: { type: String, required: true },
  cdnUrl: { type: String },
  checksumSha256: { type: String },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const MediaAssetSchema = new Schema<IMediaAsset>({
  _id: {
    type: String,
    default: () => new Types.ObjectId().toString()
  },
  tenantId: { type: String, required: true, index: true },
  contentId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: ['video', 'audio', 'image', 'document', 'transcript', 'subtitle', 'attachment']
  },
  title: { type: String, maxlength: 255, trim: true },
  description: { type: String, maxlength: 1000, trim: true },
  fileInfo: { type: FileInfoSchema, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  versionKey: false,
  collection: 'media_assets'
});

MediaAssetSchema.index({ tenantId: 1, contentId: 1, type: 1, createdAt: -1 });

MediaAssetSchema.virtual('id').get(function () {
  return this._id;
});

MediaAssetSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const MediaAsset = mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);

