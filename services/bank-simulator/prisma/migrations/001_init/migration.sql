-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "banks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_code" VARCHAR(10) NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "ifsc_prefix" VARCHAR(4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "daily_limit_paisa" BIGINT NOT NULL DEFAULT 10000000,
    "min_balance_paisa" BIGINT NOT NULL DEFAULT 1000000,
    "features" TEXT[] DEFAULT ARRAY['UPI', 'IMPS', 'NEFT', 'RTGS']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_number" VARCHAR(20) NOT NULL,
    "bank_id" UUID NOT NULL,
    "ifsc_code" VARCHAR(11) NOT NULL,
    "customer_id" VARCHAR(50) NOT NULL,
    "account_type" VARCHAR(20) NOT NULL,
    "account_holder_name" VARCHAR(100) NOT NULL,
    "mobile_number" VARCHAR(15),
    "email" VARCHAR(100),
    "balance_paisa" BIGINT NOT NULL DEFAULT 0,
    "available_balance_paisa" BIGINT NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "kyc_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "daily_limit_paisa" BIGINT NOT NULL DEFAULT 2500000,
    "pan_number" VARCHAR(10),
    "aadhaar_masked" VARCHAR(12),
    "date_of_birth" TIMESTAMP(3),
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "positive_balance" CHECK ("balance_paisa" >= 0),
    CONSTRAINT "positive_available_balance" CHECK ("available_balance_paisa" >= 0)
);

-- CreateTable
CREATE TABLE "vpa_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vpa" VARCHAR(100) NOT NULL,
    "account_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpa_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" VARCHAR(50) NOT NULL,
    "bank_reference_id" VARCHAR(50) NOT NULL,
    "account_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "amount_paisa" BIGINT NOT NULL,
    "balance_before_paisa" BIGINT NOT NULL,
    "balance_after_paisa" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "reference" VARCHAR(100),
    "description" TEXT,
    "metadata" JSONB,
    "error_code" VARCHAR(20),
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "positive_amount" CHECK ("amount_paisa" > 0)
);

-- CreateTable
CREATE TABLE "daily_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "limit_date" DATE NOT NULL,
    "total_debited_paisa" BIGINT NOT NULL DEFAULT 0,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "user_id" VARCHAR(100),
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banks_bank_code_key" ON "banks"("bank_code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");

-- CreateIndex
CREATE INDEX "accounts_bank_id_idx" ON "accounts"("bank_id");

-- CreateIndex
CREATE INDEX "accounts_customer_id_idx" ON "accounts"("customer_id");

-- CreateIndex
CREATE INDEX "accounts_mobile_number_idx" ON "accounts"("mobile_number");

-- CreateIndex
CREATE UNIQUE INDEX "vpa_mappings_vpa_key" ON "vpa_mappings"("vpa");

-- CreateIndex
CREATE INDEX "vpa_mappings_account_id_idx" ON "vpa_mappings"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_id_key" ON "transactions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_bank_reference_id_key" ON "transactions"("bank_reference_id");

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "daily_limits_account_id_limit_date_idx" ON "daily_limits"("account_id", "limit_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_limits_account_id_limit_date_key" ON "daily_limits"("account_id", "limit_date");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpa_mappings" ADD CONSTRAINT "vpa_mappings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_limits" ADD CONSTRAINT "daily_limits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
