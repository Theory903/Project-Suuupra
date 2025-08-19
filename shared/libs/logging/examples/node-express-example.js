"use strict";
/**
 * Example: Using Suuupra Global Logger with Express.js
 *
 * This example demonstrates:
 * - Setting up the global logger
 * - Express middleware integration
 * - Request correlation
 * - Wide events logging
 * - Error handling
 * - Performance monitoring
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const node_1 = require("../node");
const opentelemetry_1 = require("../observability/opentelemetry");
// Initialize logger with configuration
const logger = (0, node_1.createLogger)({
    service: 'user-api',
    version: '1.2.0',
    environment: process.env.NODE_ENV || 'development',
    level: node_1.LogLevel.INFO,
    format: 'json',
    security: {
        maskPII: true,
    },
    openTelemetry: {
        enabled: true,
    },
    performance: {
        async: true,
        bufferSize: 1000,
        flushInterval: 5000,
    },
});
// Initialize OpenTelemetry
const otelManager = new opentelemetry_1.OpenTelemetryManager({
    serviceName: 'user-api',
    serviceVersion: '1.2.0',
    environment: process.env.NODE_ENV || 'development',
    tracing: {
        enabled: true,
        otlp: {
            endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        },
    },
    metrics: {
        enabled: true,
        prometheus: {
            port: 9090,
            endpoint: '/metrics',
        },
    },
});
const app = (0, express_1.default)();
// Middleware setup
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Request ID middleware
app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
    res.setHeader('x-request-id', req.requestId);
    next();
});
// Logging middleware
app.use((0, node_1.expressLoggingMiddleware)(logger));
// OpenTelemetry middleware
app.use((0, opentelemetry_1.createOpenTelemetryMiddleware)(otelManager));
// Example: User service with comprehensive logging
class UserService {
    constructor() {
        this.logger = logger.withContext({ component: 'UserService' });
    }
    async getUser(userId, requestId) {
        const timer = this.logger.startTimer('get_user_operation');
        const contextLogger = this.logger.withRequestId(requestId).withUserId(userId);
        try {
            contextLogger.info('Fetching user', {
                userId,
                operation: 'getUser',
            });
            // Simulate database query
            const dbTimer = contextLogger.startTimer('database_query');
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            const dbDuration = dbTimer.end();
            // Log database operation
            contextLogger.logDatabaseQuery({
                operation: 'SELECT',
                table: 'users',
                duration: dbDuration,
                rowsAffected: 1,
            });
            // Simulate user data
            const user = {
                id: userId,
                name: 'John Doe',
                email: 'john.doe@example.com', // Will be masked if PII masking is enabled
                createdAt: new Date().toISOString(),
            };
            contextLogger.info('User fetched successfully', {
                userId,
                operation: 'getUser',
                userExists: true,
            });
            timer.end({ success: true, userExists: true });
            return user;
        }
        catch (error) {
            contextLogger.error('Failed to fetch user', error, {
                userId,
                operation: 'getUser',
            });
            timer.end({ success: false, error: true });
            throw error;
        }
    }
    async createUser(userData, requestId) {
        const timer = this.logger.startTimer('create_user_operation');
        const contextLogger = this.logger.withRequestId(requestId);
        try {
            contextLogger.info('Creating user', {
                operation: 'createUser',
                hasEmail: !!userData.email,
                hasName: !!userData.name,
            });
            // Validation
            if (!userData.email || !userData.name) {
                throw new Error('Missing required fields: email and name');
            }
            // Simulate database insert
            const dbTimer = contextLogger.startTimer('database_insert');
            await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
            const dbDuration = dbTimer.end();
            const userId = (0, crypto_1.randomUUID)();
            // Log database operation
            contextLogger.logDatabaseQuery({
                operation: 'INSERT',
                table: 'users',
                duration: dbDuration,
                rowsAffected: 1,
            });
            // Log security event for user creation
            contextLogger.logSecurityEvent({
                type: 'user_creation',
                severity: 'low',
                userId,
                details: {
                    userAgent: 'Express API',
                    source: 'api',
                },
            });
            contextLogger.info('User created successfully', {
                userId,
                operation: 'createUser',
            });
            timer.end({ success: true, userId });
            return { id: userId, ...userData };
        }
        catch (error) {
            contextLogger.error('Failed to create user', error, {
                operation: 'createUser',
            });
            timer.end({ success: false, error: true });
            throw error;
        }
    }
}
const userService = new UserService();
// Routes
app.get('/health', (req, res) => {
    logger.info('Health check', { requestId: req.requestId });
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
app.get('/users/:id', async (req, res) => {
    const requestLogger = logger.withRequestId(req.requestId);
    try {
        const user = await userService.getUser(req.params.id, req.requestId);
        requestLogger.info('User retrieved successfully', {
            userId: req.params.id,
            statusCode: 200,
        });
        res.json(user);
    }
    catch (error) {
        requestLogger.error('Failed to get user', error, {
            userId: req.params.id,
            statusCode: 500,
        });
        res.status(500).json({
            error: 'Internal server error',
            requestId: req.requestId,
        });
    }
});
app.post('/users', async (req, res) => {
    const requestLogger = logger.withRequestId(req.requestId);
    try {
        const user = await userService.createUser(req.body, req.requestId);
        requestLogger.info('User created successfully', {
            userId: user.id,
            statusCode: 201,
        });
        res.status(201).json(user);
    }
    catch (error) {
        requestLogger.error('Failed to create user', error, {
            statusCode: 400,
        });
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Bad request',
            requestId: req.requestId,
        });
    }
});
// Example: Batch operation with performance monitoring
app.post('/users/batch', async (req, res) => {
    const requestLogger = logger.withRequestId(req.requestId);
    const batchTimer = requestLogger.startTimer('batch_user_creation');
    try {
        const users = req.body.users || [];
        requestLogger.info('Starting batch user creation', {
            batchSize: users.length,
            operation: 'batchCreateUsers',
        });
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const userData of users) {
            try {
                const user = await userService.createUser(userData, req.requestId);
                results.push({ success: true, user });
                successCount++;
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    userData: { email: userData.email } // Log minimal info for debugging
                });
                errorCount++;
            }
        }
        const duration = batchTimer.end({
            batchSize: users.length,
            successCount,
            errorCount,
            successRate: successCount / users.length,
        });
        // Log wide event for batch operation
        requestLogger.info('Batch operation completed', {
            eventType: 'batch_user_creation',
            batchSize: users.length,
            successCount,
            errorCount,
            duration,
            successRate: successCount / users.length,
        });
        res.json({
            summary: {
                total: users.length,
                successful: successCount,
                failed: errorCount,
                duration,
            },
            results,
        });
    }
    catch (error) {
        batchTimer.end({ success: false, error: true });
        requestLogger.error('Batch operation failed', error, {
            operation: 'batchCreateUsers',
        });
        res.status(500).json({
            error: 'Batch operation failed',
            requestId: req.requestId,
        });
    }
});
// Error handling middleware
app.use((error, req, res, next) => {
    const requestLogger = logger.withRequestId(req.requestId);
    requestLogger.error('Unhandled error', error, {
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    });
    res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId,
    });
});
// 404 handler
app.use((req, res) => {
    const requestLogger = logger.withRequestId(req.requestId);
    requestLogger.warn('Route not found', {
        url: req.url,
        method: req.method,
        statusCode: 404,
    });
    res.status(404).json({
        error: 'Route not found',
        requestId: req.requestId,
    });
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    await logger.flush();
    await otelManager.shutdown();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    await logger.flush();
    await otelManager.shutdown();
    process.exit(0);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        service: 'user-api',
        version: '1.2.0',
    });
});
exports.default = app;
