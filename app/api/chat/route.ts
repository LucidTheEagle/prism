import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'
import { analyzeQuery } from '@/lib/ai/query-analysis'
import { hybridSearch, deduplicateResults } from '@/lib/ai/hybrid-search'
import { rerankSearchResults } from '@/lib/ai/reranking'
import { generateMultiPassAnswer } from '@/lib/ai/answer-generation'

/**
 * POST /api/chat
 *
 * Complete Q&A pipeline: Search → Re-rank → Generate Answer
 *
 * Auth: Required. The requesting user must own the document they
 * are querying. This is enforced at two levels:
 *   1. We verify session here and extract user.id
 *   2. The document fetch uses supabaseAdmin but checks user_id
 *      explicitly — belt-and-suspenders with RLS
 *
 * Request body:
 * {
 *   "query": "What is the termination clause?",
 *   "documentId": "uuid" (optional — searches all user's documents)
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ── 1. Authenticate the request ───────────────────────────────
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
    console.log(`💬 CHAT REQUEST`)
    console.log(`User: ${user.id}`)
    console.log(`Query: "${query}"`)
    console.log(`Document ID: ${documentId || 'all user documents'}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(80)}\n`)

    // ── 3. Fetch and verify document ownership ────────────────────
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
          { error: 'Document not found or not ready' },
          { status: 404 }
        )
      }

      // Ownership check — belt-and-suspenders alongside RLS
      if (document.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden. You do not have access to this document.' },
          { status: 403 }
        )
      }

      documentContext = {
        document_type: document.document_type || undefined,
        complexity_score: document.complexity_score || undefined,
        key_entities: document.key_entities || undefined,
      }

      console.log(`[Context] Document: ${document.name}`)
    }

    // ── 4. Query Analysis ─────────────────────────────────────────
    console.log('[Step 1/5] Analyzing query...')
    const analysis = await analyzeQuery(query, documentContext)
    console.log(`✓ Query type: ${analysis.query_type}`)

    // ── 5. Hybrid Search ──────────────────────────────────────────
    console.log('\n[Step 2/5] Performing hybrid search...')
    let searchResults = await hybridSearch(
      query,
      analysis,
      documentId || null,
      user.id  // scope search to this user's chunks only
    )
    searchResults = deduplicateResults(searchResults)
    console.log(`✓ ${searchResults.length} unique results`)

    if (searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        query,
        answer:
          "I couldn't find any relevant information in the document to answer this question.",
        confidence_score: 0,
        citations: [],
        message: 'No search results found',
      })
    }

    // ── 6. Re-ranking ─────────────────────────────────────────────
    console.log('\n[Step 3/5] Re-ranking results...')
    const rerankingResult = await rerankSearchResults(query, searchResults, 10)
    searchResults = rerankingResult.reranked_results
    console.log(`✓ Re-ranking complete`)

    // ── 7. Multi-Pass Answer Generation ──────────────────────────
    console.log('\n[Step 4/5] Generating answer (multi-pass)...')
    const multiPassResult = await generateMultiPassAnswer(
      query,
      searchResults.slice(0, 5)
    )
    console.log(`✓ Answer generated (${multiPassResult.total_passes} passes)`)

    // ── 8. Persist chat message ───────────────────────────────────
    // Store the exchange in chat_messages with user_id so history
    // is scoped to this user and RLS policies are satisfied.
    const { error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .insert([
        // User message
        {
          document_id: documentId || null,
          user_id: user.id,
          role: 'user',
          content: query,
          confidence: null,
          citations: null,
        },
        // Assistant message
        {
          document_id: documentId || null,
          user_id: user.id,
          role: 'assistant',
          content: multiPassResult.final_answer.answer,
          confidence: multiPassResult.final_answer.confidence_score,
          citations: multiPassResult.final_answer.citations,
        },
      ])

    if (msgError) {
      // Non-fatal — log but don't fail the response
      console.error('[Chat] Failed to persist message:', msgError.message)
    }

    // ── 9. Build response ─────────────────────────────────────────
    const totalDuration = Date.now() - startTime
    const totalCost =
      rerankingResult.cost_estimate + multiPassResult.cost_estimate

    console.log(`\n✅ Chat complete in ${(totalDuration / 1000).toFixed(2)}s — $${totalCost.toFixed(6)}`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      query,
      answer: multiPassResult.final_answer.answer,
      confidence_score: multiPassResult.final_answer.confidence_score,
      citations: multiPassResult.final_answer.citations,
      reasoning: multiPassResult.final_answer.reasoning,
      metadata: {
        query_type: analysis.query_type,
        sources_searched: searchResults.length,
        sources_used: multiPassResult.final_answer.sources_used,
        was_revised: multiPassResult.was_revised,
        total_passes: multiPassResult.total_passes,
        processing_time_ms: totalDuration,
        cost_estimate: totalCost,
      },
    })
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error(`\n❌ Chat failed after ${(duration / 1000).toFixed(2)}s: ${message}\n`)

    return NextResponse.json(
      { success: false, error: message, duration_ms: duration },
      { status: 500 }
    )
  }
}