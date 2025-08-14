import { ServerUnaryCall, sendUnaryData, status } from '@grpc/grpc-js';
import { PrismaClient } from '@prisma/client';
import { SUPPORTED_BANKS } from '../../constants/banks';
import { TransactionService } from '../../services/transaction-service';
import logger from '../../utils/logger';

// Types for gRPC method signatures
type GrpcCall<T> = ServerUnaryCall<T, any>;
type GrpcCallback<T> = sendUnaryData<T>;

export class BankSimulatorService {
  private transactionService: TransactionService;

  constructor(prisma: PrismaClient) {
    this.transactionService = new TransactionService(prisma);
  }
  
  async processTransaction(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      transactionId: request.transaction_id,
      bankCode: request.bank_code,
      method: 'ProcessTransaction'
    });

    try {
      requestLogger.info('Processing transaction request', {
        accountNumber: request.account_number,
        amountPaisa: request.amount_paisa,
        type: request.type,
      });

      // Validate bank
      const bank = SUPPORTED_BANKS[request.bank_code];
      if (!bank) {
        callback({
          code: status.NOT_FOUND,
          message: 'Bank not found',
          details: 'BANK_NOT_FOUND',
        });
        return;
      }

      // Process transaction using the real service with ACID guarantees
      const transactionRequest = {
        transactionId: request.transaction_id,
        bankCode: request.bank_code,
        accountNumber: request.account_number,
        amountPaisa: request.amount_paisa,
        type: request.type === 'TRANSACTION_TYPE_DEBIT' ? 'DEBIT' as const : 'CREDIT' as const,
        reference: request.reference,
        description: request.description,
        metadata: request.metadata || {},
      };

      const result = await this.transactionService.processTransaction(transactionRequest);

      // Convert to gRPC response format
      const response = {
        transaction_id: result.transactionId,
        status: result.status === 'SUCCESS' ? 'TRANSACTION_STATUS_SUCCESS' : 'TRANSACTION_STATUS_FAILED',
        bank_reference_id: result.bankReferenceId,
        error_code: result.errorCode || '',
        error_message: result.errorMessage || '',
        account_balance_paisa: result.accountBalancePaisa,
        processed_at: { 
          seconds: Math.floor(result.processedAt.getTime() / 1000), 
          nanos: (result.processedAt.getTime() % 1000) * 1000000 
        },
        fees: {
          processing_fee_paisa: result.fees.processingFeePaisa,
          service_tax_paisa: result.fees.serviceTaxPaisa,
          total_fee_paisa: result.fees.totalFeePaisa,
        },
      };

      if (result.status === 'SUCCESS') {
        requestLogger.info('Transaction processed successfully', { response });
      } else {
        requestLogger.warn('Transaction failed', { response });
      }
      
      callback(null, response);

    } catch (error) {
      requestLogger.error('Transaction processing error', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTransactionStatus(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    
    try {
      // Mock response for now
      const response = {
        transaction_id: request.transaction_id,
        status: 'TRANSACTION_STATUS_SUCCESS',
        bank_reference_id: `BNK${Date.now()}`,
        amount_paisa: 10000,
        initiated_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        processed_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        error_code: '',
        error_message: '',
      };

      callback(null, response);
    } catch (error) {
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createAccount(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    
    try {
      const bank = SUPPORTED_BANKS[request.bank_code];
      if (!bank) {
        callback({
          code: status.NOT_FOUND,
          message: 'Bank not found',
          details: 'BANK_NOT_FOUND',
        });
        return;
      }

      // Generate account number
      const accountNumber = `${bank.ifscPrefix}${Date.now().toString().slice(-10)}`;
      const ifscCode = `${bank.ifscPrefix}0000001`;

      const response = {
        account_number: accountNumber,
        ifsc_code: ifscCode,
        status: 'ACCOUNT_STATUS_ACTIVE',
        error_code: '',
        error_message: '',
      };

      callback(null, response);
    } catch (error) {
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAccountBalance(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    
    try {
      const bank = SUPPORTED_BANKS[request.bank_code];
      if (!bank) {
        callback({
          code: status.NOT_FOUND,
          message: 'Bank not found',
          details: 'BANK_NOT_FOUND',
        });
        return;
      }

      const response = {
        account_number: request.account_number,
        available_balance_paisa: 1000000, // Mock 10k balance
        ledger_balance_paisa: 1000000,
        daily_limit_remaining_paisa: bank.dailyLimitPaisa,
        last_updated: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      };

      callback(null, response);
    } catch (error) {
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAccountDetails(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    // Mock implementation
    callback(null, {
      account_number: call.request.account_number,
      ifsc_code: 'MOCK0000001',
      account_holder_name: 'Mock User',
      account_type: 'ACCOUNT_TYPE_SAVINGS',
      status: 'ACCOUNT_STATUS_ACTIVE',
      mobile_number: '+919999999999',
      email: 'mock@example.com',
      available_balance_paisa: 1000000,
      daily_limit_paisa: 2500000,
      created_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    });
  }

  async linkVPA(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    // Mock implementation
    callback(null, {
      success: true,
      error_code: '',
      error_message: '',
    });
  }

  async unlinkVPA(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    // Mock implementation
    callback(null, {
      success: true,
      error_code: '',
      error_message: '',
    });
  }

  async resolveVPA(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    // Mock implementation
    callback(null, {
      exists: true,
      bank_code: 'HDFC',
      account_number: 'HDFC1234567890',
      account_holder_name: 'Mock User',
      is_active: true,
      error_code: '',
      error_message: '',
    });
  }

  async getBankInfo(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const bank = SUPPORTED_BANKS[request.bank_code];
    
    if (!bank) {
      callback({
        code: status.NOT_FOUND,
        message: 'Bank not found',
        details: 'BANK_NOT_FOUND',
      });
      return;
    }

    callback(null, {
      bank_code: bank.code,
      bank_name: bank.name,
      ifsc_prefix: bank.ifscPrefix,
      is_active: true,
      features: bank.features,
      daily_limit_paisa: bank.dailyLimitPaisa,
      min_balance_paisa: bank.minBalancePaisa,
    });
  }

  async checkBankHealth(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const bank = SUPPORTED_BANKS[request.bank_code];
    
    if (!bank) {
      callback({
        code: status.NOT_FOUND,
        message: 'Bank not found',
        details: 'BANK_NOT_FOUND',
      });
      return;
    }

    callback(null, {
      bank_code: bank.code,
      health_status: 'HEALTH_STATUS_HEALTHY',
      success_rate_percent: Math.round(100 - (bank.failureRate * 100)),
      avg_response_time_ms: bank.processingDelayMs,
      total_accounts: 1000,
      active_accounts: 950,
      last_checked: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    });
  }

  async getBankStats(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    
    // Mock statistics
    callback(null, {
      bank_code: request.bank_code,
      total_transactions: 10000,
      successful_transactions: 9950,
      failed_transactions: 50,
      total_volume_paisa: 100000000000, // 10 crore
      success_rate_percent: 99.5,
      avg_response_time_ms: 75,
      daily_stats: [
        {
          date: '2024-01-01',
          transaction_count: 1000,
          success_count: 995,
          failure_count: 5,
          total_volume_paisa: 10000000000,
          success_rate_percent: 99.5,
        },
      ],
    });
  }
}
