import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'
import { runIngestionPipeline } from '@/lib/ai/ingestion-pipeline'
import { waitUntil } from '@vercel/functions'
import { getSubscription } from '@/lib/billing/getSubscription'
import { checkUploadAccess } from '@/lib/billing/checkAccess'
import { trackDocumentUpload } from '@/lib/billing/trackUsage'
import { TIER_LIMITS } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to upload documents.' },
        { status: 401 }
      )
    }

    // ── 2. Subscription + access check ───────────────────────────
    const subscription = await getSubscription(user.id)
    const access = await checkUploadAccess(subscription, user.id)

    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason,
          code: 'UPLOAD_LIMIT_REACHED',
          tier: access.tier,
          limit: access.limit,
          current: access.current,
          upgrade_required: true,
        },
        { status: 403 }
      )
    }

    // ── 3. Parse and validate form data ───────────────────────────
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

    // Enforce tier file size limit
    const fileSizeLimitBytes = TIER_LIMITS[subscription.tier].file_size_limit_mb * 1024 * 1024
    if (file.size > fileSizeLimitBytes) {
      return NextResponse.json(
        {
          error: `File exceeds the ${TIER_LIMITS[subscription.tier].file_size_limit_mb}MB limit for the ${TIER_LIMITS[subscription.tier].label} plan.`,
          code: 'FILE_TOO_LARGE',
          tier: subscription.tier,
          upgrade_required: subscription.tier !== 'enterprise',
        },
        { status: 400 }
      )
    }

    // ── 4. Read buffer + generate SHA-256 hash ────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileHash = createHash('sha256').update(buffer).digest('hex')

    console.log(`[Upload] SHA-256: ${fileHash}`)

    // ── 5. Duplicate detection ────────────────────────────────────
    // Check if this user has already uploaded this exact file.
    // Match on both user_id and file_hash — same file from different
    // users is not a duplicate.
    const { data: existing } = await supabaseAdmin
      .from('documents')
      .select('id, name, status')
      .eq('user_id', user.id)
      .eq('file_hash', fileHash)
      .neq('status', 'failed')
      .single()

    if (existing) {
      console.log(`[Upload] Duplicate detected — routing to existing document: ${existing.id}`)
      return NextResponse.json({
        success: true,
        documentId: existing.id,
        duplicate: true,
        message: 'This document has already been uploaded. Routing to existing analysis.',
      })
    }

    // ── 6. Upload to Supabase Storage ─────────────────────────────
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${user.id}_${timestamp}_${sanitizedName}`

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

    // ── 7. Create document record with file_hash ──────────────────
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        name: file.name,
        file_url: fileUrl,
        file_size_bytes: file.size,
        status: 'processing',
        ingestion_status: 'queued',      // Sprint 4 — Realtime status tracking
        user_id: user.id,
        file_hash: fileHash,
      })
      .select()
      .single()

    if (dbError || !document) {
      console.error('[Upload] DB insert error:', dbError)
      await supabaseAdmin.storage.from('document-uploads').remove([filename])
      throw new Error('Failed to create document record')
    }

    console.log(`[Upload] Document created: ${document.id} for user: ${user.id}`)

    // ── 8. Track usage + trigger ingestion ────────────────────────
    waitUntil(
      (async () => {
        await trackDocumentUpload({ userId: user.id, subscription })
        await runIngestionPipeline(document.id).catch((err) => {
          console.error(`[Upload] Ingestion pipeline failed for ${document.id}:`, err)
        })
      })()
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