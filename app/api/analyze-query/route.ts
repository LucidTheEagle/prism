import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase/server'
import {
  analyzeQuery,
  formatAnalysisForLogging,
  getQueryComplexity,
  estimateQueryTime,
} from '@/lib/ai/query-analysis'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

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

    // ── 2. Parse and validate request body ────────────────────────
    const body = await request.json()
    const { query, documentId } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔍 QUERY ANALYSIS`)
    console.log(`User: ${user.id}`)
    console.log(`Query: "${query}"`)
    console.log(`Document ID: ${documentId || 'none'}`)
    console.log(`${'='.repeat(80)}\n`)

    // ── 3. Document ownership check ───────────────────────────────
    let documentContext
    if (documentId) {
      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select('document_type, complexity_score, key_entities, user_id')
        .eq('id', documentId)
        .single()

      if (error || !document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }

      // Ownership check — 404 not 403
      if (document.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }

      documentContext = {
        document_type: document.document_type || undefined,
        complexity_score: document.complexity_score || undefined,
        key_entities: document.key_entities || undefined,
      }

      console.log(`[Context] Document type: ${documentContext.document_type}`)
    }

    // ── 4. Analyze query ──────────────────────────────────────────
    const analysis = await analyzeQuery(query, documentContext)
    const complexity = getQueryComplexity(analysis)
    const timeEstimate = estimateQueryTime(analysis)

    console.log(formatAnalysisForLogging(analysis))

    const duration = Date.now() - startTime
    console.log(`\n✅ Analysis complete in ${duration}ms\n`)

    return NextResponse.json({
      success: true,
      query,
      analysis,
      metrics: {
        complexity,
        estimated_search_time_ms: timeEstimate.search_time_ms,
        estimated_answer_time_ms: timeEstimate.answer_time_ms,
        estimated_total_time_ms: timeEstimate.total_time_ms,
      },
      duration_ms: duration,
    })

  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: errorMessage, duration_ms: duration },
      { status: 500 }
    )
  }
}