import { supabaseAdmin } from '@/lib/supabase/server'
import { AuditEventType } from '@/lib/types'

interface AuditEntry {
  userId: string
  documentId?: string | null
  eventType: AuditEventType
  queryText?: string | null
  responseConfidence?: number | null
  chunksAccessed?: number
  durationMs?: number | null
  metadata?: Record<string, unknown>
  request?: Request
}

/**
 * logAudit
 *
 * Writes a single record to the audit_log table.
 * Called via supabaseAdmin — users have no INSERT policy on this table.
 * Non-throwing — a logging failure must never block the user's request.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    // Extract IP and user agent from the request if provided
    const ipAddress = entry.request
      ? entry.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? entry.request.headers.get('x-real-ip')
        ?? null
      : null

    const userAgent = entry.request
      ? entry.request.headers.get('user-agent')
      : null

    const { error } = await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: entry.userId,
        document_id: entry.documentId ?? null,
        event_type: entry.eventType,
        query_text: entry.queryText ?? null,
        response_confidence: entry.responseConfidence ?? null,
        chunks_accessed: entry.chunksAccessed ?? 0,
        ip_address: ipAddress,
        user_agent: userAgent,
        duration_ms: entry.durationMs ?? null,
        metadata: entry.metadata ?? {},
      })

    if (error) {
      console.error('[logAudit] Insert failed:', error.message)
    }
  } catch (err) {
    // Never throw — audit failure is silent to the user
    console.error('[logAudit] Unexpected error:', err)
  }
}