-- Inventory Management Database Schema
-- Commerce Service - Inventory Tables

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
    -- Primary key
    id UUID PRIMARY KEY,
    
    -- Business identifiers
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255),
    sku VARCHAR(100) NOT NULL UNIQUE,
    
    -- Stock levels
    total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    
    -- Pricing
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
    cost_price DECIMAL(10, 2) CHECK (cost_price >= 0),
    
    -- Status and thresholds
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued', 'out_of_stock')),
    low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 5 CHECK (reorder_point >= 0),
    reorder_quantity INTEGER NOT NULL DEFAULT 100 CHECK (reorder_quantity > 0),
    
    -- Optimistic locking
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Soft delete
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indexes for inventory_items
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory_items(product_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_items_variant_id ON inventory_items(variant_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON inventory_items(available_quantity, low_stock_threshold) WHERE status = 'active' AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_items_reorder ON inventory_items(available_quantity, reorder_point) WHERE status = 'active' AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON inventory_items(created_at) WHERE is_deleted = FALSE;

-- Create stock_reservations table
CREATE TABLE IF NOT EXISTS stock_reservations (
    -- Primary key
    id UUID PRIMARY KEY,
    
    -- Foreign keys
    inventory_id UUID NOT NULL,
    order_id UUID NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    
    -- Reservation details
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0),
    
    -- Status and lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for stock_reservations
CREATE INDEX IF NOT EXISTS idx_stock_reservations_inventory_id ON stock_reservations(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_customer_id ON stock_reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at ON stock_reservations(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_stock_reservations_created_at ON stock_reservations(created_at);

-- Create inventory_adjustments table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    -- Primary key
    id UUID PRIMARY KEY,
    
    -- Foreign key
    inventory_id UUID NOT NULL,
    
    -- Adjustment details
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,
    
    -- Context
    adjustment_type VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    reference_id VARCHAR(255),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for inventory_adjustments
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_inventory_id ON inventory_adjustments(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_type ON inventory_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_reference_id ON inventory_adjustments(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_created_at ON inventory_adjustments(created_at);

-- Add foreign key constraints (optional - depends on your preference)
-- ALTER TABLE stock_reservations ADD CONSTRAINT fk_stock_reservations_inventory_id 
--     FOREIGN KEY (inventory_id) REFERENCES inventory_items(id);
-- ALTER TABLE inventory_adjustments ADD CONSTRAINT fk_inventory_adjustments_inventory_id 
--     FOREIGN KEY (inventory_id) REFERENCES inventory_items(id);

-- Create trigger to automatically update available_quantity
CREATE OR REPLACE FUNCTION update_available_quantity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.available_quantity = GREATEST(0, NEW.total_quantity - NEW.reserved_quantity);
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_available_quantity
    BEFORE INSERT OR UPDATE OF total_quantity, reserved_quantity ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_available_quantity();

-- Create function to automatically update out_of_stock status
CREATE OR REPLACE FUNCTION update_out_of_stock_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update status to out_of_stock if total_quantity is 0 and status is active
    IF NEW.total_quantity = 0 AND NEW.status = 'active' THEN
        NEW.status = 'out_of_stock';
    END IF;
    
    -- Update status back to active if total_quantity > 0 and status is out_of_stock
    IF NEW.total_quantity > 0 AND NEW.status = 'out_of_stock' THEN
        NEW.status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_out_of_stock_status
    BEFORE INSERT OR UPDATE OF total_quantity ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_out_of_stock_status();

-- Create views for common queries
CREATE OR REPLACE VIEW low_stock_items AS
SELECT 
    id,
    product_id,
    variant_id,
    sku,
    total_quantity,
    reserved_quantity,
    available_quantity,
    low_stock_threshold,
    reorder_point,
    reorder_quantity,
    status,
    created_at,
    updated_at
FROM inventory_items 
WHERE available_quantity <= low_stock_threshold 
  AND status = 'active' 
  AND is_deleted = FALSE
ORDER BY available_quantity ASC, created_at DESC;

CREATE OR REPLACE VIEW reorder_needed_items AS
SELECT 
    id,
    product_id,
    variant_id,
    sku,
    total_quantity,
    reserved_quantity,
    available_quantity,
    low_stock_threshold,
    reorder_point,
    reorder_quantity,
    status,
    created_at,
    updated_at
FROM inventory_items 
WHERE available_quantity <= reorder_point 
  AND status = 'active' 
  AND is_deleted = FALSE
ORDER BY available_quantity ASC, created_at DESC;

CREATE OR REPLACE VIEW expired_reservations AS
SELECT 
    r.id,
    r.inventory_id,
    r.order_id,
    r.customer_id,
    r.quantity,
    r.status,
    r.expires_at,
    r.created_at,
    i.sku,
    i.product_id
FROM stock_reservations r
JOIN inventory_items i ON r.inventory_id = i.id
WHERE r.status = 'pending' 
  AND r.expires_at <= NOW()
ORDER BY r.expires_at ASC;

CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    COUNT(*) FILTER (WHERE is_deleted = FALSE) as total_items,
    COUNT(*) FILTER (WHERE status = 'active' AND is_deleted = FALSE) as active_items,
    COUNT(*) FILTER (WHERE available_quantity <= low_stock_threshold AND status = 'active' AND is_deleted = FALSE) as low_stock_items,
    COUNT(*) FILTER (WHERE available_quantity = 0 AND status = 'active' AND is_deleted = FALSE) as out_of_stock_items,
    (SELECT COUNT(*) FROM stock_reservations WHERE status IN ('pending', 'confirmed')) as active_reservations,
    NOW() as last_updated
FROM inventory_items;

-- Insert sample data for testing (optional)
INSERT INTO inventory_items (
    id,
    product_id,
    variant_id,
    sku,
    total_quantity,
    unit_price,
    cost_price,
    low_stock_threshold,
    reorder_point,
    reorder_quantity,
    created_by
) VALUES 
(
    gen_random_uuid(),
    'PROD-001',
    'VAR-001-RED',
    'SKU-PROD-001-RED',
    100,
    29.99,
    15.00,
    10,
    5,
    50,
    'system'
),
(
    gen_random_uuid(),
    'PROD-001',
    'VAR-001-BLUE',
    'SKU-PROD-001-BLUE',
    75,
    29.99,
    15.00,
    10,
    5,
    50,
    'system'
),
(
    gen_random_uuid(),
    'PROD-002',
    NULL,
    'SKU-PROD-002',
    200,
    49.99,
    25.00,
    20,
    10,
    100,
    'system'
)
ON CONFLICT (sku) DO NOTHING;

-- Create function to clean up expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Update expired reservations
    UPDATE stock_reservations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at <= NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO inventory_adjustments (
        id,
        inventory_id,
        quantity_before,
        quantity_after,
        quantity_change,
        adjustment_type,
        reason,
        created_by
    )
    SELECT 
        gen_random_uuid(),
        r.inventory_id,
        0, -- Will be updated by application logic
        0, -- Will be updated by application logic
        0, -- Will be updated by application logic
        'reservation_cleanup',
        'Expired reservation cleanup: ' || r.quantity || ' units released',
        'system'
    FROM stock_reservations r
    WHERE r.status = 'expired' AND r.updated_at >= NOW() - INTERVAL '1 minute';
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_composite ON inventory_items(status, available_quantity, low_stock_threshold) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_stock_reservations_composite ON stock_reservations(status, expires_at, inventory_id);

COMMENT ON TABLE inventory_items IS 'Stores inventory item information with stock levels and business rules';
COMMENT ON TABLE stock_reservations IS 'Temporary stock allocations for pending orders';
COMMENT ON TABLE inventory_adjustments IS 'Audit trail for all inventory quantity changes';

COMMENT ON COLUMN inventory_items.available_quantity IS 'Computed field: total_quantity - reserved_quantity';
COMMENT ON COLUMN inventory_items.version IS 'Version number for optimistic locking';
COMMENT ON COLUMN stock_reservations.expires_at IS 'When this reservation expires and stock is released';
COMMENT ON COLUMN inventory_adjustments.quantity_change IS 'Change in quantity: positive for increases, negative for decreases';
