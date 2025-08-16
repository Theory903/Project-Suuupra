import { embeddingService } from '../../../src/services/embeddings';

describe('EmbeddingService', () => {
  it('returns 768-d normalized vector', async () => {
    const vec = await embeddingService.embedForContent({ title: 'Hello', description: 'World', tags: ['a', 'b'] });
    expect(vec.length).toBe(768);
    // check normalization roughly
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });
});

