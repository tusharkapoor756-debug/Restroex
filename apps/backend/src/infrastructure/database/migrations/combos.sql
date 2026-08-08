-- Database migration: Create combos table for Restroex Special Combos Module
CREATE TABLE IF NOT EXISTS public.combos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    combo_price NUMERIC(10, 2) NOT NULL,
    original_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    image_url TEXT,
    items_included JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast restaurant combo retrieval
CREATE INDEX IF NOT EXISTS idx_combos_restaurant ON public.combos(restaurant_id, is_active);
