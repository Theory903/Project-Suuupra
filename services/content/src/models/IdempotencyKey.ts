import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IIdempotencyKey extends Document {
  _id: string;
  tenantId: string;
  userId: string;
  key: string;
  endpoint: string;
  method: string;
  requestHash?: string;
  resourceType: string;
  resourceId: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: Date;
  expiresAt: Date;
}

const IdempotencyKeySchema = new Schema<IIdempotencyKey>({
  _id: { type: String, default: () => new Types.ObjectId().toString() },
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  key: { type: String, required: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  requestHash: { type: String },
  resourceType: { type: String, required: true },
  resourceId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'succeeded' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, {
  versionKey: false,
  collection: 'idempotency_keys'
});

// Unique per tenant-user-key-endpoint-method
IdempotencyKeySchema.index({ tenantId: 1, userId: 1, key: 1, endpoint: 1, method: 1 }, { unique: true });

export const IdempotencyKey = mongoose.model<IIdempotencyKey>('IdempotencyKey', IdempotencyKeySchema);

