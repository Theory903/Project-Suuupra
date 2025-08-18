import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().required(),
  role: Joi.string().valid('student', 'instructor').default('student')
});

export async function authRoutes(app: FastifyInstance) {
  // Login
  app.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'User login',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }
        },
        required: ['email', 'password']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { error, value } = loginSchema.validate(request.body);
      if (error) {
        return reply.code(400).send({
          error: 'Validation Error',
          details: error.details
        });
      }

      const { email, password } = value;

      // Find user in database
      const user = await app.db.client.user.findUnique({
        where: { email }
      });

      if (!user) {
        return reply.code(401).send({
          error: 'Authentication Failed',
          message: 'Invalid email or password'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return reply.code(401).send({
          error: 'Authentication Failed',
          message: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions || []
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiresIn }
      );

      // Store session in Redis
      await app.redis.setSession(user.id, {
        userId: user.id,
        email: user.email,
        role: user.role,
        loginAt: new Date()
      }, 24 * 60 * 60); // 24 hours

      logger.info('User logged in:', { userId: user.id, email: user.email });

      return reply.send({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Login failed'
      });
    }
  });

  // Register
  app.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'User registration',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
          role: { type: 'string', enum: ['student', 'instructor'] }
        },
        required: ['email', 'password', 'name']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { error, value } = registerSchema.validate(request.body);
      if (error) {
        return reply.code(400).send({
          error: 'Validation Error',
          details: error.details
        });
      }

      const { email, password, name, role } = value;

      // Check if user already exists
      const existingUser = await app.db.client.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await app.db.client.user.create({
        data: {
          id: require('uuid').v4(),
          email,
          passwordHash,
          name,
          role,
          permissions: role === 'instructor' ? ['create_room', 'manage_room'] : ['join_room'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('User registered:', { userId: user.id, email: user.email, role: user.role });

      return reply.code(201).send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        },
        message: 'User registered successfully'
      });
    } catch (error) {
      logger.error('Registration error:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Registration failed'
      });
    }
  });

  // Logout
  app.post('/logout', {
    schema: {
      tags: ['auth'],
      summary: 'User logout'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (request.user) {
        await app.redis.deleteSession(request.user.id);
        logger.info('User logged out:', { userId: request.user.id });
      }

      return reply.send({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Logout failed'
      });
    }
  });

  // Get current user profile
  app.get('/me', {
    schema: {
      tags: ['auth'],
      summary: 'Get current user profile'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const user = await app.db.client.user.findUnique({
        where: { id: request.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          permissions: true,
          createdAt: true
        }
      });

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      return reply.send({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error getting user profile:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user profile'
      });
    }
  });

  // Refresh token
  app.post('/refresh', {
    schema: {
      tags: ['auth'],
      summary: 'Refresh JWT token'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Generate new token
      const token = jwt.sign(
        {
          id: request.user.id,
          email: request.user.email,
          role: request.user.role,
          permissions: request.user.permissions
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiresIn }
      );

      return reply.send({
        success: true,
        data: { token }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Token refresh failed'
      });
    }
  });
}
