/**
 * Fastify Type Extensions for Suuupra Global Logger
 */

import { Logger } from '../../../../shared/libs/logging/core/types';

declare module 'fastify' {
  interface FastifyRequest {
    logger: Logger;
  }
}

export {};
