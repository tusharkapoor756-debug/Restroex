-- Restroex Database Migration: 00021_restaurant_operations_v1.sql
-- Description:
--   1. Extend restaurant_settings with order_modes, max_active_orders, and total_tables.
--   2. Extend orders table with order_type and table_number columns.
--   3. Ensure backward compatibility and safe default values.

-- 1. RESTAURANT_SETTINGS — extend for V1 Operations Engine
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS supported_order_modes TEXT[] DEFAULT ARRAY['takeaway', 'dining']::TEXT[] NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS max_active_orders INTEGER DEFAULT 20 NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS total_tables INTEGER DEFAULT 25 NOT NULL;

-- 2. ORDERS — extend for order types and table numbers
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'takeaway' NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number INTEGER NULL;

-- Ensure check constraint for order_type (Takeaway / Dining)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_order_type;
ALTER TABLE orders ADD CONSTRAINT chk_orders_order_type CHECK (order_type IN ('takeaway', 'dining', 'delivery'));

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_status ON orders(restaurant_id, status);
