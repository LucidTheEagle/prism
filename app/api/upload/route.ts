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
    const { error: uploadError } = await supabaseAdmin.storage
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

    // Trigger ingestion in background (will build in Phase 2)
    // For now, just mark as ready after a delay
    setTimeout(async () => {
      try {
        await supabaseAdmin
          .from('documents')
          .update({ status: 'ready' })
          .eq('id', document.id)
        console.log(`Document ${document.id} marked as ready`)
      } catch (error) {
        console.error('Error updating status:', error)
      }
    }, 5000) // 5 seconds delay for demo

    console.log('Upload successful:', {
      documentId: document.id,
      filename: file.name,
      size: file.size
    })

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileUrl: publicUrl,
      message: 'Upload successful! Processing will begin in Phase 2.'
    })

  } catch (error: unknown) {
    console.error('Upload error:', error);
    let errorMessage = 'Upload failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}