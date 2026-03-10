import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/billing/logAudit'

/**
 * GET /api/documents/[id]/pdf
 *
 * Serves the PDF file for a given document ID.
 *
 * SECURITY MODEL (v1.1):
 * 1. Authenticate the requesting user via session cookie
 * 2. Verify the document belongs to that user (ownership check)
 * 3. Only then generate a signed URL and stream the bytes
 *
 * supabaseAdmin is used ONLY for signed URL generation and byte fetch —
 * both operations that happen after ownership is confirmed.
 * The ownership query uses the session-scoped client so RLS fires.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // ── Step 1: Authenticate ─────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ── Step 2: Ownership check (RLS-scoped client) ──────────────────────────
    // This query will return null if the document exists but belongs to
    // a different user — RLS on documents enforces this silently.
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_url, name')
      .eq('id', id)
      .single()

    if (docError || !document) {
      // Return 404 regardless of whether the doc doesn't exist or belongs
      // to another user — never leak existence of another tenant's document
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // ── Step 3: Extract storage filename ─────────────────────────────────────
    const filename = document.file_url.split('/').pop()

    if (!filename) {
      return NextResponse.json(
        { error: 'Could not resolve storage filename' },
        { status: 500 }
      )
    }

    // ── Step 4: Generate signed URL (admin — ownership already verified) ─────
    const { data: signedData, error: signedError } = await supabaseAdmin
      .storage
      .from('document-uploads')
      .createSignedUrl(filename, 60)

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    // ── Step 5: Fetch PDF bytes server-side ───────────────────────────────────
    const pdfResponse = await fetch(signedData.signedUrl)

    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch PDF from storage' },
        { status: 502 }
      )
    }

    // ── Step 6: Stream to client ──────────────────────────────────────────────
    const pdfBuffer = await pdfResponse.arrayBuffer()

    // Audit log — record every PDF stream event
    logAudit({
      userId: user.id,
      documentId: id,
      eventType: 'pdf_stream',
      durationMs: Date.now() - startTime,
      metadata: {
        filename,
        document_name: document.name,
      },
      request,
    }).catch(() => null)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.name}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}