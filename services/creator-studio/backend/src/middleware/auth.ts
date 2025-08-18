import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Creator } from '../models/Creator';
import { cacheService } from '../config/redis';

export interface AuthRequest extends Request {
  creator?: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    isVerified: boolean;
    subscription: {
      plan: string;
      features: string[];
    };
  };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if token is blacklisted
    const isBlacklisted = await cacheService.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Try to get creator from cache first
    let creator = await cacheService.get<any>(`creator:${decoded.id}`);
    
    if (!creator) {
      // If not in cache, get from database
      creator = await Creator.findById(decoded.id).select('-password');
      
      if (!creator) {
        return res.status(401).json({ error: 'Creator not found' });
      }

      // Cache creator data for 15 minutes
      await cacheService.set(`creator:${decoded.id}`, creator, 900);
    }

    // Check if creator is active and not suspended
    if (!creator.status.isActive || creator.status.isSuspended) {
      return res.status(401).json({ error: 'Account is suspended or inactive' });
    }

    // Attach creator info to request
    req.creator = {
      id: creator._id.toString(),
      username: creator.username,
      email: creator.email,
      displayName: creator.displayName,
      isVerified: creator.verification.isVerified,
      subscription: {
        plan: creator.subscription.plan,
        features: creator.subscription.features,
      },
    };

    // Update last active timestamp (async, don't wait)
    setImmediate(async () => {
      try {
        await Creator.updateOne(
          { _id: decoded.id },
          { $set: { 'status.lastActiveAt': new Date() } }
        );
      } catch (error) {
        // Silently fail - this is not critical
      }
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional auth middleware - doesn't require authentication but extracts user if present
export const optionalAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.id) {
      return next();
    }

    // Check if token is blacklisted
    const isBlacklisted = await cacheService.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }

    // Try to get creator from cache first
    let creator = await cacheService.get<any>(`creator:${decoded.id}`);
    
    if (!creator) {
      // If not in cache, get from database
      creator = await Creator.findById(decoded.id).select('-password');
      
      if (!creator) {
        return next();
      }

      // Cache creator data for 15 minutes
      await cacheService.set(`creator:${decoded.id}`, creator, 900);
    }

    // Check if creator is active and not suspended
    if (!creator.status.isActive || creator.status.isSuspended) {
      return next();
    }

    // Attach creator info to request
    req.creator = {
      id: creator._id.toString(),
      username: creator.username,
      email: creator.email,
      displayName: creator.displayName,
      isVerified: creator.verification.isVerified,
      subscription: {
        plan: creator.subscription.plan,
        features: creator.subscription.features,
      },
    };

    next();
  } catch (error) {
    // If optional auth fails, just continue without user info
    next();
  }
};

// Admin middleware - requires admin role
export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.creator) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if creator has admin features
  if (!req.creator.subscription.features.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Subscription middleware - checks if creator has required plan
export const subscriptionMiddleware = (requiredPlan: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.creator) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const planHierarchy = ['free', 'creator', 'pro', 'enterprise'];
    const userPlanIndex = planHierarchy.indexOf(req.creator.subscription.plan);
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);

    if (userPlanIndex < requiredPlanIndex) {
      return res.status(403).json({ 
        error: `${requiredPlan} subscription required`,
        currentPlan: req.creator.subscription.plan,
        requiredPlan: requiredPlan,
      });
    }

    next();
  };
};
