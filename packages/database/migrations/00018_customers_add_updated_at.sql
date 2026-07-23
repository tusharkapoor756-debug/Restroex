-- Restroex Database Migration: 00018_customers_add_updated_at.sql
-- Description: Adds the missing updated_at column to the customers table.
--
-- Root Cause: Migration 00013 defined updated_at in the CREATE TABLE statement,
--             but the actual live table was created without it (possibly from an
--             earlier schema or a partial migration run). The CustomerRepository
--             explicitly writes updated_at on every update, causing a schema cache
--             error: "column customers.updated_at does not exist".
--
-- Fix: Add the column with a sensible default (current timestamp for existing rows).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;
