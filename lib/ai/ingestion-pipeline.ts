import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeDocument, detectDocumentType } from '@/lib/openai/documentAnalyzer'
import { extractPDFText } from '@/lib/pdfParser'
import {
  chunkDocument,
  storeChunksInDatabase,
  validateChunks,
  getChunkingStats,
} from '@/lib/ai/adaptive-chunking'
import { generateDocumentEmbeddings } from '@/lib/openai/embeddings'
import {
  enrichDocumentChunks,
  DEFAULT_ENRICHMENT_CONFIG,
  type EnrichmentConfig,
} from '@/lib/ai/metadata-enrichment'

/**
 * runIngestionPipeline
 *
 * Extracted from /api/ingest so it can be called directly from the
 * upload route without an internal HTTP hop (which would fail after
 * auth middleware was added — server-to-server requests have no
 * session cookie).
 *
 * The /api/ingest route still exists as a thin wrapper around this
 * function for any external or manual triggers.
 *
 * Uses supabaseAdmin throughout — this is a trusted server-side
 * pipeline, not a user-initiated client operation. RLS does not
 * apply. The user_id on document_chunks is copied from the parent
 * document row to maintain ownership integrity.
 *
 * Sprint 3 update: extractPDFText now returns { text, numPages, paragraphs }
 * from Azure Document Intelligence. paragraphs[] carries exact page numbers
 * per paragraph — passed to chunkDocument for ADI-aware chunking in 3.5.
 */
export async function runIngestionPipeline(
  documentId: string,
  enrichmentConfig: EnrichmentConfig = DEFAULT_ENRICHMENT_CONFIG
): Promise<{
  success: boolean
  documentId: string
  totalCost: number
  totalDurationMs: number
}> {
  const startTime = Date.now()
  const stages = {
    download: 0,
    parse: 0,
    analysis: 0,
    chunking: 0,
    embeddings: 0,
    enrichment: 0,
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`PRISM INGESTION PIPELINE STARTED`)
  console.log(`Document ID: ${documentId}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log(`${'='.repeat(80)}\n`)

  try {
    // ── STEP 1: Fetch document ────────────────────────────────────
    console.log(`[Step 1/7] Fetching document from database...`)

    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      throw new Error(`Document not found: ${documentId}`)
    }

    const userId: string = document.user_id
    console.log(`Document: ${document.name} (owner: ${userId})`)

    // ── STEP 2: Download PDF ──────────────────────────────────────
    const downloadStart = Date.now()
    console.log(`\n[Step 2/7] Downloading PDF from storage...`)

    const filename = document.file_url.split('/').pop()
    if (!filename) throw new Error('Invalid file URL — cannot extract filename')

    const { data: pdfBuffer, error: downloadError } = await supabaseAdmin.storage
      .from('document-uploads')
      .download(filename)

    if (downloadError || !pdfBuffer) {
      throw new Error(`Failed to download PDF: ${downloadError?.message ?? 'Unknown error'}`)
    }

    stages.download = Date.now() - downloadStart
    console.log(`Downloaded (${stages.download}ms)`)

    // ── STEP 3: Parse PDF via Azure Document Intelligence ─────────
    const parseStart = Date.now()
    console.log(`\n[Step 3/7] Parsing PDF via Azure Document Intelligence...`)

    const arrayBuffer = await pdfBuffer.arrayBuffer()

    // Sprint 3: extractPDFText now returns paragraphs[] with exact page numbers
    const {
      text: fullText,
      numPages,
      paragraphs,
    } = await extractPDFText(arrayBuffer)

    stages.parse = Date.now() - parseStart
    console.log(
      `Parsed — ${numPages} pages, ${paragraphs.length} paragraphs, ${fullText.length.toLocaleString()} chars (${stages.parse}ms)`
    )

    if (fullText.length < 100) {
      await supabaseAdmin
        .from('documents')
        .update({
          status: 'failed',
          error_message:
            'PDF contains scanned images or insufficient text. Please upload a text-based PDF.',
        })
        .eq('id', documentId)

      throw new Error('PDF contains insufficient text (< 100 characters)')
    }

    // ── STEP 4: AI Document Analysis ─────────────────────────────
    const analysisStart = Date.now()
    console.log(`\n[Step 4/7] Running AI document analysis...`)

    let analysis
    try {
      analysis = await analyzeDocument(fullText, document.name)
    } catch {
      console.warn(`WARNING: AI analysis failed, using fallback`)
      analysis = {
        document_type: detectDocumentType(fullText, document.name),
        has_table_of_contents: fullText.toLowerCase().includes('table of contents'),
        section_headers: [],
        optimal_chunk_size: 700,
        key_entities: [],
        complexity_score: 5,
      }
    }

    stages.analysis = Date.now() - analysisStart
    console.log(
      `Analysis: ${analysis.document_type}, complexity ${analysis.complexity_score}/10 (${stages.analysis}ms)`
    )

    await supabaseAdmin
      .from('documents')
      .update({
        page_count: numPages,
        document_type: analysis.document_type,
        complexity_score: analysis.complexity_score,
        has_toc: analysis.has_table_of_contents,
        key_entities: analysis.key_entities,
      })
      .eq('id', documentId)

    // ── STEP 5: Adaptive Chunking ─────────────────────────────────
    const chunkingStart = Date.now()
    console.log(`\n[Step 5/7] Creating adaptive chunks from ADI paragraphs...`)

    // Sprint 3: paragraphs[] passed to chunkDocument — ADI-aware chunking
    // uses exact page numbers from ADI, not character position estimates
    const chunks = await chunkDocument({
      optimal_chunk_size: analysis.optimal_chunk_size,
      overlap: 100,
      document_id: documentId,
      full_text: fullText,
      page_count: numPages,
      section_headers: analysis.section_headers,
      paragraphs,                // ADI paragraphs with exact page numbers
    })

    const validation = validateChunks(chunks)
    if (!validation.valid) {
      throw new Error(`Chunk validation failed: ${validation.errors.join(', ')}`)
    }

    const chunkStats = getChunkingStats(chunks)
    stages.chunking = Date.now() - chunkingStart
    console.log(`${chunkStats.total_chunks} chunks created (${stages.chunking}ms)`)

    await storeChunksInDatabase(documentId, chunks, userId)
    console.log(`Chunks stored`)

    // ── STEP 6: Vector Embeddings ─────────────────────────────────
    const embeddingsStart = Date.now()
    console.log(`\n[Step 6/7] Generating vector embeddings...`)

    const embeddingStats = await generateDocumentEmbeddings(documentId)
    stages.embeddings = Date.now() - embeddingsStart
    console.log(
      `Embeddings: ${embeddingStats.successful_embeddings}/${embeddingStats.total_chunks} (${stages.embeddings}ms) — $${embeddingStats.estimated_cost.toFixed(6)}`
    )

    // ── STEP 7: Metadata Enrichment ───────────────────────────────
    const enrichmentStart = Date.now()
    console.log(`\n[Step 7/7] Enriching chunks with AI metadata...`)

    const enrichmentStats = await enrichDocumentChunks(documentId, enrichmentConfig)
    stages.enrichment = Date.now() - enrichmentStart
    console.log(
      `Enrichment: ${enrichmentStats.successful_enrichments}/${enrichmentStats.total_chunks} (${stages.enrichment}ms) — $${enrichmentStats.estimated_cost.toFixed(6)}`
    )

    // ── Finalize ──────────────────────────────────────────────────
    await supabaseAdmin
      .from('documents')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', documentId)

    const totalDurationMs = Date.now() - startTime
    const totalCost = embeddingStats.estimated_cost + enrichmentStats.estimated_cost

    console.log(
      `\nPIPELINE COMPLETE — ${(totalDurationMs / 1000).toFixed(2)}s — $${totalCost.toFixed(6)}\n`
    )

    return { success: true, documentId, totalCost, totalDurationMs }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const totalDurationMs = Date.now() - startTime

    console.error(
      `\nPIPELINE FAILED: ${message} (${(totalDurationMs / 1000).toFixed(2)}s)\n`
    )

    // Rollback
    try {
      await supabaseAdmin
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId)

      await supabaseAdmin
        .from('documents')
        .update({
          status: 'failed',
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
    } catch (rollbackError) {
      console.error(`[Rollback] Failed:`, rollbackError)
    }

    throw error
  }
}