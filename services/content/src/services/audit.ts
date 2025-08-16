import { AuditLog } from '@/models/AuditLog';
import { ContextLogger } from '@/utils/logger';

export class AuditService {
  private context = new ContextLogger({ service: 'audit' });

  async record(params: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, any>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await AuditLog.create({ ...params });
    } catch (e) {
      this.context.error('Failed to write audit log', e as Error, { action: params.action, resourceId: params.resourceId });
    }
  }
}

export const auditService = new AuditService();

