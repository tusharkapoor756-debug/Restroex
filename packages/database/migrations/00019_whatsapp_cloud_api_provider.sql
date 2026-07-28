-- Restroex Database Migration: 00019_whatsapp_cloud_api_provider.sql
-- Description: Add provider selection and Meta Cloud API credentials to restaurant_whatsapp_config table.

ALTER TABLE restaurant_whatsapp_config 
  ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) NOT NULL DEFAULT 'webjs';

ALTER TABLE restaurant_whatsapp_config 
  ADD COLUMN IF NOT EXISTS cloud_phone_number_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cloud_access_token TEXT,
  ADD COLUMN IF NOT EXISTS cloud_waba_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS webhook_verify_token VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_provider ON restaurant_whatsapp_config(provider_type);
