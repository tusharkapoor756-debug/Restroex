-- Restroex Database Migration: 00029_add_preparing_started_at.sql
-- Description:
--   Adds dedicated business lifecycle timestamps (preparing_started_at, ready_at) to orders table.
--   Prevents overreliance on created_at or updated_at for kitchen delay calculations.
--   Idempotent and rollback-safe.

BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS preparing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMIT;
