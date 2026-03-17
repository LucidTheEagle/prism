import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * validateDocumentOwnership
 *
 * Single source of truth for document ownership verification.
 * Called by any route that accepts a document ID parameter.
 *
 * Returns the document if the user owns it.
 * Returns null if the document does not exist OR belongs to another user.
 *
 * Always returns null on mismatch — never distinguish between
 * "not found" and "forbidden". Callers must return 404, not 403,
 * to prevent document ID enumeration attacks.
 */
export async function validateDocumentOwnership(
  documentId: string,
  userId: string
): Promise<{ id: string; user_id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('id, user_id')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single()

    if (error || !data) return null

    return data
  } catch {
    return null
  }
}