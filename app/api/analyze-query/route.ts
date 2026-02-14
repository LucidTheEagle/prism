import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { 
  analyzeQuery, 
  formatAnalysisForLogging,
  getQueryComplexity,
  estimateQueryTime 
} from '@/lib/ai/query-analysis'

/**
 * POST /api/analyze-query
 * 
 * Analyzes a user query to determine optimal search strategy
 * 
 * Request body:
 * {
 *   "query": "What is the termination clause?",
 *   "documentId": "uuid" (optional - provides document context)
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { query, documentId } = body

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔍 QUERY ANALYSIS`)
    console.log(`Query: "${query}"`)
    console.log(`Document ID: ${documentId || 'none (global search)'}`)
    console.log(`${'='.repeat(80)}\n`)

    // Get document context if documentId provided
    let documentContext
    if (documentId) {
      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select('document_type, complexity_score, key_entities')
        .eq('id', documentId)
        .single()

      if (!error && document) {
        documentContext = {
          document_type: document.document_type || undefined,
          complexity_score: document.complexity_score || undefined,
          key_entities: document.key_entities || undefined,
        }
        console.log(`[Context] Document type: ${documentContext.document_type}`)
        console.log(`[Context] Complexity: ${documentContext.complexity_score}/10`)
      }
    }

    // Analyze query
    const analysis = await analyzeQuery(query, documentContext)

    // Calculate metrics
    const complexity = getQueryComplexity(analysis)
    const timeEstimate = estimateQueryTime(analysis)

    // Log analysis
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

    console.error(`\n❌ Query analysis failed:`, errorMessage)
    console.error(`Duration: ${duration}ms\n`)

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}