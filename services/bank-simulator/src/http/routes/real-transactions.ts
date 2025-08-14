import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TransactionService } from '../../services/transaction-service';
import logger from '../../utils/logger';

interface CreateAccountRequest {
  bankCode: string;
  customerId: string;
  accountType: string;
  accountHolderName: string;
  mobileNumber: string;
  email?: string;
  initialDepositPaisa: number;
}

interface LinkVPARequest {
  vpa: string;
  bankCode: string;
  accountNumber: string;
  isPrimary: boolean;
}

interface GetAccountsQuery {
  customerId?: string;
  bankCode?: string;
}

interface GetBalanceQuery {
  bankCode: string;
  accountNumber: string;
}

interface ResolveVPAQuery {
  vpa: string;
}

export async function registerRealTransactionRoutes(
  fastify: FastifyInstance,
  prisma: PrismaClient
) {
  const transactionService = new TransactionService(prisma);

  // Create Account endpoint
  fastify.post<{ Body: CreateAccountRequest }>('/admin/accounts', async (request, reply) => {
    try {
      const {
        bankCode,
        customerId,
        accountType,
        accountHolderName,
        mobileNumber,
        email,
        initialDepositPaisa
      } = request.body;

      logger.info('Creating account', {
        bankCode,
        customerId,
        accountHolderName,
        initialDepositPaisa
      });

      const result = await transactionService.createAccount(
        bankCode,
        customerId,
        accountType,
        accountHolderName,
        mobileNumber,
        email,
        initialDepositPaisa
      );

      reply.code(201).send({
        success: true,
        account: result
      });
    } catch (error) {
      logger.error('Failed to create account', { error: error.message });
      reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Link VPA endpoint
  fastify.post<{ Body: LinkVPARequest }>('/admin/vpa', async (request, reply) => {
    try {
      const { vpa, bankCode, accountNumber, isPrimary } = request.body;

      logger.info('Linking VPA', { vpa, bankCode, accountNumber });

      const result = await transactionService.linkVPA(vpa, bankCode, accountNumber, isPrimary);

      reply.send({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Failed to link VPA', { error: error.message });
      reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Get accounts endpoint
  fastify.get<{ Querystring: GetAccountsQuery }>('/admin/accounts', async (request, reply) => {
    try {
      const { customerId, bankCode } = request.query;

      // For now, return mock data since we need to implement the actual query
      // In a real implementation, you'd query the database
      const accounts = await prisma.account.findMany({
        where: {
          ...(customerId && { customerId }),
          ...(bankCode && { bank: { bankCode } })
        },
        include: {
          bank: true
        },
        take: 10
      });

      reply.send({
        success: true,
        accounts: accounts.map(account => ({
          accountNumber: account.accountNumber,
          customerId: account.customerId,
          accountHolderName: account.accountHolderName,
          bankCode: account.bank.bankCode,
          balancePaisa: Number(account.balancePaisa),
          status: account.status
        }))
      });
    } catch (error) {
      logger.error('Failed to get accounts', { error: error.message });
      reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // Get account balance endpoint
  fastify.get<{ Querystring: GetBalanceQuery }>('/admin/accounts/balance', async (request, reply) => {
    try {
      const { bankCode, accountNumber } = request.query;

      if (!bankCode || !accountNumber) {
        return reply.code(400).send({
          success: false,
          error: 'bankCode and accountNumber are required'
        });
      }

      const balance = await transactionService.getAccountBalance(bankCode, accountNumber);

      reply.send({
        success: true,
        ...balance
      });
    } catch (error) {
      logger.error('Failed to get account balance', { error: error.message });
      reply.code(404).send({
        success: false,
        error: error.message
      });
    }
  });

  // Resolve VPA endpoint
  fastify.get<{ Querystring: ResolveVPAQuery }>('/admin/vpa/resolve', async (request, reply) => {
    try {
      const { vpa } = request.query;

      if (!vpa) {
        return reply.code(400).send({
          success: false,
          error: 'vpa is required'
        });
      }

      const result = await transactionService.resolveVPA(vpa);

      reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Failed to resolve VPA', { error: error.message });
      reply.code(404).send({
        success: false,
        error: error.message
      });
    }
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'bank-simulator'
    });
  });
}
