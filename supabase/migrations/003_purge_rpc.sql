-- ============================================================
-- PRISM v1.2 Migration 003 — Atomic Account Purge RPC
-- Applied: Sprint 13.1
-- ============================================================

CREATE OR REPLACE FUNCTION purge_user_account(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  doc_count INTEGER := 0;
  chunk_count INTEGER := 0;
  message_count INTEGER := 0;
  usage_count INTEGER := 0;
  doc_ids UUID[];
BEGIN
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Unauthorized — user ID mismatch';
  END IF;

  SELECT ARRAY(
    SELECT id FROM documents WHERE user_id = target_user_id
  ) INTO doc_ids;

  DELETE FROM document_chunks WHERE document_id = ANY(doc_ids);
  GET DIAGNOSTICS chunk_count = ROW_COUNT;

  DELETE FROM chat_messages WHERE user_id = target_user_id;
  GET DIAGNOSTICS message_count = ROW_COUNT;

  DELETE FROM usage_tracking WHERE user_id = target_user_id;
  GET DIAGNOSTICS usage_count = ROW_COUNT;

  DELETE FROM documents WHERE user_id = target_user_id;
  GET DIAGNOSTICS doc_count = ROW_COUNT;

  INSERT INTO audit_log (
    user_id, document_id, event_type, query_text,
    response_confidence, chunks_accessed, ip_address,
    user_agent, duration_ms, metadata
  ) VALUES (
    target_user_id, NULL, 'document_delete', NULL,
    NULL, 0, NULL, NULL, NULL,
    jsonb_build_object(
      'event', 'account_purge',
      'documents_deleted', doc_count,
      'chunks_deleted', chunk_count,
      'messages_deleted', message_count,
      'usage_records_deleted', usage_count,
      'purged_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'documents_deleted', doc_count,
    'chunks_deleted', chunk_count,
    'messages_deleted', message_count,
    'usage_records_deleted', usage_count,
    'purged_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION purge_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_user_account(UUID) TO authenticated;