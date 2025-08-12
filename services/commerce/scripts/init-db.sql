-- Initialize Commerce Service Database
-- This script sets up the initial database structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create events table for Event Store
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    event_version INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    correlation_id UUID,
    causation_id UUID,
    user_id UUID,
    tenant_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT uq_aggregate_version UNIQUE (aggregate_id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS ix_events_aggregate_id ON events (aggregate_id);
CREATE INDEX IF NOT EXISTS ix_events_aggregate_id_version ON events (aggregate_id, version);
CREATE INDEX IF NOT EXISTS ix_events_aggregate_type ON events (aggregate_type);
CREATE INDEX IF NOT EXISTS ix_events_event_type ON events (event_type);
CREATE INDEX IF NOT EXISTS ix_events_created_at ON events (created_at);
CREATE INDEX IF NOT EXISTS ix_events_event_type_created_at ON events (event_type, created_at);
CREATE INDEX IF NOT EXISTS ix_events_correlation_id ON events (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_events_user_id ON events (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_events_tenant_id ON events (tenant_id) WHERE tenant_id IS NOT NULL;

-- Create saga instances table for Saga Pattern
CREATE TABLE IF NOT EXISTS saga_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    saga_type VARCHAR(100) NOT NULL,
    saga_data JSONB NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    correlation_id UUID,
    
    -- Indexes
    CONSTRAINT chk_status CHECK (status IN ('running', 'completed', 'failed', 'compensating', 'compensated'))
);

CREATE INDEX IF NOT EXISTS ix_saga_instances_saga_type ON saga_instances (saga_type);
CREATE INDEX IF NOT EXISTS ix_saga_instances_status ON saga_instances (status);
CREATE INDEX IF NOT EXISTS ix_saga_instances_created_at ON saga_instances (created_at);
CREATE INDEX IF NOT EXISTS ix_saga_instances_correlation_id ON saga_instances (correlation_id) WHERE correlation_id IS NOT NULL;

-- Create read model tables for CQRS

-- Order read model
CREATE TABLE IF NOT EXISTS order_views (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    shipping_amount DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50),
    shipping_address JSONB,
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_order_views_customer_id ON order_views (customer_id);
CREATE INDEX IF NOT EXISTS ix_order_views_status ON order_views (status);
CREATE INDEX IF NOT EXISTS ix_order_views_created_at ON order_views (created_at);
CREATE INDEX IF NOT EXISTS ix_order_views_total_amount ON order_views (total_amount);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_saga_instances_updated_at BEFORE UPDATE ON saga_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_views_updated_at BEFORE UPDATE ON order_views FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for development
INSERT INTO events (aggregate_id, aggregate_type, event_type, event_data, version)
VALUES 
    (uuid_generate_v4(), 'order', 'OrderCreatedEvent', '{"customer_id": "customer-123", "total_amount": "99.99"}', 1)
ON CONFLICT DO NOTHING;
