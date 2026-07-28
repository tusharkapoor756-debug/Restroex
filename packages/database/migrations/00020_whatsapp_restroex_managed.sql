-- Restroex Database Migration: 00020_whatsapp_restroex_managed.sql
-- Description: Add billing_mode and number_verification_status to restaurant_whatsapp_config table.

ALTER TABLE restaurant_whatsapp_config
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'self_managed'
    CHECK (billing_mode IN ('self_managed', 'restroex_managed')),
  ADD COLUMN IF NOT EXISTS number_verification_status TEXT
    CHECK (number_verification_status IN ('pending', 'otp_sent', 'verified', 'failed'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_billing_mode ON restaurant_whatsapp_config(billing_mode);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_cloud_phone_id ON restaurant_whatsapp_config(cloud_phone_number_id);
