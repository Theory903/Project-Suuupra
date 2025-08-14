import { PrismaClient } from '@prisma/client';
import { SUPPORTED_BANKS } from '../src/constants/banks';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

async function seedBanks() {
  logger.info('Seeding banks...');

  for (const bankConfig of Object.values(SUPPORTED_BANKS)) {
    await prisma.bank.upsert({
      where: { bankCode: bankConfig.code },
      update: {
        bankName: bankConfig.name,
        ifscPrefix: bankConfig.ifscPrefix,
        dailyLimitPaisa: BigInt(bankConfig.dailyLimitPaisa),
        minBalancePaisa: BigInt(bankConfig.minBalancePaisa),
        features: bankConfig.features,
        isActive: true,
      },
      create: {
        bankCode: bankConfig.code,
        bankName: bankConfig.name,
        ifscPrefix: bankConfig.ifscPrefix,
        dailyLimitPaisa: BigInt(bankConfig.dailyLimitPaisa),
        minBalancePaisa: BigInt(bankConfig.minBalancePaisa),
        features: bankConfig.features,
        isActive: true,
      },
    });

    logger.info(`Seeded bank: ${bankConfig.name} (${bankConfig.code})`);
  }
}

async function seedSampleAccounts() {
  logger.info('Seeding sample accounts...');

  const banks = await prisma.bank.findMany();
  
  for (const bank of banks) {
    // Create 5 sample accounts per bank
    for (let i = 1; i <= 5; i++) {
      const accountNumber = `${bank.ifscPrefix}${Date.now().toString().slice(-8)}${i.toString().padStart(2, '0')}`;
      const ifscCode = `${bank.ifscPrefix}0000001`;
      
      const account = await prisma.account.create({
        data: {
          accountNumber,
          bankId: bank.id,
          ifscCode,
          customerId: `CUST${bank.bankCode}${i.toString().padStart(3, '0')}`,
          accountType: i <= 3 ? 'SAVINGS' : 'CURRENT',
          accountHolderName: `Test User ${bank.bankCode} ${i}`,
          mobileNumber: `+9199999${bank.bankCode.slice(0, 2)}${i.toString().padStart(2, '0')}`,
          email: `test.${bank.bankCode.toLowerCase()}.${i}@example.com`,
          balancePaisa: BigInt(Math.floor(Math.random() * 10000000) + 1000000), // Random balance between 10k to 1L
          availableBalancePaisa: BigInt(Math.floor(Math.random() * 10000000) + 1000000),
          status: 'ACTIVE',
          kycStatus: 'VERIFIED',
          dailyLimitPaisa: BigInt(2500000),
          panNumber: `ABCDE1234${i}`,
          aadhaarMasked: `XXXX-XXXX-${(1000 + i).toString()}`,
          dateOfBirth: new Date(1990 + i, i % 12, (i * 3) % 28 + 1),
          address: `Test Address ${i}, ${bank.bankName} Branch, Test City - 400001`,
        },
      });

      // Create VPA mapping for each account
      const vpa = `test.${bank.bankCode.toLowerCase()}.${i}@${bank.bankCode.toLowerCase()}`;
      await prisma.vpaMapping.create({
        data: {
          vpa,
          accountId: account.id,
          isPrimary: true,
          isActive: true,
        },
      });

      logger.info(`Created account: ${accountNumber} with VPA: ${vpa}`);
    }
  }
}

async function seedSampleTransactions() {
  logger.info('Seeding sample transactions...');

  const accounts = await prisma.account.findMany({ take: 10 });
  
  for (const account of accounts) {
    // Create 3 sample transactions per account
    for (let i = 1; i <= 3; i++) {
      const transactionId = `TXN${Date.now()}${i}`;
      const bankReferenceId = `BNK${Date.now()}${i}`;
      const amountPaisa = BigInt(Math.floor(Math.random() * 100000) + 10000); // Random amount between 100 to 1000
      
      await prisma.transaction.create({
        data: {
          transactionId,
          bankReferenceId,
          accountId: account.id,
          type: i % 2 === 0 ? 'DEBIT' : 'CREDIT',
          amountPaisa,
          balanceBeforePaisa: account.balancePaisa,
          balanceAfterPaisa: i % 2 === 0 
            ? account.balancePaisa - amountPaisa 
            : account.balancePaisa + amountPaisa,
          status: Math.random() > 0.1 ? 'SUCCESS' : 'FAILED', // 90% success rate
          reference: `REF${i}${account.accountNumber.slice(-4)}`,
          description: `Sample ${i % 2 === 0 ? 'payment' : 'receipt'} transaction`,
          metadata: {
            channel: 'UPI',
            device: 'mobile',
            location: 'Mumbai',
          },
          processedAt: new Date(),
        },
      });

      logger.info(`Created transaction: ${transactionId} for account: ${account.accountNumber}`);
    }
  }
}

async function main() {
  try {
    logger.info('Starting database seeding...');

    await seedBanks();
    await seedSampleAccounts();
    await seedSampleTransactions();

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  logger.error('Seeding failed:', error);
  process.exit(1);
});
