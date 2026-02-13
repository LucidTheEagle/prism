import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * PRISM Adaptive Chunking System
 * Intelligently splits document text based on AI analysis
 */

export interface ChunkResult {
  chunk_id: string
  content: string
  chunk_index: number
  metadata: {
    page: number
    start_char: number
    end_char: number
    section_header: string | null
  }
}

export interface ChunkingConfig {
  optimal_chunk_size: number
  overlap: number
  document_id: string
  full_text: string
  page_count: number
  section_headers: string[]
}

/**
 * Main chunking function
 * Splits document into optimally-sized chunks with metadata
 */
export async function chunkDocument(config: ChunkingConfig): Promise<ChunkResult[]> {
  const {
    optimal_chunk_size,
    overlap = 100, // Default 100 token overlap
    full_text,
    page_count,
    section_headers,
  } = config

  console.log(`[Chunking] Starting with size: ${optimal_chunk_size}, overlap: ${overlap}`)

  // Calculate characters per chunk (rough token estimate: 1 token ≈ 4 chars)
  const chunkSizeChars = optimal_chunk_size * 4
  const overlapChars = overlap * 4

  // Initialize LangChain splitter with smart separators
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSizeChars,
    chunkOverlap: overlapChars,
    separators: [
      '\n\n\n',  // Multiple blank lines (section breaks)
      '\n\n',    // Paragraph breaks
      '\n',      // Line breaks
      '. ',      // Sentence endings
      '! ',      // Exclamation sentences
      '? ',      // Question sentences
      '; ',      // Semicolons
      ', ',      // Commas (last resort)
      ' ',       // Spaces (absolute last resort)
      '',        // Character-level (emergency)
    ],
    lengthFunction: (text: string) => text.length,
  })

  // Split the text
  const textChunks = await splitter.splitText(full_text)
  console.log(`[Chunking] Created ${textChunks.length} chunks`)

  // Process chunks with metadata
  const chunks: ChunkResult[] = []
  let currentCharPosition = 0

  for (let i = 0; i < textChunks.length; i++) {
    const content = textChunks[i]
    
    // Find actual position in full text (accounting for overlap)
    const actualStartChar = full_text.indexOf(content, currentCharPosition)
    const actualEndChar = actualStartChar + content.length

    // Estimate page number (rough calculation)
    const estimatedPage = Math.max(1, Math.ceil((actualStartChar / full_text.length) * page_count))

    // Detect section header for this chunk
    const sectionHeader = detectSectionHeader(content, section_headers)

    chunks.push({
      chunk_id: `${i}`, // Temporary ID (will be replaced by database UUID)
      content: content.trim(),
      chunk_index: i,
      metadata: {
        page: estimatedPage,
        start_char: actualStartChar,
        end_char: actualEndChar,
        section_header: sectionHeader,
      },
    })

    // Update position (move forward by chunk size minus overlap)
    currentCharPosition = actualEndChar - overlapChars
  }

  return chunks
}

/**
 * Detect which section a chunk belongs to
 * Checks if chunk contains or follows a known section header
 */
function detectSectionHeader(
  chunkContent: string,
  sectionHeaders: string[]
): string | null {
  if (!sectionHeaders || sectionHeaders.length === 0) {
    return null
  }

  // Check if chunk starts with or contains a section header
  for (const header of sectionHeaders) {
    if (!header) continue

    // Normalize for comparison
    const normalizedChunk = chunkContent.toLowerCase().trim()
    const normalizedHeader = header.toLowerCase().trim()

    // Check if chunk starts with this header
    if (normalizedChunk.startsWith(normalizedHeader)) {
      return header
    }

    // Check if header appears in first 200 chars of chunk
    const chunkStart = normalizedChunk.slice(0, 200)
    if (chunkStart.includes(normalizedHeader)) {
      return header
    }
  }

  return null
}

/**
 * Store chunks in database
 * Inserts all chunks for a document in a single transaction
 */
export async function storeChunksInDatabase(
  documentId: string,
  chunks: ChunkResult[]
): Promise<void> {
  console.log(`[Chunking] Storing ${chunks.length} chunks in database...`)

  // Prepare chunk records for insertion
  const chunkRecords = chunks.map((chunk) => ({
    document_id: documentId,
    content: chunk.content,
    chunk_index: chunk.chunk_index,
    metadata: chunk.metadata,
    // Note: embedding, ai_summary, keywords will be added in later checkpoints
  }))

  // Insert all chunks in one batch
  const { error } = await supabaseAdmin
    .from('document_chunks')
    .insert(chunkRecords)

  if (error) {
    console.error('[Chunking] Database insertion error:', error)
    throw new Error(`Failed to store chunks: ${error.message}`)
  }

  console.log(`[Chunking] ✅ Successfully stored ${chunks.length} chunks`)
}

/**
 * Validate chunk quality
 * Ensures chunks meet minimum quality standards
 */
export function validateChunks(chunks: ChunkResult[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check minimum chunk count
  if (chunks.length === 0) {
    errors.push('No chunks created')
    return { valid: false, errors }
  }

  // Check each chunk
  for (const chunk of chunks) {
    // Minimum content length (50 chars)
    if (chunk.content.length < 50) {
      errors.push(`Chunk ${chunk.chunk_index} is too short (${chunk.content.length} chars)`)
    }

    // Maximum content length (shouldn't exceed 2x optimal size)
    if (chunk.content.length > 12000) {
      errors.push(`Chunk ${chunk.chunk_index} is too long (${chunk.content.length} chars)`)
    }

    // Check metadata exists
    if (!chunk.metadata) {
      errors.push(`Chunk ${chunk.chunk_index} missing metadata`)
    }
  }

  // If more than 10% of chunks have errors, fail validation
  const errorThreshold = Math.max(1, chunks.length * 0.1)
  if (errors.length > errorThreshold) {
    return { valid: false, errors }
  }

  // Minor errors are acceptable
  return { valid: true, errors }
}

/**
 * Get chunking statistics
 * Returns metrics about the chunking result
 */
export function getChunkingStats(chunks: ChunkResult[]): {
  total_chunks: number
  avg_chunk_size: number
  min_chunk_size: number
  max_chunk_size: number
  chunks_with_headers: number
} {
  if (chunks.length === 0) {
    return {
      total_chunks: 0,
      avg_chunk_size: 0,
      min_chunk_size: 0,
      max_chunk_size: 0,
      chunks_with_headers: 0,
    }
  }

  const chunkSizes = chunks.map((c) => c.content.length)
  const chunksWithHeaders = chunks.filter((c) => c.metadata.section_header !== null).length

  return {
    total_chunks: chunks.length,
    avg_chunk_size: Math.round(chunkSizes.reduce((a, b) => a + b, 0) / chunks.length),
    min_chunk_size: Math.min(...chunkSizes),
    max_chunk_size: Math.max(...chunkSizes),
    chunks_with_headers: chunksWithHeaders,
  }
}