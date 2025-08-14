import { z } from 'zod';

// Configuration schema for validation
const configSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  
  // Database configuration
  database: z.object({
    url: z.string(),
    poolSize: z.coerce.number().default(20),
  }),
  
  // gRPC configuration
  grpc: z.object({
    port: z.coerce.number().default(50051),
    host: z.string().default('0.0.0.0'),
    reflection: z.coerce.boolean().default(true),
  }),
  
  // Bank simulation configuration
  banks: z.object({
    supported: z.array(z.string()).default(['HDFC', 'SBI', 'ICICI', 'AXIS', 'KOTAK']),
    defaultBalance: z.coerce.number().default(10000000), // 1 lakh in paisa
  }),
  
  // Simulation settings
  simulation: z.object({
    failureRate: z.coerce.number().min(0).max(1).default(0.01),
    latencySimulation: z.coerce.boolean().default(true),
    networkDelayMs: z.coerce.number().default(100),
    enableFraudDetection: z.coerce.boolean().default(true),
  }),
  
  // Security configuration
  security: z.object({
    jwtSecret: z.string(),
    jwtExpiresIn: z.string().default('24h'),
    bcryptRounds: z.coerce.number().default(12),
  }),
  
  // Rate limiting
  rateLimit: z.object({
    max: z.coerce.number().default(1000),
    timeWindow: z.coerce.number().default(60000),
  }),
  
  // Observability
  observability: z.object({
    logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    enableMetrics: z.coerce.boolean().default(true),
    metricsPort: z.coerce.number().default(9090),
    enableTracing: z.coerce.boolean().default(true),
    jaegerEndpoint: z.string().default('http://localhost:14268/api/traces'),
    serviceName: z.string().default('bank-simulator'),
  }),
  
  // Health check
  healthCheck: z.object({
    interval: z.coerce.number().default(30000),
    timeout: z.coerce.number().default(5000),
  }),
});

// Load and validate configuration
const loadConfig = () => {
  const rawConfig = {
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    
    database: {
      url: process.env.DATABASE_URL,
      poolSize: process.env.DATABASE_POOL_SIZE,
    },
    
    grpc: {
      port: process.env.GRPC_PORT,
      host: process.env.GRPC_HOST,
      reflection: process.env.GRPC_REFLECTION,
    },
    
    banks: {
      supported: process.env.SUPPORTED_BANKS?.split(',') || undefined,
      defaultBalance: process.env.DEFAULT_BANK_BALANCE,
    },
    
    simulation: {
      failureRate: process.env.FAILURE_RATE,
      latencySimulation: process.env.LATENCY_SIMULATION,
      networkDelayMs: process.env.NETWORK_DELAY_MS,
      enableFraudDetection: process.env.ENABLE_FRAUD_DETECTION,
    },
    
    security: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      bcryptRounds: process.env.BCRYPT_ROUNDS,
    },
    
    rateLimit: {
      max: process.env.RATE_LIMIT_MAX,
      timeWindow: process.env.RATE_LIMIT_TIMEWINDOW,
    },
    
    observability: {
      logLevel: process.env.LOG_LEVEL,
      enableMetrics: process.env.ENABLE_METRICS,
      metricsPort: process.env.METRICS_PORT,
      enableTracing: process.env.ENABLE_TRACING,
      jaegerEndpoint: process.env.JAEGER_ENDPOINT,
      serviceName: process.env.SERVICE_NAME,
    },
    
    healthCheck: {
      interval: process.env.HEALTH_CHECK_INTERVAL,
      timeout: process.env.HEALTH_CHECK_TIMEOUT,
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }
};

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;
