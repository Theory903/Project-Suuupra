import { ElasticsearchService } from '../../../src/services/elasticsearch';

describe('ElasticsearchService suggestion caching', () => {
  it('caches suggestions for same prefix', async () => {
    const es = new ElasticsearchService() as any;
    const mockSearch = jest.fn().mockResolvedValue({ suggest: { title_suggest: [{ options: [{ text: 'test' }] }] } });
    es.client = { search: mockSearch };
    es.circuitBreaker = { execute: async (fn: any) => await fn() };

    // Preload cache
    const key = (es as any)['buildCacheKey']('suggest', 'tenant-1', { q: 'ja', limit: 5 });
    (es as any)['setInCache'](key, ['ja']);
    await es.getSuggestions('ja', 'tenant-1', 5);
    await es.getSuggestions('ja', 'tenant-1', 5);
    expect(mockSearch).toHaveBeenCalledTimes(0);
  });

  it('returns cached suggestions when present', async () => {
    const es = new ElasticsearchService() as any;
    const mockSearch = jest.fn().mockResolvedValue({ suggest: { title_suggest: [{ options: [{ text: 'x' }] }] } });
    es.client = { search: mockSearch };
    es.circuitBreaker = { execute: async (fn: any) => await fn() };

    const key = (es as any)['buildCacheKey']('suggest', 'tenant-2', { q: 'ja', limit: 5 });
    (es as any)['setInCache'](key, ['t2']);
    await es.getSuggestions('ja', 'tenant-2', 5);
    expect(mockSearch).toHaveBeenCalledTimes(0);
  });
});
