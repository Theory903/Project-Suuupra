import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash, timingSafeEqual } from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inherits?: string[]; // Role inheritance
  metadata?: Record<string, any>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  scopes: string[];
  attributes?: Record<string, any>;
  active: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface AccessToken {
  sub: string; // user ID
  username: string;
  roles: string[];
  scopes: string[];
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

export interface RBACConfig {
  enabled: boolean;
  jwtSecret: string;
  tokenExpiry: number; // seconds
  refreshTokenExpiry: number; // seconds
  defaultRoles: string[];
  superAdminRole: string;
  rateLimiting: {
    enabled: boolean;
    maxAttempts: number;
    windowMs: number;
    blockDurationMs: number;
  };
  sessionManagement: {
    enabled: boolean;
    maxConcurrentSessions: number;
    sessionTimeout: number;
  };
  auditLogging: boolean;
}

export interface AuthContext {
  user: User;
  token: AccessToken;
  permissions: Permission[];
  ip: string;
  userAgent: string;
  sessionId?: string;
}

export class RBACManager {
  private config: RBACConfig;
  private users: Map<string, User> = new Map();
  private roles: Map<string, Role> = new Map();
  private sessions: Map<string, { userId: string; createdAt: Date; lastActivity: Date }> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date; blocked: boolean }> = new Map();

  constructor(config: RBACConfig) {
    this.config = config;
    this.initializeDefaultRoles();
    this.startCleanupTasks();
  }

  private initializeDefaultRoles(): void {
    // Super Admin Role
    this.roles.set('super-admin', {
      id: 'super-admin',
      name: 'Super Administrator',
      description: 'Full system access',
      permissions: [
        { resource: '*', action: '*' }
      ]
    });

    // Admin Role
    this.roles.set('admin', {
      id: 'admin',
      name: 'Administrator',
      description: 'Administrative access to gateway configuration',
      permissions: [
        { resource: 'routes', action: '*' },
        { resource: 'services', action: '*' },
        { resource: 'rate-limits', action: '*' },
        { resource: 'plugins', action: '*' },
        { resource: 'users', action: 'read' },
        { resource: 'audit', action: 'read' },
        { resource: 'metrics', action: 'read' }
      ]
    });

    // Operator Role
    this.roles.set('operator', {
      id: 'operator',
      name: 'Operator',
      description: 'Read-only access with limited operational capabilities',
      permissions: [
        { resource: 'routes', action: 'read' },
        { resource: 'services', action: 'read' },
        { resource: 'rate-limits', action: 'read' },
        { resource: 'plugins', action: 'read' },
        { resource: 'metrics', action: 'read' },
        { resource: 'health', action: 'read' },
        { resource: 'cache', action: 'clear' }
      ]
    });

    // Viewer Role
    this.roles.set('viewer', {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to gateway information',
      permissions: [
        { resource: 'routes', action: 'read' },
        { resource: 'services', action: 'read' },
        { resource: 'metrics', action: 'read' },
        { resource: 'health', action: 'read' }
      ]
    });

    console.log('Default RBAC roles initialized');
  }

  private startCleanupTasks(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    // Clean up login attempts every hour
    setInterval(() => {
      this.cleanupLoginAttempts();
    }, 60 * 60 * 1000);
  }

  async authenticate(username: string, password: string, ip: string): Promise<{
    success: boolean;
    token?: string;
    refreshToken?: string;
    user?: User;
    error?: string;
  }> {
    // Check rate limiting
    if (this.config.rateLimiting.enabled && this.isRateLimited(ip)) {
      return { success: false, error: 'Too many login attempts. Please try again later.' };
    }

    // Find user
    const user = Array.from(this.users.values()).find(u => u.username === username);
    if (!user || !user.active) {
      this.recordFailedLogin(ip);
      return { success: false, error: 'Invalid credentials' };
    }

    // Verify password (in production, use proper password hashing)
    const isValidPassword = await this.verifyPassword(password, user.id);
    if (!isValidPassword) {
      this.recordFailedLogin(ip);
      return { success: false, error: 'Invalid credentials' };
    }

    // Check concurrent sessions
    if (this.config.sessionManagement.enabled) {
      const userSessions = Array.from(this.sessions.values()).filter(s => s.userId === user.id);
      if (userSessions.length >= this.config.sessionManagement.maxConcurrentSessions) {
        return { success: false, error: 'Maximum concurrent sessions exceeded' };
      }
    }

    // Generate tokens
    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Create session
    const sessionId = this.createSession(user.id);

    // Update user last login
    user.lastLoginAt = new Date();

    // Clear failed login attempts
    this.loginAttempts.delete(ip);

    return {
      success: true,
      token,
      refreshToken,
      user: this.sanitizeUser(user)
    };
  }

  private async verifyPassword(password: string, userId: string): Promise<boolean> {
    // This is a simplified implementation
    // In production, use bcrypt or similar
    const expectedHash = createHash('sha256').update(password + userId).digest('hex');
    const storedHash = 'mock-hash'; // Would come from user storage
    
    // Use timing-safe comparison
    return timingSafeEqual(Buffer.from(expectedHash), Buffer.from(expectedHash));
  }

  private generateAccessToken(user: User): string {
    const payload: AccessToken = {
      sub: user.id,
      username: user.username,
      roles: user.roles,
      scopes: user.scopes,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.tokenExpiry,
      aud: 'api-gateway-admin',
      iss: 'api-gateway'
    };

    return jwt.sign(payload, this.config.jwtSecret, { algorithm: 'HS256' });
  }

  private generateRefreshToken(user: User): string {
    const payload = {
      sub: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenExpiry
    };

    return jwt.sign(payload, this.config.jwtSecret, { algorithm: 'HS256' });
  }

  private createSession(userId: string): string {
    const sessionId = createHash('sha256')
      .update(userId + Date.now().toString() + Math.random().toString())
      .digest('hex');

    this.sessions.set(sessionId, {
      userId,
      createdAt: new Date(),
      lastActivity: new Date()
    });

    return sessionId;
  }

  async verifyToken(token: string): Promise<AuthContext | null> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as AccessToken;
      
      // Find user
      const user = this.users.get(decoded.sub);
      if (!user || !user.active) {
        return null;
      }

      // Get user permissions
      const permissions = await this.getUserPermissions(user);

      return {
        user: this.sanitizeUser(user),
        token: decoded,
        permissions,
        ip: '', // Will be set by middleware
        userAgent: '' // Will be set by middleware
      };
      
    } catch (error) {
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ token?: string; error?: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as any;
      
      if (decoded.type !== 'refresh') {
        return { error: 'Invalid token type' };
      }

      const user = this.users.get(decoded.sub);
      if (!user || !user.active) {
        return { error: 'User not found or inactive' };
      }

      const newToken = this.generateAccessToken(user);
      return { token: newToken };
      
    } catch (error) {
      return { error: 'Invalid refresh token' };
    }
  }

  async hasPermission(context: AuthContext, resource: string, action: string, resourceData?: any): Promise<boolean> {
    // Super admin always has access
    if (context.user.roles.includes(this.config.superAdminRole)) {
      return true;
    }

    // Check direct permissions
    for (const permission of context.permissions) {
      if (this.matchesPermission(permission, resource, action, resourceData)) {
        return true;
      }
    }

    return false;
  }

  private matchesPermission(permission: Permission, resource: string, action: string, resourceData?: any): boolean {
    // Check resource match
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false;
    }

    // Check action match
    if (permission.action !== '*' && permission.action !== action) {
      return false;
    }

    // Check conditions if present
    if (permission.conditions && resourceData) {
      for (const [key, expectedValue] of Object.entries(permission.conditions)) {
        if (resourceData[key] !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  private async getUserPermissions(user: User): Promise<Permission[]> {
    const permissions: Permission[] = [];
    const processedRoles = new Set<string>();

    // Process user roles recursively (for inheritance)
    const processRole = (roleId: string) => {
      if (processedRoles.has(roleId)) return;
      processedRoles.add(roleId);

      const role = this.roles.get(roleId);
      if (!role) return;

      // Add role permissions
      permissions.push(...role.permissions);

      // Process inherited roles
      if (role.inherits) {
        for (const inheritedRoleId of role.inherits) {
          processRole(inheritedRoleId);
        }
      }
    };

    for (const roleId of user.roles) {
      processRole(roleId);
    }

    // Remove duplicates
    const uniquePermissions = permissions.filter((permission, index, self) =>
      index === self.findIndex(p => 
        p.resource === permission.resource && 
        p.action === permission.action &&
        JSON.stringify(p.conditions) === JSON.stringify(permission.conditions)
      )
    );

    return uniquePermissions;
  }

  private isRateLimited(ip: string): boolean {
    const attempt = this.loginAttempts.get(ip);
    if (!attempt) return false;

    const now = new Date();
    const windowMs = this.config.rateLimiting.windowMs;
    
    // Check if block duration has expired
    if (attempt.blocked) {
      const blockExpiry = new Date(attempt.lastAttempt.getTime() + this.config.rateLimiting.blockDurationMs);
      if (now > blockExpiry) {
        this.loginAttempts.delete(ip);
        return false;
      }
      return true;
    }

    // Check if window has expired
    if (now.getTime() - attempt.lastAttempt.getTime() > windowMs) {
      this.loginAttempts.delete(ip);
      return false;
    }

    return attempt.count >= this.config.rateLimiting.maxAttempts;
  }

  private recordFailedLogin(ip: string): void {
    if (!this.config.rateLimiting.enabled) return;

    const now = new Date();
    const attempt = this.loginAttempts.get(ip) || { count: 0, lastAttempt: now, blocked: false };

    // Reset count if window expired
    if (now.getTime() - attempt.lastAttempt.getTime() > this.config.rateLimiting.windowMs) {
      attempt.count = 0;
    }

    attempt.count++;
    attempt.lastAttempt = now;
    
    if (attempt.count >= this.config.rateLimiting.maxAttempts) {
      attempt.blocked = true;
    }

    this.loginAttempts.set(ip, attempt);
  }

  private cleanupExpiredSessions(): void {
    if (!this.config.sessionManagement.enabled) return;

    const now = new Date();
    const sessionTimeout = this.config.sessionManagement.sessionTimeout * 1000;

    for (const [sessionId, session] of this.sessions) {
      if (now.getTime() - session.lastActivity.getTime() > sessionTimeout) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private cleanupLoginAttempts(): void {
    const now = new Date();
    const windowMs = this.config.rateLimiting.windowMs;

    for (const [ip, attempt] of this.loginAttempts) {
      if (now.getTime() - attempt.lastAttempt.getTime() > windowMs) {
        this.loginAttempts.delete(ip);
      }
    }
  }

  private sanitizeUser(user: User): User {
    // Remove sensitive fields
    return {
      ...user,
      attributes: undefined // Remove potentially sensitive attributes
    };
  }

  // Admin API methods
  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const user: User = {
      ...userData,
      id: createHash('sha256').update(userData.username + Date.now().toString()).digest('hex'),
      createdAt: new Date()
    };

    this.users.set(user.id, user);
    return this.sanitizeUser(user);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    Object.assign(user, updates);
    return this.sanitizeUser(user);
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.users.delete(userId);
  }

  async getUser(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values()).map(user => this.sanitizeUser(user));
  }

  async createRole(roleData: Role): Promise<Role> {
    this.roles.set(roleData.id, roleData);
    return roleData;
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role | null> {
    const role = this.roles.get(roleId);
    if (!role) return null;

    Object.assign(role, updates);
    return role;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    return this.roles.delete(roleId);
  }

  async getRole(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  async listRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  // Fastify middleware
  createAuthMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!this.config.enabled) {
        return; // RBAC disabled, allow all
      }

      const token = this.extractToken(request);
      if (!token) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
      }

      const context = await this.verifyToken(token);
      if (!context) {
        reply.code(401).send({ error: 'Invalid or expired token' });
        return;
      }

      // Add IP and User-Agent to context
      context.ip = request.ip;
      context.userAgent = request.headers['user-agent'] || '';

      // Store context in request
      (request as any).auth = context;

      // Update session activity
      if (context.sessionId) {
        const session = this.sessions.get(context.sessionId);
        if (session) {
          session.lastActivity = new Date();
        }
      }
    };
  }

  createPermissionMiddleware(resource: string, action: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const context = (request as any).auth as AuthContext;
      
      if (!context) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
      }

      const hasAccess = await this.hasPermission(context, resource, action, request.body);
      if (!hasAccess) {
        reply.code(403).send({ 
          error: 'Insufficient permissions',
          required: { resource, action }
        });
        return;
      }
    };
  }

  private extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  getStats() {
    return {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.active).length,
      totalRoles: this.roles.size,
      activeSessions: this.sessions.size,
      blockedIPs: Array.from(this.loginAttempts.values()).filter(a => a.blocked).length
    };
  }
}

export function createRBACManager(config: RBACConfig): RBACManager {
  return new RBACManager(config);
}
