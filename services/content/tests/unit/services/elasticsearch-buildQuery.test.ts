import { ElasticsearchService } from '../../../src/services/elasticsearch';

describe('ElasticsearchService - build query and client call', () => {
  it('builds ES body with filters and sort', async () => {
    const es = new ElasticsearchService() as any;
    const mockSearch = jest.fn().mockResolvedValue({ hits: { hits: [], total: 0 }, aggregations: {} });
    es.client = { search: mockSearch };

    const query = {
      q: 'nodejs',
      page: 3,
      limit: 5,
      sort: 'title',
      order: 'asc',
      filters: {
        contentType: ['article'],
        category: ['c1', 'c2'],
        tags: ['t1'],
        dateRange: { from: new Date('2024-01-01T00:00:00.000Z') }
      }
    } as any;

    await es.search(query, 'tenant-x');

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const args = mockSearch.mock.calls[0][0];
    expect(args.index).toContain('tenant-x');
    const body = args.body;
    expect(body.size).toBe(5);
    expect(body.from).toBe(10); // (page-1)*limit = (3-1)*5
    expect(body.sort).toEqual([{ 'title.exact': { order: 'asc' } }]);
    const filters = body.query.bool.filter;
    // Ensures published filter and content_type terms exist
    expect(filters).toEqual(expect.arrayContaining([
      expect.objectContaining({ term: { status: 'published' } }),
      expect.objectContaining({ terms: { content_type: ['article'] } })
    ]));
  });
});

