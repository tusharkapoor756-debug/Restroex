-- Restroex Database Migration: 00008_conversation_memory.sql
-- Description: Create conversation_history table for persisting short-term and long-term conversation memory.
-- Author: Senior Backend Architect

CREATE TABLE IF NOT EXISTS conversation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for speedy retrieval of recent messages for a customer session
CREATE INDEX IF NOT EXISTS idx_conversation_history_lookup 
ON conversation_history(restaurant_id, customer_phone, created_at DESC);
