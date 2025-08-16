import { Content } from '@/models/Content';
import { embeddingService } from '@/services/embeddings';
import { ContextLogger } from '@/utils/logger';

const log = new ContextLogger({ worker: 'compute-embeddings' });

export async function computeEmbeddingsForTenant(tenantId: string): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;
  const cursor = Content.find({ tenantId, deleted: false }).cursor();
  for await (const doc of cursor) {
    try {
      if (Array.isArray((doc as any).embedding) && (doc as any).embedding.length === 768) {
        skipped++;
        continue;
      }
      const vec = await embeddingService.embedForContent({ title: doc.title, description: doc.description, tags: doc.tags });
      (doc as any).embedding = vec;
      await doc.save();
      updated++;
    } catch (e) {
      log.error('Failed to compute embedding', e as Error, { id: String((doc as any)._id) });
    }
  }
  log.info('Embedding computation complete', { tenantId, updated, skipped });
  return { updated, skipped };
}

