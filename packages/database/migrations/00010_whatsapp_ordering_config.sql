-- Restroex Database Migration: 00010_whatsapp_ordering_config.sql
-- Description: Table for storing restaurant-specific WhatsApp Interactive Ordering configurations.

CREATE TABLE IF NOT EXISTS restaurant_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  ordering_mode VARCHAR(20) NOT NULL DEFAULT 'hybrid'
    CHECK (ordering_mode IN ('ai_only', 'interactive_only', 'hybrid')),
  home_screen_items JSONB NOT NULL DEFAULT '["browse_menu","best_sellers","offers","track_order","talk_to_staff"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_restaurant ON restaurant_whatsapp_config(restaurant_id);
