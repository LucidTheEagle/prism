import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeQuery } from '@/lib/ai/query-analysis'
import { hybridSearch, deduplicateResults } from '@/lib/ai/hybrid-search'
import { rerankSearchResults } from '@/lib/ai/reranking'
import { generateMultiPassAnswer } from '@/lib/ai/answer-generation'

/**
 * POST /api/chat
 * 
 * Complete Q&A pipeline: Search → Re-rank → Generate Answer
 * 
 * Request body:
 * {
 *   "query": "What is the termination clause?",
 *   "documentId": "uuid" (optional)
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
    console.log(`💬 CHAT REQUEST`)
    console.log(`Query: "${query}"`)
    console.log(`Document ID: ${documentId || 'all documents'}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(80)}\n`)

    // Get document context if specified
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
          { error: 'Document not found or not ready' },
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

    // PIPELINE STEP 1: Query Analysis
    console.log('[Step 1/5] Analyzing query...')
    const analysis = await analyzeQuery(query, documentContext)
    console.log(`✓ Query type: ${analysis.query_type}`)

    // PIPELINE STEP 2: Hybrid Search
    console.log('\n[Step 2/5] Performing hybrid search...')
    let searchResults = await hybridSearch(query, analysis, documentId || null)
    searchResults = deduplicateResults(searchResults)
    console.log(`✓ Search complete: ${searchResults.length} unique results`)

    if (searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        query,
        answer: "I couldn't find any relevant information in the document to answer this question.",
        confidence_score: 0,
        citations: [],
        message: 'No search results found',
      })
    }

    // PIPELINE STEP 3: Re-Ranking
    console.log('\n[Step 3/5] Re-ranking results...')
    const rerankingResult = await rerankSearchResults(query, searchResults, 10)
    searchResults = rerankingResult.reranked_results
    console.log(`✓ Re-ranking complete`)

    // PIPELINE STEP 4: Multi-Pass Answer Generation
    console.log('\n[Step 4/5] Generating answer (multi-pass)...')
    const multiPassResult = await generateMultiPassAnswer(query, searchResults.slice(0, 5))
    console.log(`✓ Answer generated (${multiPassResult.total_passes} passes)`)

    // PIPELINE STEP 5: Build Response
    console.log('\n[Step 5/5] Building response...')
    const totalDuration = Date.now() - startTime
    const totalCost =
      rerankingResult.cost_estimate +
      multiPassResult.cost_estimate

    console.log(`\n✅ Chat complete in ${(totalDuration / 1000).toFixed(2)}s`)
    console.log(`Total cost: $${totalCost.toFixed(6)}`)
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
      // Debug info (remove in production)
      debug: {
        initial_answer: multiPassResult.initial_answer.answer,
        critique: multiPassResult.critique,
        initial_confidence: multiPassResult.initial_answer.confidence_score,
        final_confidence: multiPassResult.final_answer.confidence_score,
      },
    })

  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`\n❌ Chat failed after ${(duration / 1000).toFixed(2)}s`)
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