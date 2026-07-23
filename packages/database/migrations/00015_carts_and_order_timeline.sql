-- Restroex Database Migration: 00015_carts_and_order_timeline.sql
-- Description: Creates a separate carts table to support recoverability/abandonment states, and adds a status timeline table for auditing order state transitions.

-- Cart status options
CREATE TABLE IF NOT EXISTS customer_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL, -- 'active', 'checkout_pending', 'payment_pending', 'order_created', 'abandoned', 'expired', 'completed'
    items JSONB DEFAULT '[]' NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT chk_cart_status CHECK (status IN (
        'active',
        'checkout_pending',
        'payment_pending',
        'order_created',
        'abandoned',
        'expired',
        'completed'
    ))
);

CREATE INDEX IF NOT EXISTS idx_customer_carts_lookup ON customer_carts (restaurant_id, customer_phone, status);

-- Order Status Timeline tracking table
CREATE TABLE IF NOT EXISTS order_status_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) NOT NULL, -- same as orders status check constraint
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_lookup ON order_status_timeline (order_id, created_at ASC);
