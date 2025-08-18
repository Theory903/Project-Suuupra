import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { Creator } from '../models/Creator';
import { cacheService } from '../config/redis';
import { asyncHandler, ValidationError, UnauthorizedError, ConflictError } from '../middleware/errorHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  body('displayName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Display name must be 1-50 characters'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Creator:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         displayName:
 *           type: string
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new creator
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - displayName
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               displayName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Creator registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Creator already exists
 */
router.post('/register', authLimiter, registerValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { username, email, password, displayName } = req.body;

  // Check if creator already exists
  const existingCreator = await Creator.findOne({
    $or: [{ email }, { username }]
  });

  if (existingCreator) {
    const field = existingCreator.email === email ? 'email' : 'username';
    throw new ConflictError(`Creator with this ${field} already exists`);
  }

  // Create new creator
  const creator = new Creator({
    username,
    email,
    password,
    displayName,
  });

  await creator.save();

  // Generate JWT token
  const token = jwt.sign(
    { id: creator._id },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Cache creator data
  await cacheService.set(`creator:${creator._id}`, creator, 900);

  res.status(201).json({
    success: true,
    message: 'Creator registered successfully',
    data: {
      creator: {
        id: creator._id,
        username: creator.username,
        email: creator.email,
        displayName: creator.displayName,
        isVerified: creator.verification.isVerified,
        subscription: creator.subscription,
      },
      token,
    },
  });
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login creator
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, loginValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email, password } = req.body;

  // Find creator and include password for comparison
  const creator = await Creator.findOne({ email }).select('+password');

  if (!creator || !(await creator.comparePassword(password))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if creator is active
  if (!creator.status.isActive || creator.status.isSuspended) {
    throw new UnauthorizedError('Account is suspended or inactive');
  }

  // Update last login timestamp
  creator.status.lastLoginAt = new Date();
  await creator.save();

  // Generate JWT token
  const token = jwt.sign(
    { id: creator._id },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Cache creator data
  await cacheService.set(`creator:${creator._id}`, creator, 900);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      creator: {
        id: creator._id,
        username: creator.username,
        email: creator.email,
        displayName: creator.displayName,
        isVerified: creator.verification.isVerified,
        subscription: creator.subscription,
      },
      token,
    },
  });
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout creator
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.substring(7);
  
  if (token) {
    // Add token to blacklist
    const decoded = jwt.decode(token) as any;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    
    if (expiresIn > 0) {
      await cacheService.set(`blacklist:${token}`, true, expiresIn);
    }
  }

  // Remove creator from cache
  if (req.creator?.id) {
    await cacheService.del(`creator:${req.creator.id}`);
  }

  res.json({
    success: true,
    message: 'Logout successful',
  });
}));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current creator profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Creator profile retrieved successfully
 */
router.get('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const creator = await Creator.findById(req.creator!.id);
  
  if (!creator) {
    throw new UnauthorizedError('Creator not found');
  }

  res.json({
    success: true,
    data: {
      creator: {
        id: creator._id,
        username: creator.username,
        email: creator.email,
        displayName: creator.displayName,
        bio: creator.bio,
        avatarUrl: creator.avatarUrl,
        bannerUrl: creator.bannerUrl,
        website: creator.website,
        socialLinks: creator.socialLinks,
        verification: creator.verification,
        analytics: creator.analytics,
        subscription: creator.subscription,
        settings: creator.settings,
        status: creator.status,
        createdAt: creator.createdAt,
        updatedAt: creator.updatedAt,
      },
    },
  });
}));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 */
router.post('/refresh', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  // Generate new JWT token
  const token = jwt.sign(
    { id: req.creator!.id },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      token,
    },
  });
}));

export default router;
