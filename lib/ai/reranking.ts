import { openai, MODELS } from '@/lib/openai/client'
import type { SearchResult } from '@/lib/types'

/**
 * PRISM Intelligent Re-Ranking System
 * Uses GPT-4 to re-score search results based on relevance and quality
 * 
 * Checkpoint 3.3: Intelligent Re-Ranking
 */

export interface ReRankingScore {
  chunk_id: string
  relevance_score: number      // 0-1 (how well it answers the query)
  quality_score: number         // 0-1 (information completeness)
  citation_score: number        // 0-1 (citability/verifiability)
  diversity_bonus: number       // 0-0.2 (bonus for unique pages/sections)
  final_score: number           // Combined reranked score
  reasoning: string             // Why this score
}

export interface ReRankingResult {
  reranked_results: SearchResult[]
  scores: ReRankingScore[]
  processing_time_ms: number
  cost_estimate: number
}

/**
 * Re-rank search results using GPT-4
 * Batch processes multiple results for efficiency
 */
export async function rerankSearchResults(
  query: string,
  results: SearchResult[],
  topK: number = 10
): Promise<ReRankingResult> {
  const startTime = Date.now()

  if (results.length === 0) {
    return {
      reranked_results: [],
      scores: [],
      processing_time_ms: 0,
      cost_estimate: 0,
    }
  }

  console.log(`\n[Re-Ranking] Starting AI re-ranking for ${results.length} results...`)

  try {
    // Limit to top K results for re-ranking (save cost)
    const resultsToRerank = results.slice(0, topK)

    // Build prompt with all results
    const resultsContext = resultsToRerank.map((result, index) => {
      return `RESULT ${index + 1}:
ID: ${result.id}
Content: ${result.content.slice(0, 500)}${result.content.length > 500 ? '...' : ''}
AI Summary: ${result.ai_summary || 'N/A'}
Keywords: ${result.keywords.join(', ') || 'N/A'}
Category: ${result.semantic_category || 'N/A'}
Page: ${result.metadata.page || 'unknown'}
Initial Score: ${result.combined_score.toFixed(3)}
---`
    }).join('\n\n')

    const prompt = `You are a search relevance expert. Re-rank these search results based on their relevance to the user's query.

USER QUERY: "${query}"

SEARCH RESULTS:
${resultsContext}

For EACH result, analyze:
1. RELEVANCE: How well does it answer the query? (0.0 - 1.0)
2. QUALITY: Is the information complete and useful? (0.0 - 1.0)
3. CITATION: Can this be cited with confidence? (0.0 - 1.0)
4. REASONING: Brief explanation (1 sentence)

Return ONLY a JSON array (no markdown, no explanation) with ${resultsToRerank.length} objects:
[
  {
    "chunk_id": "result-id-here",
    "relevance_score": 0.0-1.0,
    "quality_score": 0.0-1.0,
    "citation_score": 0.0-1.0,
    "reasoning": "brief explanation"
  },
  ...
]

SCORING GUIDELINES:
- relevance_score: 1.0 = perfect answer, 0.5 = partial answer, 0.0 = irrelevant
- quality_score: 1.0 = complete info, 0.5 = fragment, 0.0 = useless
- citation_score: 1.0 = highly citable, 0.5 = questionable, 0.0 = can't cite

Return EXACTLY ${resultsToRerank.length} scores in the same order as results.
RESPOND WITH ONLY THE JSON ARRAY.`

    const response = await openai.chat.completions.create({
      model: MODELS.GPT4_TURBO,
      messages: [
        {
          role: 'system',
          content: 'You are a search relevance expert. Return only valid JSON arrays, no markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from GPT-4')
    }

    // Clean and parse response
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const aiScores = JSON.parse(cleanedContent) as Array<{
      chunk_id: string
      relevance_score: number
      quality_score: number
      citation_score: number
      reasoning: string
    }>

    // Calculate diversity bonuses
    const diversityBonuses = calculateDiversityBonuses(resultsToRerank)

    // Build final scores
    const scores: ReRankingScore[] = resultsToRerank.map((result, index) => {
      const aiScore = aiScores[index] || {
        chunk_id: result.id,
        relevance_score: 0.5,
        quality_score: 0.5,
        citation_score: 0.5,
        reasoning: 'AI scoring unavailable',
      }

      const diversityBonus = diversityBonuses.get(result.id) || 0

      // Calculate final score (weighted average + diversity)
      const finalScore =
        aiScore.relevance_score * 0.5 +   // 50% relevance
        aiScore.quality_score * 0.25 +    // 25% quality
        aiScore.citation_score * 0.15 +   // 15% citation
        result.combined_score * 0.1 +     // 10% original score
        diversityBonus                     // 0-0.2 bonus

      return {
        chunk_id: result.id,
        relevance_score: aiScore.relevance_score,
        quality_score: aiScore.quality_score,
        citation_score: aiScore.citation_score,
        diversity_bonus: diversityBonus,
        final_score: finalScore,
        reasoning: aiScore.reasoning,
      }
    })

    // Re-rank results by final score
    const scoreMap = new Map(scores.map(s => [s.chunk_id, s]))
    const rerankedResults = [...resultsToRerank]
      .map(result => ({
        ...result,
        reranked_score: scoreMap.get(result.id)?.final_score || result.combined_score,
      }))
      .sort((a, b) => b.reranked_score - a.reranked_score)

    const processingTime = Date.now() - startTime
    const costEstimate = estimateReRankingCost(resultsToRerank.length)

    console.log(`[Re-Ranking] ✅ Complete in ${processingTime}ms`)
    console.log(`[Re-Ranking] Top result: ${rerankedResults[0].id.slice(0, 8)}... (score: ${rerankedResults[0].reranked_score?.toFixed(3)})`)
    console.log(`[Re-Ranking] Cost estimate: $${costEstimate.toFixed(6)}`)

    return {
      reranked_results: rerankedResults,
      scores,
      processing_time_ms: processingTime,
      cost_estimate: costEstimate,
    }

  } catch (error) {
    console.error('[Re-Ranking] Error:', error)
    
    // Fallback: return original ranking
    console.log('[Re-Ranking] Falling back to original ranking')
    return {
      reranked_results: results.slice(0, topK),
      scores: [],
      processing_time_ms: Date.now() - startTime,
      cost_estimate: 0,
    }
  }
}

/**
 * Calculate diversity bonuses
 * Rewards results from different pages/sections
 */
function calculateDiversityBonuses(results: SearchResult[]): Map<string, number> {
  const bonuses = new Map<string, number>()
  const seenPages = new Set<number>()
  const seenSections = new Set<string>()

  for (const result of results) {
    let bonus = 0

    // Page diversity (0.1 bonus for new page)
    const page = result.metadata.page || 0
    if (!seenPages.has(page)) {
      bonus += 0.1
      seenPages.add(page)
    }

    // Section diversity (0.1 bonus for new section)
    const section = result.metadata.section_header || result.semantic_category || 'unknown'
    if (!seenSections.has(section)) {
      bonus += 0.1
      seenSections.add(section)
    }

    bonuses.set(result.id, Math.min(bonus, 0.2)) // Cap at 0.2
  }

  return bonuses
}

/**
 * Estimate re-ranking cost
 * GPT-4 Turbo: ~$0.01 per 1K input tokens, ~$0.03 per 1K output tokens
 */
function estimateReRankingCost(resultCount: number): number {
  // Rough estimate: 500 tokens per result + 500 output
  const inputTokens = resultCount * 500
  const outputTokens = resultCount * 100
  
  const inputCost = (inputTokens / 1000) * 0.01
  const outputCost = (outputTokens / 1000) * 0.03
  
  return inputCost + outputCost
}

/**
 * Simple re-ranking without AI (rule-based fallback)
 * Uses heuristics instead of GPT-4
 */
export function rerankWithoutAI(
  query: string,
  results: SearchResult[]
): SearchResult[] {
  console.log('[Re-Ranking] Using rule-based re-ranking (no AI)')

  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 3)

  return results.map(result => {
    let score = result.combined_score

    // Boost for AI summary
    if (result.ai_summary && result.ai_summary.length > 20) {
      score += 0.1
    }

    // Boost for keyword matches
    const keywordMatches = result.keywords.filter(kw =>
      queryTerms.some(qt => kw.toLowerCase().includes(qt))
    ).length
    score += keywordMatches * 0.05

    // Boost for semantic category match
    if (result.semantic_category && queryTerms.some(qt => 
      result.semantic_category?.toLowerCase().includes(qt)
    )) {
      score += 0.05
    }

    return {
      ...result,
      reranked_score: score,
    }
  }).sort((a, b) => (b.reranked_score || 0) - (a.reranked_score || 0))
}

/**
 * Apply diversity-based re-ranking
 * Ensures results come from different pages/sections
 */
export function applyDiversityReRanking(results: SearchResult[]): SearchResult[] {
  console.log('[Re-Ranking] Applying diversity optimization...')

  const reranked: SearchResult[] = []
  const remainingResults = [...results]
  const seenPages = new Set<number>()
  const seenSections = new Set<string>()

  // First pass: pick one from each unique page/section
  while (remainingResults.length > 0 && reranked.length < results.length) {
    let bestIndex = -1
    let bestScore = -1

    for (let i = 0; i < remainingResults.length; i++) {
      const result = remainingResults[i]
      const page = result.metadata.page || 0
      const section = result.metadata.section_header || result.semantic_category || ''

      // Calculate diversity score
      let diversityScore = result.combined_score
      if (!seenPages.has(page)) diversityScore += 0.2
      if (!seenSections.has(section)) diversityScore += 0.2

      if (diversityScore > bestScore) {
        bestScore = diversityScore
        bestIndex = i
      }
    }

    if (bestIndex >= 0) {
      const selected = remainingResults.splice(bestIndex, 1)[0]
      reranked.push({
        ...selected,
        reranked_score: bestScore,
      })

      seenPages.add(selected.metadata.page || 0)
      if (selected.metadata.section_header) {
        seenSections.add(selected.metadata.section_header)
      }
    } else {
      break
    }
  }

  console.log(`[Re-Ranking] Diversity re-ranking complete: ${seenPages.size} unique pages`)
  return reranked
}

/**
 * Get re-ranking statistics
 */
export function getReRankingStats(
  originalResults: SearchResult[],
  rerankedResults: SearchResult[]
): {
  position_changes: number
  avg_score_change: number
  top_result_changed: boolean
} {
  let positionChanges = 0
  let totalScoreChange = 0

  const originalOrder = new Map(originalResults.map((r, i) => [r.id, i]))

  rerankedResults.forEach((result, newIndex) => {
    const oldIndex = originalOrder.get(result.id)
    if (oldIndex !== undefined && oldIndex !== newIndex) {
      positionChanges++
    }

    const oldScore = result.combined_score
    const newScore = result.reranked_score || oldScore
    totalScoreChange += Math.abs(newScore - oldScore)
  })

  const topResultChanged = originalResults[0]?.id !== rerankedResults[0]?.id

  return {
    position_changes: positionChanges,
    avg_score_change: totalScoreChange / rerankedResults.length,
    top_result_changed: topResultChanged,
  }
}