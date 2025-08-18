import { Request, Response, NextFunction } from 'express';
import { Content } from '@/models/Content';
import { ElasticsearchService } from '@/services/elasticsearch';
import { embeddingService } from '@/services/embeddings';
import { ApiResponse, ValidationError, NotFoundError } from '@/types';

export class SimilarityController {
  constructor(private es: ElasticsearchService) {}

  public similarById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = req.params.id;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      if (!id) throw new ValidationError('Content ID is required');

      const content = await Content.findOne({ _id: id, tenantId: user.tenantId, deleted: false });
      if (!content) throw new NotFoundError('Content', id);

      // ensure embedding
      let vector = content.embedding;
      if (!vector || vector.length !== 768) {
        vector = await embeddingService.embedForContent({ title: content.title, description: content.description || undefined, tags: content.tags });
        content.embedding = vector;
        await content.save();
      }

      const results = await this.es.similarByEmbedding(user.tenantId, vector, limit);
      const response: ApiResponse = {
        success: true,
        data: results.data,
        meta: { ...results.meta, requestId: user.requestId, timestamp: new Date().toISOString() }
      };
      res.json(response);
    } catch (e) {
      next(e);
    }
  };
}

