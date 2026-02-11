import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
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

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}_${sanitizedName}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('document-uploads')
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw new Error('Failed to upload file to storage')
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('document-uploads')
      .getPublicUrl(filename)

    // Create database record
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        name: file.name,
        file_url: publicUrl,
        file_size_bytes: file.size,
        status: 'processing'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      throw new Error('Failed to create document record')
    }

    // Trigger AI ingestion immediately (server-side, not background)
    console.log(`Triggering ingestion for document ${document.id}`)
    
    // Call ingestion API (same server, internal)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // Don't await - let it run in background
    fetch(`${baseUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: document.id })
    }).catch(err => {
      console.error('Failed to trigger ingestion:', err)
    })

    console.log('Upload successful:', {
      documentId: document.id,
      filename: file.name,
      size: file.size
    })

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileUrl: publicUrl,
      message: 'Upload successful! AI processing started.'
    })

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Upload error:', error)
      return NextResponse.json(
        { error: error.message || 'Upload failed' },
        { status: 500 }
      )
    } else {
      console.error('Upload error:', error)
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      )
    }
  }
}