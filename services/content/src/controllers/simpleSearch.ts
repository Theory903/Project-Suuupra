import { Request, Response, NextFunction } from 'express';
import { InvertedIndexService } from '@/services/inverted-index';
import { ApiResponse } from '@/types';

export class SimpleSearchController {
  constructor(private idx: InvertedIndexService) {}

  public search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const q = (req.query.q as string) || '';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const types = req.query.contentType ? String(req.query.contentType).split(',') : undefined;

      if (!q.trim()) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'q is required' } });
        return;
      }

      const data = this.idx.search(q, { limit, contentType: types || undefined });

      const response: ApiResponse = {
        success: true,
        data,
        meta: { requestId: user.requestId, timestamp: new Date().toISOString() }
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  };
}

