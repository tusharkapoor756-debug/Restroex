-- Restroex Database Migration: 00025_customer_identity_enhancement.sql
-- Description:
--   1. Add contact_phone to customers table (separate from primary phone / WhatsApp LID).
--   2. Add customer_contact_phone and customer_name to orders table.

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Index for searching orders by customer contact phone
CREATE INDEX IF NOT EXISTS idx_orders_customer_contact_phone ON orders(customer_contact_phone);
