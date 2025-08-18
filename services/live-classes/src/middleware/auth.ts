import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  permissions: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function authMiddleware(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health checks and docs
    if (request.url.startsWith('/health') || 
        request.url.startsWith('/metrics') || 
        request.url.startsWith('/docs') ||
        request.url.startsWith('/api/v1/auth/login') ||
        request.url.startsWith('/api/v1/auth/register')) {
      return;
    }

    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header'
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      
      // Validate token structure
      if (!decoded.id || !decoded.email || !decoded.role) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid token structure'
        });
      }

      request.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || []
      };

      logger.debug('User authenticated:', { userId: request.user.id, role: request.user.role });
    } catch (error) {
      logger.warn('Authentication failed:', error);
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
  });
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`
      });
    }
  };
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!request.user.permissions.includes(permission)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Required permission: ${permission}`
      });
    }
  };
}
