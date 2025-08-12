// Core application types
export interface ServiceConfig {
  port: number;
  serviceName: string;
  environment: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

export interface DatabaseConfig {
  mongodb: {
    uri: string;
    options: Record<string, any>;
  };
  elasticsearch: {
    node: string;
    auth?: {
      username: string;
      password: string;
    };
    indexPrefix: string;
  };
  redis: {
    url: string;
    password?: string;
    db: number;
  };
}

export interface S3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  bucketRegion: string;
  cloudfrontDomain?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwksUri: string;
  issuer: string;
  audience: string;
}

export interface UploadConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  multipartChunkSize: number;
  uploadExpiryHours: number;
}

// Request context types
export interface RequestContext {
  requestId: string;
  userId?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
  clientId?: string;
  sessionId?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    pagination?: PaginationMeta;
    requestId: string;
    timestamp: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Content types
export type ContentType = 'video' | 'article' | 'quiz' | 'document';
export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'archived';
export type VersionBump = 'major' | 'minor' | 'patch';

export interface FileInfo {
  filename: string;
  contentType: string;
  fileSize: number;
  s3Key: string;
  cdnUrl?: string;
  checksumSha256: string;
  uploadedAt: Date;
}

export interface ContentFilters {
  status?: ContentStatus[];
  contentType?: ContentType[];
  category?: string[];
  tags?: string[];
  createdBy?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// Upload types
export type UploadStatus = 'initiated' | 'uploading' | 'completed' | 'failed' | 'aborted';

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface UploadProgress {
  uploadId: string;
  contentId: string;
  filename: string;
  totalSize: number;
  uploadedSize: number;
  percentage: number;
  status: UploadStatus;
  partsCompleted: number;
  totalParts: number;
  estimatedTimeRemaining?: number;
}

// Search types
export interface SearchQuery {
  q: string;
  filters?: ContentFilters;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  contentType: ContentType;
  category?: {
    id: string;
    name: string;
    path: string;
  };
  tags: string[];
  createdBy: string;
  createdAt: Date;
  publishedAt?: Date;
  fileInfo?: Partial<FileInfo>;
  _score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: PaginationMeta;
  aggregations?: Record<string, any>;
  queryTimeMs: number;
  totalHits: number;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  tenantId: string;
  timestamp: Date;
  version: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  url: string;
  payload: WebhookEvent;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  createdAt: Date;
}

// Error types
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}
