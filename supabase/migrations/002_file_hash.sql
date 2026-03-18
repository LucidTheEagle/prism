-- ============================================================
-- PRISM v1.2 Migration 002 — SHA-256 File Hash
-- Applied: Sprint 4
-- ============================================================

-- Add file_hash column for SHA-256 duplicate detection
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Composite index for fast duplicate detection per user
CREATE INDEX IF NOT EXISTS idx_documents_file_hash 
  ON documents(user_id, file_hash);