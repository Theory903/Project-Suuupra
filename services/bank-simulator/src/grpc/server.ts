import { Server } from '@grpc/grpc-js';
import { loadPackageDefinition } from '@grpc/proto-loader';
import * as protoLoader from '@grpc/proto-loader';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { config } from '../config';
import logger from '../utils/logger';
import { BankSimulatorService } from './services/bank-simulator-service';

export async function setupGrpcServer(prisma: PrismaClient): Promise<Server> {
  const server = new Server();

  try {
    // Load protobuf definition
    const PROTO_PATH = path.join(__dirname, '../../proto/bank_simulator.proto');
    
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const bankSimulatorProto = loadPackageDefinition(packageDefinition) as any;

    // Create service implementation
    const bankSimulatorService = new BankSimulatorService(prisma);

    // Add service to server
    server.addService(bankSimulatorProto.bank_simulator.BankSimulator.service, {
      ProcessTransaction: bankSimulatorService.processTransaction.bind(bankSimulatorService),
      GetTransactionStatus: bankSimulatorService.getTransactionStatus.bind(bankSimulatorService),
      CreateAccount: bankSimulatorService.createAccount.bind(bankSimulatorService),
      GetAccountBalance: bankSimulatorService.getAccountBalance.bind(bankSimulatorService),
      GetAccountDetails: bankSimulatorService.getAccountDetails.bind(bankSimulatorService),
      LinkVPA: bankSimulatorService.linkVPA.bind(bankSimulatorService),
      UnlinkVPA: bankSimulatorService.unlinkVPA.bind(bankSimulatorService),
      ResolveVPA: bankSimulatorService.resolveVPA.bind(bankSimulatorService),
      GetBankInfo: bankSimulatorService.getBankInfo.bind(bankSimulatorService),
      CheckBankHealth: bankSimulatorService.checkBankHealth.bind(bankSimulatorService),
      GetBankStats: bankSimulatorService.getBankStats.bind(bankSimulatorService),
    });

    // Enable reflection in development
    if (config.grpc.reflection && config.env === 'development') {
      const reflection = require('@grpc/reflection');
      reflection.addReflection(server, PROTO_PATH);
      logger.info('gRPC reflection enabled');
    }

    logger.info('gRPC server configured successfully');
    return server;

  } catch (error) {
    logger.error('Failed to setup gRPC server', { error });
    throw error;
  }
}
