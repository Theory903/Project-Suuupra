import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { SUPPORTED_BANKS } from '../../constants/banks';

const banksRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all supported banks
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const banks = Object.values(SUPPORTED_BANKS).map(bank => ({
      code: bank.code,
      name: bank.name,
      ifscPrefix: bank.ifscPrefix,
      features: bank.features,
      dailyLimitPaisa: bank.dailyLimitPaisa,
      minBalancePaisa: bank.minBalancePaisa,
    }));

    await reply.send({
      success: true,
      data: banks,
      total: banks.length,
    });
  });

  // Get specific bank information
  fastify.get('/:bankCode', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bankCode } = request.params as { bankCode: string };
    
    const bank = SUPPORTED_BANKS[bankCode.toUpperCase()];
    
    if (!bank) {
      await reply.status(404).send({
        success: false,
        error: 'Bank not found',
        code: 'BANK_NOT_FOUND',
      });
      return;
    }

    await reply.send({
      success: true,
      data: {
        code: bank.code,
        name: bank.name,
        ifscPrefix: bank.ifscPrefix,
        features: bank.features,
        dailyLimitPaisa: bank.dailyLimitPaisa,
        minBalancePaisa: bank.minBalancePaisa,
        processingDelayMs: bank.processingDelayMs,
        failureRate: bank.failureRate,
      },
    });
  });

  // Get bank health status
  fastify.get('/:bankCode/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bankCode } = request.params as { bankCode: string };
    
    const bank = SUPPORTED_BANKS[bankCode.toUpperCase()];
    
    if (!bank) {
      await reply.status(404).send({
        success: false,
        error: 'Bank not found',
        code: 'BANK_NOT_FOUND',
      });
      return;
    }

    // Simulate bank health metrics
    const successRate = Math.max(95, 100 - (bank.failureRate * 100));
    const avgResponseTime = bank.processingDelayMs + Math.random() * 20;

    await reply.send({
      success: true,
      data: {
        bankCode: bank.code,
        status: 'HEALTHY',
        successRatePercent: Math.round(successRate),
        avgResponseTimeMs: Math.round(avgResponseTime),
        lastChecked: new Date().toISOString(),
        features: bank.features,
      },
    });
  });
};

export = banksRoutes;
