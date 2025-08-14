import Fastify from 'fastify';
import { Server } from '@grpc/grpc-js';
import { config } from './config';
import logger from './utils/logger';
import { setupHttpServer } from './http/server';
import { setupGrpcServer } from './grpc/server';
import { setupMetricsServer } from './metrics/server';

let httpServer: ReturnType<typeof Fastify>;
let grpcServer: Server;

export async function startServer(): Promise<void> {
  try {
    // Setup HTTP server (REST API + Health checks)
    httpServer = await setupHttpServer();
    
    // Setup gRPC server (Core banking operations)
    const { createPrismaClient } = await import('./config/database');
    const prisma = createPrismaClient();
    grpcServer = await setupGrpcServer(prisma);
    
    // Setup metrics server (Prometheus)
    if (config.observability.enableMetrics) {
      await setupMetricsServer();
    }
    
    // Start HTTP server
    await httpServer.listen({
      port: config.port,
      host: config.host,
    });
    
    logger.info('HTTP server started', {
      port: config.port,
      host: config.host,
    });
    
    // Start gRPC server
    grpcServer.bindAsync(
      `${config.grpc.host}:${config.grpc.port}`,
      grpcServer.createInsecure(),
      (error, port) => {
        if (error) {
          logger.error('Failed to start gRPC server', { error });
          throw error;
        }
        
        grpcServer.start();
        logger.info('gRPC server started', {
          port,
          host: config.grpc.host,
        });
      }
    );
    
  } catch (error) {
    logger.error('Failed to start servers', { error });
    throw error;
  }
}

export async function stopServer(): Promise<void> {
  const shutdownPromises: Promise<void>[] = [];
  
  // Stop HTTP server
  if (httpServer) {
    shutdownPromises.push(httpServer.close());
  }
  
  // Stop gRPC server
  if (grpcServer) {
    shutdownPromises.push(
      new Promise<void>((resolve) => {
        grpcServer.tryShutdown(() => {
          resolve();
        });
      })
    );
  }
  
  await Promise.all(shutdownPromises);
  logger.info('All servers stopped');
}
