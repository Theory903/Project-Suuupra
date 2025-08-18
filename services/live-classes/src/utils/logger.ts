import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  name: config.server.name,
  level: config.observability.logLevel,
  ...(config.env === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }),
  ...(config.env === 'production' && {
    formatters: {
      level: (label) => ({ level: label }),
      log: (obj) => ({
        ...obj,
        timestamp: new Date().toISOString(),
        service: config.server.name,
        environment: config.env
      })
    }
  })
});
