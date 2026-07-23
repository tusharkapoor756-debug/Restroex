-- Restroex Database Migration: 00016_ensure_customers_table_columns.sql
-- Description: Ensures the customers table has name, address, and phone column structures aligned.

-- If customers has phone_number column but not phone, rename it. Otherwise ensure phone exists.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'phone_number'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'phone'
    ) THEN
        ALTER TABLE customers RENAME COLUMN phone_number TO phone;
    END IF;
END $$;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;

-- Update unique constraint if phone was renamed/added
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_restaurant_id_phone_number_key;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_restaurant_id_phone_key;

-- Apply check to verify constraint doesn't fail
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_restaurant_id_phone_key'
    ) THEN
        ALTER TABLE customers ADD CONSTRAINT customers_restaurant_id_phone_key UNIQUE (restaurant_id, phone);
    END IF;
END $$;
