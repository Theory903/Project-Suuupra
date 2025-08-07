/**
 * Core Types for Suuupra Global Logger
 * Shared interfaces and types across all language implementations
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 10,
  INFO = 20,
  WARN = 30,
  ERROR = 40,
  FATAL = 50,
}

export interface LogContext {
  // Request Context
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  
  // Service Context
  service: string;
  version?: string;
  environment: string;
  component?: string;
  
  // Infrastructure Context
  instanceId?: string;
  region?: string;
  availabilityZone?: string;
  
  // Business Context
  tenantId?: string;
  organizationId?: string;
  
  // Custom Context
  [key: string]: any;
}

export interface LogEntry {
  // Core Fields
  timestamp: string; // ISO 8601 format
  level: LogLevel;
  message: string;
  
  // Context
  context: LogContext;
  
  // Structured Data
  data?: Record<string, any>;
  
  // Error Information
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  
  // Performance Metrics
  metrics?: {
    duration?: number;
    memory?: number;
    cpu?: number;
  };
  
  // HTTP Context (for web services)
  http?: {
    method?: string;
    url?: string;
    statusCode?: number;
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
  };
  
  // Database Context
  database?: {
    operation?: string;
    table?: string;
    duration?: number;
    query?: string; // Be careful with PII
  };
  
  // Security Context
  security?: {
    authMethod?: string;
    permissions?: string[];
    riskScore?: number;
  };
}

export interface LoggerConfig {
  // Basic Configuration
  service: string;
  version?: string;
  environment: string;
  
  // Log Level Configuration
  level: LogLevel;
  enabledLevels?: LogLevel[];
  
  // Output Configuration
  format: 'json' | 'text' | 'pretty';
  destination: 'console' | 'file' | 'http' | 'multiple';
  
  // File Configuration (if destination includes file)
  file?: {
    path: string;
    maxSize: string; // e.g., '100MB'
    maxFiles: number;
    compress: boolean;
  };
  
  // HTTP Configuration (for log forwarding)
  http?: {
    endpoint: string;
    headers?: Record<string, string>;
    timeout: number;
    retries: number;
  };
  
  // Sampling Configuration
  sampling?: {
    enabled: boolean;
    rate: number; // 0.0 to 1.0
    strategy: 'random' | 'rate-limited' | 'adaptive';
  };
  
  // Performance Configuration
  performance?: {
    async: boolean;
    bufferSize: number;
    flushInterval: number; // milliseconds
  };
  
  // Security Configuration
  security?: {
    maskPII: boolean;
    encryptLogs: boolean;
    encryptionKey?: string;
  };
  
  // OpenTelemetry Configuration
  openTelemetry?: {
    enabled: boolean;
    endpoint?: string;
    headers?: Record<string, string>;
  };
}

export interface Logger {
  // Core Logging Methods
  trace(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void;
  debug(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void;
  info(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void;
  warn(message: string, data?: Record<string, any>, context?: Partial<LogContext>): void;
  error(message: string, error?: Error, data?: Record<string, any>, context?: Partial<LogContext>): void;
  fatal(message: string, error?: Error, data?: Record<string, any>, context?: Partial<LogContext>): void;
  
  // Context Management
  withContext(context: Partial<LogContext>): Logger;
  withRequestId(requestId: string): Logger;
  withUserId(userId: string): Logger;
  withTraceId(traceId: string): Logger;
  
  // Performance Logging
  startTimer(name: string): Timer;
  logDuration(name: string, duration: number, data?: Record<string, any>): void;
  
  // Structured Logging Helpers
  logRequest(request: HttpRequest, response?: HttpResponse): void;
  logDatabaseQuery(query: DatabaseQuery): void;
  logSecurityEvent(event: SecurityEvent): void;
  
  // Lifecycle
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface Timer {
  end(data?: Record<string, any>): void;
  getDuration(): number;
}

export interface HttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  ip?: string;
  userAgent?: string;
}

export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
  duration?: number;
}

export interface DatabaseQuery {
  operation: string;
  table: string;
  query?: string;
  duration: number;
  rowsAffected?: number;
  error?: Error;
}

export interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'suspicious_activity' | 'data_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip?: string;
  details: Record<string, any>;
}

// OpenTelemetry Integration Types
export interface OpenTelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags?: Record<string, any>;
  logs?: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;
}

// Multi-Language Support Types
export interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
  messageTemplates: Record<string, Record<string, string>>;
}

export interface LocalizedMessage {
  key: string;
  locale: string;
  template: string;
  params?: Record<string, any>;
}

// Observability 2.0 - Wide Events
export interface WideEvent {
  // Event Identity
  eventId: string;
  eventType: string;
  timestamp: string;
  
  // Request Lifecycle
  requestId: string;
  traceId: string;
  spanId?: string;
  
  // Service Information
  service: LogContext['service'];
  version: LogContext['version'];
  environment: LogContext['environment'];
  
  // Infrastructure
  instanceId?: string;
  region?: string;
  availabilityZone?: string;
  
  // HTTP Context (for web requests)
  http?: {
    method: string;
    route: string;
    statusCode: number;
    duration: number;
    requestSize?: number;
    responseSize?: number;
    userAgent?: string;
    ip: string;
    headers?: Record<string, string>;
  };
  
  // User Context
  user?: {
    id: string;
    type?: string;
    authMethod?: string;
    permissions?: string[];
  };
  
  // Business Context
  business?: {
    tenantId?: string;
    organizationId?: string;
    featureFlags?: Record<string, boolean>;
    abTestVariant?: string;
  };
  
  // Performance Metrics
  performance?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    networkLatency?: number;
    databaseConnections?: number;
  };
  
  // Error Information
  error?: {
    type?: string;
    message?: string;
    stack?: string;
    code?: string;
    category?: string;
  };
  
  // Custom Dimensions (the "wide" part)
  dimensions?: Record<string, any>;
}

export type LogTransport = 'console' | 'file' | 'http' | 'elasticsearch' | 'splunk' | 'datadog' | 'honeycomb';

export interface TransportConfig {
  type: LogTransport;
  level?: LogLevel;
  format?: 'json' | 'text' | 'pretty';
  config?: Record<string, any>;
}
