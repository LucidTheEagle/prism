import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { ADIParagraph } from '@/lib/pdfParser'

// ============================================================================
// PRISM ADAPTIVE CHUNKING — V1
// Sprint 3 update: chunkDocument now accepts paragraphs[] from Azure Document
// Intelligence. Each chunk's page number is assigned from the ADI paragraph
// whose character range contains the chunk's start position — exact page
// numbers, not character position estimates.
//
// Previous estimate formula archived below.
// ============================================================================

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
  paragraphs: ADIParagraph[]    // ADI paragraphs with exact page numbers
}

// ----------------------------------------------------------------------------
// buildPageMap — maps character ranges to exact ADI page numbers
// Called once before chunking. Each entry covers [start_char, end_char).
// When a chunk's start_char falls within a range, that page number is used.
// ----------------------------------------------------------------------------
interface PageRange {
  start_char: number
  end_char: number
  page_number: number
  section_header: string | null
}

function buildPageMap(fullText: string, paragraphs: ADIParagraph[]): PageRange[] {
  const pageMap: PageRange[] = []
  let searchFrom = 0

  for (const para of paragraphs) {
    if (!para.content || para.content.trim().length === 0) continue

    // Locate paragraph in full text by content match
    const idx = fullText.indexOf(para.content.trim(), searchFrom)
    if (idx === -1) continue

    const startChar = idx
    const endChar = idx + para.content.trim().length

    pageMap.push({
      start_char: startChar,
      end_char: endChar,
      page_number: para.page_number,
      section_header: para.section_header,
    })

    // Advance search position — allow overlap for adjacent paragraphs
    searchFrom = Math.max(searchFrom, endChar - 50)
  }

  return pageMap
}

// ----------------------------------------------------------------------------
// resolvePageFromMap — find which ADI paragraph a chunk start falls within
// Falls back to page 1 if no match found — safe default
// ----------------------------------------------------------------------------
function resolvePageFromMap(
  startChar: number,
  pageMap: PageRange[]
): { page_number: number; section_header: string | null } {
  // Find the paragraph range containing this character position
  for (const range of pageMap) {
    if (startChar >= range.start_char && startChar < range.end_char) {
      return {
        page_number: range.page_number,
        section_header: range.section_header,
      }
    }
  }

  // No exact match — find the closest preceding paragraph
  let closest: PageRange | null = null
  for (const range of pageMap) {
    if (range.start_char <= startChar) {
      if (!closest || range.start_char > closest.start_char) {
        closest = range
      }
    }
  }

  if (closest) {
    return {
      page_number: closest.page_number,
      section_header: closest.section_header,
    }
  }

  return { page_number: 1, section_header: null }
}

// ----------------------------------------------------------------------------
// chunkDocument — main export
// ----------------------------------------------------------------------------
export async function chunkDocument(config: ChunkingConfig): Promise<ChunkResult[]> {
  const {
    optimal_chunk_size,
    overlap = 100,
    full_text,
    page_count,
    section_headers,
    paragraphs,
  } = config

  console.log(`[Chunking] Starting — size: ${optimal_chunk_size}, overlap: ${overlap}`)
  console.log(`[Chunking] ADI paragraphs available: ${paragraphs.length}`)

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

  // Build page map from ADI paragraphs once — used for all chunks
  const pageMap = buildPageMap(full_text, paragraphs)
  const useADIPageMap = pageMap.length > 0

  if (useADIPageMap) {
    console.log(`[Chunking] Using ADI page map — ${pageMap.length} paragraph ranges`)
  } else {
    console.log(`[Chunking] ADI page map empty — falling back to character position estimate`)
  }

  const chunks: ChunkResult[] = []
  let currentCharPosition = 0

  for (let i = 0; i < textChunks.length; i++) {
    const content = textChunks[i]
    const actualStartChar = full_text.indexOf(content, currentCharPosition)
    const actualEndChar = actualStartChar + content.length

    let page: number
    let sectionHeader: string | null

    if (useADIPageMap) {
      // ADI-exact page assignment — Sprint 3
      const resolved = resolvePageFromMap(actualStartChar, pageMap)
      page = resolved.page_number
      sectionHeader = resolved.section_header
    } else {
      // Fallback — character position estimate
      // Used only when ADI returned no paragraphs
      page = Math.max(
        1,
        Math.ceil((actualStartChar / full_text.length) * page_count)
      )
      sectionHeader = detectSectionHeader(content, section_headers)
    }

    chunks.push({
      chunk_id: `${i}`,
      content: content.trim(),
      chunk_index: i,
      metadata: {
        page,
        start_char: actualStartChar,
        end_char: actualEndChar,
        section_header: sectionHeader,
      },
    })

    currentCharPosition = actualEndChar - overlapChars
  }

  return chunks
}

// ----------------------------------------------------------------------------
// detectSectionHeader — fallback only, used when ADI page map is empty
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// storeChunksInDatabase — unchanged from Phase 5.2
// ----------------------------------------------------------------------------
export async function storeChunksInDatabase(
  documentId: string,
  chunks: ChunkResult[],
  userId: string
): Promise<void> {
  console.log(`[Chunking] Storing ${chunks.length} chunks (user: ${userId})...`)

  const chunkRecords = chunks.map((chunk) => ({
    document_id: documentId,
    user_id: userId,
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

  console.log(`[Chunking] ${chunks.length} chunks stored`)
}

// ----------------------------------------------------------------------------
// validateChunks — unchanged
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// getChunkingStats — unchanged
// ----------------------------------------------------------------------------
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
    chunks_with_headers: chunks.filter(
      (c) => c.metadata.section_header !== null
    ).length,
  }
}

// ============================================================================
// ARCHIVED — character position page estimate (replaced by ADI page map)
// ============================================================================

// Previous page estimation — used when no ADI paragraph data available:
// const estimatedPage = Math.max(
//   1,
//   Math.ceil((actualStartChar / full_text.length) * page_count)
// )
// This formula produced incorrect page citations on dense legal documents.
// Replaced by resolvePageFromMap() which uses ADI paragraph boundaries.