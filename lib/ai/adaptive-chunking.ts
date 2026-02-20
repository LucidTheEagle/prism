import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * PRISM Adaptive Chunking System
 * Intelligently splits document text based on AI analysis
 *
 * Phase 5.2 update: storeChunksInDatabase now accepts userId and stamps
 * it on every chunk row so RLS ownership policies are satisfied.
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

export async function chunkDocument(config: ChunkingConfig): Promise<ChunkResult[]> {
  const {
    optimal_chunk_size,
    overlap = 100,
    full_text,
    page_count,
    section_headers,
  } = config

  console.log(`[Chunking] Starting — size: ${optimal_chunk_size}, overlap: ${overlap}`)

  const chunkSizeChars = optimal_chunk_size * 4
  const overlapChars = overlap * 4

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSizeChars,
    chunkOverlap: overlapChars,
    separators: [
      '\n\n\n',
      '\n\n',
      '\n',
      '. ',
      '! ',
      '? ',
      '; ',
      ', ',
      ' ',
      '',
    ],
    lengthFunction: (text: string) => text.length,
  })

  const textChunks = await splitter.splitText(full_text)
  console.log(`[Chunking] ${textChunks.length} chunks created`)

  const chunks: ChunkResult[] = []
  let currentCharPosition = 0

  for (let i = 0; i < textChunks.length; i++) {
    const content = textChunks[i]
    const actualStartChar = full_text.indexOf(content, currentCharPosition)
    const actualEndChar = actualStartChar + content.length
    const estimatedPage = Math.max(
      1,
      Math.ceil((actualStartChar / full_text.length) * page_count)
    )
    const sectionHeader = detectSectionHeader(content, section_headers)

    chunks.push({
      chunk_id: `${i}`,
      content: content.trim(),
      chunk_index: i,
      metadata: {
        page: estimatedPage,
        start_char: actualStartChar,
        end_char: actualEndChar,
        section_header: sectionHeader,
      },
    })

    currentCharPosition = actualEndChar - overlapChars
  }

  return chunks
}

function detectSectionHeader(
  chunkContent: string,
  sectionHeaders: string[]
): string | null {
  if (!sectionHeaders || sectionHeaders.length === 0) return null

  const normalizedChunk = chunkContent.toLowerCase().trim()

  for (const header of sectionHeaders) {
    if (!header) continue
    const normalizedHeader = header.toLowerCase().trim()
    if (normalizedChunk.startsWith(normalizedHeader)) return header
    if (normalizedChunk.slice(0, 200).includes(normalizedHeader)) return header
  }

  return null
}

/**
 * Store chunks in database.
 *
 * Phase 5.2: Added userId parameter — stamped on every chunk row so
 * the RLS policy "chunks: users select own" (auth.uid() = user_id)
 * resolves correctly when the authenticated user queries their chunks.
 *
 * Uses supabaseAdmin (bypasses RLS) because this runs server-side
 * inside the ingestion pipeline — not from a user browser session.
 */
export async function storeChunksInDatabase(
  documentId: string,
  chunks: ChunkResult[],
  userId: string              // ← Phase 5.2: required for RLS ownership
): Promise<void> {
  console.log(`[Chunking] Storing ${chunks.length} chunks (user: ${userId})...`)

  const chunkRecords = chunks.map((chunk) => ({
    document_id: documentId,
    user_id: userId,           // ← stamped on every row
    content: chunk.content,
    chunk_index: chunk.chunk_index,
    metadata: chunk.metadata,
  }))

  const { error } = await supabaseAdmin
    .from('document_chunks')
    .insert(chunkRecords)

  if (error) {
    console.error('[Chunking] DB insertion error:', error)
    throw new Error(`Failed to store chunks: ${error.message}`)
  }

  console.log(`[Chunking] ✅ ${chunks.length} chunks stored`)
}

export function validateChunks(chunks: ChunkResult[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (chunks.length === 0) {
    errors.push('No chunks created')
    return { valid: false, errors }
  }

  for (const chunk of chunks) {
    if (chunk.content.length < 50) {
      errors.push(`Chunk ${chunk.chunk_index} too short (${chunk.content.length} chars)`)
    }
    if (chunk.content.length > 12000) {
      errors.push(`Chunk ${chunk.chunk_index} too long (${chunk.content.length} chars)`)
    }
    if (!chunk.metadata) {
      errors.push(`Chunk ${chunk.chunk_index} missing metadata`)
    }
  }

  const errorThreshold = Math.max(1, chunks.length * 0.1)
  if (errors.length > errorThreshold) {
    return { valid: false, errors }
  }

  return { valid: true, errors }
}

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

  const sizes = chunks.map((c) => c.content.length)

  return {
    total_chunks: chunks.length,
    avg_chunk_size: Math.round(sizes.reduce((a, b) => a + b, 0) / chunks.length),
    min_chunk_size: Math.min(...sizes),
    max_chunk_size: Math.max(...sizes),
    chunks_with_headers: chunks.filter((c) => c.metadata.section_header !== null).length,
  }
}