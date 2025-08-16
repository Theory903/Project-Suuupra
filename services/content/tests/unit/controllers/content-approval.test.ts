jest.mock('../../../src/models/Content', () => ({
  Content: {
    findOne: jest.fn()
  }
}));

import { ContentController } from '../../../src/controllers/content';
import { Content } from '../../../src/models/Content';

describe('ContentController - approvals/publish', () => {
  const makeReq = (params: any = {}, body: any = {}) => ({
    params,
    body,
    user: { requestId: 'r', userId: 'moderator', tenantId: 't', roles: ['moderator'], permissions: [] }
  } as any);
  const makeRes = () => ({ json: jest.fn().mockReturnValue({}), status: jest.fn().mockReturnValue({}) } as any);
  const next = jest.fn();

  const s3: any = {};
  const ws = { sendUserNotification: jest.fn(), sendTenantNotification: jest.fn() } as any;
  const ctrl = new ContentController(s3, ws);

  beforeEach(() => jest.clearAllMocks());

  it('approves content in pending_approval', async () => {
    const doc: any = {
      _id: 'c1', tenantId: 't', status: 'pending_approval', createdBy: 'creator', title: 'T', etag: 'e',
      save: jest.fn().mockResolvedValue(undefined), toJSON: () => ({ id: 'c1', status: 'approved' })
    };
    (Content.findOne as any).mockResolvedValue(doc);

    const req = makeReq({ id: 'c1' });
    const res = makeRes();
    await ctrl.approveContent(req, res, next);
    expect(doc.status).toBe('approved');
    expect(ws.sendUserNotification).toHaveBeenCalledWith('creator', 'content:approved', expect.any(Object));
  });

  it('publishes approved content', async () => {
    const doc: any = {
      _id: 'c2', tenantId: 't', status: 'approved', createdBy: 'creator', title: 'T', etag: 'e',
      save: jest.fn().mockResolvedValue(undefined), toJSON: () => ({ id: 'c2', status: 'published' })
    };
    (Content.findOne as any).mockResolvedValue(doc);

    const req = makeReq({ id: 'c2' });
    const res = makeRes();
    await ctrl.publishContent(req, res, next);
    expect(doc.status).toBe('published');
    expect(ws.sendUserNotification).toHaveBeenCalledWith('creator', 'content:published', expect.any(Object));
    expect(ws.sendTenantNotification).toHaveBeenCalled();
  });
});

