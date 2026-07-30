-- Migration: Add allow_instructions to menu_items table
-- Description: Controls whether customer special instructions input box is shown on customer ordering web page per menu item.

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS allow_instructions BOOLEAN DEFAULT TRUE NOT NULL;
