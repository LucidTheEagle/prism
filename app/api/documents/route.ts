import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/documents
 * 
 * List all documents
 */
export async function GET() {
  try {
    const { data: documents, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      documents: documents || [],
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        documents: [],
      },
      { status: 500 }
    )
  }
}