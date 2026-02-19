import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/documents/[id]/pdf
 *
 * Serves the PDF file for a given document ID.
 *
 * WHY THIS ENDPOINT EXISTS:
 * The Supabase storage bucket is private. Direct public URLs return 400.
 * The upload route stores a `file_url` using getPublicUrl() — that URL
 * is broken for private buckets. Instead, we:
 *   1. Fetch the document record to get file_url
 *   2. Extract the storage filename from file_url
 *   3. Generate a fresh signed URL (60s expiry) via supabaseAdmin
 *   4. Fetch the PDF bytes server-side using the signed URL
 *   5. Stream the bytes back to the client as application/pdf
 *
 * This keeps the private bucket private — the signed URL never reaches
 * the browser. The browser only sees our API route.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Step 1: Fetch the document record
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('file_url, name')
      .eq('id', id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Step 2: Extract the storage filename from the stored file_url.
    // The file_url looks like:
    // https://<project>.supabase.co/storage/v1/object/public/document-uploads/1708123456789_Contract.pdf
    // We need just the last segment: "1708123456789_Contract.pdf"
    const filename = document.file_url.split('/').pop()

    if (!filename) {
      return NextResponse.json(
        { error: 'Could not resolve storage filename' },
        { status: 500 }
      )
    }

    // Step 3: Generate a short-lived signed URL (60 seconds is enough —
    // we immediately fetch from it server-side in the next step)
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

    // Step 4: Fetch the PDF bytes using the signed URL
    const pdfResponse = await fetch(signedData.signedUrl)

    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch PDF from storage' },
        { status: 502 }
      )
    }

    // Step 5: Stream the bytes back to the client
    const pdfBuffer = await pdfResponse.arrayBuffer()

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.name}"`,
        // Cache for 5 minutes on the client — the PDF content doesn't change
        'Cache-Control': 'private, max-age=300',
      },
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}