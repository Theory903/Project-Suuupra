jest.mock('../../../src/models/AuditLog', () => ({
  AuditLog: { create: jest.fn().mockResolvedValue(undefined) }
}));

import { auditService } from '../../../src/services/audit';
import { AuditLog } from '../../../src/models/AuditLog';

describe('AuditService', () => {
  it('writes an audit log entry', async () => {
    await auditService.record({
      tenantId: 't',
      userId: 'u',
      action: 'content.update',
      resourceType: 'content',
      resourceId: 'id1',
      details: { a: 1 }
    });
    expect((AuditLog.create as any)).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't', action: 'content.update' }));
  });
});

