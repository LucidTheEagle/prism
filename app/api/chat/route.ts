import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'
import { analyzeQuery } from '@/lib/ai/query-analysis'
import { generateAnswer } from '@/lib/ai/answer-generation'
import { getSubscription } from '@/lib/billing/getSubscription'
import { checkQueryAccess } from '@/lib/billing/checkAccess'
import { trackQuery } from '@/lib/billing/trackUsage'
import { logAudit } from '@/lib/billing/logAudit'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

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

    // ── 2. Subscription + access check ───────────────────────────
    const subscription = await getSubscription(user.id)
    const access = await checkQueryAccess(subscription, user.id)

    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason,
          code: 'QUERY_LIMIT_REACHED',
          tier: access.tier,
          limit: access.limit,
          current: access.current,
          upgrade_required: true,
        },
        { status: 403 }
      )
    }

    // ── 3. Parse and validate request body ────────────────────────
    const body = await request.json()
    const { query, documentId } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'documentId is required for pipeline queries' },
        { status: 400 }
      )
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`User: ${user.id} | Tier: ${subscription.tier}`)
    console.log(`Query: "${query}"`)
    console.log(`Document ID: ${documentId}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(80)}\n`)

    // ── 4. Fetch document — ownership + full text ─────────────────
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('document_type, complexity_score, key_entities, name, user_id, file_url')
      .eq('id', documentId)
      .eq('status', 'ready')
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found or not ready' },
        { status: 404 }
      )
    }

    if (document.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    console.log(`[Context] Document: ${document.name}`)

    // ── 5. Fetch full document text from Supabase Storage ─────────
    // Required by Aletheia — full document text, not pre-chunked results
    console.log('[Step 1/3] Fetching document text...')
    let documentText: string

    try {
      const fileUrl = document.file_url as string

      // Extract bucket and file path from Supabase Storage URL
      // Handles both formats:
      // Format A (with access mode): /storage/v1/object/public/<bucket>/<path>
      // Format B (without access mode): /storage/v1/object/<bucket>/<path>
      const marker = '/storage/v1/object/'

      let pathname: string
      try {
        pathname = fileUrl.startsWith('http')
          ? new URL(fileUrl).pathname
          : fileUrl
      } catch {
        throw new Error(`Invalid file_url: ${fileUrl}`)
      }

      const markerIndex = pathname.indexOf(marker)
      if (markerIndex === -1) {
        throw new Error(`Storage marker not found in path: ${pathname}`)
      }

      const remainder = pathname.slice(markerIndex + marker.length)
      const segments = remainder.split('/').filter(Boolean)

      if (segments.length < 2) {
        throw new Error(`Insufficient path segments in: ${remainder}`)
      }

      let bucket: string
      let filePath: string

      // Detect format — if first segment is a known access mode prefix, skip it
      const accessModes = ['public', 'authenticated', 'sign']
      if (accessModes.includes(segments[0])) {
        // Format A: public/<bucket>/<path>
        if (segments.length < 3) {
          throw new Error(`Invalid storage path after access mode: ${remainder}`)
        }
        bucket = segments[1]
        filePath = decodeURIComponent(segments.slice(2).join('/'))
      } else {
        // Format B: <bucket>/<path> — direct, no access mode prefix
        bucket = segments[0]
        filePath = decodeURIComponent(segments.slice(1).join('/'))
      }

      console.log(`[Step 1/3] Downloading from bucket: ${bucket}, path: ${filePath}`)

      const { data: fileData, error: storageError } = await supabaseAdmin
        .storage
        .from(bucket)
        .download(filePath)

      if (storageError || !fileData) {
        throw new Error(
          `Storage download failed (bucket="${bucket}", path="${filePath}"): ${storageError?.message}`
        )
      }

      documentText = await fileData.text()
      console.log(`[Step 1/3] Document text fetched — ${documentText.length} characters`)
    } catch (error) {
      console.error('[Chat] Document text fetch failed:', error)
      return NextResponse.json(
        {
          error: `Failed to load document content for analysis: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        { status: 500 }
      )
    }

    // ── 6. Query Analysis ─────────────────────────────────────────
    // Stays in the route — orchestrator does not call analyzeQuery
    console.log('[Step 2/3] Analyzing query...')
    const documentContext = {
      document_type: document.document_type || undefined,
      complexity_score: document.complexity_score || undefined,
      key_entities: document.key_entities || undefined,
    }
    const analysis = await analyzeQuery(query, documentContext)
    console.log(`✓ Query type: ${analysis.query_type}`)

    // ── 7. Run pipeline ───────────────────────────────────────────
    console.log('[Step 3/3] Running PRISM pipeline...')
    const pipelineResult = await generateAnswer(
      query,
      documentText,
      documentId,
      user.id
    )
    console.log(`✓ Pipeline complete | category: ${pipelineResult.logos.epistemic_category}`)

    // ── 8. Track usage (non-blocking) ────────────────────────────
    const totalTokensInput = Object.values(pipelineResult.tokens_per_agent)
      .reduce((sum, agent) => sum + agent.input, 0)
    const totalTokensOutput = Object.values(pipelineResult.tokens_per_agent)
      .reduce((sum, agent) => sum + agent.output, 0)

    trackQuery({
      userId: user.id,
      subscription,
      tokensInput: totalTokensInput,
      tokensOutput: totalTokensOutput,
    }).catch((err) => console.error('[Chat] Usage tracking failed:', err))

    // ── 9. Audit log ──────────────────────────────────────────────
    logAudit({
      userId: user.id,
      documentId: documentId ?? null,
      eventType: 'document_query',
      queryText: query,
      responseConfidence: null,           // float replaced by epistemic_category
      chunksAccessed: pipelineResult.aletheia.claims.length,
      durationMs: Date.now() - startTime,
      metadata: {
        query_type: analysis.query_type,
        tier: subscription.tier,
        epistemic_category: pipelineResult.logos.epistemic_category,
        retry_attempted: pipelineResult.retry_attempted,
        claims_verified: pipelineResult.kratos.claims_verified,
        claims_blocked: pipelineResult.kratos.claims_blocked,
        pronoia_activated: pipelineResult.pronoia.activation_status === 'active',
        tokens_per_agent: pipelineResult.tokens_per_agent,
      },
      request,
    }).catch(() => null)

    // ── 10. Persist chat message ──────────────────────────────────
    const { error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .insert([
        {
          document_id: documentId,
          user_id: user.id,
          role: 'user',
          content: query,
          confidence: null,
          citations: null,
        },
        {
          document_id: documentId,
          user_id: user.id,
          role: 'assistant',
          content: pipelineResult.logos.answer,
          confidence: null,                // float replaced by epistemic_category
          citations: pipelineResult.citations,
        },
      ])

    if (msgError) {
      console.error('[Chat] Failed to persist message:', msgError.message)
    }

    // ── 11. Store pipeline audit for chain of custody ─────────────
    // Data captured now — exportable signed format is V1.1 feature
    // pipeline_audit stored in metadata for future audit log export
    const pipelineAudit = {
      aletheia: pipelineResult.aletheia,
      kratos: pipelineResult.kratos,
      pronoia: pipelineResult.pronoia,
      tokens_per_agent: pipelineResult.tokens_per_agent,
      retry_attempted: pipelineResult.retry_attempted,
      total_time_ms: pipelineResult.total_time_ms,
    }

    // ── 12. Build response ────────────────────────────────────────
    const totalDuration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      query,
      // Core answer fields — frontend contract
      answer: pipelineResult.logos.answer,
      epistemic_category: pipelineResult.logos.epistemic_category,
      closing_statement: pipelineResult.logos.closing_statement,
      citations: pipelineResult.citations,
      // Metadata — extended, not replaced
      metadata: {
        query_type: analysis.query_type,
        epistemic_category: pipelineResult.logos.epistemic_category,
        claims_verified: pipelineResult.kratos.claims_verified,
        claims_blocked: pipelineResult.kratos.claims_blocked,
        pronoia_activated: pipelineResult.pronoia.activation_status === 'active',
        retry_attempted: pipelineResult.retry_attempted,
        processing_time_ms: totalDuration,
        tokens_per_agent: pipelineResult.tokens_per_agent,
      },
      // Pipeline audit — chain of custody data
      pipeline_audit: pipelineAudit,
    })

  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message, duration_ms: duration },
      { status: 500 }
    )
  }
}