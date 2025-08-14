-- UPI Core Database Schema with ACID Guarantees
-- Migration: 001_init_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Banks table - Registry of participating banks
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_code VARCHAR(10) UNIQUE NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    ifsc_prefix VARCHAR(4) NOT NULL,
    endpoint_url VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED')),
    last_heartbeat TIMESTAMP,
    success_rate INTEGER DEFAULT 100 CHECK (success_rate >= 0 AND success_rate <= 100),
    avg_response_time_ms INTEGER DEFAULT 0 CHECK (avg_response_time_ms >= 0),
    features TEXT[] DEFAULT ARRAY['UPI', 'IMPS', 'NEFT', 'RTGS'],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VPA mappings table - Virtual Payment Address to bank account mapping
CREATE TABLE vpa_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vpa VARCHAR(100) UNIQUE NOT NULL,
    bank_code VARCHAR(10) NOT NULL REFERENCES banks(bank_code),
    account_number VARCHAR(20) NOT NULL,
    account_holder_name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite index for fast lookups
    CONSTRAINT unique_active_vpa UNIQUE (vpa, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Transactions table - Core transaction records with ACID properties
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    rrn VARCHAR(12) UNIQUE, -- Retrieval Reference Number
    payer_vpa VARCHAR(100) NOT NULL,
    payee_vpa VARCHAR(100) NOT NULL,
    amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
    currency VARCHAR(3) DEFAULT 'INR',
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('P2P', 'P2M', 'M2P', 'REFUND')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'REVERSED')),
    description TEXT,
    reference VARCHAR(100),
    payer_bank_code VARCHAR(10) NOT NULL,
    payee_bank_code VARCHAR(10) NOT NULL,
    switch_fee_paisa BIGINT DEFAULT 0 CHECK (switch_fee_paisa >= 0),
    bank_fee_paisa BIGINT DEFAULT 0 CHECK (bank_fee_paisa >= 0),
    total_fee_paisa BIGINT DEFAULT 0 CHECK (total_fee_paisa >= 0),
    settlement_id VARCHAR(50),
    error_code VARCHAR(20),
    error_message TEXT,
    signature TEXT, -- Digital signature for non-repudiation
    metadata JSONB,
    initiated_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    expires_at TIMESTAMP, -- Transaction timeout
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_payer_bank FOREIGN KEY (payer_bank_code) REFERENCES banks(bank_code),
    CONSTRAINT fk_payee_bank FOREIGN KEY (payee_bank_code) REFERENCES banks(bank_code),
    
    -- Business logic constraints
    CONSTRAINT valid_fee_calculation CHECK (total_fee_paisa = switch_fee_paisa + bank_fee_paisa),
    CONSTRAINT valid_processing_time CHECK (processed_at IS NULL OR processed_at >= initiated_at),
    CONSTRAINT valid_expiry_time CHECK (expires_at IS NULL OR expires_at > initiated_at)
);

-- Transaction state changes for audit trail
CREATE TABLE transaction_state_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) NOT NULL REFERENCES transactions(transaction_id),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    reason VARCHAR(500),
    changed_by VARCHAR(100), -- System component or user
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Settlement batches table - For batch settlement processing
CREATE TABLE settlement_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(50) UNIQUE NOT NULL,
    settlement_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    total_transactions INTEGER DEFAULT 0 CHECK (total_transactions >= 0),
    total_amount_paisa BIGINT DEFAULT 0 CHECK (total_amount_paisa >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Ensure settlement date consistency
    CONSTRAINT valid_settlement_timeline CHECK (
        (processed_at IS NULL OR processed_at >= created_at) AND
        (completed_at IS NULL OR completed_at >= COALESCE(processed_at, created_at))
    )
);

-- Bank settlements - Individual bank positions in settlement batch
CREATE TABLE bank_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(50) NOT NULL REFERENCES settlement_batches(batch_id),
    bank_code VARCHAR(10) NOT NULL REFERENCES banks(bank_code),
    credit_amount_paisa BIGINT DEFAULT 0 CHECK (credit_amount_paisa >= 0),
    debit_amount_paisa BIGINT DEFAULT 0 CHECK (debit_amount_paisa >= 0),
    net_amount_paisa BIGINT, -- Can be negative (bank owes money)
    transaction_count INTEGER DEFAULT 0 CHECK (transaction_count >= 0),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Unique constraint to prevent duplicate entries
    CONSTRAINT unique_bank_settlement UNIQUE (batch_id, bank_code),
    
    -- Net amount calculation constraint
    CONSTRAINT valid_net_calculation CHECK (net_amount_paisa = credit_amount_paisa - debit_amount_paisa)
);

-- Idempotency keys table - Ensure exactly-once processing
CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of the idempotency key
    entity_type VARCHAR(50) NOT NULL, -- 'transaction', 'settlement', etc.
    entity_id VARCHAR(50) NOT NULL,
    response_data JSONB, -- Cached response for idempotent requests
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    -- Cleanup expired keys
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Audit logs table - Complete audit trail
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(100), -- System component or user
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    correlation_id VARCHAR(50), -- For tracing across services
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Distributed locks table - For coordinating across instances
CREATE TABLE distributed_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_name VARCHAR(100) UNIQUE NOT NULL,
    owner_id VARCHAR(100) NOT NULL, -- Instance/process ID
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    metadata JSONB,
    
    CONSTRAINT valid_lock_duration CHECK (expires_at > acquired_at)
);

-- Performance and integrity indexes
CREATE INDEX idx_transactions_payer_vpa ON transactions(payer_vpa);
CREATE INDEX idx_transactions_payee_vpa ON transactions(payee_vpa);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_settlement_id ON transactions(settlement_id) WHERE settlement_id IS NOT NULL;
CREATE INDEX idx_transactions_payer_bank ON transactions(payer_bank_code);
CREATE INDEX idx_transactions_payee_bank ON transactions(payee_bank_code);
CREATE INDEX idx_transactions_rrn ON transactions(rrn) WHERE rrn IS NOT NULL;
CREATE INDEX idx_transactions_expires_at ON transactions(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_vpa_mappings_vpa ON vpa_mappings(vpa) WHERE is_active = true;
CREATE INDEX idx_vpa_mappings_bank_code ON vpa_mappings(bank_code);
CREATE INDEX idx_vpa_mappings_account ON vpa_mappings(bank_code, account_number);

CREATE INDEX idx_transaction_state_changes_txn_id ON transaction_state_changes(transaction_id);
CREATE INDEX idx_transaction_state_changes_created_at ON transaction_state_changes(changed_at);

CREATE INDEX idx_settlement_batches_date ON settlement_batches(settlement_date);
CREATE INDEX idx_settlement_batches_status ON settlement_batches(status);

CREATE INDEX idx_bank_settlements_batch_id ON bank_settlements(batch_id);
CREATE INDEX idx_bank_settlements_bank_code ON bank_settlements(bank_code);

CREATE INDEX idx_idempotency_keys_hash ON idempotency_keys(key_hash);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;

CREATE INDEX idx_distributed_locks_expires_at ON distributed_locks(expires_at);

-- Functions for maintaining data integrity and ACID properties

-- Function to update transaction status with state change logging
CREATE OR REPLACE FUNCTION update_transaction_status(
    p_transaction_id VARCHAR(50),
    p_new_status VARCHAR(20),
    p_reason VARCHAR(500) DEFAULT NULL,
    p_changed_by VARCHAR(100) DEFAULT 'SYSTEM',
    p_error_code VARCHAR(20) DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_status VARCHAR(20);
    v_updated_count INTEGER;
BEGIN
    -- Get current status
    SELECT status INTO v_old_status 
    FROM transactions 
    WHERE transaction_id = p_transaction_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update transaction status
    UPDATE transactions 
    SET 
        status = p_new_status,
        error_code = COALESCE(p_error_code, error_code),
        error_message = COALESCE(p_error_message, error_message),
        processed_at = CASE WHEN p_new_status IN ('SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED') 
                           THEN CURRENT_TIMESTAMP 
                           ELSE processed_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = p_transaction_id
    AND status != p_new_status; -- Only update if status actually changes
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Log state change if status actually changed
    IF v_updated_count > 0 THEN
        INSERT INTO transaction_state_changes (
            transaction_id, from_status, to_status, reason, changed_by
        ) VALUES (
            p_transaction_id, v_old_status, p_new_status, p_reason, p_changed_by
        );
    END IF;
    
    RETURN v_updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function for cleanup of expired records
CREATE OR REPLACE FUNCTION cleanup_expired_records() RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_temp_count INTEGER;
BEGIN
    -- Clean up expired idempotency keys
    DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;
    
    -- Clean up expired distributed locks
    DELETE FROM distributed_locks WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;
    
    -- Clean up old audit logs (older than 1 year)
    DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON banks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vpa_mappings_updated_at BEFORE UPDATE ON vpa_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data for supported banks
INSERT INTO banks (bank_code, bank_name, ifsc_prefix, endpoint_url, public_key, status) VALUES
('HDFC', 'HDFC Bank', 'HDFC', 'http://bank-simulator:50051', 'mock_public_key_hdfc', 'ACTIVE'),
('SBI', 'State Bank of India', 'SBIN', 'http://bank-simulator:50051', 'mock_public_key_sbi', 'ACTIVE'),
('ICICI', 'ICICI Bank', 'ICIC', 'http://bank-simulator:50051', 'mock_public_key_icici', 'ACTIVE'),
('AXIS', 'Axis Bank', 'UTIB', 'http://bank-simulator:50051', 'mock_public_key_axis', 'ACTIVE'),
('KOTAK', 'Kotak Mahindra Bank', 'KKBK', 'http://bank-simulator:50051', 'mock_public_key_kotak', 'ACTIVE');

-- Create a scheduled job to clean up expired records (if pg_cron is available)
-- SELECT cron.schedule('cleanup-expired-records', '0 2 * * *', 'SELECT cleanup_expired_records();');
