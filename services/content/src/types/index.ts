export interface AuthUser {
  requestId: string;
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  clientId: string;
  sessionId: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  offset: number;
}

export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  [key: string]: string | number | boolean | string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
  [key: string]: any;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Custom Error Classes
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// Configuration types
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

// Content-related types
export type ContentType = 'video' | 'article' | 'quiz' | 'document' | 'course' | 'lesson';
export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'archived';
export type UploadStatus = 'initiated' | 'uploading' | 'completed' | 'failed' | 'aborted';

export interface CourseMetadata {
  instructorId: string;
  courseOutline: Array<{
    lessonId: string;
    title: string;
    order: number;
  }>;
  durationMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  prerequisites: string[];
  learningOutcomes: string[];
  price: number;
  currency: string;
}

export interface LessonMetadata {
  courseId: string;
  lessonNumber: number;
  durationMinutes: number;
  videoUrl?: string;
  articleUrl?: string;
  quizId?: string;
  documentUrl?: string;
}

export type ContentMetadata = CourseMetadata | LessonMetadata | Record<string, any>;

export interface FileInfo {
  filename: string;
  contentType: string;
  fileSize: number;
  s3Key: string;
  cdnUrl?: string;
  checksumSha256: string;
  uploadedAt: Date;
}

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
  size: number;
  uploadedAt?: Date;
}

// Query types
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ContentFilters {
  status?: ContentStatus[];
  contentType?: ContentType[];
  category?: string[];
  tags?: string[];
  createdBy?: string;
}

export interface SearchQuery {
  q: string;
  filters?: Record<string, any>;
  page?: number;
  limit?: number;
  sort?: string;
  order?: SortOrder;
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
  createdAt: string;
  publishedAt?: string;
  fileInfo?: Partial<FileInfo>;
  _score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  data: SearchResult[];
  meta: ResponseMeta & {
    aggregations?: Record<string, any>;
    queryTimeMs: number;
    totalHits: number;
  };
}

// Request context
export interface RequestContext {
  requestId: string;
  userId?: string;
  tenantId?: string;
  userAgent?: string;
  ip?: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}