-- Restroex Database Migration: 00027_customer_identity_redesign.sql
-- Description:
--   Phase 1 of Customer Identity System Redesign.
--   Adds per-restaurant customer code counter table, multi-channel customer_identities table,
--   customer_merge_logs table, and extends the customers table with new CRM identity fields.
--   Idempotent, transactional, and rollback-safe. Legacy columns remain intact.

BEGIN;

-- 1. Create per-restaurant atomic customer code counter table
CREATE TABLE IF NOT EXISTS restaurant_customer_counters (
    restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
    last_counter INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add columns to customers table for CRM identity & soft-merge
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS customer_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS primary_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS whatsapp_lid VARCHAR(100),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS created_source VARCHAR(50) DEFAULT 'WHATSAPP',
    ADD COLUMN IF NOT EXISTS first_order_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_orders INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_spend NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS merged_into_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;

-- 3. Create unique constraint for (restaurant_id, customer_code)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_restaurant_id_customer_code_key'
    ) THEN
        ALTER TABLE customers ADD CONSTRAINT customers_restaurant_id_customer_code_key UNIQUE (restaurant_id, customer_code);
    END IF;
END $$;

-- 4. Create customer_identities registry table for multi-channel identity mapping
CREATE TABLE IF NOT EXISTS customer_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    provider_type VARCHAR(50) NOT NULL, -- 'phone', 'whatsapp_lid', 'whatsapp_jid', 'email', 'instagram', 'telegram', 'google', 'pos_card'
    provider_value VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_customer_identities_provider UNIQUE (restaurant_id, provider_type, provider_value)
);

-- 5. Create customer_merge_logs table for audit & rollback tracking
CREATE TABLE IF NOT EXISTS customer_merge_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    primary_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    merged_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    merged_by VARCHAR(50) DEFAULT 'SYSTEM_MIGRATION',
    merge_reason TEXT,
    snapshot_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_primary_phone ON customers(restaurant_id, primary_phone) WHERE is_merged = FALSE;
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_whatsapp_lid ON customers(restaurant_id, whatsapp_lid) WHERE is_merged = FALSE;
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_code ON customers(restaurant_id, customer_code);
CREATE INDEX IF NOT EXISTS idx_customer_identities_lookup ON customer_identities(restaurant_id, provider_type, provider_value);
CREATE INDEX IF NOT EXISTS idx_customer_identities_customer ON customer_identities(customer_id);

-- 7. PL/pgSQL Function for Concurrency-Safe Per-Restaurant Customer Code Generation (CUS-XXXXXX)
CREATE OR REPLACE FUNCTION generate_next_customer_code(
    p_restaurant_id UUID
)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_counter INT;
    v_customer_code VARCHAR(20);
BEGIN
    -- Atomic Upsert & Increment lock on restaurant_customer_counters
    INSERT INTO restaurant_customer_counters (restaurant_id, last_counter, updated_at)
    VALUES (p_restaurant_id, 1, NOW())
    ON CONFLICT (restaurant_id)
    DO UPDATE SET
        last_counter = restaurant_customer_counters.last_counter + 1,
        updated_at = NOW()
    RETURNING last_counter INTO v_next_counter;

    -- Format as CUS-000001, CUS-000002, etc.
    v_customer_code := 'CUS-' || LPAD(v_next_counter::TEXT, 6, '0');
    RETURN v_customer_code;
END;
$$;

COMMIT;

