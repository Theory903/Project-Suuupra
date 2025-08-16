import { Request, Response, NextFunction } from 'express';
import { ElasticsearchService } from '@/services/elasticsearch';
import { validate } from '@/utils/validation';
import { ApiResponse, SearchQuery } from '@/types';
import { logger, ContextLogger } from '@/utils/logger';

export class SearchController {
  private esService: ElasticsearchService;
  private contextLogger: ContextLogger;

  constructor(esService: ElasticsearchService) {
    this.esService = esService;
    this.contextLogger = new ContextLogger({ controller: 'search' });
  }

  // Search content
  public searchContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const searchQuery: SearchQuery = {
        q: req.query.q as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sort: req.query.sort as string || 'relevance',
        order: req.query.order as 'asc' | 'desc' || 'desc',
        filters: {}
      };

      // Parse filters from query parameters
      if (req.query.filters) {
        try {
          searchQuery.filters = typeof req.query.filters === 'string' 
            ? JSON.parse(req.query.filters)
            : req.query.filters as any;
        } catch (error) {
          searchQuery.filters = {};
        }
      }

      // Parse individual filter parameters
      if (req.query.contentType) {
        searchQuery.filters!.contentType = Array.isArray(req.query.contentType) 
          ? req.query.contentType as string[]
          : [req.query.contentType as string];
      }

      if (req.query.category) {
        searchQuery.filters!.category = Array.isArray(req.query.category)
          ? req.query.category as string[]
          : [req.query.category as string];
      }

      if (req.query.tags) {
        searchQuery.filters!.tags = Array.isArray(req.query.tags)
          ? req.query.tags as string[]
          : [req.query.tags as string];
      }

      if (req.query.dateRange) {
        try {
          const dateRange = typeof req.query.dateRange === 'string'
            ? JSON.parse(req.query.dateRange)
            : req.query.dateRange;
          
          searchQuery.filters!.dateRange = {
            from: dateRange.from ? new Date(dateRange.from) : undefined,
            to: dateRange.to ? new Date(dateRange.to) : undefined
          };
        } catch (error) {
          // Ignore invalid date range
        }
      }

      this.contextLogger.info('Performing content search', {
        requestId: user.requestId,
        userId: user.userId,
        tenantId: user.tenantId,
        query: searchQuery.q,
        filters: searchQuery.filters
      });

      // Perform search
      const searchResults = await this.esService.search(searchQuery, user.tenantId);

      this.contextLogger.info('Search completed successfully', {
        requestId: user.requestId,
        query: searchQuery.q,
        resultsCount: searchResults.data.length,
        totalHits: searchResults.meta.totalHits,
        queryTime: searchResults.meta.queryTimeMs
      });

      const response: ApiResponse = {
        success: true,
        data: searchResults.data,
        meta: {
          ...(searchResults.meta.pagination ? { pagination: searchResults.meta.pagination } : {}),
          ...(searchResults.meta.aggregations ? { aggregations: searchResults.meta.aggregations } : {}),
          queryTimeMs: searchResults.meta.queryTimeMs,
          totalHits: searchResults.meta.totalHits,
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      this.contextLogger.error('Search failed', error as Error, {
        requestId: req.user?.requestId,
        query: req.query.q
      });
      next(error);
    }
  };

  // Get search suggestions
  public getSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || query.length < 2) {
        const response: ApiResponse = {
          success: true,
          data: [],
          meta: {
            requestId: user.requestId,
            timestamp: new Date().toISOString()
          }
        };
        res.json(response);
        return;
      }

      this.contextLogger.debug('Getting search suggestions', {
        requestId: user.requestId,
        query,
        limit
      });

      const suggestions = await this.esService.getSuggestions(query, user.tenantId, limit);

      const response: ApiResponse = {
        success: true,
        data: suggestions,
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      this.contextLogger.error('Failed to get suggestions', error as Error, {
        requestId: req.user?.requestId,
        query: req.query.q
      });
      next(error);
    }
  };

  // Get search aggregations (facets)
  public getAggregations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const query = req.query.q as string || '*';

      // Perform search with empty results to get aggregations only
      const searchQuery: SearchQuery = {
        q: query,
        page: 1,
        limit: 0, // No results, just aggregations
        filters: {}
      };

      const searchResults = await this.esService.search(searchQuery, user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: searchResults.meta.aggregations || {},
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      this.contextLogger.error('Failed to get aggregations', error as Error, {
        requestId: req.user?.requestId
      });
      next(error);
    }
  };
}
