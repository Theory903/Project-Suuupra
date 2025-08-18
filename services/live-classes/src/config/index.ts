import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(8086),
  HOST: Joi.string().default('0.0.0.0'),
  SERVICE_NAME: Joi.string().default('live-classes'),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  
  // MediaSoup
  MEDIASOUP_MIN_PORT: Joi.number().default(40000),
  MEDIASOUP_MAX_PORT: Joi.number().default(49999),
  MEDIASOUP_LISTEN_IP: Joi.string().default('0.0.0.0'),
  MEDIASOUP_ANNOUNCED_IP: Joi.string().default('127.0.0.1'),
  
  // Recording
  RECORDING_ENABLED: Joi.boolean().default(true),
  RECORDING_STORAGE_PATH: Joi.string().default('/recordings'),
  S3_BUCKET_NAME: Joi.string().required(),
  S3_REGION: Joi.string().default('us-west-2'),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  
  // Authentication
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: Joi.number().default(100),
  RATE_LIMIT_WINDOW: Joi.number().default(60000),
  
  // Observability
  PROMETHEUS_ENABLED: Joi.boolean().default(true),
  PROMETHEUS_PORT: Joi.number().default(9090),
  JAEGER_ENDPOINT: Joi.string().default('http://localhost:14268/api/traces'),
  OTEL_SERVICE_NAME: Joi.string().default('live-classes'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  
  // Security
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  HELMET_ENABLED: Joi.boolean().default(true),
  
  // Feature Flags
  ENABLE_RECORDING: Joi.boolean().default(true),
  ENABLE_SCREEN_SHARE: Joi.boolean().default(true),
  ENABLE_WHITEBOARD: Joi.boolean().default(true),
  ENABLE_BREAKOUT_ROOMS: Joi.boolean().default(true),
  MAX_PARTICIPANTS_PER_ROOM: Joi.number().default(100),
  MAX_CONCURRENT_ROOMS: Joi.number().default(1000),
  
  // WebRTC
  TURN_SERVER_URL: Joi.string().default('turn:localhost:3478'),
  TURN_USERNAME: Joi.string().default('suuupra'),
  TURN_PASSWORD: Joi.string().default('suuupra-turn-secret'),
  STUN_SERVER_URL: Joi.string().default('stun:stun.l.google.com:19302'),
  
  // Chat
  CHAT_MESSAGE_LIMIT: Joi.number().default(1000),
  CHAT_HISTORY_DAYS: Joi.number().default(30),
  
  // Notifications
  NOTIFICATION_SERVICE_URL: Joi.string().default('http://localhost:8090')
});

const { error, value: envVars } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  server: {
    port: envVars.PORT,
    host: envVars.HOST,
    name: envVars.SERVICE_NAME
  },
  database: {
    url: envVars.DATABASE_URL
  },
  redis: {
    url: envVars.REDIS_URL
  },
  mediaSoup: {
    minPort: envVars.MEDIASOUP_MIN_PORT,
    maxPort: envVars.MEDIASOUP_MAX_PORT,
    listenIp: envVars.MEDIASOUP_LISTEN_IP,
    announcedIp: envVars.MEDIASOUP_ANNOUNCED_IP
  },
  recording: {
    enabled: envVars.RECORDING_ENABLED,
    storagePath: envVars.RECORDING_STORAGE_PATH,
    s3: {
      bucket: envVars.S3_BUCKET_NAME,
      region: envVars.S3_REGION,
      accessKeyId: envVars.AWS_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY
    }
  },
  auth: {
    jwtSecret: envVars.JWT_SECRET,
    jwtExpiresIn: envVars.JWT_EXPIRES_IN
  },
  rateLimit: {
    max: envVars.RATE_LIMIT_MAX,
    window: envVars.RATE_LIMIT_WINDOW
  },
  observability: {
    prometheus: {
      enabled: envVars.PROMETHEUS_ENABLED,
      port: envVars.PROMETHEUS_PORT
    },
    jaeger: {
      endpoint: envVars.JAEGER_ENDPOINT
    },
    otel: {
      serviceName: envVars.OTEL_SERVICE_NAME
    },
    logLevel: envVars.LOG_LEVEL
  },
  security: {
    corsOrigin: envVars.CORS_ORIGIN,
    helmetEnabled: envVars.HELMET_ENABLED
  },
  features: {
    recording: envVars.ENABLE_RECORDING,
    screenShare: envVars.ENABLE_SCREEN_SHARE,
    whiteboard: envVars.ENABLE_WHITEBOARD,
    breakoutRooms: envVars.ENABLE_BREAKOUT_ROOMS,
    maxParticipantsPerRoom: envVars.MAX_PARTICIPANTS_PER_ROOM,
    maxConcurrentRooms: envVars.MAX_CONCURRENT_ROOMS
  },
  webrtc: {
    turnServer: envVars.TURN_SERVER_URL,
    turnUsername: envVars.TURN_USERNAME,
    turnPassword: envVars.TURN_PASSWORD,
    stunServer: envVars.STUN_SERVER_URL
  },
  chat: {
    messageLimit: envVars.CHAT_MESSAGE_LIMIT,
    historyDays: envVars.CHAT_HISTORY_DAYS
  },
  notifications: {
    serviceUrl: envVars.NOTIFICATION_SERVICE_URL
  }
};
