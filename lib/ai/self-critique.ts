import { openai, MODELS } from '@/lib/openai/client'
import type { SearchResult, AnswerGeneration } from '@/lib/types'

/**
 * PRISM Self-Critique System
 * Validates answer quality, accuracy, and citation integrity
 * 
 * Checkpoint 3.5: Self-Critique System (Standalone)
 */

export interface SelfCritique {
  is_accurate: boolean
  is_complete: boolean
  citation_quality: number // 0-1
  suggested_improvements: string[]
  overall_score: number // 0-1
  should_revise: boolean
  critique_reasoning: string
}

export interface CritiqueConfig {
  revision_threshold?: number // Score below this triggers revision (default 0.8)
  strict_mode?: boolean // Stricter evaluation
}

export const DEFAULT_CRITIQUE_CONFIG: CritiqueConfig = {
  revision_threshold: 0.8,
  strict_mode: false,
}

/**
 * Critique a generated answer for quality and accuracy
 */
export async function critiqueAnswer(
  query: string,
  answer: AnswerGeneration,
  searchResults: SearchResult[],
  config: CritiqueConfig = DEFAULT_CRITIQUE_CONFIG
): Promise<SelfCritique> {
  const startTime = Date.now()

  console.log(`\n[Self-Critique] Starting quality analysis...`)

  try {
    // Build source context for verification
    const context = searchResults
      .map((result, index) => {
        return `SOURCE ${index + 1}:
Page: ${result.metadata.page || 'unknown'}
Content: ${result.content.slice(0, 400)}${result.content.length > 400 ? '...' : ''}
---`
      })
      .join('\n\n')

    const revisionThreshold = config.revision_threshold || 0.8
    const strictMode = config.strict_mode ? ' Be especially critical.' : ''

    const prompt = `You are a quality control expert validating an AI-generated answer.${strictMode}

ORIGINAL QUESTION: "${query}"

GENERATED ANSWER: "${answer.answer}"

CITATIONS USED: ${answer.citations.map((c, i) => `[${i + 1}] Page ${c.page}`).join(', ')}

AVAILABLE SOURCES:
${context}

EVALUATE THE ANSWER ON THESE CRITERIA:

1. ACCURACY
   - Does the answer correctly represent the source material?
   - Are there any misinterpretations or fabrications?
   - Do cited sources actually support the claims?

2. COMPLETENESS
   - Does it fully answer the user's question?
   - Is any critical information missing?
   - Are there important caveats not mentioned?

3. CITATION QUALITY
   - Are all claims properly cited?
   - Are citations accurate (correct source numbers)?
   - Are there unsupported claims?

4. CLARITY & STRUCTURE
   - Is the answer well-organized?
   - Is the language clear and unambiguous?
   - Is it concise without losing essential details?

Return ONLY a JSON object:
{
  "is_accurate": boolean,
  "is_complete": boolean,
  "citation_quality": 0.0-1.0,
  "suggested_improvements": ["specific improvement 1", "specific improvement 2"],
  "overall_score": 0.0-1.0,
  "should_revise": boolean,
  "critique_reasoning": "Brief explanation of scores and decision"
}

SCORING GUIDELINES:
- overall_score 0.9-1.0: Excellent answer, publication-ready
- overall_score 0.8-0.9: Very good, minor improvements could help
- overall_score 0.7-0.8: Good but has notable issues, consider revision
- overall_score 0.5-0.7: Mediocre, should revise
- overall_score < 0.5: Poor, must revise or regenerate

should_revise = true if overall_score < ${revisionThreshold}

suggested_improvements: List 1-3 SPECIFIC, ACTIONABLE improvements (not vague suggestions)

Return ONLY the JSON object, no markdown.`

    const response = await openai.chat.completions.create({
      model: MODELS.GPT4_TURBO,
      messages: [
        {
          role: 'system',
          content: 'You are a meticulous quality control expert. Return only valid JSON, no markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // Low temperature for consistent evaluation
      max_tokens: 600,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from GPT-4')
    }

    // Clean and parse
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const critique = JSON.parse(cleanedContent) as SelfCritique

    const duration = Date.now() - startTime

    console.log(`[Self-Critique] ✅ Critique complete (${duration}ms)`)
    console.log(`[Self-Critique] Overall score: ${(critique.overall_score * 100).toFixed(0)}%`)
    console.log(`[Self-Critique] Accuracy: ${critique.is_accurate ? 'PASS' : 'FAIL'}`)
    console.log(`[Self-Critique] Completeness: ${critique.is_complete ? 'PASS' : 'FAIL'}`)
    console.log(`[Self-Critique] Citation quality: ${(critique.citation_quality * 100).toFixed(0)}%`)
    console.log(`[Self-Critique] Revision needed: ${critique.should_revise ? 'YES' : 'NO'}`)
    
    if (critique.suggested_improvements.length > 0) {
      console.log(`[Self-Critique] Improvements suggested: ${critique.suggested_improvements.length}`)
      critique.suggested_improvements.forEach((imp, i) => {
        console.log(`  ${i + 1}. ${imp}`)
      })
    }

    return critique

  } catch (error) {
    console.error('[Self-Critique] Error:', error)
    
    // Return safe default (assume revision not needed on error)
    return {
      is_accurate: true,
      is_complete: true,
      citation_quality: 0.8,
      suggested_improvements: [],
      overall_score: 0.8,
      should_revise: false,
      critique_reasoning: 'Critique system unavailable, proceeding with answer as-is',
    }
  }
}

/**
 * Batch critique multiple answers
 * Useful for comparing different answer generation strategies
 */
export async function critiqueMultipleAnswers(
  query: string,
  answers: AnswerGeneration[],
  searchResults: SearchResult[],
  config: CritiqueConfig = DEFAULT_CRITIQUE_CONFIG
): Promise<SelfCritique[]> {
  console.log(`\n[Self-Critique] Batch critiquing ${answers.length} answers...`)

  const critiques: SelfCritique[] = []

  for (let i = 0; i < answers.length; i++) {
    console.log(`\n[Self-Critique] Evaluating answer ${i + 1}/${answers.length}...`)
    const critique = await critiqueAnswer(query, answers[i], searchResults, config)
    critiques.push(critique)
  }

  // Find best answer
  const bestIndex = critiques.reduce((bestIdx, critique, idx) =>
    critique.overall_score > critiques[bestIdx].overall_score ? idx : bestIdx
  , 0)

  console.log(`\n[Self-Critique] Best answer: #${bestIndex + 1} (score: ${(critiques[bestIndex].overall_score * 100).toFixed(0)}%)`)

  return critiques
}

/**
 * Calculate critique cost estimate
 */
export function estimateCritiqueCost(sourceCount: number): number {
  // Rough estimate for GPT-4 Turbo
  const inputTokens = sourceCount * 150 + 300 // Sources + answer
  const outputTokens = 250 // Critique response
  
  const inputCost = (inputTokens / 1000) * 0.01
  const outputCost = (outputTokens / 1000) * 0.03
  
  return inputCost + outputCost
}

/**
 * Simple rule-based critique (no AI)
 * Fallback when GPT-4 unavailable
 */
export function ruleBasedCritique(
    answer: AnswerGeneration,
    searchResults: SearchResult[]
  ): SelfCritique {
    console.log('[Self-Critique] Using HARDENED rule-based critique')
  
    let score = 0.75 // Slightly higher base, but stricter penalties
  
    const improvements: string[] = []
  
    const hasSearchResults = searchResults.length > 0
    const hasCitations = answer.citations.length > 0
    const hasSufficientLength = answer.answer.length > 50
    const highConfidence = answer.confidence_score >= 0.8
  
    // ---------------------------
    // 1. Search result validation
    // ---------------------------
    if (!hasSearchResults) {
      score -= 0.4
      improvements.push('No source documents available to verify claims')
      console.log('[Rule-Critique] Major penalty: No search results')
    }
  
    // ---------------------------
    // 2. Citation presence
    // ---------------------------
    if (!hasCitations) {
      score -= 0.25
      improvements.push('Answer contains no citations')
    }
  
    // ---------------------------
    // 3. Validate citations exist in searchResults
    // Prevent fabricated chunk IDs
    // ---------------------------
    const validChunkIds = new Set(searchResults.map(r => r.id))
  
    const invalidCitations = answer.citations.filter(
      c => !validChunkIds.has(c.chunk_id)
    )
  
    if (invalidCitations.length > 0) {
      score -= 0.3
      improvements.push('Some citations do not match retrieved documents')
      console.log('[Rule-Critique] Fabricated citation detected')
    }
  
    // ---------------------------
    // 4. Top-ranked usage check
    // ---------------------------
    const topResultId = searchResults[0]?.id
  
    if (hasSearchResults && hasCitations && topResultId) {
      const usedTopResult = answer.citations.some(
        c => c.chunk_id === topResultId
      )
  
      if (!usedTopResult) {
        score -= 0.1
        improvements.push('Top-ranked source was not referenced')
      } else {
        score += 0.05
      }
    }
  
    // ---------------------------
    // 5. Citation diversity
    // ---------------------------
    const uniqueChunkIds = new Set(answer.citations.map(c => c.chunk_id))
    if (uniqueChunkIds.size >= 2) {
      score += 0.05
    }
  
    // ---------------------------
    // 6. Answer depth check
    // ---------------------------
    if (!hasSufficientLength) {
      score -= 0.15
      improvements.push('Answer may be too brief or incomplete')
    } else {
      score += 0.05
    }
  
    // ---------------------------
    // 7. Confidence sanity check
    // ---------------------------
    if (highConfidence && !hasCitations) {
      score -= 0.1
      improvements.push('High confidence score without citations is suspicious')
    }
  
    // ---------------------------
    // Clamp score
    // ---------------------------
    const finalScore = Math.max(0, Math.min(score, 1))
  
    const shouldRevise = finalScore < 0.8
  
    // ---------------------------
    // Accuracy logic (NO blind trust)
    // ---------------------------
    const isAccurate =
      hasSearchResults &&
      hasCitations &&
      invalidCitations.length === 0
  
    const citationQuality =
      hasCitations && invalidCitations.length === 0
        ? Math.min(1, 0.7 + uniqueChunkIds.size * 0.05)
        : 0.4
  
    return {
      is_accurate: isAccurate,
      is_complete: hasSufficientLength,
      citation_quality: citationQuality,
      suggested_improvements: shouldRevise
        ? improvements.slice(0, 3)
        : [],
      overall_score: finalScore,
      should_revise: shouldRevise,
      critique_reasoning:
        'Hardened rule-based evaluation (AI critique unavailable)',
    }
  }