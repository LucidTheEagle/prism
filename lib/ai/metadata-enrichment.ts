import { openai, MODELS } from '@/lib/openai/client'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * PRISM Metadata Enrichment System
 * Enriches document chunks with AI-generated summaries, keywords, and categories
 */

export interface ChunkEnrichment {
  chunk_id: string
  ai_summary: string
  keywords: string[]
  semantic_category: string
}

export interface EnrichmentStats {
  total_chunks: number
  successful_enrichments: number
  failed_enrichments: number
  total_tokens: number
  estimated_cost: number
  processing_time_ms: number
}

export interface EnrichmentConfig {
  enable_summaries: boolean
  enable_keywords: boolean
  enable_categories: boolean
  batch_size: number
}

// Default configuration
export const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig = {
  enable_summaries: true,
  enable_keywords: true,
  enable_categories: true,
  batch_size: 5, // Process 5 chunks per API call (cost optimization)
}

/**
 * Semantic categories for document chunks
 * Used to classify chunk content type
 */
export const SEMANTIC_CATEGORIES = [
  'introduction',
  'definition',
  'obligation',
  'right',
  'limitation',
  'procedure',
  'timeline',
  'payment',
  'termination',
  'dispute_resolution',
  'general_provision',
  'signature',
  'other',
] as const

export type SemanticCategory = typeof SEMANTIC_CATEGORIES[number]

/**
 * Enrich a single chunk with AI-generated metadata
 * Used for individual processing or retries
 */
export async function enrichChunk(content: string): Promise<ChunkEnrichment> {
  const prompt = `Analyze this document chunk and provide metadata in JSON format.

CHUNK TEXT:
${content.slice(0, 2000)} ${content.length > 2000 ? '...[truncated]' : ''}

Return ONLY a JSON object (no markdown, no explanation) with:
{
  "summary": "1-2 sentence summary of main point",
  "keywords": ["keyword1", "keyword2", ...],
  "category": "one of: introduction, definition, obligation, right, limitation, procedure, timeline, payment, termination, dispute_resolution, general_provision, signature, other"
}

RULES:
- summary: Max 2 sentences, capture essence
- keywords: 5-10 most important terms (lowercase, no duplicates)
- category: Best fit from list above

RESPOND WITH ONLY THE JSON OBJECT.`

  try {
    const response = await openai.chat.completions.create({
      model: MODELS.GPT4_TURBO,
      messages: [
        {
          role: 'system',
          content: 'You are a document analysis expert. Return only valid JSON, no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistency
      max_tokens: 300, // Summaries are short
    })

    const content_response = response.choices[0]?.message?.content
    if (!content_response) {
      throw new Error('No response from OpenAI')
    }

    // Clean response (remove markdown if present)
    const cleanedContent = content_response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Parse JSON
    const parsed = JSON.parse(cleanedContent)

    return {
      chunk_id: '', // Will be set by caller
      ai_summary: parsed.summary || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
      semantic_category: parsed.category || 'other',
    }
  } catch (error) {
    console.error('[Enrichment] Single chunk enrichment error:', error)
    // Return safe defaults
    return {
      chunk_id: '',
      ai_summary: '',
      keywords: [],
      semantic_category: 'other',
    }
  }
}

/**
 * Enrich multiple chunks in batch (COST OPTIMIZATION)
 * Processes 5 chunks per GPT-4 call instead of 5 separate calls
 */
export async function enrichChunksBatch(
  chunks: Array<{ id: string; content: string }>
): Promise<ChunkEnrichment[]> {
  if (chunks.length === 0) {
    return []
  }

  // Prepare batch prompt with all chunks
  const chunksText = chunks
    .map(
      (chunk, index) =>
        `CHUNK ${index + 1} (ID: ${chunk.id}):
${chunk.content.slice(0, 1500)}${chunk.content.length > 1500 ? '...[truncated]' : ''}
---`
    )
    .join('\n')

  const prompt = `Analyze these ${chunks.length} document chunks and provide metadata for each.

${chunksText}

Return ONLY a JSON array (no markdown, no explanation) with ${chunks.length} objects:
[
  {
    "chunk_id": "chunk-id-here",
    "summary": "1-2 sentence summary",
    "keywords": ["keyword1", "keyword2", ...],
    "category": "one of: introduction, definition, obligation, right, limitation, procedure, timeline, payment, termination, dispute_resolution, general_provision, signature, other"
  },
  ...
]

RULES:
- Return exactly ${chunks.length} objects in same order as chunks
- summary: Max 2 sentences
- keywords: 5-10 most important terms
- category: Best fit from list

RESPOND WITH ONLY THE JSON ARRAY.`

  try {
    console.log(`[Enrichment] Batch processing ${chunks.length} chunks...`)

    const response = await openai.chat.completions.create({
      model: MODELS.GPT4_TURBO,
      messages: [
        {
          role: 'system',
          content: 'You are a document analysis expert. Return only valid JSON arrays, no markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500 * chunks.length, // Scale with batch size
    })

    const content_response = response.choices[0]?.message?.content
    if (!content_response) {
      throw new Error('No response from OpenAI')
    }

    // Clean response
    const cleanedContent = content_response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Parse JSON array
    const parsed = JSON.parse(cleanedContent)

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array')
    }

    // Map results to chunks
    const enrichments: ChunkEnrichment[] = chunks.map((chunk, index) => {
      const result = parsed[index] || {}
      return {
        chunk_id: chunk.id,
        ai_summary: result.summary || '',
        keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 10) : [],
        semantic_category: result.category || 'other',
      }
    })

    console.log(`[Enrichment] Batch complete: ${enrichments.length} chunks enriched`)
    return enrichments

  } catch (error) {
    console.error('[Enrichment] Batch enrichment error:', error)
    
    // Return safe defaults for all chunks
    return chunks.map((chunk) => ({
      chunk_id: chunk.id,
      ai_summary: '',
      keywords: [],
      semantic_category: 'other',
    }))
  }
}

/**
 * Enrich all chunks for a document
 * Main function called from ingestion pipeline
 */
export async function enrichDocumentChunks(
  documentId: string,
  config: EnrichmentConfig = DEFAULT_ENRICHMENT_CONFIG
): Promise<EnrichmentStats> {
  const startTime = Date.now()
  let totalTokens = 0
  let successfulEnrichments = 0
  let failedEnrichments = 0

  console.log(`[Enrichment] Starting metadata enrichment for document: ${documentId}`)
  console.log(`[Enrichment] Config:`, config)

  // Check if enrichment is enabled
  if (!config.enable_summaries && !config.enable_keywords && !config.enable_categories) {
    console.log(`[Enrichment] All enrichment features disabled, skipping`)
    return {
      total_chunks: 0,
      successful_enrichments: 0,
      failed_enrichments: 0,
      total_tokens: 0,
      estimated_cost: 0,
      processing_time_ms: Date.now() - startTime,
    }
  }

  try {
    // 1. Fetch all chunks for this document
    const { data: chunks, error: fetchError } = await supabaseAdmin
      .from('document_chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .order('chunk_index')

    if (fetchError || !chunks || chunks.length === 0) {
      throw new Error('No chunks found for document')
    }

    console.log(`[Enrichment] Found ${chunks.length} chunks to enrich`)

    // 2. Process in batches (cost optimization)
    const batchSize = config.batch_size
    const batches: Array<typeof chunks> = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      batches.push(batch)
    }

    console.log(`[Enrichment] Processing ${batches.length} batch(es) of ${batchSize} chunks each`)

    // 3. Enrich each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`[Enrichment] Batch ${batchIndex + 1}/${batches.length}: ${batch.length} chunks`)

      try {
        // Get enrichments for this batch
        const enrichments = await enrichChunksBatch(batch)

        // Estimate tokens (rough: 500 tokens per chunk in + 100 out)
        totalTokens += batch.length * 600

        // 4. Store enrichments in database
        for (const enrichment of enrichments) {
          try {
            const updateData: Record<string, unknown> = {}

            if (config.enable_summaries && enrichment.ai_summary) {
              updateData.ai_summary = enrichment.ai_summary
            }

            if (config.enable_keywords && enrichment.keywords.length > 0) {
              updateData.keywords = enrichment.keywords
            }

            if (config.enable_categories && enrichment.semantic_category) {
              updateData.semantic_category = enrichment.semantic_category
            }

            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabaseAdmin
                .from('document_chunks')
                .update(updateData)
                .eq('id', enrichment.chunk_id)

              if (updateError) {
                console.error(`[Enrichment] Failed to update chunk ${enrichment.chunk_id}:`, updateError)
                failedEnrichments++
              } else {
                successfulEnrichments++
              }
            }
          } catch (error) {
            console.error(`[Enrichment] Error updating chunk ${enrichment.chunk_id}:`, error)
            failedEnrichments++
          }
        }
      } catch (error) {
        console.error(`[Enrichment] Batch ${batchIndex + 1} failed:`, error)
        failedEnrichments += batch.length
      }

      // Small delay between batches to avoid rate limits
      if (batchIndex < batches.length - 1) {
        await sleep(500) // 500ms delay
      }
    }

    // 5. Calculate statistics
    const processingTime = Date.now() - startTime
    const estimatedCost = calculateEnrichmentCost(totalTokens)

    const stats: EnrichmentStats = {
      total_chunks: chunks.length,
      successful_enrichments: successfulEnrichments,
      failed_enrichments: failedEnrichments,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
      processing_time_ms: processingTime,
    }

    console.log(`[Enrichment] ✅ Complete:`, stats)

    return stats

  } catch (error) {
    console.error('[Enrichment] Document enrichment failed:', error)
    throw error
  }
}

/**
 * Sleep utility for batch delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate estimated cost for enrichment
 * GPT-4 Turbo: ~$0.01 per 1K input tokens, ~$0.03 per 1K output tokens
 * Average: ~$0.015 per 1K tokens
 */
export function calculateEnrichmentCost(tokens: number): number {
  const COST_PER_1K_TOKENS = 0.015 // Conservative estimate
  return (tokens / 1000) * COST_PER_1K_TOKENS
}

/**
 * Get enrichment statistics for a document
 */
export async function getEnrichmentStats(documentId: string): Promise<{
  total_chunks: number
  chunks_with_summaries: number
  chunks_with_keywords: number
  chunks_with_categories: number
  completion_percentage: number
}> {
  const { data: chunks, error } = await supabaseAdmin
    .from('document_chunks')
    .select('id, ai_summary, keywords, semantic_category')
    .eq('document_id', documentId)

  if (error || !chunks) {
    throw new Error('Failed to fetch enrichment statistics')
  }

  const totalChunks = chunks.length
  const chunksWithSummaries = chunks.filter((c) => c.ai_summary !== null && c.ai_summary !== '').length
  const chunksWithKeywords = chunks.filter((c) => c.keywords && c.keywords.length > 0).length
  const chunksWithCategories = chunks.filter((c) => c.semantic_category !== null).length

  // Calculate completion as average of all features
  const completionScores = [
    chunksWithSummaries / totalChunks,
    chunksWithKeywords / totalChunks,
    chunksWithCategories / totalChunks,
  ]
  const avgCompletion = completionScores.reduce((a, b) => a + b, 0) / completionScores.length

  return {
    total_chunks: totalChunks,
    chunks_with_summaries: chunksWithSummaries,
    chunks_with_keywords: chunksWithKeywords,
    chunks_with_categories: chunksWithCategories,
    completion_percentage: Math.round(avgCompletion * 100),
  }
}