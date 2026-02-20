import { NextRequest, NextResponse } from 'next/server'
import { runIngestionPipeline } from '@/lib/ai/ingestion-pipeline'
import type { EnrichmentConfig } from '@/lib/ai/metadata-enrichment'

/**
 * POST /api/ingest
 *
 * Thin wrapper around runIngestionPipeline() for external or manual
 * triggers (e.g. re-processing a failed document from an admin UI).
 *
 * In the normal upload flow, the pipeline is called directly via
 * runIngestionPipeline() — no HTTP hop — so this route is not used
 * for standard document uploads.
 *
 * Auth: This route is called server-to-server or by admin tooling.
 * It uses supabaseAdmin internally (bypasses RLS) — do not expose
 * this endpoint publicly without an additional secret check.
 *
 * Note: The proxy (middleware) already blocks unauthenticated requests
 * to /api/* — an authenticated session is required to reach this route.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let documentId: string | null = null

  try {
    const body = await request.json()
    documentId = body.documentId
    const enrichmentConfig: EnrichmentConfig | undefined = body.enrichmentConfig

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId in request body' },
        { status: 400 }
      )
    }

    const result = await runIngestionPipeline(documentId, enrichmentConfig)

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      performance: {
        total_duration_ms: result.totalDurationMs,
        total_duration_seconds: +(result.totalDurationMs / 1000).toFixed(2),
        total_cost: +result.totalCost.toFixed(6),
      },
      message: 'Document processed successfully.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
        documentId,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}