import { supabaseAdmin } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import type { SearchResult, QueryAnalysis } from '@/lib/types'

/**
 * PRISM Hybrid Search Engine
 * Combines vector semantic search with BM25 keyword search
 * 
 * Checkpoint 3.2: Hybrid Search Engine
 */

// ============================================================================
// VECTOR SEARCH (Semantic Similarity)
// ============================================================================

/**
 * Generate embedding for search query
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float',
    })

    const embedding = response.data[0].embedding

    if (embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimension: ${embedding.length}`)
    }

    return embedding

  } catch (error) {
    console.error('[Search] Failed to generate query embedding:', error)
    throw new Error('Failed to generate search embedding')
  }
}

/**
 * Perform vector similarity search using pgvector
 */
export async function vectorSearch(
  queryEmbedding: number[],
  documentId: string | null,
  limit: number,
  threshold: number = 0.3
): Promise<SearchResult[]> {
  try {
    console.log(`[Vector Search] Searching with threshold ${threshold}, limit ${limit}`)

    // Build RPC call to PostgreSQL function
    const { data, error } = await supabaseAdmin.rpc('match_documents_vector', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_document_id: documentId,
    })

    if (error) {
      console.error('[Vector Search] Database error:', error)
      throw new Error(`Vector search failed: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log('[Vector Search] No results found')
      return []
    }

    // Transform to SearchResult format
    const results: SearchResult[] = data.map((row: {
      id: string
      document_id: string
      content: string
      metadata: unknown
      similarity: number
      ai_summary?: string
      keywords?: string[]
      semantic_category?: string
    }) => ({
      id: row.id,
      document_id: row.document_id,
      content: row.content,
      chunk_index: (row.metadata && typeof row.metadata === 'object' && 'chunk_index' in row.metadata)
        ? (row.metadata as { chunk_index?: number }).chunk_index || 0
        : 0,
      metadata: row.metadata || {},
      ai_summary: row.ai_summary || null,
      keywords: row.keywords || [],
      semantic_category: row.semantic_category || null,
      vector_similarity: row.similarity,
      bm25_rank: 0, // Will be filled by BM25 search
      combined_score: row.similarity, // Will be recalculated in fusion
    }))

    console.log(`[Vector Search] Found ${results.length} results`)
    return results

  } catch (error) {
    console.error('[Vector Search] Error:', error)
    throw error
  }
}

// ============================================================================
// BM25 KEYWORD SEARCH (Full-Text Search)
// ============================================================================

/**
 * Perform BM25 full-text search using PostgreSQL tsvector
 */
export async function bm25Search(
  query: string,
  documentId: string | null,
  limit: number
): Promise<SearchResult[]> {
  try {
    console.log(`[BM25 Search] Searching for: "${query}", limit ${limit}`)

    // Build RPC call to PostgreSQL function
    const { data, error } = await supabaseAdmin.rpc('match_documents_bm25', {
      query_text: query,
      match_count: limit,
      filter_document_id: documentId,
    })

    if (error) {
      console.error('[BM25 Search] Database error:', error)
      throw new Error(`BM25 search failed: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log('[BM25 Search] No results found')
      return []
    }

    // Transform to SearchResult format
    const results: SearchResult[] = data.map((row: {
      id: string
      document_id: string
      content: string
      metadata: unknown
      rank: number
      ai_summary?: string
      keywords?: string[]
      semantic_category?: string
    }) => ({
      id: row.id,
      document_id: row.document_id,
      content: row.content,
      chunk_index: (row.metadata && typeof row.metadata === 'object' && 'chunk_index' in row.metadata)
        ? (row.metadata as { chunk_index?: number }).chunk_index || 0
        : 0,
      metadata: row.metadata || {},
      ai_summary: row.ai_summary || null,
      keywords: row.keywords || [],
      semantic_category: row.semantic_category || null,
      vector_similarity: 0, // Will be filled by vector search
      bm25_rank: row.rank,
      combined_score: row.rank, // Will be recalculated in fusion
    }))

    console.log(`[BM25 Search] Found ${results.length} results`)
    return results

  } catch (error) {
    console.error('[BM25 Search] Error:', error)
    throw error
  }
}

// ============================================================================
// RECIPROCAL RANK FUSION (RRF)
// ============================================================================

/**
 * Combine vector and BM25 results using Reciprocal Rank Fusion
 * RRF formula: score = sum(1 / (k + rank_i)) for each ranking
 * k = 60 is standard constant
 */
export function reciprocalRankFusion(
  vectorResults: SearchResult[],
  bm25Results: SearchResult[],
  vectorWeight: number = 0.7,
  bm25Weight: number = 0.3
): SearchResult[] {
  const k = 60 // RRF constant
  const scoreMap = new Map<string, {
    result: SearchResult
    vectorRank: number
    bm25Rank: number
    vectorScore: number
    bm25Score: number
  }>()

  // Process vector results
  vectorResults.forEach((result, index) => {
    const rank = index + 1
    const score = 1 / (k + rank)
    
    scoreMap.set(result.id, {
      result: { ...result },
      vectorRank: rank,
      bm25Rank: 0,
      vectorScore: score,
      bm25Score: 0,
    })
  })

  // Process BM25 results
  bm25Results.forEach((result, index) => {
    const rank = index + 1
    const score = 1 / (k + rank)
    
    const existing = scoreMap.get(result.id)
    if (existing) {
      // Result appears in both - update BM25 info
      existing.bm25Rank = rank
      existing.bm25Score = score
      // Merge any missing fields
      if (!existing.result.ai_summary && result.ai_summary) {
        existing.result.ai_summary = result.ai_summary
      }
      if (existing.result.keywords.length === 0 && result.keywords.length > 0) {
        existing.result.keywords = result.keywords
      }
    } else {
      // New result only in BM25
      scoreMap.set(result.id, {
        result: { ...result },
        vectorRank: 0,
        bm25Rank: rank,
        vectorScore: 0,
        bm25Score: score,
      })
    }
  })

  // Calculate combined scores with weights
  const fusedResults: SearchResult[] = Array.from(scoreMap.values()).map(item => {
    const combinedScore = 
      (item.vectorScore * vectorWeight) + 
      (item.bm25Score * bm25Weight)
    
    return {
      ...item.result,
      combined_score: combinedScore,
    }
  })

  // Sort by combined score (highest first)
  fusedResults.sort((a, b) => b.combined_score - a.combined_score)

  console.log(`[RRF] Fused ${fusedResults.length} unique results`)
  console.log(`[RRF] Weights: Vector ${(vectorWeight * 100).toFixed(0)}% / BM25 ${(bm25Weight * 100).toFixed(0)}%`)

  return fusedResults
}

// ============================================================================
// MAIN HYBRID SEARCH FUNCTION
// ============================================================================

/**
 * Perform hybrid search combining vector and BM25
 */
export async function hybridSearch(
  query: string,
  analysis: QueryAnalysis,
  documentId: string | null = null
): Promise<SearchResult[]> {
  const startTime = Date.now()

  try {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔍 HYBRID SEARCH`)
    console.log(`Query: "${query}"`)
    console.log(`Strategy: ${(analysis.vector_weight * 100).toFixed(0)}% vector + ${(analysis.bm25_weight * 100).toFixed(0)}% BM25`)
    console.log(`Target chunks: ${analysis.chunk_count}`)
    console.log(`${'='.repeat(80)}\n`)

    // Step 1: Generate query embedding for vector search
    console.log('[Step 1/4] Generating query embedding...')
    const queryEmbedding = await generateQueryEmbedding(query)
    console.log('✓ Embedding generated (1536 dimensions)')

    // Step 2: Perform vector search
    console.log('\n[Step 2/4] Vector similarity search...')
    const vectorResults = await vectorSearch(
      queryEmbedding,
      documentId,
      analysis.chunk_count * 2, // Get 2x for better fusion
      analysis.confidence_threshold
    )
    console.log(`✓ Vector search complete: ${vectorResults.length} results`)

    // Step 3: Perform BM25 keyword search
    console.log('\n[Step 3/4] BM25 keyword search...')
    const bm25Results = await bm25Search(
      query,
      documentId,
      analysis.chunk_count * 2 // Get 2x for better fusion
    )
    console.log(`✓ BM25 search complete: ${bm25Results.length} results`)

    // Step 4: Fusion ranking
    console.log('\n[Step 4/4] Reciprocal Rank Fusion...')
    const fusedResults = reciprocalRankFusion(
      vectorResults,
      bm25Results,
      analysis.vector_weight,
      analysis.bm25_weight
    )

    // Limit to requested chunk count
    const finalResults = fusedResults.slice(0, analysis.chunk_count)

    const duration = Date.now() - startTime
    console.log(`\n✅ Hybrid search complete`)
    console.log(`Results: ${finalResults.length}/${analysis.chunk_count} requested`)
    console.log(`Duration: ${duration}ms`)
    console.log(`${'='.repeat(80)}\n`)

    return finalResults

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`\n❌ Hybrid search failed after ${duration}ms`)
    console.error(error)
    throw error
  }
}

// ============================================================================
// SEARCH RESULT UTILITIES
// ============================================================================

/**
 * Format search results for citation display
 */
export function formatResultsForCitations(results: SearchResult[]): Array<{
  chunk_id: string
  document_id: string
  text: string
  page: number
  relevance: number
  ai_summary: string | null
  chunk_index: number
}> {
  return results.map(result => ({
    chunk_id: result.id,
    document_id: result.document_id,
    text: result.content,
    page: result.metadata.page || 1,
    relevance: result.combined_score,
    ai_summary: result.ai_summary,
    chunk_index: result.chunk_index,
  }))
}

/**
 * Calculate search quality metrics
 */
export function calculateSearchMetrics(results: SearchResult[]): {
  avg_combined_score: number
  avg_vector_similarity: number
  avg_bm25_rank: number
  results_with_summaries: number
  unique_pages: number
} {
  if (results.length === 0) {
    return {
      avg_combined_score: 0,
      avg_vector_similarity: 0,
      avg_bm25_rank: 0,
      results_with_summaries: 0,
      unique_pages: 0,
    }
  }

  const avgCombined = results.reduce((sum, r) => sum + r.combined_score, 0) / results.length
  const avgVector = results.reduce((sum, r) => sum + r.vector_similarity, 0) / results.length
  const avgBm25 = results.reduce((sum, r) => sum + r.bm25_rank, 0) / results.length
  const withSummaries = results.filter(r => r.ai_summary && r.ai_summary.length > 0).length
  const uniquePages = new Set(results.map(r => r.metadata.page || 0)).size

  return {
    avg_combined_score: avgCombined,
    avg_vector_similarity: avgVector,
    avg_bm25_rank: avgBm25,
    results_with_summaries: withSummaries,
    unique_pages: uniquePages,
  }
}

/**
 * Filter results by minimum score threshold
 */
export function filterByScore(
  results: SearchResult[],
  minScore: number
): SearchResult[] {
  return results.filter(r => r.combined_score >= minScore)
}

/**
 * Deduplicate results (remove exact duplicates by content)
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return results.filter(result => {
    // Use first 200 chars as fingerprint
    const fingerprint = result.content.slice(0, 200).toLowerCase().trim()
    if (seen.has(fingerprint)) {
      return false
    }
    seen.add(fingerprint)
    return true
  })
}