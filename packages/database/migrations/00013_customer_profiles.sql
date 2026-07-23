-- Restroex Database Migration: 00013_customer_profiles.sql
-- Description: Create customer profiles table for structured customer identification, and link orders/conversations to it.

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE (restaurant_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_customers_lookup ON customers (restaurant_id, phone_number);

-- Add customer_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
