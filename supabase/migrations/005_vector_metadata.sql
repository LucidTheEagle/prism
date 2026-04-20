-- ============================================================================
-- Migration 005: Vector metadata schema lock
-- Adds page_number and section_header as top-level columns on document_chunks.
-- These fields currently live inside the metadata JSON blob — Sprint 5 promotes
-- them to first-class columns for reliable querying and schema enforcement.
-- tenant_id column added as alias for user_id — ChunkMetadata canonical name.
-- ============================================================================

-- Add page_number as top-level column
-- Backfills from existing metadata JSON blob where possible
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;

-- Add section_header as top-level column
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS section_header TEXT DEFAULT NULL;

-- Add tenant_id as top-level column
-- Maps to user_id — ChunkMetadata canonical name for multi-tenant isolation
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;

-- Backfill page_number from metadata JSON for existing chunks
UPDATE document_chunks
  SET page_number = (metadata->>'page')::INTEGER
  WHERE metadata->>'page' IS NOT NULL
  AND page_number = 1;

-- Backfill section_header from metadata JSON for existing chunks
UPDATE document_chunks
  SET section_header = metadata->>'section_header'
  WHERE metadata->>'section_header' IS NOT NULL;

-- Backfill tenant_id from user_id for existing chunks
UPDATE document_chunks
  SET tenant_id = user_id
  WHERE user_id IS NOT NULL;

-- Add NOT NULL constraint on page_number after backfill
-- Default of 1 ensures no existing rows are null
ALTER TABLE document_chunks
  ALTER COLUMN page_number SET NOT NULL;