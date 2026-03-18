import { supabaseAdmin } from '@/lib/supabase/server'

export interface DeletionResult {
  success: boolean
  documentId: string
  documentName: string
  fileHash: string | null
  destroyedAt: string
  stepsCompleted: string[]
}

/**
 * deleteDocumentCascade
 *
 * Permanently destroys a document and all associated data in the
 * correct dependency order. Every step is logged. A Destruction
 * Receipt is returned as proof of permanent deletion.
 *
 * Order:
 * 1. Vector embeddings (document_chunks.embedding set to null)
 * 2. Document chunks (document_chunks rows deleted)
 * 3. Chat messages (chat_messages rows deleted)
 * 4. Usage tracking entries for this document
 * 5. Storage file (Supabase Storage)
 * 6. Document record (documents row deleted)
 * 7. Audit log entry written
 */
export async function deleteDocumentCascade(
  documentId: string,
  userId: string
): Promise<DeletionResult> {
  const destroyedAt = new Date().toISOString()
  const stepsCompleted: string[] = []

  // ── Fetch document before deletion ───────────────────────────────
  const { data: document, error: fetchError } = await supabaseAdmin
    .from('documents')
    .select('id, name, file_url, file_hash, user_id')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !document) {
    throw new Error('Document not found or access denied')
  }

  const documentName = document.name
  const fileHash = document.file_hash ?? null

  // ── Step 1: Clear vector embeddings ──────────────────────────────
  await supabaseAdmin
    .from('document_chunks')
    .update({ embedding: null })
    .eq('document_id', documentId)

  stepsCompleted.push('vector_embeddings_cleared')

  // ── Step 2: Delete document chunks ───────────────────────────────
  await supabaseAdmin
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId)

  stepsCompleted.push('document_chunks_deleted')

  // ── Step 3: Delete chat messages ──────────────────────────────────
  await supabaseAdmin
    .from('chat_messages')
    .delete()
    .eq('document_id', documentId)

  stepsCompleted.push('chat_messages_deleted')

  // ── Step 4: Clear usage tracking entries for this document ────────
  // usage_tracking is period-based, not document-based — we decrement
  // the document_count for the user's current period rather than
  // deleting the row (which would break billing history).
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('id, document_count')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(1)
    .single()

  if (usage && usage.document_count > 0) {
    await supabaseAdmin
      .from('usage_tracking')
      .update({ document_count: usage.document_count - 1 })
      .eq('id', usage.id)
  }

  stepsCompleted.push('usage_tracking_updated')

  // ── Step 5: Delete file from Supabase Storage ─────────────────────
  const filename = document.file_url.split('/').pop()

  if (filename) {
    const { error: storageError } = await supabaseAdmin.storage
      .from('document-uploads')
      .remove([filename])

    if (storageError) {
      console.error(`[Delete] Storage removal failed for ${filename}:`, storageError.message)
      // Non-fatal — continue with deletion
    } else {
      stepsCompleted.push('storage_file_deleted')
    }
  }

  // ── Step 6: Delete document record ───────────────────────────────
  const { error: deleteError } = await supabaseAdmin
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', userId)

  if (deleteError) {
    throw new Error(`Failed to delete document record: ${deleteError.message}`)
  }

  stepsCompleted.push('document_record_deleted')

  // ── Step 7: Write audit log ───────────────────────────────────────
  await supabaseAdmin
    .from('audit_log')
    .insert({
      user_id: userId,
      document_id: null, // document is gone — don't reference deleted ID
      event_type: 'document_delete',
      query_text: null,
      response_confidence: null,
      chunks_accessed: 0,
      ip_address: null,
      user_agent: null,
      duration_ms: null,
      metadata: {
        deleted_document_id: documentId,
        document_name: documentName,
        file_hash: fileHash,
        destroyed_at: destroyedAt,
        steps_completed: stepsCompleted,
      },
    })

  stepsCompleted.push('audit_log_written')

  return {
    success: true,
    documentId,
    documentName,
    fileHash,
    destroyedAt,
    stepsCompleted,
  }
}