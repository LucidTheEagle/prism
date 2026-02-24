import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'
import { runIngestionPipeline } from '@/lib/ai/ingestion-pipeline'
import { waitUntil } from '@vercel/functions'

/**
 * POST /api/upload
 *
 * Accepts a PDF file, uploads it to Supabase Storage, creates a
 * document record owned by the authenticated user, then kicks off
 * the ingestion pipeline directly (no internal HTTP hop — avoids
 * auth complexity between server-to-server calls).
 *
 * Auth: Required. user_id is extracted from the session cookie and
 * stamped on the document row so RLS policies enforce ownership.
 *
 * Phase 5.4 fix: replaced fire-and-forget runIngestionPipeline() call
 * with waitUntil() — Vercel was killing the function immediately after
 * the response was sent, so the pipeline never completed past Step 1.
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate the request ───────────────────────────────
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to upload documents.' },
        { status: 401 }
      )
    }

    // ── 2. Parse and validate the form data ───────────────────────
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File exceeds 50MB limit' },
        { status: 400 }
      )
    }

    // ── 3. Upload to Supabase Storage ─────────────────────────────
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${user.id}_${timestamp}_${sanitizedName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('document-uploads')
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('[Upload] Storage error:', uploadError)
      throw new Error('Failed to upload file to storage')
    }

    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/document-uploads/${filename}`

    // ── 4. Create document record with user_id ────────────────────
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        name: file.name,
        file_url: fileUrl,
        file_size_bytes: file.size,
        status: 'processing',
        user_id: user.id,
      })
      .select()
      .single()

    if (dbError || !document) {
      console.error('[Upload] DB insert error:', dbError)
      await supabaseAdmin.storage.from('document-uploads').remove([filename])
      throw new Error('Failed to create document record')
    }

    console.log(`[Upload] Document created: ${document.id} for user: ${user.id}`)

    // ── 5. Trigger ingestion pipeline ─────────────────────────────
    // FIX: Use waitUntil() so Vercel keeps the function alive until
    // the pipeline completes. The old fire-and-forget .catch() pattern
    // caused Vercel to kill the process after the response was sent,
    // meaning the pipeline always died after Step 1.
    waitUntil(
      runIngestionPipeline(document.id).catch((err) => {
        console.error(`[Upload] Ingestion pipeline failed for ${document.id}:`, err)
      })
    )

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileUrl,
      message: 'Upload successful! AI processing started.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    console.error('[Upload] Fatal error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}