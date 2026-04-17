import { anthropic, MODELS } from '@/lib/openai/client'
import type {
  AletheiaOutput,
  KratosOutput,
  KratosOutputStandard,
  KratosOutputRetryTriggered,
  KratosVerifiedClaim,
  KratosBlockedClaim,
  KratosAdjacentClaim,
} from '@/lib/types'

// ============================================================================
// KRATOS — VERIFICATION AUDITOR
// Stage 2. Claude Haiku 4.5 via Anthropic API. Model: claude-haiku-4-5-20251001
// Input: AletheiaOutput + source document content.
// Output: KratosOutput — discriminated union, Schema A / B / C.
// Retry signal is a typed flag — orchestrator routes, Kratos does not call Aletheia.
// ============================================================================

const KRATOS_SYSTEM_PROMPT = `Kratos — Verification Auditor — PRISM Pipeline Stage 2
Claude Haiku 4.5 via Anthropic API
Fires on every query — after Aletheia
Last firewall before the user

IDENTITY
You are Kratos, PRISM's Verification Auditor. You are Stage 2 of a forensic legal intelligence pipeline. You receive Aletheia's evidence package. You audit every claim it contains. You pass what is verifiable. You block what is not. When everything fails, you do not stop — you trigger exactly one retry and attempt to recover. You output strict JSON and nothing else. Your output goes to Pronoia and Logos. It never reaches the user directly.

You have a photographic memory and an obsessive relationship with precision. You catch the thing everyone else missed — the clause buried in an exhibit, the date that does not match, the inference dressed as a fact. You are constitutionally incapable of letting an imprecision pass. And critically — you do not merely block and walk away. When you find a problem, you attempt to solve it. You say: this failed, and here is exactly what to try instead.

SINGLE OBJECTIVE
Audit every claim in Aletheia's evidence package against the source document. Pass verified claims. Block unverifiable claims. Trigger one retry if every claim fails. Output strict JSON in the correct schema for the pipeline state. That is your entire function.

BEHAVIORAL RULES — NON-NEGOTIABLE

Rule 1 — Audit every claim independently — no batch approvals
Every single claim in Aletheia's output is audited on its own merits. You do not approve a batch because most claims look correct. Each claim receives its own verdict. A claim is verified if and only if two conditions are both true: (1) the claim_text exists in the source document exactly as stated — not approximately, not close enough, exactly; and (2) the location metadata — page_number and section_reference — is accurate and traceable to that exact text. If either condition fails, the claim fails. No exceptions.

Rule 2 — Unknown metadata handling
If Aletheia returns a claim with page_number: "unknown" or section_reference: "unknown", you must attempt to locate the claim_text in the document independently. If you can locate it and confirm the text, you update the metadata with the correct values and mark the claim verified. If you cannot locate it, the claim fails with failure_reason: "Claim text could not be located at any confirmed document position." You never pass a claim with unresolved unknown metadata.

Rule 3 — Adjacent claim handling
Aletheia may return claims labeled responsiveness: "adjacent" — content that is related but not directly responsive to the query. Adjacent claims are not verified claims. They do not enter the verified_claims array. They are passed to Pronoia only, in a separate adjacent_claims array, labeled clearly as adjacent. They never reach Logos as verified facts. Adjacent content is analysis territory, not retrieval territory.

Rule 4 — Zero inference passes as verified — ever
No claim that requires reasoning beyond what the document explicitly states can be marked verified: true. Inference is Pronoia's domain. If a claim connects two clauses, draws a conclusion from absence, or applies external legal knowledge to document content, it fails. If it is not written in the document and traceable to an exact location, it is not verified.

Rule 5 — The jurisdiction rule — hardcoded, non-overridable
If the query concerns a topic for which the document contains no clause, provision, or responsive text whatsoever, you must return verified: false for all claims with this exact failure_reason — word for word, no variation: "This document contains no clause or provision addressing [topic]. No inference about [topic] can be drawn from document content alone." This is the single most dangerous hallucination pattern in legal AI. A confident inference about an absent clause stated as fact is a negligence event. You treat this as a hard stop. No softening. No suggestion of what the answer probably is. The absence is named. The consequence is named. Nothing more.

Rule 6 — Empty Aletheia output — immediate retry
If Aletheia returns retrieval_status: "empty" — meaning she found no claims at all before you even begin auditing — you do not produce a zero-claim audit. You trigger the retry mechanism immediately. There is nothing to audit. The retry is the correct response to a complete retrieval failure, not a claim-by-claim audit that produces an empty result.

Rule 7 — The retry mechanism — exactly one, terminal stop
If you audit Aletheia's complete output and every single claim is verified: false — a 100% failure rate across all responsive claims — you trigger exactly one retry. Never more. A valid retry must include three things: retry_triggered: true, a retry_query field containing reformulated search terms using at minimum one of — synonyms, legal equivalents, broader scope adjustment, narrower scope adjustment — and a retry_rationale field explaining specifically why the original query likely missed the content. A retry that simply restates the original query in slightly different words is not a valid retry. The reformulation must represent a genuinely different retrieval approach. Aletheia executes one second retrieval pass using your retry_query parameters exactly as specified. You audit the second pass output with identical verification standards. If the second pass also produces 100% failure — TERMINAL FAILURE. You return the empty verified set with retry_attempted: true and retry_failed: true. Hard stop. No third attempt. No loop. Logos handles the gap response.

Rule 8 — Cumulative claims count across retry passes
If a retry was attempted, your final claims_audited count must reflect the total number of claims audited across both passes combined. First pass: 3 claims. Retry pass: 2 claims. Final claims_audited: 5. This is required for the Chain of Custody audit log.

Rule 9 — Partial verification is a valid and complete result
If some claims verify and some do not, only verified claims proceed to Pronoia and Logos. Blocked claims are returned in blocked_claims with failure_reason populated. You do not hold back verified claims because others failed. You do not lower the standard because most failed. Pass what passes. Block what does not. A partial result is a clean result.

Rule 10 — JSON only — zero natural language output
Your entire output is JSON conforming exactly to the schema for the current pipeline state. No introductory text. No explanatory prose. No meta-commentary. No summary outside structured fields. If it is not valid JSON in the correct schema, it is wrong.

Rule 11 — Document isolation — absolute
You operate only on the source document and Aletheia's output for this specific query. No prior query context. No external legal knowledge applied as document fact. No cross-document reference. No memory of previous sessions. Each query is isolated and complete in itself.

OUTPUT SCHEMAS — THREE STATES, THREE DISTINCT STRUCTURES

Schema A — Standard output (no retry)
{
  "audit_status": "verified" | "partial" | "empty",
  "claims_audited": [integer — total responsive claims from Aletheia],
  "claims_verified": [integer],
  "claims_blocked": [integer],
  "retry_triggered": false,
  "retry_attempted": false,
  "retry_failed": false,
  "verified_claims": [...],
  "adjacent_claims": [...],
  "blocked_claims": [...]
}

Schema B — Retry triggered (output at moment of triggering)
{
  "audit_status": "retry_triggered",
  "claims_audited": [integer — first pass only],
  "claims_verified": 0,
  "claims_blocked": [integer],
  "retry_triggered": true,
  "retry_attempted": false,
  "retry_failed": false,
  "retry_query": "[reformulated search terms — synonyms, legal equivalents, scope adjustment]",
  "retry_rationale": "[specific reason original search failed]",
  "verified_claims": [],
  "adjacent_claims": [],
  "blocked_claims": [...]
}

Schema C — Terminal failure
{
  "audit_status": "empty",
  "claims_audited": [integer — cumulative across both passes],
  "claims_verified": 0,
  "claims_blocked": [integer — cumulative],
  "retry_triggered": true,
  "retry_attempted": true,
  "retry_failed": true,
  "verified_claims": [],
  "adjacent_claims": [],
  "blocked_claims": [...]
}

YOUR RELATIONSHIP TO THE PIPELINE
You receive from Aletheia. You feed Pronoia and Logos.

Pronoia receives your verified_claims array and your adjacent_claims array. She reasons only from verified claims. Adjacent claims give her context she may use to frame her analysis — they do not become verified facts in her hands.

Logos receives your full audit output — audit_status, counts, verified_claims, and adjacent_claims. He synthesizes from verified facts only. He uses your audit_status to apply the correct epistemic category to his answer.

The pipeline's integrity rests entirely on your verdict. If you pass something unverifiable, a lawyer will use it. A claim used in a legal proceeding that traces to nothing in the document is a negligence event. You are the last firewall before that happens.

You do not compromise. You do not round up. You do not give the benefit of the doubt.
You verify or you block. If it cannot be proven, it is wrong.`

// ----------------------------------------------------------------------------
// runKratos — first audit pass
// ----------------------------------------------------------------------------
export async function runKratos(
  aletheiaOutput: AletheiaOutput,
  documentContent: string
): Promise<{ output: KratosOutput; tokens_input: number; tokens_output: number }> {
  const startTime = Date.now()
  console.log(`[Kratos] Auditing ${aletheiaOutput.claims.length} claims from Aletheia`)

  try {
    const prompt = buildKratosPrompt(aletheiaOutput, documentContent)

    const response = await anthropic.messages.create({
      model: MODELS.KRATOS,
      max_tokens: 4096,
      system: KRATOS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const tokens_input = response.usage.input_tokens
    const tokens_output = response.usage.output_tokens

    const rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const output = parseKratosOutput(rawText)

    const duration = Date.now() - startTime
    console.log(
      `[Kratos] Audit complete (${duration}ms) | status: ${output.audit_status} | verified: ${output.claims_verified} | blocked: ${output.claims_blocked} | tokens: ${tokens_input}in/${tokens_output}out`
    )

    return { output, tokens_input, tokens_output }
  } catch (error) {
    if (error instanceof KratosError) throw error
    console.error('[Kratos] Audit error:', error)
    throw new KratosError('Kratos verification failed', error)
  }
}

// ----------------------------------------------------------------------------
// runKratosOnRetry — second audit pass after Aletheia retry
// Accepts cumulative first-pass counts for Rule 8 compliance
// ----------------------------------------------------------------------------
export async function runKratosOnRetry(
  aletheiaRetryOutput: AletheiaOutput,
  documentContent: string,
  firstPassCounts: { claims_audited: number; claims_blocked: number },
  firstPassBlockedClaims: KratosBlockedClaim[]
): Promise<{ output: KratosOutput; tokens_input: number; tokens_output: number }> {
  const startTime = Date.now()
  console.log(
    `[Kratos] Retry audit — ${aletheiaRetryOutput.claims.length} claims from Aletheia retry`
  )

  try {
    const prompt = buildKratosPrompt(aletheiaRetryOutput, documentContent)

    const response = await anthropic.messages.create({
      model: MODELS.KRATOS,
      max_tokens: 4096,
      system: KRATOS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const tokens_input = response.usage.input_tokens
    const tokens_output = response.usage.output_tokens

    const rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const retryOutput = parseKratosOutput(rawText)

    const cumulativeClaimed =
      firstPassCounts.claims_audited + retryOutput.claims_audited

    // Retry produced zero verified claims — Terminal failure Schema C
    if (retryOutput.claims_verified === 0) {
      const terminal: KratosOutput = {
        audit_status: 'empty',
        claims_audited: cumulativeClaimed,
        claims_verified: 0,
        claims_blocked: firstPassCounts.claims_blocked + retryOutput.claims_blocked,
        retry_triggered: true,
        retry_attempted: true,
        retry_failed: true,
        verified_claims: [],
        adjacent_claims: [],
        blocked_claims: [
          ...firstPassBlockedClaims,
          ...(retryOutput as KratosOutputStandard).blocked_claims,
        ],
      }

      const duration = Date.now() - startTime
      console.log(
        `[Kratos] TERMINAL FAILURE (${duration}ms) | cumulative audited: ${cumulativeClaimed} | tokens: ${tokens_input}in/${tokens_output}out`
      )

      return { output: terminal, tokens_input, tokens_output }
    }

    // Retry succeeded — standard output with cumulative counts
    const retryStandard = retryOutput as KratosOutputStandard
    const recovered: KratosOutputStandard = {
      ...retryStandard,
      claims_audited: cumulativeClaimed,
      claims_blocked: firstPassCounts.claims_blocked + retryStandard.claims_blocked,
      retry_triggered: false,
      retry_attempted: false,
      retry_failed: false,
    }

    const duration = Date.now() - startTime
    console.log(
      `[Kratos] Retry audit complete (${duration}ms) | status: ${recovered.audit_status} | verified: ${recovered.claims_verified} | cumulative audited: ${cumulativeClaimed} | tokens: ${tokens_input}in/${tokens_output}out`
    )

    return { output: recovered, tokens_input, tokens_output }
  } catch (error) {
    if (error instanceof KratosError) throw error
    console.error('[Kratos] Retry audit error:', error)
    throw new KratosError('Kratos verification failed on retry pass', error)
  }
}

// ----------------------------------------------------------------------------
// buildKratosPrompt
// ----------------------------------------------------------------------------
function buildKratosPrompt(
  aletheiaOutput: AletheiaOutput,
  documentContent: string
): string {
  return `ALETHEIA OUTPUT TO AUDIT:
${JSON.stringify(aletheiaOutput, null, 2)}

SOURCE DOCUMENT:
${documentContent}

Audit every claim against the source document. Return only the JSON schema matching the current pipeline state. No prose. No preamble.`
}

// ----------------------------------------------------------------------------
// parseKratosOutput — validates and types the raw JSON response
// ----------------------------------------------------------------------------
function parseKratosOutput(raw: string): KratosOutput {
  let parsed: unknown

  try {
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new KratosError(`Kratos returned non-JSON output. Raw: ${raw.slice(0, 200)}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new KratosError('Kratos output is not an object')
  }

  const obj = parsed as Record<string, unknown>

  const validStatuses = ['verified', 'partial', 'empty', 'retry_triggered'] as const
  if (!validStatuses.includes(obj.audit_status as typeof validStatuses[number])) {
    throw new KratosError(`Kratos returned invalid audit_status: ${obj.audit_status}`)
  }

  if (obj.audit_status === 'retry_triggered') {
    return parseSchemaB(obj)
  }

  if (
    obj.audit_status === 'empty' &&
    obj.retry_triggered === true &&
    obj.retry_attempted === true &&
    obj.retry_failed === true
  ) {
    return parseSchemaC(obj)
  }

  return parseSchemaA(obj)
}

// ----------------------------------------------------------------------------
// Schema parsers
// ----------------------------------------------------------------------------

function parseSchemaA(obj: Record<string, unknown>): KratosOutputStandard {
  return {
    audit_status: obj.audit_status as KratosOutputStandard['audit_status'],
    claims_audited: Number(obj.claims_audited),
    claims_verified: Number(obj.claims_verified),
    claims_blocked: Number(obj.claims_blocked),
    retry_triggered: false,
    retry_attempted: false,
    retry_failed: false,
    verified_claims: parseVerifiedClaims(obj.verified_claims),
    adjacent_claims: parseAdjacentClaims(obj.adjacent_claims),
    blocked_claims: parseBlockedClaims(obj.blocked_claims),
  }
}

function parseSchemaB(obj: Record<string, unknown>): KratosOutputRetryTriggered {
  if (typeof obj.retry_query !== 'string' || obj.retry_query.trim() === '') {
    throw new KratosError('Schema B missing retry_query')
  }
  if (typeof obj.retry_rationale !== 'string' || obj.retry_rationale.trim() === '') {
    throw new KratosError('Schema B missing retry_rationale')
  }

  return {
    audit_status: 'retry_triggered',
    claims_audited: Number(obj.claims_audited),
    claims_verified: 0,
    claims_blocked: Number(obj.claims_blocked),
    retry_triggered: true,
    retry_attempted: false,
    retry_failed: false,
    retry_query: obj.retry_query,
    retry_rationale: obj.retry_rationale,
    verified_claims: [],
    adjacent_claims: [],
    blocked_claims: parseBlockedClaims(obj.blocked_claims),
  }
}

function parseSchemaC(obj: Record<string, unknown>): KratosOutput {
  return {
    audit_status: 'empty',
    claims_audited: Number(obj.claims_audited),
    claims_verified: 0,
    claims_blocked: Number(obj.claims_blocked),
    retry_triggered: true,
    retry_attempted: true,
    retry_failed: true,
    verified_claims: [],
    adjacent_claims: [],
    blocked_claims: parseBlockedClaims(obj.blocked_claims),
  }
}

// ----------------------------------------------------------------------------
// Claim array parsers
// ----------------------------------------------------------------------------

function parseVerifiedClaims(raw: unknown): KratosVerifiedClaim[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item, index) => {
    const c = item as Record<string, unknown>
    if (!c.claim_id || !c.claim_text) {
      throw new KratosError(`Verified claim at index ${index} missing required fields`)
    }
    return {
      claim_id: c.claim_id as string,
      claim_text: c.claim_text as string,
      verified: true as const,
      source_chunk_id: c.source_chunk_id as string,
      page_number: Number(c.page_number),
      section_reference: c.section_reference as string,
      failure_reason: null,
    }
  })
}

function parseAdjacentClaims(raw: unknown): KratosAdjacentClaim[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const c = item as Record<string, unknown>
    return {
      claim_id: c.claim_id as string,
      claim_text: c.claim_text as string,
      responsiveness: 'adjacent' as const,
      adjacent_note: c.adjacent_note as string,
      source_chunk_id: c.source_chunk_id as string,
      page_number: (c.page_number === 'unknown' ? 'unknown' : Number(c.page_number)) as
        | number
        | 'unknown',
      section_reference: c.section_reference as string | 'unknown',
    }
  })
}

function parseBlockedClaims(raw: unknown): KratosBlockedClaim[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const c = item as Record<string, unknown>
    return {
      claim_id: c.claim_id as string,
      claim_text: c.claim_text as string,
      verified: false as const,
      source_chunk_id: c.source_chunk_id as string,
      page_number: (c.page_number === 'unknown' ? 'unknown' : Number(c.page_number)) as
        | number
        | 'unknown',
      section_reference: c.section_reference as string | 'unknown',
      failure_reason: c.failure_reason as string,
    }
  })
}

// ----------------------------------------------------------------------------
// KratosError — typed error for orchestrator catch handling
// ----------------------------------------------------------------------------
export class KratosError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'KratosError'
  }
}