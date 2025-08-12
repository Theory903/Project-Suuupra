import { Request, Response, NextFunction } from 'express';
import { ContentWorkflowService, WorkflowAction } from '@/services/workflow';
import { WebSocketService } from '@/services/websocket';
import { ApiResponse, ValidationError } from '@/types';
import { logger, ContextLogger } from '@/utils/logger';
import { recordContentOperation } from '@/utils/metrics';

export class WorkflowController {
  private workflowService: ContentWorkflowService;
  private contextLogger: ContextLogger;

  constructor(wsService: WebSocketService) {
    this.workflowService = new ContentWorkflowService(wsService);
    this.contextLogger = new ContextLogger({ controller: 'workflow' });
  }

  // Submit content for approval
  public submitForApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      this.contextLogger.info('Submitting content for approval', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId
      });

      const content = await this.workflowService.executeAction(
        id,
        'submit_for_approval',
        user.userId,
        user.roles,
        user.permissions,
        user.tenantId
      );

      // Record metrics
      recordContentOperation('submit_approval', content.contentType, 'success', user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      recordContentOperation('submit_approval', 'unknown', 'failure', req.user?.tenantId || 'unknown');
      next(error);
    }
  };

  // Approve content
  public approveContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason, metadata } = req.body;
      const user = req.user!;

      this.contextLogger.info('Approving content', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId
      });

      const content = await this.workflowService.executeAction(
        id,
        'approve',
        user.userId,
        user.roles,
        user.permissions,
        user.tenantId,
        { reason, metadata }
      );

      // Record metrics
      recordContentOperation('approve', content.contentType, 'success', user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      recordContentOperation('approve', 'unknown', 'failure', req.user?.tenantId || 'unknown');
      next(error);
    }
  };

  // Reject content
  public rejectContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason, metadata } = req.body;
      const user = req.user!;

      if (!reason) {
        throw new ValidationError('Rejection reason is required');
      }

      this.contextLogger.info('Rejecting content', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId,
        reason
      });

      const content = await this.workflowService.executeAction(
        id,
        'reject',
        user.userId,
        user.roles,
        user.permissions,
        user.tenantId,
        { reason, metadata }
      );

      // Record metrics
      recordContentOperation('reject', content.contentType, 'success', user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      recordContentOperation('reject', 'unknown', 'failure', req.user?.tenantId || 'unknown');
      next(error);
    }
  };

  // Publish content
  public publishContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { versionBump, metadata } = req.body;
      const user = req.user!;

      this.contextLogger.info('Publishing content', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId,
        versionBump
      });

      const content = await this.workflowService.executeAction(
        id,
        'publish',
        user.userId,
        user.roles,
        user.permissions,
        user.tenantId,
        { versionBump, metadata }
      );

      // Record metrics
      recordContentOperation('publish', content.contentType, 'success', user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      recordContentOperation('publish', 'unknown', 'failure', req.user?.tenantId || 'unknown');
      next(error);
    }
  };

  // Archive content
  public archiveContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason, metadata } = req.body;
      const user = req.user!;

      this.contextLogger.info('Archiving content', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId,
        reason
      });

      const content = await this.workflowService.executeAction(
        id,
        'archive',
        user.userId,
        user.roles,
        user.permissions,
        user.tenantId,
        { reason, metadata }
      );

      // Record metrics
      recordContentOperation('archive', content.contentType, 'success', user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      recordContentOperation('archive', 'unknown', 'failure', req.user?.tenantId || 'unknown');
      next(error);
    }
  };

  // Restore content
  public restoreContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason, metadata } = req.body;
      const user = req.user!;

      this.contextLogger.info('Restoring content', {
        requestId: user.requestId,
        contentId: id,
        userId: user.userId,
        reason
      });

      const content = await this.workflowService.executeAction(
        id,
        'restore',
        user.userId,
        user.roles,
        user.permissions,
        user.tenantId,
        { reason, metadata }
      );

      // Record metrics
      recordContentOperation('restore', content.contentType, 'success', user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: content.toJSON(),
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      recordContentOperation('restore', 'unknown', 'failure', req.user?.tenantId || 'unknown');
      next(error);
    }
  };

  // Get available workflow actions for content
  public getAvailableActions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const { Content } = await import('@/models/Content');
      const content = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Content not found'
          }
        });
        return;
      }

      const availableActions = this.workflowService.getAvailableActions(
        content,
        user.roles,
        user.permissions
      );

      const response: ApiResponse = {
        success: true,
        data: {
          contentId: id,
          currentStatus: content.status,
          availableActions
        },
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Get workflow history for content
  public getWorkflowHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const { Content } = await import('@/models/Content');
      const content = await Content.findOne({
        _id: id,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Content not found'
          }
        });
        return;
      }

      const workflowHistory = this.workflowService.getWorkflowHistory(content);

      const response: ApiResponse = {
        success: true,
        data: {
          contentId: id,
          workflowHistory
        },
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Get workflow statistics
  public getWorkflowStatistics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { from, to } = req.query;

      let timeRange: { from: Date; to: Date } | undefined;
      if (from && to) {
        timeRange = {
          from: new Date(from as string),
          to: new Date(to as string)
        };
      }

      const statistics = await this.workflowService.getWorkflowStatistics(
        user.tenantId,
        timeRange
      );

      const response: ApiResponse = {
        success: true,
        data: statistics,
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString(),
          timeRange
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Bulk workflow operations
  public bulkWorkflowAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contentIds, action, reason, metadata } = req.body;
      const user = req.user!;

      if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
        throw new ValidationError('contentIds must be a non-empty array');
      }

      if (!action || !['approve', 'reject', 'publish', 'archive', 'restore'].includes(action)) {
        throw new ValidationError('Invalid or missing action');
      }

      this.contextLogger.info('Executing bulk workflow action', {
        requestId: user.requestId,
        action,
        contentCount: contentIds.length,
        userId: user.userId
      });

      const results = await this.workflowService.bulkExecuteAction(
        contentIds,
        action as WorkflowAction,
        user.userId,
        user.roles,
        user.permissions,
        user.tenantId,
        { reason, metadata }
      );

      const response: ApiResponse = {
        success: true,
        data: {
          action,
          results,
          summary: {
            total: contentIds.length,
            successful: results.successful.length,
            failed: results.failed.length
          }
        },
        meta: {
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Get content pending approval (for moderators/admins)
  public getPendingApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { page = 1, limit = 20 } = req.query;

      // Check if user can approve content
      if (!user.roles.includes('moderator') && !user.roles.includes('admin')) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient privileges to view pending approval queue'
          }
        });
        return;
      }

      const { Content } = await import('@/models/Content');
      const skip = (Number(page) - 1) * Number(limit);

      const [contents, total] = await Promise.all([
        Content.find({
          tenantId: user.tenantId,
          status: 'pending_approval',
          deleted: false
        })
        .sort({ updatedAt: 1 }) // Oldest first
        .skip(skip)
        .limit(Number(limit))
        .lean(),
        Content.countDocuments({
          tenantId: user.tenantId,
          status: 'pending_approval',
          deleted: false
        })
      ]);

      const totalPages = Math.ceil(total / Number(limit));

      const response: ApiResponse = {
        success: true,
        data: contents,
        meta: {
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
            hasNext: Number(page) < totalPages,
            hasPrev: Number(page) > 1
          },
          requestId: user.requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}
