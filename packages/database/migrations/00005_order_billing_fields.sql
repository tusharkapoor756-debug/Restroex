-- Restroex Database Migration: 00005_order_billing_fields.sql
-- Description:
--   Add detailed billing breakdown fields to orders table.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packing_charge DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;
