-- Restroex Database Migration: 00011_fix_conversation_states_constraint.sql
-- Description: Drop and recreate the conversation_sessions state CHECK constraint to include 'awaiting_payment_screenshot'

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
    'human_takeover'
));
