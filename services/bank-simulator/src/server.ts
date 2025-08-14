import Fastify from 'fastify';
import { Server } from '@grpc/grpc-js';
import { config } from './config';
import logger from './utils/logger';
import { setupHttpServer } from './http/server';
import { setupGrpcServer } from './grpc/server';
import { setupMetricsServer } from './metrics/server';
import { ServerCredentials } from '@grpc/grpc-js';

let httpServer: ReturnType<typeof Fastify>;
let grpcServer: Server;

export async function startServer(): Promise<void> {
  try {
    // Setup HTTP server (REST API + Health checks)
    logger.info('Setting up HTTP server...');
    httpServer = await setupHttpServer();
    logger.info('HTTP server setup completed');
    
    // Setup gRPC server (Core banking operations)
    logger.info('Setting up gRPC server...');
    const { createPrismaClient } = await import('./config/database');
    const prisma = createPrismaClient();
    grpcServer = await setupGrpcServer(prisma);
    logger.info('gRPC server setup completed');
    
    // Setup metrics server (Prometheus)
    if (config.observability.enableMetrics) {
      logger.info('Setting up metrics server...');
      await setupMetricsServer();
      logger.info('Metrics server setup completed');
    }
    
    // Start HTTP server
    logger.info('Starting HTTP server...', { port: config.port, host: config.host });
    try {
      await httpServer.listen({
        port: config.port,
        host: config.host,
      });
      logger.info('HTTP server started successfully', {
        port: config.port,
        host: config.host,
      });
    } catch (httpError) {
      console.error('HTTP Server Error:', httpError);
      logger.error('Failed to start HTTP server', { 
        error: httpError instanceof Error ? httpError.message : httpError,
        stack: httpError instanceof Error ? httpError.stack : undefined,
        port: config.port,
        host: config.host
      });
      throw httpError;
    }
    
    // Start gRPC server
    logger.info('Starting gRPC server...', { port: config.grpc.port, host: config.grpc.host });
    try {
      await new Promise<void>((resolve, reject) => {
        grpcServer.bindAsync(
          `${config.grpc.host}:${config.grpc.port}`,
          ServerCredentials.createInsecure(),
          (error, port) => {
            if (error) {
              logger.error('Failed to bind gRPC server', { 
                error: error.message,
                stack: error.stack,
                port: config.grpc.port,
                host: config.grpc.host
              });
              reject(error);
              return;
            }
            
            try {
              grpcServer.start();
              logger.info('gRPC server started successfully', {
                port,
                host: config.grpc.host,
              });
              resolve();
            } catch (startError) {
              logger.error('Failed to start gRPC server after bind', { 
                error: startError instanceof Error ? startError.message : startError
              });
              reject(startError);
            }
          }
        );
      });
    } catch (grpcError) {
      logger.error('Failed to start gRPC server', { 
        error: grpcError instanceof Error ? grpcError.message : grpcError,
        stack: grpcError instanceof Error ? grpcError.stack : undefined
      });
      throw grpcError;
    }

    logger.info('All servers started successfully');
    
  } catch (error) {
    logger.error('Failed to start servers', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
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
