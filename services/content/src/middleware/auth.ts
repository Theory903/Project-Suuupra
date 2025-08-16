import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { config } from '@/config';
import { UnauthorizedError, ForbiddenError, AuthUser } from '@/types';
import { logger } from '@/utils/logger';

// JWKS client for token verification
const client = new JwksClient({
  jwksUri: config.auth.jwksUri,
  timeout: 30000,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

// Get signing key from JWKS
function getKey(header: any, callback: (err: Error | null, key?: string) => void): void {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err as Error);
    }
    const signingKey = key?.getPublicKey();
    if (!signingKey) return callback(new Error('No signing key'));
    callback(null, signingKey);
  });
}

// JWT verification options
const jwtOptions = {
  audience: config.auth.audience,
  issuer: config.auth.issuer,
  algorithms: ['ES256', 'RS256'] as jwt.Algorithm[],
  clockTolerance: 60 // 60 seconds clock skew tolerance
};

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      throw new UnauthorizedError('Missing access token');
    }

    // Verify JWT token
    const decoded = await verifyToken(token) as any;
    
    // Extract user context from token
    const userContext: AuthUser = {
      requestId: (req as any).requestId || generateRequestId(),
      userId: decoded.sub,
      tenantId: decoded.tenant_id || decoded.tid,
      roles: decoded.roles || [],
      permissions: decoded.permissions || decoded.perms || [],
      clientId: decoded.client_id || decoded.azp,
      sessionId: decoded.sid
    };

    // Validate required fields
    if (!userContext.userId) {
      throw new UnauthorizedError('Invalid token: missing user ID');
    }

    if (!userContext.tenantId) {
      throw new UnauthorizedError('Invalid token: missing tenant ID');
    }

    // Add user context to request
    (req as any).user = userContext;

    logger.debug('User authenticated successfully', {
      requestId: userContext.requestId,
      userId: userContext.userId,
      tenantId: userContext.tenantId,
      roles: userContext.roles
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Authentication failed'));
    }
  }
};

// Verify JWT token
function verifyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, jwtOptions, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}

// Role-based authorization middleware
export const requireRole = (requiredRoles: string | string[]) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const userRoles = req.user.roles || [];
      const hasRequiredRole = roles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        logger.warn('Authorization failed: insufficient role', {
          requestId: req.user.requestId,
          userId: req.user.userId,
          userRoles,
          requiredRoles: roles
        });
        
        throw new ForbiddenError(`Insufficient privileges. Required roles: ${roles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Permission-based authorization middleware
export const requirePermission = (requiredPermissions: string | string[]) => {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const userPermissions = req.user.permissions || [];
      const hasRequiredPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasRequiredPermission) {
        logger.warn('Authorization failed: insufficient permissions', {
          requestId: req.user.requestId,
          userId: req.user.userId,
          userPermissions,
          requiredPermissions: permissions
        });
        
        throw new ForbiddenError(`Insufficient privileges. Required permissions: ${permissions.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Resource ownership authorization
export const requireOwnership = (resourceUserIdField: string = 'createdBy') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Allow admins and moderators to bypass ownership check
      const userRoles = req.user.roles || [];
      if (userRoles.includes('admin') || userRoles.includes('moderator')) {
        return next();
      }

      // Check if user owns the resource
      const resourceUserId = (req as any)[resourceUserIdField];
      if (resourceUserId && resourceUserId !== req.user.userId) {
        throw new ForbiddenError('Access denied: insufficient privileges');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Tenant isolation middleware
export const requireTenantAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Extract tenant ID from various sources
    const requestTenantId = req.params.tenantId || 
                           req.query.tenantId || 
                           req.headers['x-tenant-id'];

    // If no tenant ID in request, use user's tenant
    if (!requestTenantId) {
      return next();
    }

    // Check if user has access to the requested tenant
    if (requestTenantId !== req.user.tenantId) {
      // Allow super admins to access any tenant
      if (!req.user.roles.includes('super-admin')) {
        throw new ForbiddenError('Access denied: insufficient tenant privileges');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token provided, continue without authentication
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Empty token, continue without authentication
    }

    try {
      const decoded: any = await verifyToken(token);
      
      const userContext: AuthUser = {
        requestId: req.requestId || generateRequestId(),
        userId: decoded.sub,
        tenantId: decoded.tenant_id || decoded.tid,
        roles: decoded.roles || [],
        permissions: decoded.permissions || decoded.perms || [],
        clientId: decoded.client_id || decoded.azp,
        sessionId: decoded.sid || 'optional'
      };

      (req as any).user = userContext;
    } catch (tokenError) {
      // Invalid token, but we continue without authentication
      logger.debug('Optional authentication failed', {
        error: tokenError instanceof Error ? tokenError.message : 'Unknown error'
      });
    }

    next();
  } catch (error) {
    // Don't fail the request for optional auth errors
    next();
  }
};

// Admin-only middleware
export const requireAdmin = requireRole(['admin', 'super-admin']);

// Moderator or admin middleware
export const requireModerator = requireRole(['moderator', 'admin', 'super-admin']);

// Content creator middleware (can create content)
export const requireCreator = requireRole(['creator', 'moderator', 'admin', 'super-admin']);

// API key authentication middleware (for service-to-service communication)
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new UnauthorizedError('Missing API key');
    }

    // In a real implementation, you would validate the API key against a database
    // For now, we'll use a simple validation
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!validApiKeys.includes(apiKey)) {
      throw new UnauthorizedError('Invalid API key');
    }

    // Set a service context
    (req as any).user = {
      requestId: req.requestId || generateRequestId(),
      userId: 'system',
      tenantId: 'system',
      roles: ['service'],
      permissions: ['*'],
      clientId: 'api-key',
      sessionId: 'system'
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Request signing middleware (HMAC of body + timestamp)
export const verifyRequestSignature = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const secret = process.env.WEBHOOK_SECRET || config.webhooks.secret;

    if (!signature || !timestamp) {
      throw new UnauthorizedError('Missing signature headers');
    }

    const ts = parseInt(timestamp, 10);
    if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      throw new UnauthorizedError('Stale or invalid timestamp');
    }

    const payload = JSON.stringify(req.body || {});
    const hmac = require('crypto').createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

    if (hmac !== signature) {
      throw new UnauthorizedError('Invalid signature');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Rate limiting per user
export const rateLimitPerUser = (windowMs: number, maxRequests: number) => {
  const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(); // Skip rate limiting if not authenticated
      }

      const userId = req.user.userId;
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;

      let userLimit = userRequestCounts.get(userId);
      
      if (!userLimit || userLimit.resetTime !== windowStart) {
        userLimit = { count: 0, resetTime: windowStart };
        userRequestCounts.set(userId, userLimit);
      }

      userLimit.count++;

      if (userLimit.count > maxRequests) {
        const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
        
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(windowStart + windowMs).toISOString(),
          'Retry-After': retryAfter.toString()
        });

        throw new Error('Rate limit exceeded');
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - userLimit.count).toString(),
        'X-RateLimit-Reset': new Date(windowStart + windowMs).toISOString()
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Utility function to generate request ID
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
