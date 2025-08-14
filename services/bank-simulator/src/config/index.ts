// Helper to parse boolean environment variables
const parseBoolean = (value: string | undefined): boolean => {
  return value?.toLowerCase() === 'true';
};

export const config = {
  env: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '8080', 10),
  host: process.env['HOST'] || '0.0.0.0',
  database: {
    url: process.env['DATABASE_URL'] || 'postgresql://user:password@localhost:5432/bank_simulator_db',
    poolSize: parseInt(process.env['DATABASE_POOL_SIZE'] || '10', 10),
  },
  grpc: {
    port: parseInt(process.env['GRPC_PORT'] || '50051', 10),
    host: process.env['GRPC_HOST'] || '0.0.0.0',
    reflection: parseBoolean(process.env['GRPC_REFLECTION'] || 'false'),
  },
  simulator: {
    supportedBanks: (process.env['SUPPORTED_BANKS'] || 'HDFC,SBI,ICICI,AXIS,KOTAK').split(','),
    defaultBankBalance: parseInt(process.env['DEFAULT_BANK_BALANCE'] || '1000000', 10), // 10,000 INR
    failureRate: parseFloat(process.env['FAILURE_RATE'] || '0.1'),
    latencySimulation: parseBoolean(process.env['LATENCY_SIMULATION'] || 'true'),
    networkDelayMs: parseInt(process.env['NETWORK_DELAY_MS'] || '50', 10),
    enableFraudDetection: parseBoolean(process.env['ENABLE_FRAUD_DETECTION'] || 'true'),
  },
  security: {
    jwtSecret: process.env['JWT_SECRET'] || 'supersecretjwtkey',
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '1h',
    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '10', 10),
  },
  rateLimit: {
    max: parseInt(process.env['RATE_LIMIT_MAX'] || '1000', 10),
    timeWindow: process.env['RATE_LIMIT_TIMEWINDOW'] || '1 minute',
  },
  observability: {
    logLevel: process.env['LOG_LEVEL'] || 'info',
    enableMetrics: parseBoolean(process.env['ENABLE_METRICS'] || 'true'),
    metricsPort: parseInt(process.env['METRICS_PORT'] || '9090', 10),
    enableTracing: parseBoolean(process.env['ENABLE_TRACING'] || 'true'),
    jaegerEndpoint: process.env['JAEGER_ENDPOINT'] || 'http://localhost:6831/udp',
    serviceName: process.env['SERVICE_NAME'] || 'bank-simulator',
  },
  healthCheck: {
    interval: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '5000', 10),
    timeout: parseInt(process.env['HEALTH_CHECK_TIMEOUT'] || '2000', 10),
  },
  appVersion: process.env['npm_package_version'] || '1.0.0',
};
