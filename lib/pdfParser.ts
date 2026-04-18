import DocumentIntelligence, {
  getLongRunningPoller,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence'

// ============================================================================
// PRISM PDF PARSER — V1
// Replaces pdf-parse character-position page estimation with Azure Document
// Intelligence paragraph-level extraction. Every paragraph carries an exact
// page number, bounding box, and section role from ADI structural analysis.
//
// Previous implementation archived below.
// ============================================================================

// ----------------------------------------------------------------------------
// ADI paragraph — atomic unit of structured document content
// ----------------------------------------------------------------------------
export interface ADIParagraph {
  content: string
  page_number: number           // exact — from ADI, not estimated
  section_header: string | null // from ADI paragraph role detection
  bounding_box?: number[]       // [x1,y1,x2,y2,x3,y3,x4,y4] — for future use
}

// ----------------------------------------------------------------------------
// Parser output — extended from the old { text, numPages } shape
// ingestion-pipeline.ts consumes all three fields
// ----------------------------------------------------------------------------
export interface PDFParseResult {
  text: string                  // full document text — for analyzeDocument
  numPages: number              // total page count — for document record
  paragraphs: ADIParagraph[]    // structured paragraphs — for chunking
}

// ----------------------------------------------------------------------------
// ADI client — initialized once, key-based auth matching existing Azure pattern
// ----------------------------------------------------------------------------
function getADIClient() {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY

  if (!endpoint) {
    throw new Error('Missing AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT environment variable')
  }
  if (!key) {
    throw new Error('Missing AZURE_DOCUMENT_INTELLIGENCE_KEY environment variable')
  }

  return DocumentIntelligence(endpoint, { key })
}

// ----------------------------------------------------------------------------
// Section role mapping — ADI paragraph roles → section header strings
// ADI detects: title, sectionHeading, footnote, pageHeader, pageFooter,
// pageNumber, caption, figure, formula, table — we surface the meaningful ones
// ----------------------------------------------------------------------------
function resolveADISectionHeader(role: string | undefined): string | null {
  if (!role) return null
  switch (role) {
    case 'title':           return 'Title'
    case 'sectionHeading':  return 'Section Heading'
    case 'pageHeader':      return null  // page headers are not legal section markers
    case 'pageFooter':      return null  // page footers are not legal section markers
    case 'pageNumber':      return null
    case 'footnote':        return null
    default:                return null
  }
}

// ----------------------------------------------------------------------------
// extractPDFText — main export
// Input: ArrayBuffer (PDF file bytes)
// Output: PDFParseResult — text, numPages, paragraphs[]
// ----------------------------------------------------------------------------
export async function extractPDFText(buffer: ArrayBuffer): Promise<PDFParseResult> {
  const client = getADIClient()

  console.log(`[PDFParser] Sending to Azure Document Intelligence...`)
  const startTime = Date.now()

  try {
    // Convert ArrayBuffer to base64 for ADI REST API
    const base64Source = Buffer.from(buffer).toString('base64')

    // Use prebuilt-layout model — extracts paragraphs, tables, section headings,
    // page numbers, bounding boxes. Correct model for legal document structure.
    const initialResponse = await client
      .path('/documentModels/{modelId}:analyze', 'prebuilt-layout')
      .post({
        contentType: 'application/json',
        body: {
          base64Source,
        },
        queryParameters: {
          outputContentFormat: 'text',
        },
      })

    if (isUnexpected(initialResponse)) {
      throw new Error(
        `ADI analysis failed: ${initialResponse.status} — ${JSON.stringify(initialResponse.body as unknown)}`
      )
    }

    // Poll until analysis is complete
    const poller = getLongRunningPoller(client, initialResponse)
    const result = await poller.pollUntilDone()

    if (isUnexpected(result)) {
      throw new Error(
        `ADI polling failed: ${result.status} — ${JSON.stringify(result.body)}`
      )
    }

    // Cast result body — @azure-rest/ai-document-intelligence@1.1.0 returns unknown
    const resultBody = result.body as {
      analyzeResult?: {
        pages?: Array<{ pageNumber: number }>
        paragraphs?: Array<{
          content: string
          role?: string
          boundingRegions?: Array<{
            pageNumber: number
            polygon?: number[]
          }>
        }>
      }
    }

    const analyzeResult = resultBody.analyzeResult

    if (!analyzeResult) {
      throw new Error('ADI returned no analyzeResult')
    }

    // ── Extract page count ─────────────────────────────────────────────────
    const numPages = analyzeResult.pages?.length ?? 0

    if (numPages === 0) {
      throw new Error('ADI returned zero pages — document may be empty or corrupted')
    }

    // ── Extract paragraphs ─────────────────────────────────────────────────
    const paragraphs: ADIParagraph[] = []

    if (analyzeResult.paragraphs && analyzeResult.paragraphs.length > 0) {
      for (const para of analyzeResult.paragraphs) {
        // Skip empty paragraphs
        if (!para.content || para.content.trim().length === 0) continue

        // Get page number from first bounding region
        // ADI paragraphs can span pages — we take the starting page
        const pageNumber = para.boundingRegions?.[0]?.pageNumber ?? 1

        // Get bounding box polygon from first region
        const boundingBox = para.boundingRegions?.[0]?.polygon ?? undefined

        // Resolve section header from ADI role
        const sectionHeader = resolveADISectionHeader(para.role ?? undefined)

        paragraphs.push({
          content: para.content.trim(),
          page_number: pageNumber,
          section_header: sectionHeader,
          bounding_box: boundingBox,
        })
      }
    }

    // ── Build full text from paragraphs ────────────────────────────────────
    // Preserves reading order — ADI returns paragraphs in document order
    const text = paragraphs.map((p) => p.content).join('\n\n')

    // ── Scanned PDF guard ──────────────────────────────────────────────────
    // ADI handles scanned PDFs better than pdf-parse but OCR quality varies
    // Threshold kept at 100 chars — same as previous guard
    if (text.length < 100) {
      throw new Error(
        'Document contains insufficient extractable text. ' +
        'Please upload a text-based PDF. Scanned PDFs require OCR — contact support.'
      )
    }

    const duration = Date.now() - startTime
    console.log(
      `[PDFParser] Complete (${duration}ms) | pages: ${numPages} | paragraphs: ${paragraphs.length} | chars: ${text.length.toLocaleString()}`
    )

    return { text, numPages, paragraphs }

  } catch (error) {
    console.error('[PDFParser] Azure Document Intelligence error:', error)
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// ============================================================================
// ARCHIVED — pdf-parse implementation
// ============================================================================

// export async function extractPDFText(
//   buffer: ArrayBuffer
// ): Promise<{ text: string; numPages: number }> {
//   const nodeBuffer = Buffer.from(buffer)
//   const pdfParse = (await import('pdf-parse')).default
//   try {
//     const data = await pdfParse(nodeBuffer)
//     return { text: data.text, numPages: data.numpages }
//   } catch (error) {
//     console.error('PDF parsing error:', error)
//     throw new Error(
//       `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
//     )
//   }
// }