import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/chat/[id]/messages
 *
 * Load full message history for a document, oldest first.
 * Called once on ChatInterface mount.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // ── Auth ──────────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // ── Ownership check ───────────────────────────────────────────
    // Demo documents are accessible to all authenticated users.
    // Personal documents are strictly locked to their owner.
    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('id, user_id, is_demo')
      .eq('id', id)
      .single()
      
      if (!document || (!document.is_demo && document.user_id !== user.id)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
      }

    // ── Fetch messages scoped to this user ────────────────────────
    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('document_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ messages: messages ?? [] })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}