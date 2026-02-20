import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/documents/[id]
 *
 * Fetch document details by ID.
 *
 * Phase 5.2 update: Auth required. The requesting user must own the
 * document. Uses belt-and-suspenders: session check + explicit
 * user_id comparison, in addition to RLS at the database level.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────
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

    // ── 2. Resolve document ID ────────────────────────────────────
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // ── 3. Fetch document ─────────────────────────────────────────
    // supabaseAdmin bypasses RLS — we enforce ownership explicitly
    // so the error message can distinguish "not found" from "forbidden"
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // ── 4. Ownership check ────────────────────────────────────────
    if (document.user_id !== user.id) {
      // Return 404 not 403 — don't confirm the document exists
      // to users who don't own it (prevents enumeration attacks)
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(document)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}