-- Restroex Database Migration: 00031_kds_and_cancellation_logs.sql
-- Description:
--   Creates order_cancellation_logs table to audit post-cooking order cancellations.

BEGIN;

CREATE TABLE IF NOT EXISTS order_cancellation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    previous_status VARCHAR(30) NOT NULL,
    cancellation_reason TEXT NOT NULL,
    cancelled_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_cancellation_logs_restaurant ON order_cancellation_logs(restaurant_id, created_at DESC);

COMMIT;
