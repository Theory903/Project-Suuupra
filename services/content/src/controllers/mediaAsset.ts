import { Request, Response, NextFunction } from 'express';
import { Content } from '@/models/Content';
import { MediaAsset } from '@/models/MediaAsset';
import { ApiResponse, ValidationError, NotFoundError } from '@/types';
import { ContextLogger } from '@/utils/logger';

export class MediaAssetController {
  private contextLogger: ContextLogger;

  constructor() {
    this.contextLogger = new ContextLogger({ controller: 'media-asset' });
  }

  // Create media asset linked to content
  public createAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: contentId } = req.params;
      const { type, title, description, fileInfo, metadata } = req.body;
      const user = req.user!;

      if (!contentId) {
        throw new ValidationError('Content ID is required');
      }

      // Validate content exists and user can edit
      const content = await Content.findOne({
        _id: contentId,
        tenantId: user.tenantId,
        deleted: false
      });

      if (!content) {
        throw new NotFoundError('Content', contentId);
      }

      if (!content.canBeEditedBy(user.userId, user.roles)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient privileges to add asset' },
          meta: { requestId: user.requestId, timestamp: new Date().toISOString() }
        });
        return;
      }

      // Basic validation for fileInfo
      if (!fileInfo?.s3Key || !fileInfo?.filename || !fileInfo?.contentType || !fileInfo?.fileSize) {
        throw new ValidationError('Invalid fileInfo provided');
      }

      const asset = await MediaAsset.create({
        tenantId: user.tenantId,
        contentId,
        type,
        title,
        description,
        fileInfo: {
          filename: fileInfo.filename,
          contentType: fileInfo.contentType,
          fileSize: fileInfo.fileSize,
          s3Key: fileInfo.s3Key,
          cdnUrl: fileInfo.cdnUrl,
          checksumSha256: fileInfo.checksumSha256,
          uploadedAt: fileInfo.uploadedAt || new Date()
        },
        metadata: metadata || {},
        createdBy: user.userId
      });

      const response: ApiResponse = {
        success: true,
        data: asset.toJSON(),
        meta: { requestId: user.requestId, timestamp: new Date().toISOString() }
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  // List assets for a content
  public listAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: contentId } = req.params;
      const user = req.user!;

      const assets = await MediaAsset.find({ tenantId: user.tenantId, contentId })
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: assets.map(a => a.toJSON()),
        meta: { requestId: user.requestId, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get single asset
  public getAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assetId = req.params.assetId as string;
      const user = req.user!;

      const asset = await MediaAsset.findOne({ _id: assetId, tenantId: user.tenantId });
      if (!asset) {
        throw new NotFoundError('MediaAsset', assetId);
      }

      res.json({
        success: true,
        data: asset.toJSON(),
        meta: { requestId: user.requestId, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete asset
  public deleteAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assetId = req.params.assetId as string;
      const user = req.user!;

      const asset = await MediaAsset.findOne({ _id: assetId, tenantId: user.tenantId });
      if (!asset) {
        throw new NotFoundError('MediaAsset', assetId);
      }

      // Only creator, moderator, admin can delete
      const roles = user.roles || [];
      if (asset.createdBy !== user.userId && !(roles.includes('moderator') || roles.includes('admin') || roles.includes('super-admin'))) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient privileges to delete asset' },
          meta: { requestId: user.requestId, timestamp: new Date().toISOString() }
        });
        return;
      }

      await MediaAsset.deleteOne({ _id: assetId });

      res.json({
        success: true,
        data: { id: assetId, deleted: true },
        meta: { requestId: user.requestId, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      next(error);
    }
  };
}
