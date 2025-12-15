-- Migration: Update device fields for Asset-Tag workflow
-- Adds asset_tag and windows_version fields
-- Date: 2025-01-XX
-- Compatible with SQLite

-- Add new columns to devices table
ALTER TABLE devices ADD COLUMN asset_tag VARCHAR(100);
ALTER TABLE devices ADD COLUMN windows_version VARCHAR(100);

-- Create index on asset_tag for faster lookups (especially for barcode scanner)
CREATE INDEX IF NOT EXISTS idx_asset_tag ON devices(asset_tag);

-- Note: We keep manufacturer and serial_number columns for backward compatibility
-- Frontend will use:
-- - asset_tag (new primary identifier)
-- - inventory_number (CM-Nummer in UI)
-- - device_type (Kategorie in UI)
-- - model (Model in UI)
-- - windows_version (new field)
-- - notes (Zusätzliche Informationen in UI)
