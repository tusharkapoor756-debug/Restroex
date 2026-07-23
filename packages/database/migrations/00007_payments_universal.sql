-- Restroex Database Migration: 00007_payments_universal.sql
-- Description:
--   Replaces the legacy payments table with a universal, provider-agnostic
--   schema. This design supports Manual UPI, Razorpay, PhonePe, Stripe,
--   Cash, Card and any future gateway without schema redesign.
--   Project is in development - safe to replace the legacy table.

-- Drop legacy table (dev environment - no production data)
DROP TABLE IF EXISTS payments CASCADE;

-- ============================================================
-- UNIVERSAL PAYMENTS TABLE
-- ============================================================
-- Design principles:
--   - payment_method is provider-agnostic (e.g. 'manual_upi', 'razorpay', 'cash')
--   - payment_status is workflow-state (e.g. 'pending', 'verified')
--   - provider_name tracks the gateway/provider actually used
--   - gateway_data (JSONB) stores all provider-specific data:
--       Manual UPI: { upi_id, merchant_name, screenshot_url, transaction_ref }
--       Razorpay:   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
--       PhonePe:    { merchant_transaction_id, provider_transaction_id, ... }
--       Stripe:     { payment_intent_id, client_secret, ... }
--   - metadata (JSONB) holds any additional context (auditing, OCR results, etc.)
-- ============================================================

CREATE TABLE payments (
    -- Identity
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,

    -- Payment Classification (provider-independent)
    payment_method VARCHAR(100) NOT NULL,    -- 'manual_upi' | 'razorpay' | 'phonepe' | 'stripe' | 'cash' | 'card'
    provider_name VARCHAR(100) NOT NULL,     -- The actual provider handling this payment
    payment_status VARCHAR(50) DEFAULT 'pending' NOT NULL,

    -- Financials
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0.00),
    currency VARCHAR(10) DEFAULT 'INR' NOT NULL,

    -- Provider-specific data (replaces scattered UPI/gateway columns)
    -- Each provider stores its own structure here. Never query internals of this column
    -- from application code — delegate to the provider class.
    gateway_data JSONB DEFAULT '{}' NOT NULL,

    -- Verification workflow (shared across all providers)
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_amount DECIMAL(10, 2),
    verified_transaction_reference VARCHAR(255),
    rejected_reason TEXT,
    failure_reason TEXT,

    -- Idempotency (prevents double-charging, safe for webhook replay)
    idempotency_key VARCHAR(255) UNIQUE,

    -- Retry tracking — increments with each new attempt for the same order
    payment_attempt INTEGER DEFAULT 1 NOT NULL,

    -- Expiry — for payment links, gateway sessions, QR codes
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Extensible metadata: OCR results, audit notes, flags, etc.
    metadata JSONB DEFAULT '{}' NOT NULL,

    -- Lifecycle timestamps
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT chk_payment_status CHECK (payment_status IN (
        'pending',
        'initiated',
        'screenshot_uploaded',
        'pending_verification',
        'verified',
        'captured',
        'failed',
        'rejected',
        'refunded',
        'cancelled'
    ))
);

-- Indexes
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_restaurant_id ON payments(restaurant_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
