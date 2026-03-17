import { NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/documents
 *
 * Returns all documents belonging to the authenticated user.
 * Scoped strictly to user_id — never returns another user's documents.
 */
export async function GET() {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // ── 2. Fetch only this user's documents ───────────────────────
    const { data: documents, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      documents: documents || [],
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        documents: [],
      },
      { status: 500 }
    )
  }
}