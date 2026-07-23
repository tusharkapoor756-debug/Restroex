-- Restroex Database Migration: 00017_fix_conversation_states_constraint.sql
-- Description: Extends the conversation_sessions state CHECK constraint to include
--              all new onboarding and cart recovery states added during the
--              Customer Onboarding and Cart Recovery sprints.
--
-- Root Cause: Migration 00011 locked the constraint to only 8 original states.
--             New states (awaiting_name, awaiting_address, awaiting_profile_confirmation,
--             awaiting_recovery) were never added — causing silent DB write failures
--             when the onboarding/recovery FSM tried to persist these states.

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
    'awaiting_recovery'
));
