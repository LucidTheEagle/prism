import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeDocument, detectDocumentType } from '@/lib/openai/documentAnalyzer'
import { extractPDFText } from '@/lib/pdfParser'
import { 
  chunkDocument, 
  storeChunksInDatabase, 
  validateChunks, 
  getChunkingStats 
} from '@/lib/ai/adaptive-chunking'
import { generateDocumentEmbeddings } from '@/lib/openai/embeddings'
import { 
  enrichDocumentChunks, 
  DEFAULT_ENRICHMENT_CONFIG,
  type EnrichmentConfig 
} from '@/lib/ai/metadata-enrichment'

/**
 * PRISM Document Ingestion Pipeline - PRODUCTION READY
 * 
 * Complete AI-powered document processing:
 * 1. PDF Download & Parsing
 * 2. AI Document Analysis
 * 3. Adaptive Chunking
 * 4. Vector Embedding Generation
 * 5. Metadata Enrichment
 * 
 * Checkpoint 2.5: Complete Integration
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let documentId: string | null = null
  const stages = {
    download: 0,
    parse: 0,
    analysis: 0,
    chunking: 0,
    embeddings: 0,
    enrichment: 0,
  }

  try {
    // =========================================================================
    // STEP 0: VALIDATE REQUEST
    // =========================================================================
    const body = await request.json()
    documentId = body.documentId
    
    // Optional: Custom enrichment config
    const enrichmentConfig: EnrichmentConfig = body.enrichmentConfig || DEFAULT_ENRICHMENT_CONFIG

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId in request body' },
        { status: 400 }
      )
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`🚀 PRISM INGESTION PIPELINE STARTED`)
    console.log(`Document ID: ${documentId}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(80)}\n`)

    // =========================================================================
    // STEP 1: FETCH DOCUMENT FROM DATABASE
    // =========================================================================
    const stepStart = Date.now()
    console.log(`[Step 1/7] 📄 Fetching document from database...`)

    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      throw new Error(`Document not found: ${documentId}`)
    }

    console.log(`✓ Document found: ${document.name}`)
    console.log(`  File size: ${(document.file_size_bytes / 1024).toFixed(2)} KB`)

    // =========================================================================
    // STEP 2: DOWNLOAD PDF FROM STORAGE
    // =========================================================================
    stages.download = Date.now() - stepStart
    const downloadStart = Date.now()
    console.log(`\n[Step 2/7] ⬇️  Downloading PDF from storage...`)

    const filename = document.file_url.split('/').pop()
    if (!filename) {
      throw new Error('Invalid file URL - cannot extract filename')
    }

    const { data: pdfBuffer, error: downloadError } = await supabaseAdmin.storage
      .from('document-uploads')
      .download(filename)

    if (downloadError || !pdfBuffer) {
      throw new Error(`Failed to download PDF: ${downloadError?.message || 'Unknown error'}`)
    }

    stages.download = Date.now() - downloadStart
    console.log(`✓ PDF downloaded successfully (${stages.download}ms)`)

    // =========================================================================
    // STEP 3: PARSE PDF TEXT
    // =========================================================================
    const parseStart = Date.now()
    console.log(`\n[Step 3/7] 📖 Parsing PDF content...`)

    const arrayBuffer = await pdfBuffer.arrayBuffer()
    const { text: fullText, numPages } = await extractPDFText(arrayBuffer)

    stages.parse = Date.now() - parseStart
    console.log(`✓ PDF parsed successfully`)
    console.log(`  Pages: ${numPages}`)
    console.log(`  Characters: ${fullText.length.toLocaleString()}`)
    console.log(`  Parse time: ${stages.parse}ms`)

    // Validate text content
    if (fullText.length < 100) {
      await supabaseAdmin
        .from('documents')
        .update({
          status: 'failed',
          error_message: 'PDF contains scanned images or insufficient text. Please upload a text-based PDF or use OCR.'
        })
        .eq('id', documentId)

      return NextResponse.json({
        success: false,
        error: 'PDF contains insufficient text (< 100 characters). This appears to be a scanned document.',
        suggestion: 'Please re-export as a text-based PDF or use OCR software first.'
      }, { status: 400 })
    }

    // =========================================================================
    // STEP 4: AI DOCUMENT ANALYSIS
    // =========================================================================
    const analysisStart = Date.now()
    console.log(`\n[Step 4/7] 🧠 Running AI document analysis...`)

    let analysis
    try {
      analysis = await analyzeDocument(fullText, document.name)
      stages.analysis = Date.now() - analysisStart
      
      console.log(`✓ AI analysis complete (${stages.analysis}ms)`)
      console.log(`  Type: ${analysis.document_type}`)
      console.log(`  Complexity: ${analysis.complexity_score}/10`)
      console.log(`  Optimal chunk size: ${analysis.optimal_chunk_size} tokens`)
      console.log(`  Section headers found: ${analysis.section_headers.length}`)
      console.log(`  Key entities: ${analysis.key_entities.length}`)
    } catch (error) {
      console.warn(`⚠️  AI analysis failed, using fallback detection`)
      console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown'}`)
      
      // Fallback to simple detection
      analysis = {
        document_type: detectDocumentType(fullText, document.name),
        has_table_of_contents: fullText.toLowerCase().includes('table of contents'),
        section_headers: [],
        optimal_chunk_size: 700,
        key_entities: [],
        complexity_score: 5,
      }
      stages.analysis = Date.now() - analysisStart
    }

    // Update document metadata
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

    // =========================================================================
    // STEP 5: ADAPTIVE CHUNKING
    // =========================================================================
    const chunkingStart = Date.now()
    console.log(`\n[Step 5/7] 📄 Creating adaptive chunks...`)

    const chunks = await chunkDocument({
      optimal_chunk_size: analysis.optimal_chunk_size,
      overlap: 100,
      document_id: documentId,
      full_text: fullText,
      page_count: numPages,
      section_headers: analysis.section_headers,
    })

    // Validate chunks
    const validation = validateChunks(chunks)
    if (!validation.valid) {
      throw new Error(`Chunk validation failed: ${validation.errors.join(', ')}`)
    }

    // Get statistics
    const chunkStats = getChunkingStats(chunks)
    stages.chunking = Date.now() - chunkingStart

    console.log(`✓ Chunking complete (${stages.chunking}ms)`)
    console.log(`  Total chunks: ${chunkStats.total_chunks}`)
    console.log(`  Avg size: ${chunkStats.avg_chunk_size} chars`)
    console.log(`  Range: ${chunkStats.min_chunk_size} - ${chunkStats.max_chunk_size} chars`)
    console.log(`  Chunks with headers: ${chunkStats.chunks_with_headers}`)

    // Store chunks in database
    await storeChunksInDatabase(documentId, chunks)
    console.log(`✓ Chunks stored in database`)

    // =========================================================================
    // STEP 6: VECTOR EMBEDDING GENERATION
    // =========================================================================
    const embeddingsStart = Date.now()
    console.log(`\n[Step 6/7] 🧠 Generating vector embeddings...`)

    const embeddingStats = await generateDocumentEmbeddings(documentId)
    stages.embeddings = Date.now() - embeddingsStart

    console.log(`✓ Embeddings complete (${stages.embeddings}ms)`)
    console.log(`  Successful: ${embeddingStats.successful_embeddings}/${embeddingStats.total_chunks}`)
    console.log(`  Failed: ${embeddingStats.failed_embeddings}`)
    console.log(`  Tokens used: ${embeddingStats.total_tokens.toLocaleString()}`)
    console.log(`  Cost: $${embeddingStats.estimated_cost.toFixed(6)}`)

    if (embeddingStats.failed_embeddings > 0) {
      console.warn(`⚠️  ${embeddingStats.failed_embeddings} embeddings failed - document still usable but search quality may be reduced`)
    }

    // =========================================================================
    // STEP 7: METADATA ENRICHMENT
    // =========================================================================
    const enrichmentStart = Date.now()
    console.log(`\n[Step 7/7] 💎 Enriching chunks with AI metadata...`)
    console.log(`  Summaries: ${enrichmentConfig.enable_summaries ? 'enabled' : 'disabled'}`)
    console.log(`  Keywords: ${enrichmentConfig.enable_keywords ? 'enabled' : 'disabled'}`)
    console.log(`  Categories: ${enrichmentConfig.enable_categories ? 'enabled' : 'disabled'}`)

    const enrichmentStats = await enrichDocumentChunks(documentId, enrichmentConfig)
    stages.enrichment = Date.now() - enrichmentStart

    console.log(`✓ Enrichment complete (${stages.enrichment}ms)`)
    console.log(`  Successful: ${enrichmentStats.successful_enrichments}/${enrichmentStats.total_chunks}`)
    console.log(`  Failed: ${enrichmentStats.failed_enrichments}`)
    console.log(`  Tokens used: ${enrichmentStats.total_tokens.toLocaleString()}`)
    console.log(`  Cost: $${enrichmentStats.estimated_cost.toFixed(6)}`)

    if (enrichmentStats.failed_enrichments > 0) {
      console.warn(`⚠️  ${enrichmentStats.failed_enrichments} enrichments failed - metadata may be incomplete`)
    }

    // =========================================================================
    // STEP 8: MARK DOCUMENT AS READY
    // =========================================================================
    console.log(`\n[Finalization] ✅ Marking document as ready...`)
    
    await supabaseAdmin
      .from('documents')
      .update({ 
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)

    // =========================================================================
    // SUCCESS RESPONSE
    // =========================================================================
    const totalDuration = Date.now() - startTime
    const totalCost = embeddingStats.estimated_cost + enrichmentStats.estimated_cost

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ PIPELINE COMPLETE`)
    console.log(`${'='.repeat(80)}`)
    console.log(`Total time: ${(totalDuration / 1000).toFixed(2)}s`)
    console.log(`Total cost: $${totalCost.toFixed(6)}`)
    console.log(`\nStage breakdown:`)
    console.log(`  Download: ${stages.download}ms`)
    console.log(`  Parse: ${stages.parse}ms`)
    console.log(`  Analysis: ${stages.analysis}ms`)
    console.log(`  Chunking: ${stages.chunking}ms`)
    console.log(`  Embeddings: ${stages.embeddings}ms`)
    console.log(`  Enrichment: ${stages.enrichment}ms`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      documentId,
      document: {
        name: document.name,
        pages: numPages,
        characters: fullText.length,
        type: analysis.document_type,
        complexity: analysis.complexity_score,
      },
      processing: {
        analysis,
        chunking: {
          total_chunks: chunkStats.total_chunks,
          avg_size: chunkStats.avg_chunk_size,
          chunks_with_headers: chunkStats.chunks_with_headers,
        },
        embeddings: {
          successful: embeddingStats.successful_embeddings,
          failed: embeddingStats.failed_embeddings,
          tokens: embeddingStats.total_tokens,
          cost: embeddingStats.estimated_cost,
          time_ms: embeddingStats.processing_time_ms,
        },
        enrichment: {
          successful: enrichmentStats.successful_enrichments,
          failed: enrichmentStats.failed_enrichments,
          tokens: enrichmentStats.total_tokens,
          cost: enrichmentStats.estimated_cost,
          time_ms: enrichmentStats.processing_time_ms,
        },
      },
      performance: {
        total_duration_ms: totalDuration,
        total_duration_seconds: +(totalDuration / 1000).toFixed(2),
        total_cost: +totalCost.toFixed(6),
        stages,
      },
      message: `Document processed successfully! ${chunkStats.total_chunks} chunks created, embedded, and enriched. Ready for intelligent search.`,
    })

  } catch (error: unknown) {
    // =========================================================================
    // ERROR HANDLING & ROLLBACK
    // =========================================================================
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const totalDuration = Date.now() - startTime

    console.error(`\n${'='.repeat(80)}`)
    console.error(`❌ PIPELINE FAILED`)
    console.error(`${'='.repeat(80)}`)
    console.error(`Error: ${errorMessage}`)
    console.error(`Duration before failure: ${(totalDuration / 1000).toFixed(2)}s`)
    console.error(`${'='.repeat(80)}\n`)

    // Rollback: Delete chunks and update status
    if (documentId) {
      try {
        console.log(`[Rollback] Cleaning up chunks...`)
        await supabaseAdmin
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId)

        console.log(`[Rollback] Updating document status to failed...`)
        await supabaseAdmin
          .from('documents')
          .update({
            status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId)

        console.log(`✓ Rollback complete`)
      } catch (rollbackError) {
        console.error(`❌ Rollback failed:`, rollbackError)
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        documentId,
        duration_ms: totalDuration,
        stages_completed: stages,
      },
      { status: 500 }
    )
  }
}