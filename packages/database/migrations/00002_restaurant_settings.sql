-- Restroex Database Migration: 00002_restaurant_settings.sql
-- Description:
--   1. Add owner_name column to restaurants table.
--   2. Add new columns to restaurant_settings for GST, payment (Manual UPI), and store config.
--   3. Add awaiting_variant to conversation_sessions FSM state enum.
-- Author: Senior Lead Architect

-- ============================================================
-- 1. RESTAURANTS — extend profile
-- ============================================================
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);

-- ============================================================
-- 2. RESTAURANT_SETTINGS — create table if it doesn't already exist
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tax & Billing
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS gst_number VARCHAR(100);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS gst_percentage DECIMAL(5, 2) DEFAULT 0.00;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS fssai_number VARCHAR(100);

-- Payment Settings (Manual UPI — provider-agnostic design)
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'MANUAL_UPI' NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS upi_merchant_name VARCHAR(255);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS upi_qr_image_url TEXT;

-- Store Settings
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS pickup_available BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS prep_time INT DEFAULT 15 NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS pickup_instructions TEXT;

-- ============================================================
-- 3. CONVERSATION_SESSIONS — add awaiting_variant to state enum
-- (The existing CHECK constraint must be dropped and recreated)
-- ============================================================
ALTER TABLE conversation_sessions DROP CONSTRAINT IF EXISTS chk_conversation_state;

ALTER TABLE conversation_sessions
ADD CONSTRAINT chk_conversation_state CHECK (state IN (
    'idle',
    'awaiting_item',
    'awaiting_variant',
    'awaiting_quantity',
    'awaiting_confirmation',
    'awaiting_payment',
    'payment_completed',
    'human_takeover'
));

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_tenant ON restaurant_settings(restaurant_id);
