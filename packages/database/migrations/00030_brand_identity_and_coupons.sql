-- Restroex Database Migration: 00030_brand_identity_and_coupons.sql
-- Description:
--   Adds brand identity schema fields (cover_image_url, primary_color, restaurant_story, google_review_url, gallery_images).
--   Adds coupons table for direct marketing promotions.
--   Adds wallet_credits table for SaaS software credit balance & recharge ledger.

BEGIN;

-- 1. Brand Identity fields on restaurants table
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
    ADD COLUMN IF NOT EXISTS primary_color VARCHAR(10) DEFAULT '#F97316',
    ADD COLUMN IF NOT EXISTS restaurant_story TEXT,
    ADD COLUMN IF NOT EXISTS google_review_url TEXT,
    ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb;

-- 2. Coupons table
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10, 2) DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_restaurant_coupon_code UNIQUE (restaurant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_restaurant_code ON coupons(restaurant_id, code);

-- 3. SaaS Wallet Credits table
CREATE TABLE IF NOT EXISTS wallet_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    credit_balance INT NOT NULL DEFAULT 1000 CHECK (credit_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_restaurant_wallet UNIQUE (restaurant_id)
);

-- 4. Wallet Transactions Ledger table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('recharge', 'deduction')),
    credits INT NOT NULL,
    amount NUMERIC(10, 2) DEFAULT 0,
    description TEXT,
    reference_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_restaurant ON wallet_transactions(restaurant_id, created_at DESC);

COMMIT;
