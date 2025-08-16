import { Content } from '@/models/Content';
import { IContent } from '@/models/Content';
import { logger, ContextLogger } from '@/utils/logger';

// Very lightweight, in-memory inverted index for titles/descriptions/tags
// Intended as a learning aid; not for production-scale search
export class InvertedIndexService {
  private index: Map<string, Set<string>> = new Map();
  private docs: Map<string, { id: string; title: string; description?: string; tags: string[]; contentType: string; tenantId: string; createdAt: Date }> = new Map();
  private contextLogger = new ContextLogger({ service: 'inverted-index' });
  private builtForTenant?: string;

  public async build(tenantId: string): Promise<void> {
    this.contextLogger.info('Building inverted index...', { tenantId });
    this.index.clear();
    this.docs.clear();

    const cursor = Content.find({ tenantId, deleted: false }).cursor();
    let count = 0;
    for await (const doc of cursor) {
      this.addDocument(doc as unknown as IContent);
      count++;
    }
    this.builtForTenant = tenantId;
    this.contextLogger.info('Inverted index built', { tenantId, count });
  }

  public addDocument(doc: IContent): void {
    const id = doc._id;
    const tokens = this.tokenize(`${doc.title} ${doc.description || ''} ${(doc.tags || []).join(' ')}`);
    this.docs.set(id, {
      id,
      title: doc.title,
      description: doc.description,
      tags: doc.tags || [],
      contentType: doc.contentType,
      tenantId: doc.tenantId,
      createdAt: doc.createdAt
    });
    for (const t of tokens) {
      if (!this.index.has(t)) this.index.set(t, new Set());
      this.index.get(t)!.add(id);
    }
  }

  public removeDocument(id: string): void {
    if (!this.docs.has(id)) return;
    // Rebuild postings for the removed doc tokens
    const doc = this.docs.get(id)!;
    const tokens = this.tokenize(`${doc.title} ${doc.description || ''} ${doc.tags.join(' ')}`);
    for (const t of tokens) {
      const set = this.index.get(t);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.index.delete(t);
      }
    }
    this.docs.delete(id);
  }

  public search(q: string, options?: { limit?: number; contentType?: string[] }): { id: string; title: string; description?: string; tags: string[]; contentType: string }[] {
    const tokens = this.tokenize(q);
    if (tokens.length === 0) return [];

    // AND semantics across tokens
    let resultSet: Set<string> | null = null;
    for (const t of tokens) {
      const postings = this.index.get(t);
      if (!postings) return [];
      resultSet = resultSet ? this.intersect(resultSet, postings) : new Set(postings);
      if (resultSet.size === 0) return [];
    }

    const limit = options?.limit ?? 20;
    const filterTypes = options?.contentType;

    const results: { id: string; title: string; description?: string; tags: string[]; contentType: string }[] = [];
    for (const id of resultSet!.values()) {
      const d = this.docs.get(id);
      if (!d) continue;
      if (filterTypes && !filterTypes.includes(d.contentType)) continue;
      results.push({ id: d.id, title: d.title, description: d.description, tags: d.tags, contentType: d.contentType });
      if (results.length >= limit) break;
    }
    // Naive ranking: recent first
    results.sort((a, b) => (this.docs.get(b.id)!.createdAt.getTime() - this.docs.get(a.id)!.createdAt.getTime()));
    return results;
  }

  private tokenize(text: string): string[] {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  private intersect(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    const [small, large] = a.size < b.size ? [a, b] : [b, a];
    for (const x of small) if (large.has(x)) out.add(x);
    return out;
  }
}
