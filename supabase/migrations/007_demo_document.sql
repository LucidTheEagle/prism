-- 007_demo_document.sql
-- Adds is_demo flag to documents table.
-- Demo documents are readable by any authenticated user.
-- All other RLS policies remain unchanged.

-- Add the column
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Index for fast demo document lookups
CREATE INDEX IF NOT EXISTS documents_is_demo_idx
  ON documents (is_demo)
  WHERE is_demo = true;

-- RLS policy — any authenticated user can read demo documents
CREATE POLICY "Authenticated users can read demo documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (is_demo = true);

-- Mark the PSTA document as the demo document
UPDATE documents
  SET is_demo = true
  WHERE id = 'e44cae21-8ccb-47e2-a83d-680c9adc010c';

COMMENT ON COLUMN documents.is_demo IS
  'When true, this document is readable by all authenticated users. Used for onboarding demo content only.';