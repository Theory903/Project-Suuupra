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
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
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

    } catch (error: unknown) {
      requestLogger.error('Transaction processing error', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async getTransactionStatus(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      transactionId: request.transaction_id,
      method: 'GetTransactionStatus'
    });
    
    try {
      requestLogger.info('Looking up transaction status', {
        transactionId: request.transaction_id,
      });

      // Look up transaction in database
      const transaction = await this.prisma.transaction.findUnique({
        where: {
          transactionId: request.transaction_id,
        },
        include: {
          account: {
            include: { bank: true },
          },
        },
      });

      if (!transaction) {
        callback({
          code: status.NOT_FOUND,
          message: 'Transaction not found',
          details: 'TRANSACTION_NOT_FOUND',
        });
        return;
      }

      const response = {
        transaction_id: transaction.transactionId,
        status: transaction.status === 'SUCCESS' ? 'TRANSACTION_STATUS_SUCCESS' : 'TRANSACTION_STATUS_FAILED',
        bank_reference_id: transaction.bankReferenceId,
        amount_paisa: Number(transaction.amountPaisa),
        initiated_at: { 
          seconds: Math.floor(transaction.createdAt.getTime() / 1000), 
          nanos: (transaction.createdAt.getTime() % 1000) * 1000000 
        },
        processed_at: transaction.processedAt ? {
          seconds: Math.floor(transaction.processedAt.getTime() / 1000), 
          nanos: (transaction.processedAt.getTime() % 1000) * 1000000 
        } : { seconds: 0, nanos: 0 },
        error_code: '',
        error_message: '',
      };

      requestLogger.info('Transaction status retrieved', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Failed to get transaction status', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async createAccount(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      customerId: request.customer_id,
      method: 'CreateAccount'
    });
    
    try {
      requestLogger.info('Creating new account', {
        accountType: request.account_type,
        accountHolderName: request.account_holder_name,
        mobileNumber: request.mobile_number,
      });

      const bank = SUPPORTED_BANKS[request.bank_code];
      if (!bank) {
        callback({
          code: status.NOT_FOUND,
          message: 'Bank not found',
          details: 'BANK_NOT_FOUND',
        });
        return;
      }

      // Create account using TransactionService
      const result = await this.transactionService.createAccount(
        request.bank_code,
        request.customer_id,
        request.account_type || 'SAVINGS',
        request.account_holder_name,
        request.mobile_number,
        request.email || undefined,
        request.initial_deposit_paisa || 0
      );

      const response = {
        account_number: result.accountNumber,
        ifsc_code: result.ifscCode,
        status: result.status === 'ACTIVE' ? 'ACCOUNT_STATUS_ACTIVE' : 'ACCOUNT_STATUS_INACTIVE',
        error_code: '',
        error_message: '',
      };

      requestLogger.info('Account created successfully', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Account creation failed', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async getAccountBalance(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      accountNumber: request.account_number,
      method: 'GetAccountBalance'
    });
    
    try {
      requestLogger.info('Retrieving account balance', {
        accountNumber: request.account_number,
      });

      const bank = SUPPORTED_BANKS[request.bank_code];
      if (!bank) {
        callback({
          code: status.NOT_FOUND,
          message: 'Bank not found',
          details: 'BANK_NOT_FOUND',
        });
        return;
      }

      // Get real account balance using TransactionService
      const balanceInfo = await this.transactionService.getAccountBalance(
        request.bank_code,
        request.account_number
      );

      const response = {
        account_number: balanceInfo.accountNumber,
        available_balance_paisa: balanceInfo.availableBalancePaisa,
        ledger_balance_paisa: balanceInfo.ledgerBalancePaisa,
        daily_limit_remaining_paisa: balanceInfo.dailyLimitRemainingPaisa,
        last_updated: { 
          seconds: Math.floor(balanceInfo.lastUpdated.getTime() / 1000), 
          nanos: (balanceInfo.lastUpdated.getTime() % 1000) * 1000000 
        },
      };

      requestLogger.info('Account balance retrieved', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Failed to get account balance', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async getAccountDetails(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      accountNumber: request.account_number,
      method: 'GetAccountDetails'
    });
    
    try {
      requestLogger.info('Retrieving account details', {
        accountNumber: request.account_number,
      });

      // Get account from database
      const account = await this.prisma.account.findFirst({
        where: {
          accountNumber: request.account_number,
          bank: { bankCode: request.bank_code },
        },
        include: { bank: true },
      });

      if (!account) {
        callback({
          code: status.NOT_FOUND,
          message: 'Account not found',
          details: 'ACCOUNT_NOT_FOUND',
        });
        return;
      }

      const response = {
        account_number: account.accountNumber,
        ifsc_code: account.ifscCode,
        account_holder_name: account.accountHolderName,
        account_type: `ACCOUNT_TYPE_${account.accountType}`,
        status: `ACCOUNT_STATUS_${account.status}`,
        mobile_number: account.mobileNumber,
        email: account.email || '',
        available_balance_paisa: Number(account.availableBalancePaisa),
        daily_limit_paisa: Number(account.dailyLimitPaisa),
        created_at: { 
          seconds: Math.floor(account.createdAt.getTime() / 1000), 
          nanos: (account.createdAt.getTime() % 1000) * 1000000 
        },
      };

      requestLogger.info('Account details retrieved', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Failed to get account details', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async linkVPA(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      vpa: request.vpa,
      bankCode: request.bank_code,
      accountNumber: request.account_number,
      method: 'LinkVPA'
    });
    
    try {
      requestLogger.info('Linking VPA to account', {
        vpa: request.vpa,
        isPrimary: request.is_primary,
      });

      // Link VPA using TransactionService
      const result = await this.transactionService.linkVPA(
        request.vpa,
        request.bank_code,
        request.account_number,
        request.is_primary || false
      );

      const response = {
        success: result.success,
        error_code: '',
        error_message: '',
      };

      requestLogger.info('VPA linked successfully', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('VPA linking failed', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async unlinkVPA(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      vpa: request.vpa,
      method: 'UnlinkVPA'
    });
    
    try {
      requestLogger.info('Unlinking VPA', {
        vpa: request.vpa,
      });

      // Unlink VPA by setting isActive to false
      await this.prisma.vpaMapping.updateMany({
        where: {
          vpa: request.vpa,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      const response = {
        success: true,
        error_code: '',
        error_message: '',
      };

      requestLogger.info('VPA unlinked successfully', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('VPA unlinking failed', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async resolveVPA(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      vpa: request.vpa,
      method: 'ResolveVPA'
    });
    
    try {
      requestLogger.info('Resolving VPA', {
        vpa: request.vpa,
      });

      // Resolve VPA using TransactionService
      const result = await this.transactionService.resolveVPA(request.vpa);

      if (!result.exists) {
        const response = {
          exists: false,
          bank_code: '',
          account_number: '',
          account_holder_name: '',
          is_active: false,
          error_code: result.errorCode || '',
          error_message: result.errorMessage || '',
        };
        callback(null, response);
        return;
      }

      const response = {
        exists: true,
        bank_code: result.bankCode || '',
        account_number: result.accountNumber || '',
        account_holder_name: result.accountHolderName || '',
        is_active: result.isActive || false,
        error_code: '',
        error_message: '',
      };

      requestLogger.info('VPA resolved successfully', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('VPA resolution failed', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async getBankInfo(
    request: any,
    callback: GrpcCallback<any>
  ): Promise<void> {
    
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
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      method: 'CheckBankHealth'
    });
    
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

      requestLogger.info('Checking bank health');

      // Get real account counts from database
      const [totalAccounts, activeAccounts] = await Promise.all([
        this.prisma.account.count({
          where: {
            bank: { bankCode: request.bank_code },
          },
        }),
        this.prisma.account.count({
          where: {
            bank: { bankCode: request.bank_code },
            status: 'ACTIVE',
          },
        }),
      ]);

      const response = {
        bank_code: bank.code,
        health_status: 'HEALTH_STATUS_HEALTHY',
        success_rate_percent: Math.round(100 - (bank.failureRate * 100)),
        avg_response_time_ms: bank.processingDelayMs,
        total_accounts: totalAccounts,
        active_accounts: activeAccounts,
        last_checked: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      };

      requestLogger.info('Bank health check completed', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Bank health check failed', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async getBankStats(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      method: 'GetBankStats'
    });
    
    try {
      requestLogger.info('Retrieving bank statistics');

      // Get real transaction statistics from database
      const bankAccounts = await this.prisma.account.findMany({
        where: {
          bank: { bankCode: request.bank_code },
        },
        select: { id: true },
      });

      const accountIds = bankAccounts.map((acc: { id: string }) => acc.id);

      if (accountIds.length === 0) {
        // No accounts found for this bank
        callback(null, {
          bank_code: request.bank_code,
          total_transactions: 0,
          successful_transactions: 0,
          failed_transactions: 0,
          total_volume_paisa: 0,
          success_rate_percent: 0,
          avg_response_time_ms: 0,
          daily_stats: [],
        });
        return;
      }

      const [totalTransactions, successfulTransactions, failedTransactions, volumeResult] = await Promise.all([
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
          },
        }),
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            status: 'SUCCESS',
          },
        }),
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            status: 'FAILED',
          },
        }),
        this.prisma.transaction.aggregate({
          where: {
            accountId: { in: accountIds },
            status: 'SUCCESS',
          },
          _sum: {
            amountPaisa: true,
          },
        }),
      ]);

      const totalVolumePaisa = Number(volumeResult._sum.amountPaisa || 0);
      const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

      // Get today's statistics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [todayTotal, todaySuccess, todayFailed, todayVolume] = await Promise.all([
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            status: 'SUCCESS',
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            status: 'FAILED',
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        this.prisma.transaction.aggregate({
          where: {
            accountId: { in: accountIds },
            status: 'SUCCESS',
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          _sum: {
            amountPaisa: true,
          },
        }),
      ]);

      const todaySuccessRate = todayTotal > 0 ? (todaySuccess / todayTotal) * 100 : 0;
      const bankConfig = SUPPORTED_BANKS[request.bank_code];

      const response = {
        bank_code: request.bank_code,
        total_transactions: totalTransactions,
        successful_transactions: successfulTransactions,
        failed_transactions: failedTransactions,
        total_volume_paisa: totalVolumePaisa,
        success_rate_percent: Math.round(successRate * 100) / 100,
        avg_response_time_ms: bankConfig?.processingDelayMs || 75,
        daily_stats: [
          {
            date: today.toISOString().split('T')[0],
            transaction_count: todayTotal,
            success_count: todaySuccess,
            failure_count: todayFailed,
            total_volume_paisa: Number(todayVolume._sum.amountPaisa || 0),
            success_rate_percent: Math.round(todaySuccessRate * 100) / 100,
          },
        ],
      };

      requestLogger.info('Bank statistics retrieved', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Failed to get bank statistics', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  // New methods for BankSimulatorService
  async getBankConfig(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      method: 'GetBankConfig'
    });
    
    try {
      requestLogger.info('Retrieving bank configuration');

      const bank = SUPPORTED_BANKS[request.bank_code];
      if (!bank) {
        callback({ 
          code: status.NOT_FOUND, 
          message: 'Bank not found',
          details: 'BANK_NOT_FOUND'
        });
        return;
      }

      // Get bank status from database
      const bankRecord = await this.prisma.bank.findUnique({
        where: { bankCode: request.bank_code },
      });

      const isActive = bankRecord?.isActive ?? true;

      const response = {
        bank_code: bank.code,
        bank_name: bank.name,
        ifsc_prefix: bank.ifscPrefix,
        is_active: isActive,
        features: bank.features,
        daily_debit_limit_paisa: bank.dailyDebitLimitPaisa,
        daily_credit_limit_paisa: bank.dailyCreditLimitPaisa,
        min_balance_paisa: bank.minBalancePaisa,
        transaction_fees: {
          processing_fee_paisa: bank.transactionFees.processingFeePaisa,
          service_tax_paisa: bank.transactionFees.serviceTaxPaisa,
          total_fee_paisa: bank.transactionFees.totalFeePaisa,
        },
        processing_delay_ms: bank.processingDelayMs,
        failure_rate: bank.failureRate,
      };

      requestLogger.info('Bank configuration retrieved', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Failed to get bank configuration', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async updateBankStatus(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      newStatus: request.status,
      method: 'UpdateBankStatus'
    });
    
    try {
      requestLogger.info('Updating bank status', {
        bankCode: request.bank_code,
        newStatus: request.status,
      });

      // Update bank status in database
      const updateResult = await this.prisma.bank.updateMany({
        where: {
          bankCode: request.bank_code,
        },
        data: {
          isActive: request.status === 'ACTIVE',
        },
      });

      if (updateResult.count === 0) {
        callback({
          code: status.NOT_FOUND,
          message: 'Bank not found',
          details: 'BANK_NOT_FOUND',
        });
        return;
      }

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          entityType: 'bank',
          entityId: request.bank_code,
          action: 'UPDATE_BANK_STATUS',
          newValues: {
            status: request.status,
            isActive: request.status === 'ACTIVE',
          },
          userId: 'SYSTEM',
          userAgent: 'Bank Simulator gRPC',
        },
      });

      const response = { success: true };
      requestLogger.info('Bank status updated successfully', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Bank status update failed', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }

  async getMetrics(
    call: GrpcCall<any>,
    callback: GrpcCallback<any>
  ): Promise<void> {
    const request = call.request;
    const requestLogger = logger.child({ 
      bankCode: request.bank_code,
      method: 'GetMetrics'
    });
    
    try {
      requestLogger.info('Retrieving metrics', {
        bankCode: request.bank_code,
        timeRange: request.time_range,
      });

      // Calculate time range filter
      let dateFilter = {};
      if (request.time_range) {
        const now = new Date();
        let startDate: Date;
        
        switch (request.time_range) {
          case 'HOUR':
            startDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case 'DAY':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'WEEK':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'MONTH':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0); // All time
        }
        
        dateFilter = {
          createdAt: {
            gte: startDate,
          },
        };
      }

      // Get bank accounts for filtering
      const bankAccounts = await this.prisma.account.findMany({
        where: {
          bank: { bankCode: request.bank_code },
        },
        select: { id: true },
      });

      const accountIds = bankAccounts.map((acc: { id: string }) => acc.id);

      if (accountIds.length === 0) {
        callback(null, {
          total_transactions: 0,
          successful_transactions: 0,
          failed_transactions: 0,
          total_accounts: 0,
          active_accounts: 0,
          total_volume_paisa: 0,
          avg_transaction_value_paisa: 0,
          peak_tps: 0,
          avg_response_time_ms: 0,
        });
        return;
      }

      // Get transaction metrics
      const [totalTransactions, successfulTransactions, failedTransactions, volumeResult, totalAccounts, activeAccounts] = await Promise.all([
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            ...dateFilter,
          },
        }),
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            status: 'SUCCESS',
            ...dateFilter,
          },
        }),
        this.prisma.transaction.count({
          where: {
            accountId: { in: accountIds },
            status: 'FAILED',
            ...dateFilter,
          },
        }),
        this.prisma.transaction.aggregate({
          where: {
            accountId: { in: accountIds },
            status: 'SUCCESS',
            ...dateFilter,
          },
          _sum: {
            amountPaisa: true,
          },
          _avg: {
            amountPaisa: true,
          },
        }),
        this.prisma.account.count({
          where: {
            bank: { bankCode: request.bank_code },
          },
        }),
        this.prisma.account.count({
          where: {
            bank: { bankCode: request.bank_code },
            status: 'ACTIVE',
          },
        }),
      ]);

      const bankConfig = SUPPORTED_BANKS[request.bank_code];
      const totalVolume = Number(volumeResult._sum.amountPaisa || 0);
      const avgTransactionValue = Number(volumeResult._avg.amountPaisa || 0);

      const response = {
        total_transactions: totalTransactions,
        successful_transactions: successfulTransactions,
        failed_transactions: failedTransactions,
        total_accounts: totalAccounts,
        active_accounts: activeAccounts,
        total_volume_paisa: totalVolume,
        avg_transaction_value_paisa: Math.round(avgTransactionValue),
        peak_tps: Math.max(1, Math.floor(totalTransactions / 3600)), // Rough estimate
        avg_response_time_ms: bankConfig?.processingDelayMs || 75,
      };

      requestLogger.info('Metrics retrieved successfully', { response });
      callback(null, response);
    } catch (error: unknown) {
      requestLogger.error('Failed to get metrics', { error });
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
      });
    }
  }
}
