import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TransactionService } from '../../services/transaction-service';
import logger from '../../utils/logger';
import { z } from 'zod';

const processTransactionSchema = z.object({
  transactionId: z.string(),
  bankCode: z.string(),
  accountNumber: z.string(),
  amountPaisa: z.number().int().positive(),
  type: z.enum(['DEBIT', 'CREDIT']),
  reference: z.string().nullable().optional(), // Allow null
  description: z.string().nullable().optional(), // Allow null
  metadata: z.record(z.any()).optional(),
});

export async function registerRealTransactionRoutes(server: FastifyInstance, prisma: PrismaClient) {
  const transactionService = new TransactionService(prisma);

  server.post('/api/real-transactions/process', {
    schema: {
      body: {
        type: 'object',
        required: ['transactionId', 'bankCode', 'accountNumber', 'amountPaisa', 'type'],
        properties: {
          transactionId: { type: 'string' },
          bankCode: { type: 'string' },
          accountNumber: { type: 'string' },
          amountPaisa: { type: 'integer', minimum: 1 },
          type: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
          reference: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          metadata: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            transactionId: { type: 'string' },
            bankReferenceId: { type: 'string' },
            status: { type: 'string' },
            errorCode: { type: ['string', 'null'] },
            errorMessage: { type: ['string', 'null'] },
            accountBalancePaisa: { type: 'integer' },
            processedAt: { type: 'string' },
            fees: {
              type: 'object',
              properties: {
                processingFeePaisa: { type: 'integer' },
                serviceTaxPaisa: { type: 'integer' },
                totalFeePaisa: { type: 'integer' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'integer' },
            errorCode: { type: ['string', 'null'] },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const requestBody = request.body as z.infer<typeof processTransactionSchema>;
      const requestLogger = logger.child({
        transactionId: requestBody.transactionId,
        bankCode: requestBody.bankCode,
        method: 'RealProcessTransaction',
      });

      try {
        requestLogger.info('Processing real transaction request', requestBody);

        const transactionRequest = {
          ...requestBody,
          reference: requestBody.reference === undefined ? null : requestBody.reference,
          description: requestBody.description === undefined ? null : requestBody.description,
          metadata: requestBody.metadata || undefined,
        };

        const result = await transactionService.processTransaction(transactionRequest);

        if (result.status === 'SUCCESS') {
          requestLogger.info('Real transaction processed successfully', { result });
          return reply.send({
            transactionId: result.transactionId,
            bankReferenceId: result.bankReferenceId,
            status: result.status,
            accountBalancePaisa: Number(result.accountBalancePaisa), // Convert BigInt to Number for JSON
            processedAt: result.processedAt.toISOString(),
            fees: result.fees,
            errorCode: result.errorCode === undefined ? null : result.errorCode,
            errorMessage: result.errorMessage === undefined ? null : result.errorMessage,
          });
        } else {
          requestLogger.warn('Real transaction failed', { result });
          return reply.status(400).send({
            error: result.errorMessage || 'Transaction failed',
            statusCode: 400,
            errorCode: result.errorCode === undefined ? null : result.errorCode,
          });
        }
      } catch (error: unknown) {
        requestLogger.error('Real transaction processing error', { error });
        return reply.status(500).send({
          error: (error as Error).message || 'Internal Server Error',
          statusCode: 500,
        });
      }
    },
  });

  server.get('/api/real-accounts/:bankCode/:accountNumber/balance', {
    schema: {
      params: {
        type: 'object',
        required: ['bankCode', 'accountNumber'],
        properties: {
          bankCode: { type: 'string' },
          accountNumber: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            bankCode: { type: 'string' },
            accountNumber: { type: 'string' },
            balancePaisa: { type: 'integer' },
            availableBalancePaisa: { type: 'integer' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { bankCode, accountNumber } = request.params as { bankCode: string, accountNumber: string };
      const requestLogger = logger.child({ bankCode, accountNumber, method: 'GetAccountBalance' });

      try {
        requestLogger.info('Fetching account balance');
        const account: any = await prisma.account.findFirst({
          where: {
            accountNumber,
            bank: { bankCode },
          },
          include: {
            bank: true, // Include the bank relation to access bankCode
          },
        });

        if (!account) {
          return reply.status(404).send({ error: 'Account not found', statusCode: 404 });
        }

        return reply.send({
          bankCode: account.bank.bankCode, // Access bankCode via the bank relation
          accountNumber: account.accountNumber,
          balancePaisa: Number(account.balancePaisa),
          availableBalancePaisa: Number(account.availableBalancePaisa),
        });
      } catch (error: unknown) {
        requestLogger.error('Error fetching account balance', { error });
        return reply.status(500).send({
          error: (error as Error).message || 'Internal Server Error',
          statusCode: 500,
        });
      }
    },
  });
}
