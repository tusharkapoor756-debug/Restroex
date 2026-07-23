-- Restroex Database Migration: 00012_payment_methods_settings_update.sql
-- Description: Add cod_enabled and manual_upi_enabled to restaurant_settings

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS manual_upi_enabled BOOLEAN DEFAULT TRUE NOT NULL;
