-- Database Performance Optimization Indexes for Commerce Service
-- This file contains all database indexes for optimal query performance

-- ============================================================================
-- EVENT STORE INDEXES
-- ============================================================================

-- Primary event lookup by aggregate
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_aggregate_id 
ON events (aggregate_id);

-- Event ordering and replay
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_aggregate_version 
ON events (aggregate_id, version);

-- Event type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type_timestamp 
ON events (event_type, created_at);

-- Temporal queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_created_at 
ON events (created_at);

-- Composite index for event sourcing queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_composite 
ON events (aggregate_type, aggregate_id, version);

-- ============================================================================
-- ORDER READ MODEL INDEXES
-- ============================================================================

-- Customer order lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_customer_id 
ON order_views (customer_id);

-- Order status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_status 
ON order_views (status);

-- Date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_created_at 
ON order_views (created_at);

-- Composite index for customer order history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_customer_status_date 
ON order_views (customer_id, status, created_at DESC);

-- Order amount queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_total_amount 
ON order_views (total_amount);

-- Full-text search on order items (if using JSONB)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_items_gin 
ON order_views USING GIN (items);

-- ============================================================================
-- INVENTORY ITEM INDEXES
-- ============================================================================

-- Product lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_product_id 
ON inventory_items (product_id);

-- SKU lookup (unique constraint already creates index)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items (sku);

-- Low stock queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_low_stock 
ON inventory_items (available_quantity, low_stock_threshold) 
WHERE available_quantity <= low_stock_threshold;

-- Reorder point queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_reorder 
ON inventory_items (available_quantity, reorder_point) 
WHERE available_quantity <= reorder_point;

-- Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_status 
ON inventory_items (status);

-- Created date for reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_created_at 
ON inventory_items (created_at);

-- Composite index for inventory analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_analytics 
ON inventory_items (status, created_at, total_quantity);

-- ============================================================================
-- STOCK RESERVATION INDEXES
-- ============================================================================

-- Inventory item reservations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_reservations_inventory_id 
ON stock_reservations (inventory_id);

-- Order reservations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_reservations_order_id 
ON stock_reservations (order_id);

-- Customer reservations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_reservations_customer_id 
ON stock_reservations (customer_id);

-- Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_reservations_status 
ON stock_reservations (status);

-- Expiration cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_reservations_expires_at 
ON stock_reservations (expires_at) 
WHERE status IN ('pending', 'confirmed');

-- Active reservations composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_reservations_active 
ON stock_reservations (inventory_id, status, expires_at) 
WHERE status IN ('pending', 'confirmed');

-- ============================================================================
-- INVENTORY ADJUSTMENT INDEXES
-- ============================================================================

-- Inventory item adjustments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_adjustments_inventory_id 
ON inventory_adjustments (inventory_id);

-- Date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_adjustments_created_at 
ON inventory_adjustments (created_at);

-- Reason analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_adjustments_reason 
ON inventory_adjustments (reason);

-- User activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_adjustments_created_by 
ON inventory_adjustments (created_by);

-- ============================================================================
-- SAGA INSTANCE INDEXES
-- ============================================================================

-- Saga type lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saga_instances_saga_type 
ON saga_instances (saga_type);

-- Correlation ID lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saga_instances_correlation_id 
ON saga_instances (correlation_id);

-- Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saga_instances_status 
ON saga_instances (status);

-- Active sagas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saga_instances_active 
ON saga_instances (status, updated_at) 
WHERE status IN ('running', 'compensating');

-- Saga cleanup (completed/failed sagas)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saga_instances_cleanup 
ON saga_instances (status, updated_at) 
WHERE status IN ('completed', 'failed', 'compensated');

-- ============================================================================
-- SHOPPING CART INDEXES (if using PostgreSQL for carts)
-- ============================================================================

-- Customer cart lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopping_carts_customer_id 
ON shopping_carts (customer_id) 
WHERE status = 'active';

-- Cart expiration cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopping_carts_expires_at 
ON shopping_carts (expires_at) 
WHERE status = 'active';

-- Session-based carts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopping_carts_session_id 
ON shopping_carts (session_id) 
WHERE status = 'active';

-- ============================================================================
-- AUDIT LOG INDEXES
-- ============================================================================

-- Entity audit trail
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity 
ON audit_logs (entity_type, entity_id);

-- User activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id 
ON audit_logs (user_id);

-- Action filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action 
ON audit_logs (action);

-- Temporal audit queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp 
ON audit_logs (timestamp);

-- Composite audit index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_composite 
ON audit_logs (entity_type, entity_id, timestamp DESC);

-- ============================================================================
-- NOTIFICATION LOG INDEXES
-- ============================================================================

-- Recipient lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_logs_recipient 
ON notification_logs (recipient);

-- Notification type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_logs_type 
ON notification_logs (notification_type);

-- Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_logs_status 
ON notification_logs (status);

-- Channel filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_logs_channel 
ON notification_logs (channel);

-- Retry processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_logs_retry 
ON notification_logs (status, retry_count, created_at) 
WHERE status = 'failed' AND retry_count < 3;

-- ============================================================================
-- PAYMENT TRANSACTION INDEXES
-- ============================================================================

-- Order payment lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_order_id 
ON payment_transactions (order_id);

-- Customer payment history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_customer_id 
ON payment_transactions (customer_id);

-- Payment method analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_payment_method 
ON payment_transactions (payment_method);

-- Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_status 
ON payment_transactions (status);

-- External transaction ID lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_external_id 
ON payment_transactions (external_transaction_id) 
WHERE external_transaction_id IS NOT NULL;

-- Amount range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_amount 
ON payment_transactions (amount);

-- ============================================================================
-- SHIPMENT TRACKING INDEXES
-- ============================================================================

-- Order shipment lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_order_id 
ON shipments (order_id);

-- Tracking number lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_tracking_number 
ON shipments (tracking_number);

-- Carrier filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_carrier 
ON shipments (carrier);

-- Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_status 
ON shipments (status);

-- Delivery date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_delivered_at 
ON shipments (delivered_at) 
WHERE delivered_at IS NOT NULL;

-- ============================================================================
-- PERFORMANCE MONITORING INDEXES
-- ============================================================================

-- Request log indexes for performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_endpoint 
ON request_logs (endpoint);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_timestamp 
ON request_logs (timestamp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_response_time 
ON request_logs (response_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_status_code 
ON request_logs (status_code);

-- Error tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_errors 
ON request_logs (status_code, timestamp) 
WHERE status_code >= 400;

-- ============================================================================
-- PARTIAL INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Active orders only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_active 
ON order_views (customer_id, created_at DESC) 
WHERE status NOT IN ('completed', 'cancelled');

-- Recent orders (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_recent 
ON order_views (customer_id, created_at DESC) 
WHERE created_at >= (CURRENT_DATE - INTERVAL '30 days');

-- High-value orders
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_high_value 
ON order_views (created_at DESC, total_amount DESC) 
WHERE total_amount >= 100.00;

-- Failed payments for retry
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_failed 
ON payment_transactions (created_at, retry_count) 
WHERE status = 'failed' AND retry_count < 3;

-- Pending shipments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_pending 
ON shipments (created_at) 
WHERE status = 'pending';

-- ============================================================================
-- COVERING INDEXES FOR READ-HEAVY QUERIES
-- ============================================================================

-- Order summary with items (covering index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_summary_covering 
ON order_views (customer_id, created_at DESC) 
INCLUDE (order_id, status, total_amount);

-- Inventory summary covering index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_summary_covering 
ON inventory_items (product_id) 
INCLUDE (sku, total_quantity, available_quantity, reserved_quantity, status);

-- ============================================================================
-- EXPRESSION INDEXES FOR COMPUTED QUERIES
-- ============================================================================

-- Order total by month
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_views_monthly 
ON order_views (DATE_TRUNC('month', created_at), status);

-- Inventory turnover calculation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_turnover 
ON inventory_items ((total_quantity - available_quantity), created_at);

-- ============================================================================
-- CLEANUP AND MAINTENANCE COMMANDS
-- ============================================================================

-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_scan DESC;

-- To find unused indexes:
-- SELECT schemaname, tablename, indexname, idx_scan 
-- FROM pg_stat_user_indexes 
-- WHERE idx_scan = 0 AND schemaname = 'public';

-- To check index sizes:
-- SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY pg_relation_size(indexrelid) DESC;
