import { openai, MODELS } from '@/lib/openai/client'

/**
 * PRISM Query Analysis System
 * Analyzes user queries to determine optimal search strategy
 *
 * Checkpoint 3.1: Query Analysis System
 * Phase 5.2 fix: Lowered confidence_threshold range from 0.5–0.9 → 0.3–0.7
 * so vector search actually returns results at realistic similarity scores.
 */

export type QueryType = 'factual' | 'conceptual' | 'comparative' | 'extractive'

export interface QueryAnalysis {
  // Query Classification
  query_type: QueryType
  requires_exact_match: boolean
  temporal_context: boolean
  needs_cross_reference: boolean

  // Search Strategy
  vector_weight: number       // 0–1 (higher = more semantic)
  bm25_weight: number         // 0–1 (higher = more keyword)
  chunk_count: number         // 5–20 chunks to retrieve
  confidence_threshold: number // 0.3–0.7 (was 0.5–0.9, too strict)

  // Context Metadata
  detected_entities: string[]
  key_terms: string[]
  temporal_indicators: string[]

  // Reasoning (for debugging/transparency)
  reasoning: string
}

/**
 * Analyze a user query to determine optimal search strategy.
 * Uses GPT-4 to understand query intent and complexity.
 */
export async function analyzeQuery(
  query: string,
  documentContext?: {
    document_type?: string
    complexity_score?: number
    key_entities?: string[]
  }
): Promise<QueryAnalysis> {
  const prompt = `Analyze this search query and determine the optimal search strategy.

USER QUERY: "${query}"

${documentContext ? `DOCUMENT CONTEXT:
- Type: ${documentContext.document_type || 'unknown'}
- Complexity: ${documentContext.complexity_score || 5}/10
- Key entities: ${documentContext.key_entities?.join(', ') || 'none'}
` : ''}

Return ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "query_type": "factual|conceptual|comparative|extractive",
  "requires_exact_match": boolean,
  "temporal_context": boolean,
  "needs_cross_reference": boolean,
  "vector_weight": 0.0-1.0,
  "bm25_weight": 0.0-1.0,
  "chunk_count": 5-20,
  "confidence_threshold": 0.3-0.7,
  "detected_entities": ["entity1", "entity2"],
  "key_terms": ["term1", "term2"],
  "temporal_indicators": ["date1", "deadline1"],
  "reasoning": "brief explanation of strategy"
}

RULES FOR CLASSIFICATION:

query_type:
- "factual": Simple fact lookup (Who? What? When? How much?)
  Example: "What is the payment term?"
- "conceptual": Requires understanding/explanation (Why? How? Explain?)
  Example: "Explain the termination process"
- "comparative": Comparing multiple items/sections
  Example: "Compare sections 3 and 5"
- "extractive": Listing/extracting multiple items
  Example: "List all dates mentioned"

requires_exact_match:
- true: Legal terms, specific amounts, dates, names
- false: General concepts, explanations

temporal_context:
- true: Query involves dates, deadlines, timelines
- false: No time-related aspects

needs_cross_reference:
- true: Answer likely spans multiple sections
- false: Answer in single location

vector_weight (semantic similarity):
- 0.8-1.0: Conceptual queries, explanations
- 0.6-0.8: Mixed queries
- 0.3-0.6: Factual with some context
- 0.0-0.3: Exact term lookup

bm25_weight (keyword matching):
- 0.8-1.0: Exact term lookup, legal phrases
- 0.6-0.8: Factual queries
- 0.3-0.6: Mixed queries
- 0.0-0.3: Pure conceptual

chunk_count:
- 5-8: Simple factual queries
- 8-12: Standard queries
- 12-15: Complex/comparative queries
- 15-20: Extractive/comprehensive queries

confidence_threshold (IMPORTANT — keep these low, embeddings rarely score above 0.7):
- 0.6-0.7: Exact matches required (legal terms, specific numbers)
- 0.5-0.6: Standard factual queries
- 0.4-0.5: Mixed or exploratory queries
- 0.3-0.4: Broad conceptual queries

detected_entities: People, companies, amounts, dates found in query
key_terms: Important keywords that must be matched
temporal_indicators: Any dates, deadlines, time periods mentioned

RESPOND WITH ONLY THE JSON OBJECT.`

  try {
    const response = await openai.chat.completions.create({
      model: MODELS.GPT4_TURBO,
      messages: [
        {
          role: 'system',
          content: 'You are a query analysis expert. Return only valid JSON, no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Strip any accidental markdown fences
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const analysis = JSON.parse(cleanedContent) as QueryAnalysis

    // Normalize weights so they sum to 1.0
    const totalWeight = analysis.vector_weight + analysis.bm25_weight
    if (totalWeight > 0) {
      analysis.vector_weight = analysis.vector_weight / totalWeight
      analysis.bm25_weight = analysis.bm25_weight / totalWeight
    } else {
      analysis.vector_weight = 0.7
      analysis.bm25_weight = 0.3
    }

    // Clamp chunk count
    analysis.chunk_count = Math.min(Math.max(analysis.chunk_count, 5), 20)

    // ✅ FIX: threshold range is now 0.3–0.7 (was 0.5–0.9 — too strict)
    analysis.confidence_threshold = Math.min(Math.max(analysis.confidence_threshold, 0.3), 0.7)

    console.log(`[Query Analysis] Type: ${analysis.query_type}`)
    console.log(`[Query Analysis] Weights: Vector ${(analysis.vector_weight * 100).toFixed(0)}% / BM25 ${(analysis.bm25_weight * 100).toFixed(0)}%`)
    console.log(`[Query Analysis] Chunks: ${analysis.chunk_count}, Threshold: ${analysis.confidence_threshold}`)

    return analysis

  } catch (error) {
    console.error('[Query Analysis] Error:', error)
    return getFallbackAnalysis(query)
  }
}

/**
 * Fallback query analysis (rule-based, no AI).
 * Used when GPT-4 analysis fails.
 */
export function getFallbackAnalysis(query: string): QueryAnalysis {
  const lowerQuery = query.toLowerCase()

  // Detect query type
  let queryType: QueryType = 'factual'
  if (lowerQuery.includes('explain') || lowerQuery.includes('why') || lowerQuery.includes('how does')) {
    queryType = 'conceptual'
  } else if (lowerQuery.includes('compare') || lowerQuery.includes('difference') || lowerQuery.includes('versus')) {
    queryType = 'comparative'
  } else if (lowerQuery.includes('list') || lowerQuery.includes('all') || lowerQuery.includes('every')) {
    queryType = 'extractive'
  }

  const requiresExactMatch = /\$[\d,]+|section \d+|clause \d+|article \d+/i.test(query)
  const temporalContext = /date|deadline|when|timeline|schedule|term|period/i.test(query)
  const needsCrossReference = queryType === 'comparative' || queryType === 'extractive'

  // Weights
  let vectorWeight = 0.7
  let bm25Weight = 0.3
  if (queryType === 'conceptual') {
    vectorWeight = 0.8
    bm25Weight = 0.2
  } else if (requiresExactMatch) {
    vectorWeight = 0.4
    bm25Weight = 0.6
  }

  // Chunk count
  let chunkCount = 10
  if (queryType === 'factual') chunkCount = 8
  else if (queryType === 'comparative' || queryType === 'extractive') chunkCount = 15

  // ✅ FIX: thresholds lowered across the board
  // Old values: exact=0.8, conceptual=0.6, default=0.7 — all too strict
  let confidenceThreshold = 0.45
  if (requiresExactMatch) {
    confidenceThreshold = 0.55
  } else if (queryType === 'conceptual') {
    confidenceThreshold = 0.35
  } else if (queryType === 'comparative' || queryType === 'extractive') {
    confidenceThreshold = 0.4
  }

  const keyTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 3)
    .slice(0, 5)

  return {
    query_type: queryType,
    requires_exact_match: requiresExactMatch,
    temporal_context: temporalContext,
    needs_cross_reference: needsCrossReference,
    vector_weight: vectorWeight,
    bm25_weight: bm25Weight,
    chunk_count: chunkCount,
    confidence_threshold: confidenceThreshold,
    detected_entities: [],
    key_terms: keyTerms,
    temporal_indicators: [],
    reasoning: 'Fallback rule-based analysis (AI analysis unavailable)',
  }
}

/**
 * Get query complexity score (1–10).
 */
export function getQueryComplexity(analysis: QueryAnalysis): number {
  const typeComplexity: Record<QueryType, number> = {
    factual: 3,
    conceptual: 7,
    comparative: 8,
    extractive: 9,
  }

  let complexity = typeComplexity[analysis.query_type]
  if (analysis.needs_cross_reference) complexity += 2
  if (analysis.requires_exact_match) complexity += 1

  return Math.min(Math.max(complexity, 1), 10)
}

/**
 * Estimate query processing time based on complexity.
 */
export function estimateQueryTime(analysis: QueryAnalysis): {
  search_time_ms: number
  answer_time_ms: number
  total_time_ms: number
} {
  const complexity = getQueryComplexity(analysis)

  const searchTime = 500 + analysis.chunk_count * 50
  const answerTime = 2000 + complexity * 200

  return {
    search_time_ms: searchTime,
    answer_time_ms: answerTime,
    total_time_ms: searchTime + answerTime,
  }
}

/**
 * Format query analysis for logging/debugging.
 */
export function formatAnalysisForLogging(analysis: QueryAnalysis): string {
  const complexity = getQueryComplexity(analysis)
  const estimate = estimateQueryTime(analysis)

  return `
Query Analysis:
  Type: ${analysis.query_type} (complexity: ${complexity}/10)
  Strategy: ${(analysis.vector_weight * 100).toFixed(0)}% semantic + ${(analysis.bm25_weight * 100).toFixed(0)}% keyword
  Retrieval: ${analysis.chunk_count} chunks, ${(analysis.confidence_threshold * 100).toFixed(0)}% threshold
  Flags: ${[
    analysis.requires_exact_match ? 'exact-match' : '',
    analysis.temporal_context ? 'temporal' : '',
    analysis.needs_cross_reference ? 'cross-ref' : '',
  ].filter(Boolean).join(', ') || 'none'}
  Estimated time: ~${(estimate.total_time_ms / 1000).toFixed(1)}s
  Reasoning: ${analysis.reasoning}
`.trim()
}