import { Content, IContent } from '@/models/Content';
import { logger, ContextLogger } from '@/utils/logger';
import { WebSocketService } from './websocket';
import { ValidationError, NotFoundError, ConflictError } from '@/types';
import semver from 'semver';
import { v4 as uuidv4 } from 'uuid';

export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'archived';
export type WorkflowAction = 'submit_for_approval' | 'approve' | 'reject' | 'publish' | 'archive' | 'restore';

export interface WorkflowTransition {
  from: ContentStatus[];
  to: ContentStatus;
  requiredRoles: string[];
  requiredPermissions?: string[];
}

export interface WorkflowEvent {
  contentId: string;
  action: WorkflowAction;
  fromStatus: ContentStatus;
  toStatus: ContentStatus;
  userId: string;
  reason?: string | undefined;
  metadata?: Record<string, any> | undefined;
  timestamp: Date;
}

export class ContentWorkflowService {
  private wsService: WebSocketService;
  private contextLogger: ContextLogger;

  // Define workflow state machine
  private transitions: Map<WorkflowAction, WorkflowTransition> = new Map([
    ['submit_for_approval', {
      from: ['draft'],
      to: 'pending_approval',
      requiredRoles: ['creator', 'moderator', 'admin'],
      requiredPermissions: ['content.submit']
    }],
    ['approve', {
      from: ['pending_approval'],
      to: 'approved',
      requiredRoles: ['moderator', 'admin'],
      requiredPermissions: ['content.approve']
    }],
    ['reject', {
      from: ['pending_approval', 'approved'],
      to: 'draft',
      requiredRoles: ['moderator', 'admin'],
      requiredPermissions: ['content.reject']
    }],
    ['publish', {
      from: ['approved'],
      to: 'published',
      requiredRoles: ['moderator', 'admin'],
      requiredPermissions: ['content.publish']
    }],
    ['archive', {
      from: ['published'],
      to: 'archived',
      requiredRoles: ['moderator', 'admin'],
      requiredPermissions: ['content.archive']
    }],
    ['restore', {
      from: ['archived'],
      to: 'published',
      requiredRoles: ['moderator', 'admin'],
      requiredPermissions: ['content.restore']
    }]
  ]);

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.contextLogger = new ContextLogger({ service: 'workflow' });
  }

  // Execute workflow action
  public async executeAction(
    contentId: string,
    action: WorkflowAction,
    userId: string,
    userRoles: string[],
    userPermissions: string[],
    tenantId: string,
    options: {
      reason?: string;
      metadata?: Record<string, any>;
      versionBump?: 'major' | 'minor' | 'patch';
    } = {}
  ): Promise<IContent> {
    this.contextLogger.info('Executing workflow action', {
      contentId,
      action,
      userId,
      tenantId
    });

    // Get content
    const content = await Content.findOne({
      _id: contentId,
      tenantId,
      deleted: false
    });

    if (!content) {
      throw new NotFoundError('Content', contentId);
    }

    // Get transition definition
    const transition = this.transitions.get(action);
    if (!transition) {
      throw new ValidationError(`Invalid workflow action: ${action}`);
    }

    // Check if current status allows this transition
    if (!transition.from.includes(content.status as ContentStatus)) {
      throw new ConflictError(
        `Cannot ${action} content with status ${content.status}. Valid statuses: ${transition.from.join(', ')}`
      );
    }

    // Check user permissions
    this.validateUserPermissions(transition, userRoles, userPermissions);

    // Additional validations based on action
    await this.validateActionSpecificRules(content, action, options);

    // Record workflow event
    const workflowEvent: WorkflowEvent = {
      contentId,
      action,
      fromStatus: content.status as ContentStatus,
      toStatus: transition.to,
      userId,
      reason: options.reason as string | undefined,
      metadata: options.metadata as any,
      timestamp: new Date()
    };

    // Execute the transition
    const updatedContent = await this.performTransition(content, workflowEvent, options);

    // Send notifications
    await this.sendWorkflowNotifications(updatedContent, workflowEvent);

    this.contextLogger.info('Workflow action executed successfully', {
      contentId,
      action,
      fromStatus: workflowEvent.fromStatus,
      toStatus: workflowEvent.toStatus
    });

    return updatedContent;
  }

  // Validate user permissions for transition
  private validateUserPermissions(
    transition: WorkflowTransition,
    userRoles: string[],
    userPermissions: string[]
  ): void {
    // Check roles
    const hasRequiredRole = transition.requiredRoles.some(role => userRoles.includes(role));
    if (!hasRequiredRole) {
      throw new ValidationError(
        `Insufficient role. Required roles: ${transition.requiredRoles.join(', ')}`
      );
    }

    // Check permissions if specified
    if (transition.requiredPermissions) {
      const hasRequiredPermission = transition.requiredPermissions.some(
        permission => userPermissions.includes(permission)
      );
      if (!hasRequiredPermission) {
        throw new ValidationError(
          `Insufficient permissions. Required permissions: ${transition.requiredPermissions.join(', ')}`
        );
      }
    }
  }

  // Validate action-specific business rules
  private async validateActionSpecificRules(
    content: IContent,
    action: WorkflowAction,
    options: any
  ): Promise<void> {
    switch (action) {
      case 'submit_for_approval':
        // Content must have title and description
        if (!content.title || !content.description) {
          throw new ValidationError('Content must have title and description before submission');
        }
        break;

      case 'approve':
        // Content must meet quality criteria
        if (content.title.length < 5) {
          throw new ValidationError('Content title too short for approval');
        }
        break;

      case 'reject':
        // Rejection must have a reason
        if (!options.reason) {
          throw new ValidationError('Rejection reason is required');
        }
        break;

      case 'publish':
        // Published content must have file info for certain types
        if (['video', 'document'].includes(content.contentType) && !content.fileInfo) {
          throw new ValidationError('Content must have associated file before publishing');
        }
        break;

      case 'archive':
        // Can only archive published content that's been live for at least 24 hours
        if (content.publishedAt && (Date.now() - content.publishedAt.getTime()) < 24 * 60 * 60 * 1000) {
          throw new ValidationError('Content must be published for at least 24 hours before archiving');
        }
        break;
    }
  }

  // Perform the actual transition
  private async performTransition(
    content: IContent,
    event: WorkflowEvent,
    options: any
  ): Promise<IContent> {
    const updates: any = {
      status: event.toStatus,
      etag: uuidv4(),
      updatedAt: new Date()
    };

    // Handle version bumping for published content
    if (content.status === 'published' && options.versionBump) {
      const newVersion = semver.inc(content.version, options.versionBump);
      if (newVersion) {
        updates.version = newVersion;
      }
    }

    // Action-specific updates
    switch (event.action) {
      case 'approve':
        updates.metadata = {
          ...(content.metadata as any),
          approvedBy: event.userId,
          approvedAt: event.timestamp,
          approvalReason: event.reason
        } as any;
        break;

      case 'reject':
        updates.metadata = {
          ...(content.metadata as any),
          rejectedBy: event.userId,
          rejectedAt: event.timestamp,
          rejectionReason: event.reason
        } as any;
        // Clear approval metadata if previously approved
        delete updates.metadata.approvedBy;
        delete updates.metadata.approvedAt;
        delete updates.metadata.approvalReason;
        break;

      case 'publish':
        updates.publishedAt = event.timestamp;
        updates.metadata = {
          ...(content.metadata as any),
          publishedBy: event.userId,
          firstPublishedAt: (content.metadata as any)?.firstPublishedAt || event.timestamp
        } as any;
        break;

      case 'archive':
        updates.metadata = {
          ...(content.metadata as any),
          archivedBy: event.userId,
          archivedAt: event.timestamp,
          archiveReason: event.reason
        } as any;
        break;

      case 'restore':
        updates.metadata = {
          ...(content.metadata as any),
          restoredBy: event.userId,
          restoredAt: event.timestamp,
          restoreReason: event.reason
        } as any;
        // Clear archive metadata
        delete updates.metadata.archivedBy;
        delete updates.metadata.archivedAt;
        delete updates.metadata.archiveReason;
        break;
    }

    // Store workflow event in content history
    const workflowHistory = (content.metadata as any)?.workflowHistory || [];
    workflowHistory.push({
      id: uuidv4(),
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      userId: event.userId,
      reason: event.reason,
      timestamp: event.timestamp,
      metadata: event.metadata
    });

    updates.metadata = {
      ...updates.metadata,
      workflowHistory
    };

    // Apply updates
    Object.assign(content, updates);
    await content.save();

    return content;
  }

  // Send workflow notifications
  private async sendWorkflowNotifications(
    content: IContent,
    event: WorkflowEvent
  ): Promise<void> {
    try {
      // Notify content creator
      this.wsService.sendUserNotification(content.createdBy, 'content:workflow', {
        contentId: content._id,
        title: content.title,
        action: event.action,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        userId: event.userId,
        reason: event.reason,
        timestamp: event.timestamp
      });

      // Notify tenant (for published content)
      if (event.toStatus === 'published') {
        this.wsService.sendTenantNotification(content.tenantId, 'content:published', {
          contentId: content._id,
          title: content.title,
          contentType: content.contentType,
          publishedBy: event.userId,
          timestamp: event.timestamp
        });
      }

      // Log workflow event for audit trail
      this.contextLogger.info('Workflow event logged', {
        contentId: content._id,
        action: event.action,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        userId: event.userId
      });

    } catch (error) {
      this.contextLogger.error('Failed to send workflow notifications', error as Error, {
        contentId: content._id,
        action: event.action
      });
    }
  }

  // Get available actions for content
  public getAvailableActions(
    content: IContent,
    userRoles: string[],
    userPermissions: string[]
  ): WorkflowAction[] {
    const availableActions: WorkflowAction[] = [];

    for (const [action, transition] of this.transitions.entries()) {
      // Check if current status allows this action
      if (!transition.from.includes(content.status as ContentStatus)) {
        continue;
      }

      // Check user permissions
      const hasRequiredRole = transition.requiredRoles.some(role => userRoles.includes(role));
      if (!hasRequiredRole) {
        continue;
      }

      if (transition.requiredPermissions) {
        const hasRequiredPermission = transition.requiredPermissions.some(
          permission => userPermissions.includes(permission)
        );
        if (!hasRequiredPermission) {
          continue;
        }
      }

      availableActions.push(action);
    }

    return availableActions;
  }

  // Get workflow history for content
  public getWorkflowHistory(content: IContent): any[] {
    return (content.metadata as any)?.workflowHistory || [];
  }

  // Get workflow statistics
  public async getWorkflowStatistics(tenantId: string, timeRange?: {
    from: Date;
    to: Date;
  }): Promise<any> {
    const matchStage: any = {
      tenantId,
      deleted: false
    };

    if (timeRange) {
      matchStage.updatedAt = {
        $gte: timeRange.from,
        $lte: timeRange.to
      };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $subtract: ['$updatedAt', '$createdAt']
            }
          }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          avgProcessingTimeHours: {
            $divide: ['$avgProcessingTime', 1000 * 60 * 60]
          }
        }
      }
    ];

    const results = await Content.aggregate(pipeline);

    return {
      statusDistribution: results.reduce((acc: any, item: any) => {
        acc[item.status] = {
          count: item.count,
          avgProcessingTimeHours: Math.round(item.avgProcessingTimeHours * 100) / 100
        };
        return acc;
      }, {}),
      totalContent: results.reduce((sum: number, item: any) => sum + item.count, 0)
    };
  }

  // Bulk workflow operations
  public async bulkExecuteAction(
    contentIds: string[],
    action: WorkflowAction,
    userId: string,
    userRoles: string[],
    userPermissions: string[],
    tenantId: string,
    options: {
      reason?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ successful: string[]; failed: Array<{ contentId: string; error: string }> }> {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ contentId: string; error: string }>
    };

    for (const contentId of contentIds) {
      try {
        await this.executeAction(
          contentId,
          action,
          userId,
          userRoles,
          userPermissions,
          tenantId,
          options
        );
        results.successful.push(contentId);
      } catch (error) {
        results.failed.push({
          contentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.contextLogger.info('Bulk workflow action completed', {
      action,
      totalContent: contentIds.length,
      successful: results.successful.length,
      failed: results.failed.length
    });

    return results;
  }

  // Schedule automatic workflow actions
  public async scheduleAutoActions(): Promise<void> {
    try {
      // Auto-archive old published content (example: after 1 year)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const oldPublishedContent = await Content.find({
        status: 'published',
        publishedAt: { $lt: oneYearAgo },
        deleted: false,
        'metadata.autoArchiveEnabled': { $ne: false }
      });

      for (const content of oldPublishedContent) {
        try {
          await this.executeAction(
            content._id,
            'archive',
            'system',
            ['admin'],
            ['content.archive'],
            content.tenantId,
            {
              reason: 'Automatically archived after 1 year',
              metadata: { autoArchived: true }
            }
          );
        } catch (error) {
          this.contextLogger.error('Failed to auto-archive content', error as Error, {
            contentId: content._id
          });
        }
      }

      this.contextLogger.info('Auto workflow actions completed', {
        archivedCount: oldPublishedContent.length
      });

    } catch (error) {
      this.contextLogger.error('Failed to execute auto workflow actions', error as Error);
    }
  }
}
