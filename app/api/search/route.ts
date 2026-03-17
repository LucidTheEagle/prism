import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase/server'
import { analyzeQuery } from '@/lib/ai/query-analysis'
import {
  hybridSearch,
  calculateSearchMetrics,
  deduplicateResults,
} from '@/lib/ai/hybrid-search'
import { rerankSearchResults } from '@/lib/ai/reranking'
import type { SearchResponse } from '@/lib/types'

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
    console.log(`🔍 SEARCH REQUEST`)
    console.log(`User: ${user.id}`)
    console.log(`Query: "${query}"`)
    console.log(`Document ID: ${documentId || 'all documents'}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(80)}\n`)

    // ── 3. Document ownership check ───────────────────────────────
    let documentContext
    if (documentId) {
      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select('document_type, complexity_score, key_entities, name, user_id')
        .eq('id', documentId)
        .eq('status', 'ready')
        .single()

      if (error || !document) {
        return NextResponse.json(
          { error: 'Document not found or not ready for search' },
          { status: 404 }
        )
      }

      // Ownership check — 404 not 403, never confirm existence to non-owner
      if (document.user_id !== user.id) {
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
    }

    // ── 4. Query analysis ─────────────────────────────────────────
    console.log('\n[Step 1/4] Analyzing query...')
    const analysis = await analyzeQuery(query, documentContext)
    console.log(`✓ Query type: ${analysis.query_type}`)

    // ── 5. Hybrid search ──────────────────────────────────────────
    console.log('\n[Step 2/4] Performing hybrid search...')
    let searchResults = await hybridSearch(query, analysis, documentId || null, user.id)
    console.log(`✓ Search complete: ${searchResults.length} results`)

    // ── 6. Deduplicate ────────────────────────────────────────────
    console.log('\n[Step 3/4] Deduplicating results...')
    searchResults = deduplicateResults(searchResults)
    console.log(`✓ After deduplication: ${searchResults.length} unique results`)

    // ── 7. Re-ranking ─────────────────────────────────────────────
    console.log('\n[Step 4/4] AI-powered re-ranking...')
    const rerankingResult = await rerankSearchResults(query, searchResults, 10)
    searchResults = rerankingResult.reranked_results
    console.log(`✓ Re-ranking complete: ${rerankingResult.scores.length} results scored`)

    const metrics = calculateSearchMetrics(searchResults)
    const totalDuration = Date.now() - startTime

     console.log(`\n✅ Search complete in ${totalDuration}ms`)
     console.log(`${'='.repeat(80)}\n`)   
     console.log(`[Metrics] Avg Combined Score: ${metrics.avg_combined_score?.toFixed(3)}`)
     console.log(`[Metrics] Unique Pages: ${metrics.unique_pages}`)
     console.log(`[Metrics] Results with Summaries: ${metrics.results_with_summaries}`)  

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
         avg_combined_score: metrics.avg_combined_score,
         unique_pages: metrics.unique_pages,
         results_with_summaries: metrics.results_with_summaries,
       },
     }

    return NextResponse.json(response)

  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: errorMessage, duration_ms: duration },
      { status: 500 }
    )
  }
}

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

  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ query, documentId }),
      headers: request.headers,
    })
  )
}