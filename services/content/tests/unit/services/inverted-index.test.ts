import { InvertedIndexService } from '../../../src/services/inverted-index';

describe('InvertedIndexService', () => {
  it('indexes and searches simple documents', () => {
    const idx = new InvertedIndexService();
    // @ts-ignore - use minimal shape
    idx.addDocument({ _id: '1', title: 'Learn TypeScript', description: 'Guide and tutorial', tags: ['ts'], contentType: 'article', tenantId: 't1', createdAt: new Date() });
    // @ts-ignore
    idx.addDocument({ _id: '2', title: 'Advanced JavaScript', description: 'JS deep dive', tags: ['js'], contentType: 'article', tenantId: 't1', createdAt: new Date() });

    const res1 = idx.search('TypeScript');
    expect(res1.map(r => r.id)).toContain('1');
    const res2 = idx.search('JavaScript');
    expect(res2.map(r => r.id)).toContain('2');
    const res3 = idx.search('Python');
    expect(res3.length).toBe(0);
  });
});

