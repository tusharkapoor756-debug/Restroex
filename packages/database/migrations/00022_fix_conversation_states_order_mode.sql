-- Restroex Database Migration: 00022_fix_conversation_states_order_mode.sql
-- Description: Extends conversation_sessions state CHECK constraint to include
--              awaiting_order_mode and awaiting_table_number.

ALTER TABLE conversation_sessions DROP CONSTRAINT IF EXISTS chk_conversation_state;

ALTER TABLE conversation_sessions
ADD CONSTRAINT chk_conversation_state CHECK (state IN (
    'idle',
    'awaiting_item',
    'awaiting_variant',
    'awaiting_quantity',
    'awaiting_confirmation',
    'awaiting_payment',
    'payment_completed',
    'awaiting_payment_screenshot',
    'human_takeover',
    'awaiting_name',
    'awaiting_address',
    'awaiting_profile_confirmation',
    'awaiting_recovery',
    'awaiting_order_mode',
    'awaiting_table_number'
));
