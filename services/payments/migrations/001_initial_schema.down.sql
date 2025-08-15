-- Drop triggers
DROP TRIGGER IF EXISTS update_payment_intents_updated_at ON payment_intents;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_refunds_updated_at ON refunds;
DROP TRIGGER IF EXISTS update_webhook_endpoints_updated_at ON webhook_endpoints;
DROP TRIGGER IF EXISTS update_webhook_deliveries_updated_at ON webhook_deliveries;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_payment_intents_merchant_id;
DROP INDEX IF EXISTS idx_payment_intents_status;
DROP INDEX IF EXISTS idx_payment_intents_customer_id;
DROP INDEX IF EXISTS idx_payment_intents_expires_at;

DROP INDEX IF EXISTS idx_payments_payment_intent_id;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payments_rail_transaction_id;

DROP INDEX IF EXISTS idx_refunds_payment_id;
DROP INDEX IF EXISTS idx_refunds_status;
DROP INDEX IF EXISTS idx_refunds_refund_reference;

DROP INDEX IF EXISTS idx_ledger_entries_transaction_id;
DROP INDEX IF EXISTS idx_ledger_entries_account_id;
DROP INDEX IF EXISTS idx_ledger_entries_reference_id;

DROP INDEX IF EXISTS idx_idempotency_keys_key;
DROP INDEX IF EXISTS idx_idempotency_keys_expires_at;

DROP INDEX IF EXISTS idx_webhook_endpoints_merchant_id;

DROP INDEX IF EXISTS idx_webhook_deliveries_endpoint_id;
DROP INDEX IF EXISTS idx_webhook_deliveries_event_id;
DROP INDEX IF EXISTS idx_webhook_deliveries_status;
DROP INDEX IF EXISTS idx_webhook_deliveries_next_attempt_at;

DROP INDEX IF EXISTS idx_risk_assessments_payment_intent_id;

DROP INDEX IF EXISTS idx_outbox_events_event_type;
DROP INDEX IF EXISTS idx_outbox_events_aggregate_id;
DROP INDEX IF EXISTS idx_outbox_events_published;

-- Drop tables in reverse order (due to foreign key constraints)
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS risk_assessments;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhook_endpoints;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS payment_intents;