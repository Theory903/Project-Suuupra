// ===================================================================
// GATEWAY-KAFKA EVENT INTEGRATION MIDDLEWARE - PHASE 2
// Connects existing API Gateway with Event-Driven Architecture  
// ===================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { RouteConfig } from '../services/api-gateway/src/types/gateway';
import { v4 as uuidv4 } from 'uuid';

// Event types that the gateway publishes
interface GatewayEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: 'api-gateway';
  data: Record<string, any>;
  metadata: {
    correlationId: string;
    requestId: string;
    userId?: string;
    tenantId?: string;
    routeId: string;
    serviceName: string;
  };
}

interface RequestEvent extends GatewayEvent {
  eventType: 'request.received';
  data: {
    method: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    userAgent: string;
    ipAddress: string;
    contentLength?: number;
  };
}

interface ResponseEvent extends GatewayEvent {
  eventType: 'request.completed';
  data: {
    statusCode: number;
    responseTime: number;
    responseSize?: number;
    cacheHit: boolean;
    retryCount: number;
    errorMessage?: string;
  };
}

interface RateLimitEvent extends GatewayEvent {
  eventType: 'rate_limit.exceeded';
  data: {
    limitKey: string;
    limitType: string;
    currentCount: number;
    limitThreshold: number;
    resetTime: string;
  };
}

interface CircuitBreakerEvent extends GatewayEvent {
  eventType: 'circuit_breaker.opened' | 'circuit_breaker.closed' | 'circuit_breaker.half_open';
  data: {
    serviceName: string;
    failureRate: number;
    failureThreshold: number;
    requestCount: number;
    errorCount: number;
    lastFailureReason?: string;
  };
}

interface AuthenticationEvent extends GatewayEvent {
  eventType: 'authentication.success' | 'authentication.failure';
  data: {
    authMethod: 'jwt' | 'api-key' | 'oauth2';
    userAgent: string;
    ipAddress: string;
    failureReason?: string;
    tokenExpiry?: string;
  };
}

// Configuration for Kafka integration
export interface KafkaIntegrationConfig {
  enabled: boolean;
  brokers: string[];
  clientId: string;
  groupId: string;
  
  // Producer configuration
  producer: {
    maxInFlightRequests: number;
    idempotent: boolean;
    transactionTimeout: number;
    retry: {
      initialRetryTime: number;
      retries: number;
    };
    compression: 'gzip' | 'snappy' | 'lz4' | 'zstd';
  };
  
  // Consumer configuration  
  consumer: {
    sessionTimeout: number;
    heartbeatInterval: number;
    maxBytesPerPartition: number;
    maxWaitTimeInMs: number;
    autoOffsetReset: 'earliest' | 'latest';
    allowAutoTopicCreation: boolean;
  };

  // Topic configuration
  topics: {
    gatewayEvents: string;
    userEvents: string;
    analyticsEvents: string;
    auditEvents: string;
  };

  // Event filtering
  eventFiltering: {
    enabledEvents: string[];
    excludePaths: string[];
    excludeUserAgents: string[];
    samplingRate: number; // 0.0 to 1.0
  };

  // Batching configuration
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    maxBatchTimeMs: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: KafkaIntegrationConfig = {
  enabled: true,
  brokers: ['kafka:9092'],
  clientId: 'api-gateway',
  groupId: 'api-gateway-service',
  
  producer: {
    maxInFlightRequests: 1,
    idempotent: true,
    transactionTimeout: 30000,
    retry: {
      initialRetryTime: 100,
      retries: 3
    },
    compression: 'gzip'
  },
  
  consumer: {
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576, // 1MB
    maxWaitTimeInMs: 5000,
    autoOffsetReset: 'latest',
    allowAutoTopicCreation: false
  },

  topics: {
    gatewayEvents: 'gateway-events',
    userEvents: 'user-events',  
    analyticsEvents: 'analytics-events',
    auditEvents: 'audit-events'
  },

  eventFiltering: {
    enabledEvents: [
      'request.received',
      'request.completed',
      'rate_limit.exceeded',
      'circuit_breaker.opened',
      'authentication.failure'
    ],
    excludePaths: ['/health', '/metrics', '/favicon.ico'],
    excludeUserAgents: ['kube-probe', 'monitoring'],
    samplingRate: 1.0 // Capture all events by default
  },

  batching: {
    enabled: true,
    maxBatchSize: 100,
    maxBatchTimeMs: 1000
  }
};

// Main Kafka integration class
export class GatewayKafkaIntegration {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private config: KafkaIntegrationConfig;
  private eventBatch: GatewayEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private stats = {
    eventsPublished: 0,
    eventsConsumed: 0,
    publishErrors: 0,
    batchesFlushed: 0
  };

  constructor(config: Partial<KafkaIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      retry: {
        initialRetryTime: this.config.producer.retry.initialRetryTime,
        retries: this.config.producer.retry.retries
      }
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: this.config.producer.maxInFlightRequests,
      idempotent: this.config.producer.idempotent,
      transactionTimeout: this.config.producer.transactionTimeout
    });

    this.consumer = this.kafka.consumer({
      groupId: this.config.groupId,
      sessionTimeout: this.config.consumer.sessionTimeout,
      heartbeatInterval: this.config.consumer.heartbeatInterval,
      maxBytesPerPartition: this.config.consumer.maxBytesPerPartition,
      maxWaitTimeInMs: this.config.consumer.maxWaitTimeInMs
    });
  }

  // Initialize Kafka connection
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Kafka integration is disabled');
      return;
    }

    try {
      await this.producer.connect();
      await this.consumer.connect();
      
      // Subscribe to relevant topics for consuming
      await this.consumer.subscribe({
        topics: [this.config.topics.userEvents],
        fromBeginning: this.config.consumer.autoOffsetReset === 'earliest'
      });

      // Start consuming events
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleIncomingEvent(topic, message);
        }
      });

      this.isConnected = true;
      console.log('✅ Kafka integration initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Kafka integration:', error);
      throw error;
    }
  }

  // Create Fastify plugin for gateway integration
  createFastifyPlugin() {
    return async (fastify: FastifyInstance) => {
      // Request lifecycle hooks
      fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        await this.handleRequestStart(request, reply);
      });

      fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
        await this.handleRequestComplete(request, reply);
      });

      fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
        await this.handleRequestError(request, reply, error);
      });

      // Add custom route for event statistics
      fastify.get('/api/internal/kafka-stats', async (request, reply) => {
        reply.send({
          connected: this.isConnected,
          stats: this.stats,
          config: {
            enabled: this.config.enabled,
            topics: this.config.topics,
            batching: this.config.batching
          }
        });
      });

      // Graceful shutdown handler
      fastify.addHook('onClose', async () => {
        await this.shutdown();
      });
    };
  }

  // Handle request start event
  private async handleRequestStart(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.shouldPublishEvent('request.received', request)) {
      return;
    }

    const correlationId = this.extractCorrelationId(request);
    const requestId = uuidv4();
    const userId = this.extractUserId(request);
    const tenantId = this.extractTenantId(request);

    // Store metadata in request for later use
    (request as any).eventMetadata = {
      correlationId,
      requestId,
      userId,
      tenantId,
      startTime: Date.now()
    };

    const event: RequestEvent = {
      eventId: uuidv4(),
      eventType: 'request.received',
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
      data: {
        method: request.method,
        path: this.sanitizePath(request.url),
        headers: this.sanitizeHeaders(request.headers),
        query: request.query as Record<string, string>,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: this.getClientIP(request),
        contentLength: this.getContentLength(request)
      },
      metadata: {
        correlationId,
        requestId,
        userId,
        tenantId,
        routeId: this.extractRouteId(request),
        serviceName: this.extractServiceName(request)
      }
    };

    await this.publishEvent(this.config.topics.gatewayEvents, event);
  }

  // Handle request completion event
  private async handleRequestComplete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.shouldPublishEvent('request.completed', request)) {
      return;
    }

    const metadata = (request as any).eventMetadata;
    if (!metadata) return;

    const responseTime = Date.now() - metadata.startTime;
    const cacheHit = reply.getHeader('x-cache') === 'HIT';
    const retryCount = parseInt(reply.getHeader('x-retry-count') as string || '0');

    const event: ResponseEvent = {
      eventId: uuidv4(),
      eventType: 'request.completed',
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
      data: {
        statusCode: reply.statusCode,
        responseTime,
        responseSize: this.getResponseSize(reply),
        cacheHit,
        retryCount,
        errorMessage: reply.statusCode >= 400 ? 'HTTP error response' : undefined
      },
      metadata: {
        correlationId: metadata.correlationId,
        requestId: metadata.requestId,
        userId: metadata.userId,
        tenantId: metadata.tenantId,
        routeId: this.extractRouteId(request),
        serviceName: this.extractServiceName(request)
      }
    };

    await this.publishEvent(this.config.topics.gatewayEvents, event);

    // Also publish analytics event for successful requests
    if (reply.statusCode < 400) {
      await this.publishAnalyticsEvent(request, reply, metadata);
    }
  }

  // Handle request error event  
  private async handleRequestError(request: FastifyRequest, reply: FastifyReply, error: Error): Promise<void> {
    const metadata = (request as any).eventMetadata;
    if (!metadata) return;

    const responseTime = Date.now() - metadata.startTime;

    const event: ResponseEvent = {
      eventId: uuidv4(),
      eventType: 'request.completed',
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
      data: {
        statusCode: reply.statusCode || 500,
        responseTime,
        cacheHit: false,
        retryCount: 0,
        errorMessage: error.message
      },
      metadata: {
        correlationId: metadata.correlationId,
        requestId: metadata.requestId,
        userId: metadata.userId,
        tenantId: metadata.tenantId,
        routeId: this.extractRouteId(request),
        serviceName: this.extractServiceName(request)
      }
    };

    await this.publishEvent(this.config.topics.gatewayEvents, event);
  }

  // Publish rate limit exceeded event
  async publishRateLimitEvent(
    request: FastifyRequest,
    limitKey: string,
    limitType: string,
    currentCount: number,
    threshold: number,
    resetTime: Date
  ): Promise<void> {
    const metadata = (request as any).eventMetadata || this.createBasicMetadata(request);

    const event: RateLimitEvent = {
      eventId: uuidv4(),
      eventType: 'rate_limit.exceeded',
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
      data: {
        limitKey,
        limitType,
        currentCount,
        limitThreshold: threshold,
        resetTime: resetTime.toISOString()
      },
      metadata
    };

    await this.publishEvent(this.config.topics.gatewayEvents, event);
  }

  // Publish circuit breaker event
  async publishCircuitBreakerEvent(
    serviceName: string,
    eventType: 'circuit_breaker.opened' | 'circuit_breaker.closed' | 'circuit_breaker.half_open',
    failureRate: number,
    threshold: number,
    requestCount: number,
    errorCount: number,
    lastFailure?: string
  ): Promise<void> {
    const event: CircuitBreakerEvent = {
      eventId: uuidv4(),
      eventType,
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
      data: {
        serviceName,
        failureRate,
        failureThreshold: threshold,
        requestCount,
        errorCount,
        lastFailureReason: lastFailure
      },
      metadata: {
        correlationId: uuidv4(),
        requestId: uuidv4(),
        routeId: 'system',
        serviceName
      }
    };

    await this.publishEvent(this.config.topics.gatewayEvents, event);
  }

  // Publish authentication event
  async publishAuthenticationEvent(
    request: FastifyRequest,
    success: boolean,
    authMethod: 'jwt' | 'api-key' | 'oauth2',
    failureReason?: string,
    tokenExpiry?: Date
  ): Promise<void> {
    const metadata = (request as any).eventMetadata || this.createBasicMetadata(request);

    const event: AuthenticationEvent = {
      eventId: uuidv4(),
      eventType: success ? 'authentication.success' : 'authentication.failure',
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
      data: {
        authMethod,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: this.getClientIP(request),
        failureReason,
        tokenExpiry: tokenExpiry?.toISOString()
      },
      metadata
    };

    await this.publishEvent(this.config.topics.gatewayEvents, event);
  }

  // Publish analytics event
  private async publishAnalyticsEvent(request: FastifyRequest, reply: FastifyReply, metadata: any): Promise<void> {
    const analyticsEvent = {
      eventId: uuidv4(),
      eventType: 'user.page_view',
      timestamp: new Date().toISOString(),
      source: 'api-gateway',
      data: {
        page_url: request.url,
        referrer: request.headers.referer,
        user_agent: request.headers['user-agent'],
        device_type: this.detectDeviceType(request.headers['user-agent']),
        response_time: Date.now() - metadata.startTime,
        status_code: reply.statusCode
      },
      metadata
    };

    await this.publishEvent(this.config.topics.analyticsEvents, analyticsEvent);
  }

  // Core event publishing method
  private async publishEvent(topic: string, event: GatewayEvent): Promise<void> {
    if (!this.config.enabled || !this.isConnected) {
      return;
    }

    try {
      if (this.config.batching.enabled) {
        await this.addEventToBatch(topic, event);
      } else {
        await this.sendEventImmediate(topic, event);
      }
      
      this.stats.eventsPublished++;
    } catch (error) {
      console.error('Failed to publish event:', error);
      this.stats.publishErrors++;
    }
  }

  // Add event to batch
  private async addEventToBatch(topic: string, event: GatewayEvent): Promise<void> {
    this.eventBatch.push(event);

    // Flush batch if it reaches max size
    if (this.eventBatch.length >= this.config.batching.maxBatchSize) {
      await this.flushBatch();
    } else if (!this.batchTimer) {
      // Set timer to flush batch
      this.batchTimer = setTimeout(async () => {
        await this.flushBatch();
      }, this.config.batching.maxBatchTimeMs);
    }
  }

  // Flush event batch
  private async flushBatch(): Promise<void> {
    if (this.eventBatch.length === 0) {
      return;
    }

    try {
      const messages = this.eventBatch.map(event => ({
        key: event.metadata.correlationId,
        value: JSON.stringify(event),
        timestamp: Date.now().toString(),
        headers: {
          eventType: event.eventType,
          source: event.source,
          eventId: event.eventId
        }
      }));

      await this.producer.send({
        topic: this.config.topics.gatewayEvents,
        compression: this.config.producer.compression,
        messages
      });

      this.stats.batchesFlushed++;
      this.eventBatch = [];
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
    } catch (error) {
      console.error('Failed to flush event batch:', error);
      this.stats.publishErrors++;
    }
  }

  // Send event immediately (non-batched)
  private async sendEventImmediate(topic: string, event: GatewayEvent): Promise<void> {
    await this.producer.send({
      topic,
      compression: this.config.producer.compression,
      messages: [{
        key: event.metadata.correlationId,
        value: JSON.stringify(event),
        timestamp: Date.now().toString(),
        headers: {
          eventType: event.eventType,
          source: event.source,
          eventId: event.eventId
        }
      }]
    });
  }

  // Handle incoming events from Kafka
  private async handleIncomingEvent(topic: string, message: KafkaMessage): Promise<void> {
    try {
      const event = JSON.parse(message.value?.toString() || '{}');
      
      // Handle different event types
      switch (event.eventType) {
        case 'user.tier_upgraded':
          await this.handleUserTierUpgraded(event);
          break;
        case 'user.profile_updated':
          await this.handleUserProfileUpdated(event);
          break;
        // Add more event handlers as needed
      }
      
      this.stats.eventsConsumed++;
    } catch (error) {
      console.error('Failed to handle incoming event:', error);
    }
  }

  // Handle user tier upgrade event
  private async handleUserTierUpgraded(event: any): Promise<void> {
    const { user_id, to_tier } = event.data;
    
    // Update internal cache or trigger rate limit adjustments
    console.log(`User ${user_id} upgraded to ${to_tier} tier`);
    
    // Could trigger rate limit policy updates, feature flag changes, etc.
  }

  // Handle user profile update event
  private async handleUserProfileUpdated(event: any): Promise<void> {
    const { user_id, changed_fields } = event.data;
    
    // Update internal user context cache if needed
    console.log(`User ${user_id} updated fields: ${changed_fields.join(', ')}`);
  }

  // Utility methods
  private shouldPublishEvent(eventType: string, request: FastifyRequest): boolean {
    if (!this.config.enabled) return false;
    
    // Check if event type is enabled
    if (!this.config.eventFiltering.enabledEvents.includes(eventType)) {
      return false;
    }
    
    // Check sampling rate
    if (Math.random() > this.config.eventFiltering.samplingRate) {
      return false;
    }
    
    // Check excluded paths
    const path = request.url;
    if (this.config.eventFiltering.excludePaths.some(excludePath => path.includes(excludePath))) {
      return false;
    }
    
    // Check excluded user agents
    const userAgent = request.headers['user-agent'] || '';
    if (this.config.eventFiltering.excludeUserAgents.some(excluded => 
      userAgent.toLowerCase().includes(excluded.toLowerCase())
    )) {
      return false;
    }
    
    return true;
  }

  private extractCorrelationId(request: FastifyRequest): string {
    return (request.headers['x-correlation-id'] as string) || 
           (request.headers['x-request-id'] as string) || 
           uuidv4();
  }

  private extractUserId(request: FastifyRequest): string | undefined {
    const user = (request as any).user;
    return user?.sub || user?.id;
  }

  private extractTenantId(request: FastifyRequest): string | undefined {
    const user = (request as any).user;
    return user?.tenant_id || user?.tenantId || 
           (request.headers['x-tenant-id'] as string);
  }

  private extractRouteId(request: FastifyRequest): string {
    return (request as any).routeOptions?.config?.routeId || 'unknown';
  }

  private extractServiceName(request: FastifyRequest): string {
    return (request as any).routeOptions?.config?.serviceName || 'unknown';
  }

  private createBasicMetadata(request: FastifyRequest): any {
    return {
      correlationId: this.extractCorrelationId(request),
      requestId: uuidv4(),
      userId: this.extractUserId(request),
      tenantId: this.extractTenantId(request),
      routeId: this.extractRouteId(request),
      serviceName: this.extractServiceName(request)
    };
  }

  private sanitizePath(path: string): string {
    // Remove query parameters and sanitize path
    return path.split('?')[0].replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/{id}');
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = ['content-type', 'accept', 'user-agent', 'referer', 'origin'];
    
    for (const [key, value] of Object.entries(headers)) {
      if (allowedHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private getClientIP(request: FastifyRequest): string {
    return (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           (request.headers['x-real-ip'] as string) ||
           request.ip ||
           'unknown';
  }

  private getContentLength(request: FastifyRequest): number | undefined {
    const length = request.headers['content-length'];
    return length ? parseInt(length as string) : undefined;
  }

  private getResponseSize(reply: FastifyReply): number | undefined {
    const length = reply.getHeader('content-length');
    return length ? parseInt(length as string) : undefined;
  }

  private detectDeviceType(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet')) return 'tablet';
    if (ua.includes('bot') || ua.includes('crawler')) return 'bot';
    return 'desktop';
  }

  // Get integration statistics
  getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      batchSize: this.eventBatch.length,
      config: this.config
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down Kafka integration...');
    
    try {
      // Flush any remaining batched events
      if (this.eventBatch.length > 0) {
        await this.flushBatch();
      }
      
      // Clear batch timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      // Disconnect from Kafka
      await this.producer.disconnect();
      await this.consumer.disconnect();
      
      this.isConnected = false;
      console.log('✅ Kafka integration shut down successfully');
      
    } catch (error) {
      console.error('❌ Error during Kafka shutdown:', error);
    }
  }
}

// Factory function to create and initialize integration
export async function createKafkaIntegration(config?: Partial<KafkaIntegrationConfig>): Promise<GatewayKafkaIntegration> {
  const integration = new GatewayKafkaIntegration(config);
  await integration.initialize();
  return integration;
}

// Export types and default config
export {
  DEFAULT_CONFIG as defaultKafkaConfig,
  type KafkaIntegrationConfig,
  type GatewayEvent,
  type RequestEvent,
  type ResponseEvent,
  type RateLimitEvent,
  type CircuitBreakerEvent,
  type AuthenticationEvent
};
