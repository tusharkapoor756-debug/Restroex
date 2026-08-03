-- Restroex Database Migration: 00022_restaurant_charges.sql
-- Description:
--   1. Create restaurant_charges table for extensible Taxes & Charges module.
--   2. Extend restaurant_settings with round_off_mode.
--   3. Seed default system-protected charges (GST, Packaging Charge, Service Charge, Delivery Charge) for existing restaurants.

-- 1. RESTAURANT_CHARGES TABLE
CREATE TABLE IF NOT EXISTS restaurant_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'fee' NOT NULL, -- 'tax' | 'fee'
    calculation_type VARCHAR(50) DEFAULT 'percentage' NOT NULL, -- 'fixed' | 'percentage'
    value DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    pricing_type VARCHAR(50) DEFAULT 'exclusive' NOT NULL, -- 'exclusive' | 'inclusive'
    scope VARCHAR(50) DEFAULT 'order' NOT NULL, -- 'order' | 'item'
    apply_on TEXT[] DEFAULT ARRAY['dining', 'takeaway', 'delivery']::TEXT[] NOT NULL,
    show_on_invoice BOOLEAN DEFAULT TRUE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    is_system BOOLEAN DEFAULT FALSE NOT NULL, -- System protected (GST, Packaging, Service Charge, Delivery Charge)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT chk_charge_type CHECK (type IN ('tax', 'fee')),
    CONSTRAINT chk_calculation_type CHECK (calculation_type IN ('fixed', 'percentage')),
    CONSTRAINT chk_pricing_type CHECK (pricing_type IN ('exclusive', 'inclusive')),
    CONSTRAINT chk_scope CHECK (scope IN ('order', 'item'))
);

CREATE INDEX IF NOT EXISTS idx_restaurant_charges_tenant ON restaurant_charges(restaurant_id);

-- 2. EXTEND RESTAURANT_SETTINGS with round_off_mode
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS round_off_mode VARCHAR(50) DEFAULT 'nearest' NOT NULL;
ALTER TABLE restaurant_settings DROP CONSTRAINT IF EXISTS chk_round_off_mode;
ALTER TABLE restaurant_settings ADD CONSTRAINT chk_round_off_mode CHECK (round_off_mode IN ('disabled', 'round_up', 'round_down', 'nearest'));

-- 3. SEED SYSTEM DEFAULT CHARGES FOR EXISTING RESTAURANTS
DO $$
DECLARE
    r_record RECORD;
BEGIN
    FOR r_record IN SELECT id FROM restaurants LOOP
        -- Seed Protected System GST
        IF NOT EXISTS (SELECT 1 FROM restaurant_charges WHERE restaurant_id = r_record.id AND name = 'GST' AND is_system = TRUE) THEN
            INSERT INTO restaurant_charges (restaurant_id, name, type, calculation_type, value, pricing_type, scope, apply_on, show_on_invoice, enabled, is_system)
            VALUES (r_record.id, 'GST', 'tax', 'percentage', 5.00, 'exclusive', 'order', ARRAY['dining', 'takeaway', 'delivery'], TRUE, TRUE, TRUE);
        END IF;

        -- Seed Protected System Packaging Charge
        IF NOT EXISTS (SELECT 1 FROM restaurant_charges WHERE restaurant_id = r_record.id AND name = 'Packaging Charge' AND is_system = TRUE) THEN
            INSERT INTO restaurant_charges (restaurant_id, name, type, calculation_type, value, pricing_type, scope, apply_on, show_on_invoice, enabled, is_system)
            VALUES (r_record.id, 'Packaging Charge', 'fee', 'fixed', 0.00, 'exclusive', 'order', ARRAY['takeaway', 'delivery'], TRUE, FALSE, TRUE);
        END IF;

        -- Seed Protected System Service Charge
        IF NOT EXISTS (SELECT 1 FROM restaurant_charges WHERE restaurant_id = r_record.id AND name = 'Service Charge' AND is_system = TRUE) THEN
            INSERT INTO restaurant_charges (restaurant_id, name, type, calculation_type, value, pricing_type, scope, apply_on, show_on_invoice, enabled, is_system)
            VALUES (r_record.id, 'Service Charge', 'fee', 'percentage', 0.00, 'exclusive', 'order', ARRAY['dining'], TRUE, FALSE, TRUE);
        END IF;

        -- Seed Protected System Delivery Charge
        IF NOT EXISTS (SELECT 1 FROM restaurant_charges WHERE restaurant_id = r_record.id AND name = 'Delivery Charge' AND is_system = TRUE) THEN
            INSERT INTO restaurant_charges (restaurant_id, name, type, calculation_type, value, pricing_type, scope, apply_on, show_on_invoice, enabled, is_system)
            VALUES (r_record.id, 'Delivery Charge', 'fee', 'fixed', 0.00, 'exclusive', 'order', ARRAY['delivery'], TRUE, FALSE, TRUE);
        END IF;
    END LOOP;
END $$;
