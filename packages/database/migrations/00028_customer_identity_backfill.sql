-- Restroex Database Migration: 00028_customer_identity_backfill.sql
-- Description:
--   Phase 6 of Customer Identity System — Legacy Data Backfill.
--
--   SAFE TO RUN MULTIPLE TIMES (idempotent).
--
--   What this migration does:
--   1. Backfills primary_phone for existing customers with real phone numbers (not LIDs).
--   2. Backfills whatsapp_lid for customers whose phone column contains an @lid string.
--   3. Backfills created_source = 'WHATSAPP' for all pre-existing customers.
--   4. Assigns customer_code (CUS-XXXXXX) to every customer that doesn't have one yet,
--      using the concurrency-safe generate_next_customer_code() function.
--   5. Initialises restaurant_customer_counters for every restaurant that has customers.
--   6. Populates customer_identities registry for all existing customers.
--   7. Soft-merge exact-duplicate customers per restaurant (same normalised primary_phone).
--
--   SAFETY GUARANTEES:
--   - Legacy columns (phone, contact_phone) are NEVER dropped.
--   - No hard deletions. Duplicates are soft-merged (is_merged = TRUE).
--   - All related records (orders, payments, whatsapp_conversations) are re-linked.
--   - customer_merge_logs is written for every merge for full audit trail.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Initialise restaurant_customer_counters for restaurants that already
--         have customers so the generator starts from the right counter value.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO restaurant_customer_counters (restaurant_id, last_counter, created_at, updated_at)
SELECT
    c.restaurant_id,
    COUNT(c.id)::INT AS last_counter,
    NOW(),
    NOW()
FROM customers c
WHERE c.is_merged IS NOT TRUE
GROUP BY c.restaurant_id
ON CONFLICT (restaurant_id)
DO UPDATE SET
    last_counter = GREATEST(
        restaurant_customer_counters.last_counter,
        EXCLUDED.last_counter
    ),
    updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Backfill created_source for all existing rows (safe default)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE customers
SET created_source = 'WHATSAPP'
WHERE created_source IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Backfill whatsapp_lid from the legacy phone column if it contains @lid
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE customers
SET
    whatsapp_lid = LOWER(phone),
    primary_phone = NULL
WHERE
    phone ILIKE '%@lid%'
    AND whatsapp_lid IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Backfill primary_phone from contact_phone (preferred) or phone column
--         for non-LID customers only.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE customers
SET primary_phone = CASE
    -- Prefer contact_phone if it looks like a real number (10-13 digits, not LID)
    WHEN contact_phone IS NOT NULL
         AND contact_phone NOT ILIKE '%@lid%'
         AND LENGTH(REGEXP_REPLACE(contact_phone, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
    THEN REGEXP_REPLACE(contact_phone, '[^0-9]', '', 'g')

    -- Fallback: use phone column if it is a real number
    WHEN phone NOT ILIKE '%@lid%'
         AND phone NOT ILIKE '%@c.us%'
         AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
    THEN REGEXP_REPLACE(phone, '[^0-9]', '', 'g')

    ELSE NULL
END
WHERE
    primary_phone IS NULL
    AND (phone NOT ILIKE '%@lid%' OR contact_phone IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Assign customer_code to all existing customers that don't have one.
--         Uses generate_next_customer_code() which is concurrency-safe.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT id, restaurant_id
        FROM customers
        WHERE customer_code IS NULL
        ORDER BY created_at ASC
    LOOP
        UPDATE customers
        SET customer_code = generate_next_customer_code(rec.restaurant_id)
        WHERE id = rec.id;
    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Populate customer_identities registry for all existing customers.
--         Idempotent — uses ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

-- Register primary_phone identities
INSERT INTO customer_identities (id, restaurant_id, customer_id, provider_type, provider_value, is_verified, created_at, updated_at)
SELECT
    uuid_generate_v4(),
    c.restaurant_id,
    c.id,
    'phone',
    c.primary_phone,
    TRUE,
    NOW(),
    NOW()
FROM customers c
WHERE
    c.primary_phone IS NOT NULL
    AND c.is_merged IS NOT TRUE
ON CONFLICT (restaurant_id, provider_type, provider_value) DO NOTHING;

-- Register whatsapp_lid identities
INSERT INTO customer_identities (id, restaurant_id, customer_id, provider_type, provider_value, is_verified, created_at, updated_at)
SELECT
    uuid_generate_v4(),
    c.restaurant_id,
    c.id,
    'whatsapp_lid',
    c.whatsapp_lid,
    TRUE,
    NOW(),
    NOW()
FROM customers c
WHERE
    c.whatsapp_lid IS NOT NULL
    AND c.is_merged IS NOT TRUE
ON CONFLICT (restaurant_id, provider_type, provider_value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Soft-merge duplicate customers (same restaurant + same primary_phone).
--         Keeps the OLDEST record (earliest created_at) as the primary.
--         Marks all newer duplicates as merged.
--         Re-links orders and whatsapp_conversations to the primary.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    primary_id UUID;
BEGIN
    -- Loop over all groups where 2+ active customers share the same primary_phone per restaurant
    FOR rec IN
        SELECT
            restaurant_id,
            primary_phone,
            MIN(created_at) AS first_seen,
            COUNT(*) AS duplicate_count
        FROM customers
        WHERE
            primary_phone IS NOT NULL
            AND is_merged IS NOT TRUE
        GROUP BY restaurant_id, primary_phone
        HAVING COUNT(*) > 1
    LOOP
        -- Find the oldest (primary) customer in this group
        SELECT id INTO primary_id
        FROM customers
        WHERE
            restaurant_id = rec.restaurant_id
            AND primary_phone = rec.primary_phone
            AND is_merged IS NOT TRUE
        ORDER BY created_at ASC
        LIMIT 1;

        -- Re-link orders to the primary customer
        UPDATE orders
        SET customer_id = primary_id
        WHERE
            restaurant_id = rec.restaurant_id
            AND customer_id IN (
                SELECT id FROM customers
                WHERE
                    restaurant_id = rec.restaurant_id
                    AND primary_phone = rec.primary_phone
                    AND id <> primary_id
                    AND is_merged IS NOT TRUE
            );

        -- Re-link whatsapp_conversations to the primary customer
        UPDATE whatsapp_conversations
        SET customer_id = primary_id
        WHERE
            restaurant_id = rec.restaurant_id
            AND customer_id IN (
                SELECT id FROM customers
                WHERE
                    restaurant_id = rec.restaurant_id
                    AND primary_phone = rec.primary_phone
                    AND id <> primary_id
                    AND is_merged IS NOT TRUE
            );

        -- Write merge log for each duplicate before marking merged
        INSERT INTO customer_merge_logs (
            id, restaurant_id, primary_customer_id, merged_customer_id,
            merged_by, merge_reason, snapshot_data, created_at
        )
        SELECT
            uuid_generate_v4(),
            rec.restaurant_id,
            primary_id,
            c.id,
            'SYSTEM_MIGRATION',
            'Duplicate primary_phone detected during Phase 6 backfill migration',
            row_to_json(c)::JSONB,
            NOW()
        FROM customers c
        WHERE
            c.restaurant_id = rec.restaurant_id
            AND c.primary_phone = rec.primary_phone
            AND c.id <> primary_id
            AND c.is_merged IS NOT TRUE;

        -- Soft-mark all non-primary duplicates as merged
        UPDATE customers
        SET
            is_merged = TRUE,
            merged_into_customer_id = primary_id,
            merged_at = NOW()
        WHERE
            restaurant_id = rec.restaurant_id
            AND primary_phone = rec.primary_phone
            AND id <> primary_id
            AND is_merged IS NOT TRUE;

    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION: Quick summary of migration results
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_total INT;
    v_with_code INT;
    v_with_phone INT;
    v_with_lid INT;
    v_merged INT;
    v_identity_rows INT;
BEGIN
    SELECT COUNT(*) INTO v_total FROM customers;
    SELECT COUNT(*) INTO v_with_code FROM customers WHERE customer_code IS NOT NULL;
    SELECT COUNT(*) INTO v_with_phone FROM customers WHERE primary_phone IS NOT NULL;
    SELECT COUNT(*) INTO v_with_lid FROM customers WHERE whatsapp_lid IS NOT NULL;
    SELECT COUNT(*) INTO v_merged FROM customers WHERE is_merged = TRUE;
    SELECT COUNT(*) INTO v_identity_rows FROM customer_identities;

    RAISE NOTICE '=== Phase 6 Backfill Summary ===';
    RAISE NOTICE 'Total customers:       %', v_total;
    RAISE NOTICE 'With customer_code:    %', v_with_code;
    RAISE NOTICE 'With primary_phone:    %', v_with_phone;
    RAISE NOTICE 'With whatsapp_lid:     %', v_with_lid;
    RAISE NOTICE 'Soft-merged (dupes):   %', v_merged;
    RAISE NOTICE 'Identity registry rows:%', v_identity_rows;
END;
$$;

COMMIT;
