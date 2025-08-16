jest.mock('../../../src/models/Content', () => ({
  Content: {
    find: () => ({
      cursor: async function* () {
        yield {
          _id: '1', tenantId: 't', title: 'A', description: 'D', contentType: 'article', status: 'published',
          version: '1.0.0', tags: [], metadata: {}, createdBy: 'u', createdAt: new Date(), updatedAt: new Date(), publishedAt: new Date()
        } as any;
      }
    })
  }
}));

jest.mock('../../../src/models/Category', () => ({
  Category: { findById: jest.fn().mockResolvedValue(null) }
}));

import { reindexTenant } from '../../../src/workers/reindex-elasticsearch';

describe('reindex-elasticsearch worker', () => {
  it('indexes documents for a tenant', async () => {
    const es = { index: jest.fn().mockResolvedValue(undefined) } as any;
    const stats = await reindexTenant(es, 't');
    expect(es.index).toHaveBeenCalledTimes(1);
    expect(stats.indexed).toBe(1);
  });
});

