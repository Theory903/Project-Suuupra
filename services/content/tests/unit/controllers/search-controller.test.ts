import { SearchController } from '../../../src/controllers/search';

describe('SearchController - query parsing', () => {
  const makeReq = (query: any = {}) => ({
    query,
    user: { requestId: 'r', userId: 'u', tenantId: 't', roles: [], permissions: [] }
  } as any);

  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('parses filters from query params and passes to ES', async () => {
    const es = { search: jest.fn().mockResolvedValue({ data: [], meta: { totalHits: 0, queryTimeMs: 1 } }) } as any;
    const ctrl = new SearchController(es);
    const q = {
      q: 'javascript',
      page: '2',
      limit: '10',
      sort: 'created_at',
      order: 'asc',
      contentType: ['article', 'video'],
      category: 'cat123',
      tags: ['tutorial', 'js'],
      dateRange: JSON.stringify({ from: '2024-01-01T00:00:00.000Z', to: '2024-12-31T23:59:59.000Z' })
    };
    const req: any = makeReq(q);
    const res = makeRes();
    await ctrl.searchContent(req, res, jest.fn());

    expect(es.search).toHaveBeenCalled();
    const [searchQuery, tenantId] = es.search.mock.calls[0];
    expect(tenantId).toBe('t');
    expect(searchQuery.q).toBe('javascript');
    expect(searchQuery.page).toBe(2);
    expect(searchQuery.limit).toBe(10);
    expect(searchQuery.sort).toBe('created_at');
    expect(searchQuery.order).toBe('asc');
    expect(searchQuery.filters.contentType).toEqual(['article', 'video']);
    expect(searchQuery.filters.category).toEqual(['cat123']);
    expect(searchQuery.filters.tags).toEqual(['tutorial', 'js']);
    expect(searchQuery.filters.dateRange.from).toBeInstanceOf(Date);
    expect(searchQuery.filters.dateRange.to).toBeInstanceOf(Date);
  });
});

