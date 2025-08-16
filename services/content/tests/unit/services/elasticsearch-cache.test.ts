import { ElasticsearchService } from '../../../src/services/elasticsearch';

describe('ElasticsearchService caching', () => {
  it('caches search responses for identical queries', async () => {
    const es = new ElasticsearchService() as any;
    const mockSearch = jest.fn().mockResolvedValue({ hits: { hits: [], total: 0 }, aggregations: {} });
    es.client = { search: mockSearch };
    es.circuitBreaker = { execute: async (fn: any) => await fn() };

    const query = { q: 'test', page: 1, limit: 10 } as any;
    // Preload cache and ensure client.search is not called
    const key = es.buildCacheKey ? es.buildCacheKey('search', 'tenant-1', query) : (es as any)['buildCacheKey']('search', 'tenant-1', query);
    const setInCache = (es as any)['setInCache'].bind(es);
    setInCache(key, { data: [], meta: { totalHits: 0, queryTimeMs: 0 } });

    await es.search(query, 'tenant-1');
    await es.search(query, 'tenant-1');

    expect(mockSearch).toHaveBeenCalledTimes(0);
  });

  it('returns cached results when present', async () => {
    const es = new ElasticsearchService() as any;
    const mockSearch = jest.fn().mockResolvedValue({ hits: { hits: [], total: 0 }, aggregations: {} });
    es.client = { search: mockSearch };
    es.circuitBreaker = { execute: async (fn: any) => await fn() };

    const query = { q: 'test', page: 1, limit: 10 } as any;
    const key = (es as any)['buildCacheKey']('search', 'tenant-2', query);
    (es as any)['setInCache'](key, { data: [], meta: { totalHits: 0, queryTimeMs: 0 } });

    await es.search(query, 'tenant-2');
    expect(mockSearch).toHaveBeenCalledTimes(0);
  });
});
