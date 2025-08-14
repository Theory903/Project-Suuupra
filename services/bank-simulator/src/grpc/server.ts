import { Server } from '@grpc/grpc-js';
import { loadPackageDefinition } from '@grpc/grpc-js'; // Correct import path
import * as protoLoader from '@grpc/proto-loader';
import { PrismaClient } from '@prisma/client';
import path from 'path';
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

    const bankSimulatorProto = (loadPackageDefinition(packageDefinition) as any).bank_simulator as any;

    // Create service implementation
    const bankSimulatorService = new BankSimulatorService(prisma);

    // Add service to server
    server.addService(bankSimulatorProto.BankSimulator.service, {
      ProcessTransaction: bankSimulatorService.processTransaction.bind(bankSimulatorService),
      GetTransactionStatus: bankSimulatorService.getTransactionStatus.bind(bankSimulatorService),
      GetAccountBalance: bankSimulatorService.getAccountBalance.bind(bankSimulatorService),
      CreateAccount: bankSimulatorService.createAccount.bind(bankSimulatorService),
      LinkVPA: bankSimulatorService.linkVPA.bind(bankSimulatorService),
      GetBankConfig: bankSimulatorService.getBankConfig.bind(bankSimulatorService),
      UpdateBankStatus: bankSimulatorService.updateBankStatus.bind(bankSimulatorService),
      GetMetrics: bankSimulatorService.getMetrics.bind(bankSimulatorService),
    });

    // Return configured server (binding/starting will be handled by server.ts)
    return server;
  } catch (error) {
    logger.error(`Error setting up gRPC server: ${(error as Error).message}`); // Cast error to Error
    throw error;
  }
}
