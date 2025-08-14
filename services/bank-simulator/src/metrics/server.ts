import { createServer } from 'http';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { config } from '../config';
import logger from '../utils/logger';

// Enable default metrics collection
collectDefaultMetrics({
  prefix: 'bank_simulator_',
  labels: { service: 'bank-simulator' },
});

// Custom metrics
export const transactionCounter = new Counter({
  name: 'bank_simulator_transactions_total',
  help: 'Total number of transactions processed',
  labelNames: ['bank_code', 'type', 'status'],
});

export const transactionDuration = new Histogram({
  name: 'bank_simulator_transaction_duration_seconds',
  help: 'Transaction processing duration in seconds',
  labelNames: ['bank_code', 'type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const accountsGauge = new Gauge({
  name: 'bank_simulator_accounts_total',
  help: 'Total number of accounts per bank',
  labelNames: ['bank_code', 'status'],
});

export const balanceGauge = new Gauge({
  name: 'bank_simulator_total_balance_paisa',
  help: 'Total balance across all accounts in paisa',
  labelNames: ['bank_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'bank_simulator_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const grpcRequestDuration = new Histogram({
  name: 'bank_simulator_grpc_request_duration_seconds',
  help: 'gRPC request duration in seconds',
  labelNames: ['method', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export async function setupMetricsServer(): Promise<void> {
  const server = createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  server.listen(config.observability.metricsPort, () => {
    logger.info('Metrics server started', {
      port: config.observability.metricsPort,
      endpoint: `/metrics`,
    });
  });
}
