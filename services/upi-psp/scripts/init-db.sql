-- UPI PSP Database Initialization Script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create database if it doesn't exist (this would be handled by Docker)
-- CREATE DATABASE upi_psp_db;

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance
-- These will be created by GORM migrations, but we can add custom ones here

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Device table indexes  
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_used_at ON devices(last_used_at);
CREATE INDEX IF NOT EXISTS idx_devices_is_active ON devices(is_active);

-- VPA table indexes
CREATE INDEX IF NOT EXISTS idx_vpas_user_id ON vpas(user_id);
CREATE INDEX IF NOT EXISTS idx_vpas_address ON vpas(address);
CREATE INDEX IF NOT EXISTS idx_vpas_is_primary ON vpas(is_primary);

-- Transaction table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_rrn ON transactions(rrn);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_payer_vpa ON transactions(payer_vpa);
CREATE INDEX IF NOT EXISTS idx_transactions_payee_vpa ON transactions(payee_vpa);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);

-- QR Code table indexes
CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_vpa ON qr_codes(vpa);
CREATE INDEX IF NOT EXISTS idx_qr_codes_is_active ON qr_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);

-- Payment Request table indexes
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_request_id ON payment_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_payer_vpa ON payment_requests(payer_vpa);
CREATE INDEX IF NOT EXISTS idx_payment_requests_expires_at ON payment_requests(expires_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_created ON transactions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_created ON transactions(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_user_active ON devices(user_id, is_active);

-- Create functions for common operations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at columns
-- These will be created by GORM, but we can add them manually if needed

-- Create views for reporting
CREATE OR REPLACE VIEW user_transaction_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(t.id) as total_transactions,
    COUNT(CASE WHEN t.status = 'success' THEN 1 END) as successful_transactions,
    COUNT(CASE WHEN t.status = 'failed' THEN 1 END) as failed_transactions,
    COALESCE(SUM(CASE WHEN t.status = 'success' THEN t.amount ELSE 0 END), 0) as total_amount_transacted,
    MAX(t.created_at) as last_transaction_at
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.email, u.first_name, u.last_name;

-- Create view for daily transaction stats
CREATE OR REPLACE VIEW daily_transaction_stats AS
SELECT 
    DATE(created_at) as transaction_date,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
    COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_volume,
    COALESCE(AVG(CASE WHEN status = 'success' THEN amount END), 0) as average_transaction_amount
FROM transactions
GROUP BY DATE(created_at)
ORDER BY transaction_date DESC;

-- Insert seed data
INSERT INTO users (id, first_name, last_name, email, phone_number, password_hash, pin_hash, is_active, is_verified, kyc_status, created_at, updated_at) VALUES
    (uuid_generate_v4(), 'Test', 'User', 'test@suuupra.com', '+919999999999', '$2a$12$dummy.hash.for.testing', '$2a$12$dummy.pin.hash', true, true, 'verified', NOW(), NOW()),
    (uuid_generate_v4(), 'Demo', 'Merchant', 'merchant@suuupra.com', '+918888888888', '$2a$12$dummy.hash.for.testing', '$2a$12$dummy.pin.hash', true, true, 'verified', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Create a test VPA for the test user
INSERT INTO vpas (id, user_id, address, alias, is_active, is_primary, is_verified, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    u.id,
    'testuser@suuupra',
    'Test User',
    true,
    true,
    true,
    NOW(),
    NOW()
FROM users u 
WHERE u.email = 'test@suuupra.com'
ON CONFLICT (address) DO NOTHING;

-- Create a merchant VPA
INSERT INTO vpas (id, user_id, address, alias, is_active, is_primary, is_verified, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    u.id,
    'merchant@suuupra',
    'Demo Merchant',
    true,
    true,
    true,
    NOW(),
    NOW()
FROM users u 
WHERE u.email = 'merchant@suuupra.com'
ON CONFLICT (address) DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO upi_psp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO upi_psp;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO upi_psp;

-- Create backup user (optional)
-- CREATE USER upi_psp_backup WITH PASSWORD 'backup_password';
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO upi_psp_backup;

COMMIT;
