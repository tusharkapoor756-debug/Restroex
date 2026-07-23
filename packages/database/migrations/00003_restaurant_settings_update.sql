-- Restroex Database Migration: 00003_restaurant_settings_update.sql
-- Description:
--   1. Convert payment_mode to payment_methods JSONB array
--   2. Add new settings fields

-- ============================================================
-- 1. Convert payment_mode to payment_methods
-- ============================================================
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '["manual_upi"]'::jsonb NOT NULL;

-- (Optional) If we want to copy data over before dropping payment_mode:
-- UPDATE restaurant_settings SET payment_methods = jsonb_build_array(LOWER(payment_mode)) WHERE payment_mode IS NOT NULL;

ALTER TABLE restaurant_settings DROP COLUMN IF EXISTS payment_mode;

-- ============================================================
-- 2. Add new settings fields
-- ============================================================
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(50);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS receipt_footer TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS support_phone VARCHAR(50);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS support_email VARCHAR(255);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS auto_accept_paid_orders BOOLEAN DEFAULT FALSE NOT NULL;
