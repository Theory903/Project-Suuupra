import { ServiceConfig, DatabaseConfig, S3Config, AuthConfig, UploadConfig } from '@/types';

export class Config {
  public readonly service: ServiceConfig;
  public readonly database: DatabaseConfig;
  public readonly s3: S3Config;
  public readonly auth: AuthConfig;
  public readonly upload: UploadConfig;

  constructor() {
    this.service = {
      port: parseInt(process.env.PORT || '8082', 10),
      serviceName: process.env.SERVICE_NAME || 'content-service',
      environment: process.env.NODE_ENV || 'development',
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true
      }
    };

    // Build database config with exactOptionalPropertyTypes-friendly optionals
    const esConfig: any = {
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'content'
    };
    if (process.env.ELASTICSEARCH_USERNAME) {
      esConfig.auth = {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD || ''
      };
    }

    const redisConfig: any = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      db: parseInt(process.env.REDIS_DB || '0', 10)
    };
    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    this.database = {
      mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/content_dev',
        options: this.parseJsonConfig(process.env.MONGODB_OPTIONS, {})
      },
      elasticsearch: esConfig,
      redis: redisConfig
    };

    const s3Config: any = {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      bucketName: process.env.S3_BUCKET_NAME || 'suuupra-content-dev',
      bucketRegion: process.env.S3_BUCKET_REGION || 'us-east-1'
    };
    if (process.env.CLOUDFRONT_DOMAIN) {
      s3Config.cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
    }
    this.s3 = s3Config;

    this.auth = {
      jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
      jwksUri: process.env.JWKS_URI || 'http://localhost:8081/.well-known/jwks.json',
      issuer: process.env.JWT_ISSUER || 'https://identity.suuupra.local',
      audience: process.env.JWT_AUDIENCE || 'suuupra-api'
    };

    this.upload = {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '2147483648', 10), // 2GB
      allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
        'video/mp4', 'video/webm', 'application/pdf',
        'image/jpeg', 'image/png', 'image/webp',
        'text/html', 'text/markdown'
      ],
      multipartChunkSize: parseInt(process.env.MULTIPART_CHUNK_SIZE || '10485760', 10), // 10MB
      uploadExpiryHours: parseInt(process.env.UPLOAD_EXPIRY_HOURS || '24', 10)
    };

    this.validate();
  }

  private parseJsonConfig(value: string | undefined, defaultValue: any): any {
    if (!value) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  private validate(): void {
    const required = [
      'MONGODB_URI',
      'ELASTICSEARCH_NODE',
      'REDIS_URL',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'S3_BUCKET_NAME',
      'JWT_SECRET',
      'JWKS_URI'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0 && this.service.environment === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  // Feature flags
  public get features() {
    return {
      contentVersioning: process.env.ENABLE_CONTENT_VERSIONING === 'true',
      approvalWorkflow: process.env.ENABLE_APPROVAL_WORKFLOW === 'true',
      webhookDelivery: process.env.ENABLE_WEBHOOK_DELIVERY === 'true',
      contentModeration: process.env.ENABLE_CONTENT_MODERATION === 'true',
      backgroundJobs: process.env.ENABLE_BACKGROUND_JOBS === 'true',
      virusScanning: process.env.ENABLE_VIRUS_SCANNING === 'true'
    };
  }

  // Rate limiting configuration
  public get rateLimit() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true'
    };
  }

  // Observability configuration
  public get observability() {
    return {
      logLevel: process.env.LOG_LEVEL || 'info',
      enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
      prometheusMetricsPort: parseInt(process.env.PROMETHEUS_METRICS_PORT || '9090', 10),
      jaegerEndpoint: process.env.JAEGER_ENDPOINT
    };
  }

  // External services configuration
  public get services() {
    return {
      identity: process.env.IDENTITY_SERVICE_URL || 'http://localhost:8081',
      notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085',
      analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8087'
    };
  }

  // Background job configuration
  public get jobs() {
    return {
      concurrency: parseInt(process.env.JOB_CONCURRENCY || '5', 10),
      retryAttempts: parseInt(process.env.JOB_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.JOB_RETRY_DELAY || '5000', 10)
    };
  }

  // Webhook configuration
  public get webhooks() {
    return {
      secret: process.env.WEBHOOK_SECRET || 'your-webhook-secret',
      timeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10),
      retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10)
    };
  }
}

export const config = new Config();
