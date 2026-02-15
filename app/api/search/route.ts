import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeQuery } from '@/lib/ai/query-analysis'
import { 
  hybridSearch,
  calculateSearchMetrics,
  deduplicateResults 
} from '@/lib/ai/hybrid-search'
import type { SearchResponse } from '@/lib/types'

/**
 * POST /api/search
 * 
 * Performs hybrid search (vector + BM25) on document chunks
 * 
 * Request body:
 * {
 *   "query": "What is the termination clause?",
 *   "documentId": "uuid" (optional - search specific document)
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
    console.log(`🔍 SEARCH REQUEST`)
    console.log(`Query: "${query}"`)
    console.log(`Document ID: ${documentId || 'all documents'}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(80)}\n`)

    // Step 1: Get document context (if searching specific document)
    let documentContext
    if (documentId) {
      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select('document_type, complexity_score, key_entities, name')
        .eq('id', documentId)
        .eq('status', 'ready')
        .single()

      if (error || !document) {
        return NextResponse.json(
          { error: 'Document not found or not ready for search' },
          { status: 404 }
        )
      }

      documentContext = {
        document_type: document.document_type || undefined,
        complexity_score: document.complexity_score || undefined,
        key_entities: document.key_entities || undefined,
      }

      console.log(`[Context] Document: ${document.name}`)
      console.log(`[Context] Type: ${documentContext.document_type}`)
      console.log(`[Context] Complexity: ${documentContext.complexity_score}/10`)
    }

    // Step 2: Analyze query to determine search strategy
    console.log('\n[Step 1/3] Analyzing query...')
    const analysis = await analyzeQuery(query, documentContext)
    console.log(`✓ Query analysis complete`)
    console.log(`  Type: ${analysis.query_type}`)
    console.log(`  Strategy: ${(analysis.vector_weight * 100).toFixed(0)}% vector + ${(analysis.bm25_weight * 100).toFixed(0)}% BM25`)
    console.log(`  Target chunks: ${analysis.chunk_count}`)

    // Step 3: Perform hybrid search
    console.log('\n[Step 2/3] Performing hybrid search...')
    let searchResults = await hybridSearch(query, analysis, documentId || null)
    console.log(`✓ Search complete: ${searchResults.length} results`)

    // Step 4: Deduplicate and finalize results
    console.log('\n[Step 3/3] Finalizing results...')
    searchResults = deduplicateResults(searchResults)
    console.log(`✓ After deduplication: ${searchResults.length} unique results`)

    // Calculate metrics
    const metrics = calculateSearchMetrics(searchResults)
    console.log(`\nSearch Quality Metrics:`)
    console.log(`  Avg combined score: ${metrics.avg_combined_score.toFixed(3)}`)
    console.log(`  Results with AI summaries: ${metrics.results_with_summaries}/${searchResults.length}`)
    console.log(`  Unique pages covered: ${metrics.unique_pages}`)

    const totalDuration = Date.now() - startTime

    console.log(`\n✅ Search complete in ${totalDuration}ms`)
    console.log(`${'='.repeat(80)}\n`)

    // Build response
    const response: SearchResponse = {
      success: true,
      query,
      results: searchResults,
      analysis,
      metadata: {
        total_chunks_searched: searchResults.length,
        results_returned: searchResults.length,
        search_time_ms: totalDuration,
        vector_weight_used: analysis.vector_weight,
        bm25_weight_used: analysis.bm25_weight,
      },
    }

    return NextResponse.json(response)

  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`\n❌ Search failed after ${duration}ms`)
    console.error(`Error:`, errorMessage)
    console.error(`${'='.repeat(80)}\n`)

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

/**
 * GET /api/search?q=query&documentId=uuid
 * 
 * Alternative GET endpoint for simple searches
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const documentId = searchParams.get('documentId')

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    )
  }

  // Redirect to POST handler
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ query, documentId }),
      headers: request.headers,
    })
  )
}