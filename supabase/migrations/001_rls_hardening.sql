-- ============================================================
-- PRISM v1.2 Migration 001 — RLS Hardening
-- Applied: Sprint 2
-- ============================================================

-- document_chunks: deny direct write access from public role
-- Only service role (ingestion pipeline) writes chunks.

CREATE POLICY "chunks: deny direct insert" ON document_chunks
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "chunks: deny direct update" ON document_chunks
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING (false);

CREATE POLICY "chunks: deny direct delete" ON document_chunks
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (false);

-- chat_messages: fix INSERT policy — add with_check
DROP POLICY IF EXISTS "messages: users insert own" ON chat_messages;

CREATE POLICY "messages: users insert own" ON chat_messages
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

-- audit_log: deny direct write access from public role
-- Only service role writes audit entries.

CREATE POLICY "audit_log: deny direct insert" ON audit_log
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "audit_log: deny direct update" ON audit_log
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING (false);

CREATE POLICY "audit_log: deny direct delete" ON audit_log
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (false);