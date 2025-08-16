import { ElasticsearchService } from '@/services/elasticsearch';
import { Content } from '@/models/Content';
import { Category } from '@/models/Category';
import { logger, ContextLogger } from '@/utils/logger';

const context = new ContextLogger({ worker: 'reindex-elasticsearch' });

export async function reindexTenant(es: ElasticsearchService, tenantId: string): Promise<{ indexed: number; skipped: number }> {
  context.info('Starting tenant reindex', { tenantId });
  let indexed = 0;
  let skipped = 0;
  const cursor = Content.find({ tenantId, deleted: false }).cursor();

  for await (const doc of cursor) {
    try {
      // Build ES document similar to toSearchDocument if exists
      const category = doc.categoryId ? await Category.findById(doc.categoryId) : null;
      const body: any = {
        id: doc._id,
        tenant_id: doc.tenantId,
        title: doc.title,
        description: doc.description,
        content_type: doc.contentType,
        status: doc.status,
        version: doc.version,
        category: category ? { id: category._id, name: category.name, path: await category.getFullPath() } : undefined,
        tags: doc.tags || [],
        metadata: doc.metadata || {},
        file_info: doc.fileInfo ? {
          filename: doc.fileInfo.filename,
          content_type: doc.fileInfo.contentType,
          file_size: doc.fileInfo.fileSize
        } : undefined,
        created_by: doc.createdBy,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt,
        published_at: doc.publishedAt
      };
      await es.index({ id: String(doc._id), body, tenantId });
      indexed++;
    } catch (e) {
      skipped++;
      context.error('Failed to index content', e as Error, { id: String((doc as any)._id) });
    }
  }

  context.info('Tenant reindex completed', { tenantId, indexed, skipped });
  return { indexed, skipped };
}

