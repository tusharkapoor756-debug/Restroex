-- Restroex Database Migration: 00001_initial_schema.sql
-- Description: Core transactional schema for AI-assisted restaurant ordering system.
-- Author: Senior Backend Architect

-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TENANTS (RESTAURANTS)
-- ==========================================
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL, -- WhatsApp Business API number (identifier)
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- 2. USERS (STAFF & ADMINS)
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff' NOT NULL, -- Hardcoded roles: 'admin', 'manager', 'staff'
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL, -- Strict tenant isolation
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_user_role CHECK (role IN ('admin', 'manager', 'staff'))
);

-- ==========================================
-- 3. MENU ITEMS
-- ==========================================
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    aliases VARCHAR(255)[] DEFAULT '{}'::VARCHAR(255)[] NOT NULL, -- PostgreSQL string array for token/regex match
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0.00),
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- 4. CONVERSATION SESSIONS (FSM WORKFLOWS)
-- ==========================================
CREATE TABLE conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    state VARCHAR(50) DEFAULT 'idle' NOT NULL, -- 'idle', 'awaiting_item', 'awaiting_quantity', 'awaiting_confirmation', 'awaiting_payment', 'payment_completed', 'human_takeover'
    cart JSONB DEFAULT '{"items": []}'::jsonb NOT NULL, -- Array of items: {menu_item_id, qty, unit_price}
    context JSONB DEFAULT '{}'::jsonb NOT NULL, -- Temporary conversational contexts (e.g. pending_item_id, last_message_id)
    last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE (restaurant_id, customer_phone),
    CONSTRAINT chk_conversation_state CHECK (state IN (
        'idle', 
        'awaiting_item', 
        'awaiting_quantity', 
        'awaiting_confirmation', 
        'awaiting_payment', 
        'payment_completed', 
        'human_takeover'
    ))
);

-- ==========================================
-- 5. ORDERS (SOURCE OF TRUTH)
-- ==========================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'checkout_pending' NOT NULL, -- 'cart_active', 'checkout_pending', 'payment_pending', 'paid', 'accepted', 'preparing', 'ready', 'completed', 'cancelled', 'refunded'
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0.00),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL, -- Maps to a unique WhatsApp message ID or unique invoice key
    human_readable_id VARCHAR(50) NOT NULL, -- Operator friendly sequence (e.g. ORD-1001)
    receipt_snapshot JSONB, -- Final immutable receipt snap
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(restaurant_id, human_readable_id),
    CONSTRAINT chk_order_status CHECK (status IN (
        'cart_active',
        'checkout_pending',
        'payment_pending',
        'paid',
        'accepted',
        'preparing',
        'ready',
        'completed',
        'cancelled',
        'refunded'
    ))
);

-- ==========================================
-- 6. ORDER ITEMS
-- ==========================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT NOT NULL, -- Prevent deleting menu items that are inside historic orders
    item_name_snapshot VARCHAR(255) NOT NULL, -- Immutable snapshot of name
    variant_name_snapshot VARCHAR(255), -- Immutable snapshot of variant (if exists)
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0.00),
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0.00)
);

-- ==========================================
-- 7. PAYMENTS (RAZORPAY AUTHORITY)
-- ==========================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT NOT NULL, -- Keep historic order references
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    external_transaction_id VARCHAR(255) UNIQUE NOT NULL, -- Razorpay Payment ID (Strict uniqueness)
    status VARCHAR(50) NOT NULL, -- 'captured', 'failed', 'refunded'
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0.00),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- 8. AUDIT LOGS (SECURITY & WORKFLOW TRACES)
-- ==========================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Null if customer action
    action VARCHAR(255) NOT NULL, -- e.g. 'state_changed', 'menu_updated', 'payment_captured'
    entity_type VARCHAR(100) NOT NULL, -- 'orders', 'menu_items', 'conversation_sessions'
    entity_id UUID NOT NULL,
    changes JSONB, -- Logs before-and-after values
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- 9. PERFORMANCE & TENANT ISOLATION INDEXES
-- ==========================================

-- Strict isolation and fast query mapping by tenant (restaurant_id)
CREATE INDEX idx_users_tenant ON users(restaurant_id);
CREATE INDEX idx_menu_items_tenant ON menu_items(restaurant_id);
CREATE INDEX idx_orders_tenant ON orders(restaurant_id);
CREATE INDEX idx_payments_tenant ON payments(restaurant_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(restaurant_id);

-- Speeding up Webhook Ingestion & Deduplication
CREATE INDEX idx_conversation_sessions_lookup ON conversation_sessions(restaurant_id, customer_phone);
CREATE INDEX idx_orders_customer ON orders(customer_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_idempotency ON orders(idempotency_key);
CREATE INDEX idx_payments_external_id ON payments(external_transaction_id);

-- Optimize alias/fuzzy search on menu items using Postgres array index (GIN index)
CREATE INDEX idx_menu_items_aliases ON menu_items USING gin(aliases);
