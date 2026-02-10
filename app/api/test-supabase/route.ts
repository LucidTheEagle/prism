import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Test 1: Check if we can connect to Supabase
    const { error: healthError } = await supabaseAdmin
      .from('documents')
      .select('count')
      .limit(0)
      .single()

    // This will error but proves connection works
    const canConnect = healthError?.code !== 'PGRST301' // Not auth error

    // Test 2: Check storage bucket
    const { data: buckets, error: bucketError } = await supabaseAdmin
      .storage
      .listBuckets()

    if (bucketError) {
      console.error('Bucket error:', bucketError)
    }

    const documentBucket = buckets?.find(b => b.name === 'document-uploads')

    // Test 3: Check if documents table exists by trying to query it
    const { error: tableError } = await supabaseAdmin
      .from('documents')
      .select('id')
      .limit(0)

    const documentsTableExists = !tableError

    // Test 4: Check if document_chunks table exists
    const { error: chunksError } = await supabaseAdmin
      .from('document_chunks')
      .select('id')
      .limit(0)

    const chunksTableExists = !chunksError

    return NextResponse.json({
      success: true,
      connection: {
        supabase: canConnect,
        message: canConnect ? 'Connected ✅' : 'Connection failed ❌'
      },
      storage: {
        bucketExists: !!documentBucket,
        bucketName: documentBucket?.name,
        isPublic: documentBucket?.public,
        message: documentBucket ? 'Bucket ready ✅' : 'Bucket not found ❌'
      },
      database: {
        documentsTable: documentsTableExists,
        chunksTable: chunksTableExists,
        message: (documentsTableExists && chunksTableExists) 
          ? 'All tables ready ✅' 
          : 'Run schema SQL in Supabase ⚠️'
      },
      nextSteps: !documentsTableExists 
        ? 'Run sql-03-complete-schema.sql in Supabase SQL Editor'
        : 'All set! Ready for Checkpoint 1.4'
    })

  } catch (error: unknown) {
    console.error('Supabase test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        hint: 'Check your .env.local file for correct Supabase keys',
        message: 'Connection failed ❌'
      },
      { status: 500 }
    )
  }
}