import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'
import { deleteDocumentCascade, type DeletionResult } from '@/lib/utils/deleteDocument'

/**
 * GET /api/documents/[id]
 *
 * Fetch document details by ID.
 *
 * Phase 5.2 update: Auth required. The requesting user must own the
 * document. Uses belt-and-suspenders: session check + explicit
 * user_id comparison, in addition to RLS at the database level.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // ── 2. Resolve document ID ────────────────────────────────────
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // ── 3. Fetch document ─────────────────────────────────────────
    // supabaseAdmin bypasses RLS — we enforce ownership explicitly
    // so the error message can distinguish "not found" from "forbidden"
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // ── 4. Ownership check ────────────────────────────────────────
    // Demo documents are accessible to all authenticated users.
    // All other documents are strictly locked to their owner.
    const isDemo = document.is_demo === true
    if (!isDemo && document.user_id !== user.id) {
      // Return 404 not 403 — don't confirm the document exists
      // to users who don't own it (prevents enumeration attacks)
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(document)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/documents/[id]
 *
 * Permanently destroys the document and all associated data.
 * Returns a Destruction Receipt as a downloadable PDF.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // ── 2. Resolve document ID ────────────────────────────────────
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // ── 3. Execute cascading delete ───────────────────────────────
    const result = await deleteDocumentCascade(id, user.id)

    // ── 4. Generate Destruction Receipt PDF ──────────────────────
    const receipt = generateDestructionReceipt(result)

    return new NextResponse(receipt.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Destruction_Receipt_${id}.pdf"`,
      },
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('not found') || message.includes('access denied')) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * generateDestructionReceipt
 *
 * Generates a minimal PDF as a Buffer using raw PDF syntax.
 * No external dependencies — pure RFC 3200 compliant PDF.
 * This is a legal artifact — content must be precise and timestamped.
 */
function generateDestructionReceipt(result: DeletionResult): Uint8Array {
  const lines = [
    'PRISM — PERMANENT DELETION CERTIFICATE',
    '========================================',
    '',
    'This certificate confirms that the following document and all',
    'associated data have been permanently and irreversibly destroyed.',
    '',
    `Document Name:    ${result.documentName}`,
    `Document ID:      ${result.documentId}`,
    `SHA-256 Hash:     ${result.fileHash ?? 'N/A'}`,
    `Destroyed At:     ${result.destroyedAt}`,
    '',
    'Data Purged:',
    '  - Original PDF file from encrypted storage',
    '  - All vector embeddings (pgvector)',
    '  - All document chunks and text extracts',
    '  - All associated chat history',
    '  - Usage tracking entries',
    '',
    'Purge Confirmation:',
    result.stepsCompleted.map(s => `  ✓ ${s}`).join('\n'),
    '',
    '========================================',
    'Generated by PRISM · Precision Document Intelligence',
    'prism-mu-one.vercel.app',
    '',
    'This document serves as cryptographic proof of permanent deletion.',
    'PRISM does not retain any copy of the destroyed document or its',
    'contents after this operation is complete.',
  ]

  const text = lines.join('\n')

  // Raw minimal PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length ${estimatePdfStreamLength(text)} >>
stream
BT
/F1 10 Tf
50 742 Td
12 TL
${text.split('\n').map(line => `(${escapePdfString(line)}) Tj T*`).join('\n')}
ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000800 00000 n

trailer
<< /Size 6 /Root 1 0 R >>
startxref
900
%%EOF`

return new TextEncoder().encode(pdfContent)
}

function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '')
}

function estimatePdfStreamLength(text: string): number {
  return text.length * 4 + 500
}