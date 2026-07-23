-- Restroex Database Migration: 00006_payments_module.sql
-- Description:
--   Safe production migration for the dedicated payments table.
--   If the table does not exist, creates it from scratch.
--   If it already exists, adds new columns using ALTER TABLE IF NOT EXISTS.
--   Never destroys existing data.

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,

    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending' NOT NULL,

    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0.00),
    currency VARCHAR(10) DEFAULT 'INR' NOT NULL,

    -- Manual / UPI fields
    upi_id VARCHAR(255),
    merchant_name VARCHAR(255),
    transaction_reference VARCHAR(255) UNIQUE,
    payment_screenshot_url TEXT,

    -- Verification fields
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    rejected_reason TEXT,

    -- Future-ready Gateway fields (all nullable)
    gateway_name VARCHAR(100),
    gateway_payment_id VARCHAR(255),
    gateway_response JSONB,
    gateway_signature VARCHAR(255),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add payment_status constraint if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_payment_status'
          AND table_name = 'payments'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT chk_payment_status CHECK (payment_status IN (
            'pending',
            'screenshot_uploaded',
            'pending_verification',
            'verified',
            'rejected',
            'refunded'
        ));
    END IF;
END;
$$;

-- Add new columns to existing tables safely (idempotent)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_name VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_response JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_signature VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant ON payments(restaurant_id);
