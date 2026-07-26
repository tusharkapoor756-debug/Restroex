-- Migration: 006_add_payment_intelligence_columns.sql
-- Description: Adds standalone Payment Intelligence Engine columns to the payments table for Restroex

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS image_hash TEXT,
ADD COLUMN IF NOT EXISTS exact_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS similarity_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS analysis_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS provider_order_id TEXT;

-- Create B-tree indexes for fast duplicate transaction lookups (O(1) time complexity)
CREATE INDEX IF NOT EXISTS idx_payments_image_hash ON payments(image_hash);
CREATE INDEX IF NOT EXISTS idx_payments_exact_fingerprint ON payments(exact_fingerprint);
CREATE INDEX IF NOT EXISTS idx_payments_similarity_fingerprint ON payments(similarity_fingerprint);
