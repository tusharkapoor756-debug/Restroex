-- Restroex Database Migration: 00009_dynamic_menu.sql
-- Description: Dynamic Menu Management System (Categories, Subcategories, Menu Items additions, Customizations, and Variants display order).

-- ==========================================
-- 1. CATEGORIES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0 NOT NULL,
    icon VARCHAR(255),
    image_url VARCHAR(500),
    is_visible BOOLEAN DEFAULT TRUE NOT NULL,
    available_from TIME,
    available_till TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for tenant separation and fast ordering queries
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- ==========================================
-- 2. ALTER MENU ITEMS FOR DYNAMIC STRUCTS
-- ==========================================
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS veg_type VARCHAR(50) DEFAULT 'veg' CHECK (veg_type IN ('veg', 'non-veg'));
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS preparation_time INT DEFAULT 15;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0 NOT NULL;

-- Indexes for menu categorization
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_subcategory ON menu_items(subcategory_id);

-- ==========================================
-- 3. CUSTOMIZATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS menu_item_customizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    price_adjustment DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for fast customization fetch
CREATE INDEX IF NOT EXISTS idx_customizations_menu_item ON menu_item_customizations(menu_item_id);

-- ==========================================
-- 4. ALTER MENU ITEM VARIANTS FOR ORDERING
-- ==========================================
ALTER TABLE menu_item_variants ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0 NOT NULL;
