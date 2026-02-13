import { openai } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * PRISM Embedding Generation System
 * Generates vector embeddings for document chunks using OpenAI
 */

export interface EmbeddingResult {
  chunk_id: string
  embedding: number[]
  tokens_used: number
}

export interface EmbeddingStats {
  total_chunks: number
  successful_embeddings: number
  failed_embeddings: number
  total_tokens: number
  estimated_cost: number
  processing_time_ms: number
}

/**
 * Generate embeddings for a single chunk
 * Used for individual chunk processing or retries
 */
export async function generateEmbedding(text: string): Promise<{
  embedding: number[]
  tokens: number
}> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions
      input: text,
      encoding_format: 'float',
    })

    const embedding = response.data[0].embedding
    const tokens = response.usage.total_tokens

    // Validate embedding dimensions
    if (embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimension: ${embedding.length} (expected 1536)`)
    }

    return {
      embedding,
      tokens,
    }
  } catch (error) {
    console.error('[Embeddings] Generation error:', error)
    throw error
  }
}

/**
 * Generate embeddings for multiple chunks in batch
 * Processes up to 100 chunks at once (OpenAI batch limit)
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<EmbeddingResult[]> {
  const BATCH_SIZE = 100

  if (texts.length > BATCH_SIZE) {
    throw new Error(`Batch size ${texts.length} exceeds limit of ${BATCH_SIZE}`)
  }

  try {
    console.log(`[Embeddings] Generating batch of ${texts.length} embeddings...`)

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float',
    })

    // Map results back to chunk IDs
    const results: EmbeddingResult[] = response.data.map((item, index) => ({
      chunk_id: index.toString(), // Temporary ID, will be replaced
      embedding: item.embedding,
      tokens_used: Math.ceil(response.usage.total_tokens / texts.length), // Estimate per chunk
    }))

    console.log(`[Embeddings] Batch complete: ${results.length} embeddings generated`)

    return results
  } catch (error) {
    console.error('[Embeddings] Batch generation error:', error)
    throw error
  }
}

/**
 * Generate embeddings for all chunks of a document
 * Main function called from ingestion pipeline
 */
export async function generateDocumentEmbeddings(
  documentId: string
): Promise<EmbeddingStats> {
  const startTime = Date.now()
  let totalTokens = 0
  let successfulEmbeddings = 0
  let failedEmbeddings = 0

  console.log(`[Embeddings] Starting embedding generation for document: ${documentId}`)

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

    console.log(`[Embeddings] Found ${chunks.length} chunks to process`)

    // 2. Process in batches of 100
    const BATCH_SIZE = 100
    const batches = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      batches.push(batch)
    }

    console.log(`[Embeddings] Processing ${batches.length} batch(es)...`)

    // 3. Generate embeddings for each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`[Embeddings] Batch ${batchIndex + 1}/${batches.length}: ${batch.length} chunks`)

      try {
        // Extract text content
        const texts = batch.map((chunk) => chunk.content)

        // Generate embeddings with retry logic
        const embeddings = await retryWithBackoff(
          () => generateEmbeddingsBatch(texts),
          3, // Max retries
          1000 // Initial delay (ms)
        )

        // 4. Store embeddings in database
        for (let i = 0; i < batch.length; i++) {
          const chunk = batch[i]
          const embedding = embeddings[i]

          try {
            const { error: updateError } = await supabaseAdmin
              .from('document_chunks')
              .update({
                embedding: embedding.embedding, // PostgreSQL vector type
              })
              .eq('id', chunk.id)

            if (updateError) {
              console.error(`[Embeddings] Failed to update chunk ${chunk.id}:`, updateError)
              failedEmbeddings++
            } else {
              successfulEmbeddings++
              totalTokens += embedding.tokens_used
            }
          } catch (error) {
            console.error(`[Embeddings] Error updating chunk ${chunk.id}:`, error)
            failedEmbeddings++
          }
        }
      } catch (error) {
        console.error(`[Embeddings] Batch ${batchIndex + 1} failed:`, error)
        failedEmbeddings += batch.length
      }
    }

    // 5. Calculate statistics
    const processingTime = Date.now() - startTime
    const estimatedCost = calculateEmbeddingCost(totalTokens)

    const stats: EmbeddingStats = {
      total_chunks: chunks.length,
      successful_embeddings: successfulEmbeddings,
      failed_embeddings: failedEmbeddings,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
      processing_time_ms: processingTime,
    }

    console.log(`[Embeddings] ✅ Complete:`, stats)

    return stats

  } catch (error) {
    console.error('[Embeddings] Document embedding generation failed:', error)
    throw error
  }
}

/**
 * Retry function with exponential backoff
 * Handles rate limiting and temporary API failures
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelay: number
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt) // Exponential backoff
        console.log(`[Embeddings] Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`)
        await sleep(delay)
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError?.message}`)
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate estimated cost for embeddings
 * text-embedding-3-small: $0.00002 per 1K tokens
 */
export function calculateEmbeddingCost(tokens: number): number {
  const COST_PER_1K_TOKENS = 0.00002
  return (tokens / 1000) * COST_PER_1K_TOKENS
}

/**
 * Validate embedding vector
 * Ensures correct dimensions and no NaN values
 */
export function validateEmbedding(embedding: number[]): {
  valid: boolean
  error?: string
} {
  // Check dimension
  if (embedding.length !== 1536) {
    return {
      valid: false,
      error: `Invalid dimension: ${embedding.length} (expected 1536)`,
    }
  }

  // Check for NaN or Infinity
  if (embedding.some((val) => !isFinite(val))) {
    return {
      valid: false,
      error: 'Embedding contains NaN or Infinity values',
    }
  }

  // Check for all zeros (suspicious)
  if (embedding.every((val) => val === 0)) {
    return {
      valid: false,
      error: 'Embedding is all zeros',
    }
  }

  return { valid: true }
}

/**
 * Get embedding statistics for a document
 * Used for monitoring and debugging
 */
export async function getEmbeddingStats(documentId: string): Promise<{
  total_chunks: number
  chunks_with_embeddings: number
  chunks_without_embeddings: number
  completion_percentage: number
}> {
  const { data: chunks, error } = await supabaseAdmin
    .from('document_chunks')
    .select('id, embedding')
    .eq('document_id', documentId)

  if (error || !chunks) {
    throw new Error('Failed to fetch chunk statistics')
  }

  const totalChunks = chunks.length
  const chunksWithEmbeddings = chunks.filter((c) => c.embedding !== null).length
  const chunksWithoutEmbeddings = totalChunks - chunksWithEmbeddings

  return {
    total_chunks: totalChunks,
    chunks_with_embeddings: chunksWithEmbeddings,
    chunks_without_embeddings: chunksWithoutEmbeddings,
    completion_percentage: totalChunks > 0 
      ? Math.round((chunksWithEmbeddings / totalChunks) * 100) 
      : 0,
  }
}