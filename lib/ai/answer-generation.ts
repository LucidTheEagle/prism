import { openai, MODELS } from '@/lib/openai/client'
import type { SearchResult, Citation, AnswerGeneration } from '@/lib/types'
import { critiqueAnswer, type SelfCritique } from './self-critique'

export interface GenerationConfig {
  max_answer_length?: number
  citation_style?: 'inline' | 'endnotes'
  include_reasoning?: boolean
  temperature?: number
}

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  max_answer_length: 300,
  citation_style: 'inline',
  include_reasoning: true,
  temperature: 0.3,
}

// ============================================================================
// PASS 1: INITIAL ANSWER GENERATION
// ============================================================================

export async function generateInitialAnswer(
  query: string,
  searchResults: SearchResult[],
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG
): Promise<{ result: AnswerGeneration; tokens_input: number; tokens_output: number }> {
  const startTime = Date.now()

  console.log(`[Pass 1] Generating initial answer...`)
  console.log(`[Pass 1] Using ${searchResults.length} search results`)

  try {
    const context = searchResults
      .map((result, index) => {
        return `SOURCE ${index + 1}:
Page: ${result.metadata.page || 'unknown'}
Content: ${result.content}
Summary: ${result.ai_summary || 'N/A'}
Relevance: ${(result.reranked_score || result.combined_score).toFixed(3)}
---`
      })
      .join('\n\n')

    const prompt = `You are a precise document analyst. Answer the user's question using ONLY the provided sources.

USER QUESTION: "${query}"

SOURCES:
${context}

INSTRUCTIONS:
1. Answer the question directly and concisely (max ${config.max_answer_length} words)
2. Use ONLY information from the sources provided
3. Cite sources using [1], [2], [3] format inline
4. If information is incomplete, say so clearly
5. Do NOT make assumptions or add external knowledge
6. Include specific details (dates, amounts, terms) when present

ANSWER FORMAT:
{
  "answer": "Your comprehensive answer here with [1] citations [2] inline.",
  "citations": [
    {
      "source_number": 1,
      "reason": "Why this source was cited"
    }
  ],
  "confidence_score": 0.0-1.0,
  "reasoning": "Brief explanation of your answer approach"
}

CONFIDENCE SCORING:
- 0.9-1.0: Direct answer found in sources with multiple confirmations
- 0.7-0.9: Answer found but from single source or requires inference
- 0.5-0.7: Partial answer, missing some details
- Below 0.5: Insufficient information in sources

Return ONLY the JSON object, no markdown, no explanation.`

    const response = await openai.chat.completions.create({
      model: MODELS.GPT4O,
      messages: [
        {
          role: 'system',
          content: 'You are a precise document analyst. Return only valid JSON, no markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.temperature || 0.3,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from GPT-4')
    }

    const tokens_input = response.usage?.prompt_tokens ?? 0
    const tokens_output = response.usage?.completion_tokens ?? 0

    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleanedContent) as {
      answer: string
      citations: Array<{ source_number: number; reason: string }>
      confidence_score: number
      reasoning: string
    }

    const citations: Citation[] = parsed.citations.reduce<Citation[]>((acc, cite) => {
      const sourceIndex = cite.source_number - 1
      const source = searchResults[sourceIndex]

      if (source) {
        acc.push({
          chunk_id: source.id,
          document_id: source.document_id,
          text: source.content.slice(0, 200),
          page: source.metadata.page || 1,
          relevance: source.reranked_score || source.combined_score,
          ai_summary: source.ai_summary || undefined,
          chunk_index: source.chunk_index,
        })
      } else {
        console.warn(`[Pass 1] Invalid citation source: ${cite.source_number}`)
      }
      return acc
    }, [])

    const duration = Date.now() - startTime

    const result: AnswerGeneration = {
      answer: parsed.answer,
      confidence_score: parsed.confidence_score,
      citations,
      reasoning: parsed.reasoning,
      sources_used: citations.length,
      generation_time_ms: duration,
    }

    console.log(`[Pass 1] Complete (${duration}ms) | confidence: ${(result.confidence_score * 100).toFixed(0)}% | tokens: ${tokens_input}in/${tokens_output}out`)

    return { result, tokens_input, tokens_output }

  } catch (error) {
    console.error('[Pass 1] Generation error:', error)
    throw new Error('Failed to generate initial answer')
  }
}

// ============================================================================
// PASS 3: REFINEMENT
// ============================================================================

export async function refineAnswer(
  query: string,
  initialAnswer: AnswerGeneration,
  critique: SelfCritique,
  searchResults: SearchResult[]
): Promise<{ result: AnswerGeneration; tokens_input: number; tokens_output: number }> {
  const startTime = Date.now()

  console.log(`[Pass 3] Refining answer based on critique...`)

  try {
    const context = searchResults
      .map((result, index) => {
        return `SOURCE ${index + 1}:
Page: ${result.metadata.page || 'unknown'}
Content: ${result.content}
---`
      })
      .join('\n\n')

    const prompt = `You are refining an answer based on quality feedback.

ORIGINAL QUESTION: "${query}"

INITIAL ANSWER: "${initialAnswer.answer}"

CRITIQUE FEEDBACK:
${critique.suggested_improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}

Critique reasoning: ${critique.critique_reasoning}

SOURCES:
${context}

INSTRUCTIONS:
1. Address the critique's suggested improvements
2. Maintain or improve citation quality
3. Ensure accuracy and completeness
4. Keep answer concise but thorough
5. Use ONLY information from sources

Return ONLY a JSON object:
{
  "answer": "Refined answer with [1] citations [2]",
  "citations": [
    {
      "source_number": 1,
      "reason": "Why cited"
    }
  ],
  "confidence_score": 0.0-1.0,
  "reasoning": "What was improved"
}

Return ONLY the JSON object.`

    const response = await openai.chat.completions.create({
      model: MODELS.GPT4O,
      messages: [
        {
          role: 'system',
          content: 'You are a document analyst refining an answer. Return only valid JSON.',
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

    const tokens_input = response.usage?.prompt_tokens ?? 0
    const tokens_output = response.usage?.completion_tokens ?? 0

    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleanedContent) as {
      answer: string
      citations: Array<{ source_number: number; reason: string }>
      confidence_score: number
      reasoning: string
    }

    const citations: Citation[] = parsed.citations.reduce<Citation[]>((acc, cite) => {
      const sourceIndex = cite.source_number - 1
      const source = searchResults[sourceIndex]

      if (source) {
        acc.push({
          chunk_id: source.id,
          document_id: source.document_id,
          text: source.content.slice(0, 200),
          page: source.metadata.page || 1,
          relevance: source.reranked_score || source.combined_score,
          ai_summary: source.ai_summary || undefined,
          chunk_index: source.chunk_index,
        })
      }
      return acc
    }, [])

    const duration = Date.now() - startTime

    const result: AnswerGeneration = {
      answer: parsed.answer,
      confidence_score: parsed.confidence_score,
      citations,
      reasoning: parsed.reasoning,
      sources_used: citations.length,
      generation_time_ms: duration,
    }

    console.log(`[Pass 3] Complete (${duration}ms) | confidence: ${(result.confidence_score * 100).toFixed(0)}% | tokens: ${tokens_input}in/${tokens_output}out`)

    return { result, tokens_input, tokens_output }

  } catch (error) {
    console.error('[Pass 3] Refinement error, falling back to initial answer:', error)
    return { result: initialAnswer, tokens_input: 0, tokens_output: 0 }
  }
}

// ============================================================================
// MAIN MULTI-PASS FUNCTION
// ============================================================================

export interface MultiPassResult {
  initial_answer: AnswerGeneration
  critique: SelfCritique
  final_answer: AnswerGeneration
  total_passes: number
  was_revised: boolean
  total_time_ms: number
  cost_estimate: number
  tokens_input: number
  tokens_output: number
}

export async function generateMultiPassAnswer(
  query: string,
  searchResults: SearchResult[],
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG
): Promise<MultiPassResult> {
  const startTime = Date.now()

  console.log(`${'='.repeat(80)}`)
  console.log(`MULTI-PASS ANSWER GENERATION`)
  console.log(`Query: "${query}"`)
  console.log(`Sources: ${searchResults.length} chunks`)
  console.log(`${'='.repeat(80)}`)

  try {
    // Pass 1
    const { result: initialAnswer, tokens_input: p1in, tokens_output: p1out } =
      await generateInitialAnswer(query, searchResults, config)

    // Pass 2
    const critique = await critiqueAnswer(query, initialAnswer, searchResults)

    // Pass 3 — conditional
    let finalAnswer = initialAnswer
    let wasRevised = false
    let p3in = 0
    let p3out = 0

    if (critique.should_revise) {
      console.log(`[Decision] Critique score ${(critique.overall_score * 100).toFixed(0)}% — revising`)
      const { result: refined, tokens_input, tokens_output } =
        await refineAnswer(query, initialAnswer, critique, searchResults)
      finalAnswer = refined
      wasRevised = true
      p3in = tokens_input
      p3out = tokens_output
    } else {
      console.log(`[Decision] Critique score ${(critique.overall_score * 100).toFixed(0)}% — no revision needed`)
    }

    const totalTime = Date.now() - startTime
    const totalTokensInput = p1in + p3in
    const totalTokensOutput = p1out + p3out
    const costEstimate = estimateGenerationCost(searchResults.length, wasRevised)

    console.log(`${'='.repeat(80)}`)
    console.log(`MULTI-PASS COMPLETE | ${(totalTime / 1000).toFixed(2)}s | passes: ${wasRevised ? 3 : 2} | confidence: ${(finalAnswer.confidence_score * 100).toFixed(0)}% | tokens: ${totalTokensInput}in/${totalTokensOutput}out | cost: $${costEstimate.toFixed(6)}`)
    console.log(`${'='.repeat(80)}`)

    return {
      initial_answer: initialAnswer,
      critique,
      final_answer: finalAnswer,
      total_passes: wasRevised ? 3 : 2,
      was_revised: wasRevised,
      total_time_ms: totalTime,
      cost_estimate: costEstimate,
      tokens_input: totalTokensInput,
      tokens_output: totalTokensOutput,
    }

  } catch (error) {
    console.error('Multi-pass generation failed:', error)
    throw error
  }
}

function estimateGenerationCost(sourceCount: number, wasRevised: boolean): number {
  const pass1Cost = (sourceCount * 200 + 500) * 0.00001
  const pass2Cost = (sourceCount * 100 + 200) * 0.00001
  const pass3Cost = wasRevised ? (sourceCount * 200 + 500) * 0.00001 : 0
  return pass1Cost + pass2Cost + pass3Cost
}

export type { SelfCritique }