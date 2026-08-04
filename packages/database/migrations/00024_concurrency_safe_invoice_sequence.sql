-- Restroex Database Migration: 00024_concurrency_safe_invoice_sequence.sql
-- Description:
--   1. Create invoice_counters table to track atomic invoice sequences per restaurant and year.
--   2. Create PL/pgSQL function generate_next_invoice_number for 100% lock-safe atomic increments.

CREATE TABLE IF NOT EXISTS invoice_counters (
    restaurant_id UUID NOT NULL,
    year INT NOT NULL,
    last_sequence INT DEFAULT 100000 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (restaurant_id, year)
);

-- Atomic Sequence Generator Function
CREATE OR REPLACE FUNCTION generate_next_invoice_number(
    p_restaurant_id UUID,
    p_order_id UUID,
    p_year INT
)
RETURNS VARCHAR(100)
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_invoice VARCHAR(100);
    v_next_seq INT;
    v_invoice_num VARCHAR(100);
BEGIN
    -- 1. Idempotency Check: Return if order already has an assigned invoice_number
    SELECT invoice_number INTO v_existing_invoice
    FROM orders
    WHERE id = p_order_id;

    IF v_existing_invoice IS NOT NULL THEN
        RETURN v_existing_invoice;
    END IF;

    -- 2. Atomic Upsert & Lock on invoice_counters
    INSERT INTO invoice_counters (restaurant_id, year, last_sequence, updated_at)
    VALUES (p_restaurant_id, p_year, 100001, NOW())
    ON CONFLICT (restaurant_id, year)
    DO UPDATE SET 
        last_sequence = invoice_counters.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;

    -- 3. Construct Invoice Number String
    v_invoice_num := 'INV-' || p_year::TEXT || '-' || v_next_seq::TEXT;

    -- 4. Attach Invoice Number atomically to Order
    UPDATE orders
    SET invoice_number = v_invoice_num
    WHERE id = p_order_id;

    RETURN v_invoice_num;
END;
$$;
