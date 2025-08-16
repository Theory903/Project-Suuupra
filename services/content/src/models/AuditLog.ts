import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: string;
  tenantId: string;
  userId: string;
  action: string; // e.g., content.create, content.update, workflow.approve
  resourceType: string; // 'content'
  resourceId: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  _id: { type: String, default: () => new Types.ObjectId().toString() },
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true },
  resourceId: { type: String, required: true, index: true },
  details: { type: Schema.Types.Mixed, default: {} },
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
}, {
  collection: 'audit_logs',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

AuditLogSchema.index({ tenantId: 1, resourceType: 1, resourceId: 1, createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

