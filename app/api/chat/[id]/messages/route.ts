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

    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('document_id', id)
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

/**
 * POST /api/chat/[id]/messages
 *
 * Persist a single message (user or assistant) to the database.
 * Called after each message is added to local state.
 *
 * Body:
 * {
 *   role:       'user' | 'assistant'
 *   content:    string
 *   confidence: number | undefined   (assistant only)
 *   citations:  Citation[] | undefined (assistant only)
 * }
 */
export async function POST(
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

    // ── Auth: get user so we can stamp user_id on the row ─────────
    // chat_messages.user_id is NOT NULL — inserts without it will 500.
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { role, content, confidence, citations } = body

    if (!role || !content) {
      return NextResponse.json(
        { error: 'role and content are required' },
        { status: 400 }
      )
    }

    const { data: message, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        document_id: id,
        user_id: user.id,   // ← FIX: was missing, caused 500 on every insert
        role,
        content,
        confidence: confidence ?? null,
        citations: citations ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Messages] Insert error:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}