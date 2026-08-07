-- Restroex Database Migration: 00026_enterprise_menu_import_engine.sql
-- Description: Schema tables for deterministic Menu Import Engine (Staging Sessions, Items, Version History, Tenant Dictionaries, and Import Analytics).

-- ==========================================
-- 1. IMPORT SESSIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS menu_import_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) DEFAULT 'queued' NOT NULL, -- 'queued', 'processing', 'draft', 'committed', 'failed', 'cancelled'
    import_mode VARCHAR(50) DEFAULT 'append' NOT NULL, -- 'append', 'replace_category', 'full_sync'
    original_filename VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    quality_report JSONB,
    dry_run_summary JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT chk_import_session_status CHECK (status IN ('queued', 'processing', 'draft', 'committed', 'failed', 'cancelled')),
    CONSTRAINT chk_import_session_mode CHECK (import_mode IN ('append', 'replace_category', 'full_sync'))
);

-- ==========================================
-- 2. STAGED IMPORT ITEMS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS menu_import_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES menu_import_sessions(id) ON DELETE CASCADE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    subcategory_name VARCHAR(255),
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2),
    veg_type VARCHAR(50) DEFAULT 'veg' CHECK (veg_type IN ('veg', 'non-veg', 'egg', 'vegan')),
    is_bestseller BOOLEAN DEFAULT FALSE NOT NULL,
    variants JSONB DEFAULT '[]'::jsonb NOT NULL,
    customizations JSONB DEFAULT '[]'::jsonb NOT NULL,
    bounding_box JSONB, -- [x0, y0, x1, y1]
    confidence_score DECIMAL(5, 4) DEFAULT 1.0000 NOT NULL,
    needs_review BOOLEAN DEFAULT FALSE NOT NULL,
    matched_menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    sync_action VARCHAR(50) DEFAULT 'create' NOT NULL CHECK (sync_action IN ('create', 'update', 'merge', 'ignore')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- 3. MENU VERSION HISTORY TABLE (SNAPSHOTS & ROLLBACK)
-- ==========================================
CREATE TABLE IF NOT EXISTS menu_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    version_number INT NOT NULL,
    source VARCHAR(100) NOT NULL, -- 'import_session', 'manual_edit', 'bulk_update'
    import_session_id UUID REFERENCES menu_import_sessions(id) ON DELETE SET NULL,
    snapshot_data JSONB NOT NULL, -- Complete serialized snapshot of categories, items, variants, customizations
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(restaurant_id, version_number)
);

-- ==========================================
-- 4. TENANT LEARNING DICTIONARY
-- ==========================================
CREATE TABLE IF NOT EXISTS tenant_menu_dictionaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    raw_ocr_text VARCHAR(255) NOT NULL,
    corrected_text VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) DEFAULT 'item_name' NOT NULL, -- 'item_name', 'category', 'variant'
    use_count INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(restaurant_id, raw_ocr_text, field_type)
);

-- ==========================================
-- 5. IMPORT ANALYTICS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS menu_import_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES menu_import_sessions(id) ON DELETE CASCADE NOT NULL,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    ocr_accuracy_score DECIMAL(5, 4),
    processing_duration_ms INT NOT NULL,
    total_items_extracted INT NOT NULL,
    manual_corrections_count INT DEFAULT 0 NOT NULL,
    duplicates_detected_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- 6. PERFORMANCE & ISOLATION INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_import_sessions_tenant ON menu_import_sessions(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_import_items_session ON menu_import_items(session_id);
CREATE INDEX IF NOT EXISTS idx_menu_versions_tenant ON menu_versions(restaurant_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_dict_lookup ON tenant_menu_dictionaries(restaurant_id, raw_ocr_text);
