import { runAletheia, runAletheiaRetry, AletheiaError } from './aletheia'
import { runKratos, runKratosOnRetry, KratosError } from './kratos'
import { runPronoia, PronoiaError } from './pronoia'
import { runLogos, LogosError } from './logos'
import {
  generateQueryEmbedding,
  vectorSearch,
  bm25Search,
  reciprocalRankFusion,
  deduplicateResults,
} from '@/lib/ai/hybrid-search'
import type {
  PipelineResult,
  KratosOutputRetryTriggered,
  KratosOutputStandard,
  AletheiaOutput,
} from '@/lib/types'

// ============================================================================
// PIPELINE ORCHESTRATOR
// Sequences all four agents. Enforces all routing decisions in code.
// Entry point: runPipeline(query, documentText, documentId, userId)
// Returns: PipelineResult — carries all four agent outputs for chain of custody
// ============================================================================

export interface OrchestratorInput {
  query: string
  documentText: string
  documentId: string
  userId: string
}

// ----------------------------------------------------------------------------
// runPipeline — main entry point
// ----------------------------------------------------------------------------
export async function runPipeline(
  input: OrchestratorInput
): Promise<PipelineResult> {
  const startTime = Date.now()
  const { query, documentText, documentId, userId } = input

  console.log(`\n${'='.repeat(80)}`)
  console.log(`[Pipeline] Starting — query: "${query}"`)
  console.log(`[Pipeline] Document: ${documentId}`)
  console.log(`${'='.repeat(80)}\n`)

  // Token accumulators — per agent, for chain of custody log
  const tokens = {
    aletheia: { input: 0, output: 0 },
    kratos: { input: 0, output: 0 },
    pronoia: { input: 0, output: 0 },
    logos: { input: 0, output: 0 },
  }

  // ── Stage 1: Aletheia — Retrieval ──────────────────────────────────────────
  console.log('[Pipeline] Stage 1 — Aletheia')
  let aletheiaOutput: AletheiaOutput

  try {
    const aletheiaResult = await runAletheia(query, documentText)
    aletheiaOutput = aletheiaResult.output
    tokens.aletheia.input += aletheiaResult.tokens_input
    tokens.aletheia.output += aletheiaResult.tokens_output
  } catch (error) {
    if (error instanceof AletheiaError) {
      console.error('[Pipeline] Aletheia failed — routing to Red response')
      return buildErrorResult(input, tokens, startTime, 'Aletheia retrieval failed')
    }
    throw error
  }

  // ── Stage 2: Kratos — Verification (first pass) ────────────────────────────
  console.log('[Pipeline] Stage 2 — Kratos (first pass)')
  let kratosResult: Awaited<ReturnType<typeof runKratos>>

  try {
    kratosResult = await runKratos(aletheiaOutput, documentText)
    tokens.kratos.input += kratosResult.tokens_input
    tokens.kratos.output += kratosResult.tokens_output
  } catch (error) {
    if (error instanceof KratosError) {
      console.error('[Pipeline] Kratos failed — routing to Red response')
      return buildErrorResult(input, tokens, startTime, 'Kratos verification failed')
    }
    throw error
  }

  // ── Retry routing — Kratos triggered retry ─────────────────────────────────
  if (kratosResult.output.audit_status === 'retry_triggered') {
    console.log('[Pipeline] Kratos triggered retry — routing to Aletheia second pass')

    const retrySchema = kratosResult.output as KratosOutputRetryTriggered
    const firstPassCounts = {
      claims_audited: retrySchema.claims_audited,
      claims_blocked: retrySchema.claims_blocked,
    }
    const firstPassBlockedClaims = retrySchema.blocked_claims

    // Build hybrid search guidance for retry
    // Orchestrator is the sole caller of hybrid search in the pipeline path
    const retryGuidance = await buildRetryGuidance(
      retrySchema.retry_query,
      documentId,
      userId
    )

    // Aletheia second pass — retry_query + full document + section guidance
    let aletheiaRetryOutput: AletheiaOutput
    try {
      const retryResult = await runAletheiaRetry(
        {
          retry_query: retrySchema.retry_query,
          retry_rationale: retrySchema.retry_rationale,
        },
        documentText + retryGuidance
      )
      aletheiaRetryOutput = retryResult.output
      tokens.aletheia.input += retryResult.tokens_input
      tokens.aletheia.output += retryResult.tokens_output
    } catch (error) {
      if (error instanceof AletheiaError) {
        console.error('[Pipeline] Aletheia retry failed — routing to Red response')
        return buildErrorResult(input, tokens, startTime, 'Aletheia retry failed')
      }
      throw error
    }

    // Kratos second pass
    console.log('[Pipeline] Kratos — second pass (retry audit)')
    try {
      kratosResult = await runKratosOnRetry(
        aletheiaRetryOutput,
        documentText,
        firstPassCounts,
        firstPassBlockedClaims
      )
      tokens.kratos.input += kratosResult.tokens_input
      tokens.kratos.output += kratosResult.tokens_output

      // Update aletheiaOutput to retry output for PipelineResult
      aletheiaOutput = aletheiaRetryOutput
    } catch (error) {
      if (error instanceof KratosError) {
        console.error('[Pipeline] Kratos retry audit failed — routing to Red response')
        return buildErrorResult(input, tokens, startTime, 'Kratos retry verification failed')
      }
      throw error
    }
  }

  // ── Stage 3: Pronoia — Analysis (conditional) ──────────────────────────────
  console.log('[Pipeline] Stage 3 — Pronoia')
  let pronoiaResult: Awaited<ReturnType<typeof runPronoia>>

  try {
    pronoiaResult = await runPronoia(kratosResult.output, query)
    tokens.pronoia.input += pronoiaResult.tokens_input
    tokens.pronoia.output += pronoiaResult.tokens_output
  } catch (error) {
    if (error instanceof PronoiaError) {
      console.error('[Pipeline] Pronoia failed — continuing to Logos with silent Pronoia')
      // Pronoia failure degrades gracefully — Logos synthesizes from Kratos alone
      pronoiaResult = {
        output: {
          activation_status: 'silent',
          reason: 'Pronoia encountered an error — degraded to silent mode',
        },
        tokens_input: 0,
        tokens_output: 0,
      }
    } else {
      throw error
    }
  }

  // ── Stage 4: Logos — Synthesis ─────────────────────────────────────────────
  console.log('[Pipeline] Stage 4 — Logos')
  let logosResult: Awaited<ReturnType<typeof runLogos>>

  try {
    logosResult = await runLogos(kratosResult.output, pronoiaResult.output, query)
    tokens.logos.input += logosResult.tokens_input
    tokens.logos.output += logosResult.tokens_output
  } catch (error) {
    if (error instanceof LogosError) {
      console.error('[Pipeline] Logos failed')
      return buildErrorResult(input, tokens, startTime, 'Logos synthesis failed')
    }
    throw error
  }

  // ── Populate citation document_id from document context ───────────────────
  const citations = logosResult.citations.map((citation) => ({
    ...citation,
    document_id: documentId,
  }))

  const totalTime = Date.now() - startTime
  const finalKratosOutput = kratosResult.output
  const retryAttempted = isKratosOutputStandard(finalKratosOutput)
    ? false
    : finalKratosOutput.retry_attempted

  console.log(`\n${'='.repeat(80)}`)
  console.log(`[Pipeline] Complete — ${totalTime}ms | category: ${logosResult.output.epistemic_category}`)
  console.log(`[Pipeline] Tokens — Aletheia: ${tokens.aletheia.input}in/${tokens.aletheia.output}out | Kratos: ${tokens.kratos.input}in/${tokens.kratos.output}out | Pronoia: ${tokens.pronoia.input}in/${tokens.pronoia.output}out | Logos: ${tokens.logos.input}in/${tokens.logos.output}out`)
  console.log(`${'='.repeat(80)}\n`)

  return {
    logos: logosResult.output,
    aletheia: aletheiaOutput,
    kratos: finalKratosOutput,
    pronoia: pronoiaResult.output,
    query,
    document_id: documentId,
    retry_attempted: retryAttempted,
    total_time_ms: totalTime,
    tokens_per_agent: tokens,
    citations,
  }
}

function isKratosOutputStandard(
  output: PipelineResult['kratos']
): output is KratosOutputStandard {
  return output.retry_triggered === false
}

// ----------------------------------------------------------------------------
// buildRetryGuidance
// Calls hybrid search with Kratos's retry_query to generate section guidance
// Appended to documentText for Aletheia's second pass
// Orchestrator is the sole caller of hybrid search in the pipeline path
// ----------------------------------------------------------------------------
async function buildRetryGuidance(
  retryQuery: string,
  documentId: string,
  userId: string
): Promise<string> {
  try {
    console.log(`[Pipeline] Building retry guidance — query: "${retryQuery}"`)

    const queryEmbedding = await generateQueryEmbedding(retryQuery)

    const [vectorResults, bm25Results] = await Promise.all([
      vectorSearch(queryEmbedding, documentId, 10, 0.3, userId),
      bm25Search(retryQuery, documentId, 10, userId),
    ])

    const fused = reciprocalRankFusion(vectorResults, bm25Results, 0.7, 0.3)
    const guidance = deduplicateResults(fused.slice(0, 5))

    if (guidance.length === 0) {
      console.log('[Pipeline] Retry guidance — no additional sections found')
      return ''
    }

    const guidanceText = guidance
      .map((result, index) => {
        const page = result.metadata?.page ?? 'unknown'
        const section = result.metadata?.section_header ?? 'unknown section'
        return `[RETRY GUIDANCE ${index + 1}] Page ${page} — ${section}:\n${result.content}`
      })
      .join('\n\n')

    console.log(`[Pipeline] Retry guidance — ${guidance.length} sections identified`)

    return `\n\n--- RETRY SEARCH GUIDANCE ---\nThe following sections may be relevant to the reformulated query. Search these areas thoroughly:\n\n${guidanceText}\n--- END RETRY GUIDANCE ---`
  } catch (error) {
    // Retry guidance failure is non-fatal — Aletheia retries with full document only
    console.error('[Pipeline] Retry guidance failed — Aletheia retries without guidance:', error)
    return ''
  }
}

// ----------------------------------------------------------------------------
// buildErrorResult
// Returns a valid PipelineResult with Red epistemic category on agent failure
// ----------------------------------------------------------------------------
function buildErrorResult(
  input: OrchestratorInput,
  tokens: PipelineResult['tokens_per_agent'],
  startTime: number,
  reason: string
): PipelineResult {
  const emptyAletheia: AletheiaOutput = {
    retrieval_status: 'empty',
    query_received: input.query,
    search_scope: 'full_document',
    claims: [],
    empty_declaration: reason,
  }

  return {
    logos: {
      epistemic_category: 'SILENT',
      answer: `PRISM encountered an error processing this query. ${reason}.`,
      closing_statement: 'Please try again or contact support if the issue persists.',
    },
    aletheia: emptyAletheia,
    kratos: {
      audit_status: 'empty',
      claims_audited: 0,
      claims_verified: 0,
      claims_blocked: 0,
      retry_triggered: false,
      retry_attempted: false,
      retry_failed: false,
      verified_claims: [],
      adjacent_claims: [],
      blocked_claims: [],
    },
    pronoia: {
      activation_status: 'silent',
      reason,
    },
    query: input.query,
    document_id: input.documentId,
    retry_attempted: false,
    total_time_ms: Date.now() - startTime,
    tokens_per_agent: tokens,
    citations: [],
  }
}