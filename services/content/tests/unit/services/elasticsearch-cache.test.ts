import { ElasticsearchService } from '../../../src/services/elasticsearch';

describe('ElasticsearchService caching', () => {
  it('caches search responses for identical queries', async () => {
    const es = new ElasticsearchService() as any;
    // Inject mock client
    const mockSearch = jest.fn().mockResolvedValue({ hits: { hits: [], total: 0 }, aggregations: {} });
    es.client = { search: mockSearch };

    const query = { q: 'test', page: 1, limit: 10 } as any;
    await es.search(query, 'tenant-1');
    await es.search(query, 'tenant-1');

    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it('does not reuse cache across different tenants', async () => {
    const es = new ElasticsearchService() as any;
    const mockSearch = jest.fn().mockResolvedValue({ hits: { hits: [], total: 0 }, aggregations: {} });
    es.client = { search: mockSearch };

    const query = { q: 'test', page: 1, limit: 10 } as any;
    await es.search(query, 'tenant-1');
    await es.search(query, 'tenant-2');

    expect(mockSearch).toHaveBeenCalledTimes(2);
  });
});

