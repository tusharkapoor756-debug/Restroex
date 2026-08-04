-- Restroex Database Migration: 00023_order_invoice_number.sql
-- Description:
--   Add invoice_number column to orders table with sequence tracking support.

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) UNIQUE;

-- Create index for fast invoice lookup
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number);
