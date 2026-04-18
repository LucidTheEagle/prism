-- ============================================================================
-- Migration 004: Ingestion status tracking + Supabase Realtime
-- Adds ingestion_status and ingestion_error columns to documents table.
-- Enables Supabase Realtime on documents table for status push to client.
-- ============================================================================

-- Add ingestion_status column
-- Four states: queued | processing | ready | failed
-- Separate from the existing 'status' column which tracks document availability
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS ingestion_status TEXT
    NOT NULL
    DEFAULT 'queued'
    CHECK (ingestion_status IN ('queued', 'processing', 'ready', 'failed'));

-- Add ingestion_error column
-- Captures structured ingestion failure reason separate from general error_message
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS ingestion_error TEXT DEFAULT NULL;

-- Update existing documents to reflect their current state
-- Documents with status 'ready' have completed ingestion
UPDATE documents
  SET ingestion_status = 'ready'
  WHERE status = 'ready';

-- Documents with status 'failed' have failed ingestion
UPDATE documents
  SET ingestion_status = 'failed'
  WHERE status = 'failed';

-- Documents with status 'processing' are in an unknown mid-flight state
-- Set to 'failed' — they will never complete, safer to mark as failed
UPDATE documents
  SET ingestion_status = 'failed',
      ingestion_error = 'Document was mid-processing when migration ran. Please re-upload.'
  WHERE status = 'processing';

-- Enable Supabase Realtime on documents table
-- This allows DocumentStatus to subscribe to live status updates
-- without polling the API every 3 seconds
ALTER PUBLICATION supabase_realtime ADD TABLE documents;