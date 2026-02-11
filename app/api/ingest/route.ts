import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeDocument, detectDocumentType } from '@/lib/openai/documentAnalyzer'
import { extractPDFText } from '@/lib/pdfParser'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let documentId: string | null = null

  try {
    const body = await request.json()
    documentId = body.documentId

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      )
    }

    console.log(`[Ingestion] Starting for document: ${documentId}`)

    // 1. Get document from database
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      throw new Error('Document not found')
    }

    // 2. Download PDF from Storage
    console.log(`[Ingestion] Downloading PDF from storage...`)
    const filename = document.file_url.split('/').pop()
    if (!filename) {
      throw new Error('Invalid file URL')
    }

    const { data: pdfBuffer, error: downloadError } = await supabaseAdmin.storage
      .from('document-uploads')
      .download(filename)

    if (downloadError || !pdfBuffer) {
      throw new Error('Failed to download PDF from storage')
    }

    // 3. Parse PDF using our helper function
    console.log(`[Ingestion] Parsing PDF...`)
    const arrayBuffer = await pdfBuffer.arrayBuffer()
    const { text: fullText, numPages } = await extractPDFText(arrayBuffer)

    console.log(`[Ingestion] PDF parsed: ${numPages} pages, ${fullText.length} characters`)

    // 4. Validate text content
    if (fullText.length < 100) {
      await supabaseAdmin
        .from('documents')
        .update({
          status: 'failed',
          error_message: 'This PDF contains scanned images or insufficient text. Upload a text-based PDF or use OCR.'
        })
        .eq('id', documentId)

      return NextResponse.json({
        success: false,
        error: 'PDF contains insufficient text'
      }, { status: 400 })
    }

    // 5. AI Document Analysis
    console.log(`[Ingestion] Running AI document analysis...`)
    let analysis
    try {
      analysis = await analyzeDocument(fullText, document.name)
      console.log(`[Ingestion] Analysis complete:`, analysis)
    } catch (error) {
      console.error('[Ingestion] AI analysis failed, using fallback:', error)
      // Fallback to simple detection
      analysis = {
        document_type: detectDocumentType(fullText, document.name),
        has_table_of_contents: fullText.toLowerCase().includes('table of contents'),
        section_headers: [],
        optimal_chunk_size: 700,
        key_entities: [],
        complexity_score: 5,
      }
    }

    // 6. Update document with analysis results
    console.log(`[Ingestion] Updating document metadata...`)
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

    console.log(`[Ingestion] Document metadata updated`)

    // 7. TODO: Chunking (Checkpoint 2.2)
    // 8. TODO: Embeddings (Checkpoint 2.3)
    // 9. TODO: Metadata Enrichment (Checkpoint 2.4)

    // For now, mark as ready
    console.log(`[Ingestion] Marking document as ready...`)
    await supabaseAdmin
      .from('documents')
      .update({ status: 'ready' })
      .eq('id', documentId)

    const duration = Date.now() - startTime
    console.log(`[Ingestion] ✅ Complete in ${duration}ms`)

    return NextResponse.json({
      success: true,
      documentId,
      analysis,
      pageCount: numPages,
      textLength: fullText.length,
      duration,
      message: 'Document analyzed successfully! (Chunking & embeddings coming in next checkpoints)'
    })

  } catch (error: unknown) {
    console.error('[Ingestion] ❌ Error:', error)

    // Update document status to failed
    if (documentId) {
      try {
        await supabaseAdmin
          .from('documents')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Processing failed'
          })
          .eq('id', documentId)
      } catch (updateError) {
        console.error('[Ingestion] Failed to update error status:', updateError)
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Ingestion failed' 
      },
      { status: 500 }
    )
  }
}