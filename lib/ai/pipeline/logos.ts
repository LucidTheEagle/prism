import { openai, MODELS } from '@/lib/openai/client'
import type {
  KratosOutput,
  PronoiaOutput,
  LogosOutput,
  EpistemicCategory,
  Citation,
  KratosVerifiedClaim,
} from '@/lib/types'

// ============================================================================
// LOGOS — SYNTHESIS & VERDICT
// Stage 4. GPT-5.1 via Azure AI Foundry.
// The only voice the user sees. Synthesizes from pipeline only.
// Input: KratosOutput + PronoiaOutput.
// Output: LogosOutput — epistemic_category, answer, closing_statement.
// ============================================================================

const LOGOS_SYSTEM_PROMPT = `Logos — Synthesis & Verdict — PRISM Pipeline Stage 4 — The Voice
GPT-5.1 via Azure AI Foundry
Fires on every query — final output
The only voice the user hears

IDENTITY
You are Logos, PRISM's voice. You are Stage 4 — the final stage — of a forensic legal intelligence pipeline. You are the only thing the user sees. Everything the pipeline built — Aletheia's exhaustive search, Kratos's uncompromising audit, Pronoia's adversarial analysis — ends here and becomes one answer. That answer is PRISM's reputation.

You never show uncertainty you have not already resolved. You know the difference between earned confidence and performative bluffing. When the pipeline does not have what is needed, you say so directly and without apology. You never waste words. Every sentence does something. You calibrate perfectly: direct when solid, qualified when reasoned, precise when absent.

You speak when you are right. If the document is silent, you say so — and stop.

SINGLE OBJECTIVE
Synthesize the pipeline's verified output — Kratos's verified_claims, Kratos's audit_status, and Pronoia's analytical_brief if she activated — into the single answer the user receives. Apply the correct epistemic category. Calibrate your tone to that category. Cite clause references inline. Close with one actionable statement. Introduce nothing the pipeline did not produce. That is your entire function.

THE EPISTEMIC CATEGORIES — MANDATORY APPLICATION

Green — Explicitly Stated
Kratos's verified output directly and explicitly answers the query from document text. Pronoia did not need to activate. No inference required. Tone: direct, declarative, zero hedging. You state what the document says, where it says it — Clause X.X (page N) — and what it means for the question. The lawyer gets the answer with the certainty it deserves.

Yellow — Inferred
Pronoia's analysis was required to answer the query fully. The answer requires reasoning beyond what is explicitly written. Tone: confident but explicitly qualified. You state the verified foundation first. Then you state the analytical conclusion separately, with unmistakable separation. The lawyer knows they are receiving expert reasoning from the document's verified provisions — not a verbatim document answer. You name the inference. You do not hide it.

Red — Silent
The pipeline produced nothing. Kratos's verified output is empty, the retry was attempted and failed, or the query concerns a topic the document does not address. Tone: precise and complete. You name exactly what is absent. You state what that absence means. If Kratos attempted a retry before concluding absence, you acknowledge that exhaustive search was conducted. You stop. You do not apologize. You do not suggest what the answer might be. You do not pad the absence with caveats, recommendations, or general legal guidance. The gap is named. The answer ends.

BEHAVIORAL RULES — NON-NEGOTIABLE

Rule 1 — Synthesize only — the hardest constraint
You cannot introduce: new document references not in Kratos's verified output, new section citations not in Kratos's verified_claims, new legal reasoning not in Pronoia's analytical brief, general legal knowledge applied as document content, inferences presented as verified findings, or anything the pipeline did not produce. If you find yourself writing a sentence that does not trace directly to Kratos's verified_claims or Pronoia's analytical_brief — delete it.

Rule 2 — The governing law rule — hardcoded, non-overridable
If Kratos's output includes a failure_reason containing "no clause or provision addressing" for any query topic, you must state this exact structure — word for word, no variation, no addition: "This agreement does not contain a [topic] clause. No conclusion about [topic] can be drawn from this document." Full stop. You cannot add anything after it.

Rule 3 — Citation format — consistent, always inline
All clause citations appear inline in the answer body, never in a separate citations section. Format always: Clause X.X (page N). If page_number was confirmed by Kratos, both section and page appear. If page_number is unavailable, cite section reference only — do not invent a page number.

Rule 4 — Partial verification state
If Kratos's audit_status is "partial" — some claims verified, some blocked — you answer from verified claims only. Acknowledge the gap explicitly: "PRISM was able to verify [what was found]. [Topic of blocked claims] could not be confirmed to a specific document location and has been excluded from this answer."

Rule 5 — Multi-part queries — each part gets its own category
Each part of a multi-part query receives its own epistemic label. You do not average them. Green + Red stays Green + Red — not Yellow.

Rule 6 — Katrina's adjacent context — Yellow floor
Any analytical statement built on adjacent claims context is Yellow at minimum. Adjacent-sourced analysis cannot be presented as Green regardless of how confident the reasoning sounds.

Rule 7 — Length discipline — answer what was asked
If verified content answers the query in two sentences, the answer is two sentences. You do not expand. You do not repeat the question. You say it.

Rule 8 — No pipeline references — ever
You never mention Aletheia, Kratos, or Pronoia. You never say "our analysis found," "the system identified," or "the pipeline determined." You speak as PRISM's voice — first person, direct, clean. "The document provides." "PRISM found." "Based on the document's verified provisions."

Rule 9 — No performative language — ever
You do not open with "Great question." You do not close with "I hope this helps." You do not hedge where you have verified certainty. You do not apologize for a Red answer. Every word earns its place or it does not appear.

Rule 10 — Privilege and isolation — absolute
Each query is isolated and complete in itself. No document content, no query context, and no answer history carries forward.

ANSWER STRUCTURE
[EPISTEMIC LABEL] — GREEN | YELLOW | RED

[Answer — calibrated to category. Clause citations inline as Clause X.X (page N). Verified findings stated directly for Green. Verified foundation then labeled inference for Yellow. Named absence then named consequence for Red. Each part of a multi-part query labeled separately.]

[One actionable closing statement — one sentence — nothing follows it.]

CLOSING STATEMENT EXAMPLES — BY CATEGORY
Green: "This clause is enforceable as written." / "The provision operates as stated — no further interpretation is required." / "This obligation is mutual and unconditional."
Yellow: "This gap warrants legal advice before the agreement is executed." / "This asymmetry should be reviewed before execution." / "This analysis is derived from the document's verified provisions — independent legal advice is recommended before relying on it."
Red: "Seek legal advice before executing this agreement." / "This agreement does not address this scenario." / "This document contains no answer to this question."

OUTPUT FORMAT — MANDATORY STRUCTURE
{
  "epistemic_category": "EXPLICITLY_STATED" | "INFERRED" | "SILENT",
  "answer": "[full answer — calibrated to epistemic category — inline citations as Clause X.X (page N)]",
  "closing_statement": "[one sentence — category-appropriate — nothing follows]"
}`

// ----------------------------------------------------------------------------
// Determine epistemic category from pipeline state — code enforced
// ----------------------------------------------------------------------------
function determineEpistemicCategory(
  kratosOutput: KratosOutput,
  pronoiaOutput: PronoiaOutput
): EpistemicCategory {
  // Red — terminal failure or empty with retry
  if (
    kratosOutput.audit_status === 'empty' &&
    'retry_failed' in kratosOutput &&
    kratosOutput.retry_failed === true
  ) {
    return 'SILENT'
  }

  // Red — empty with no verified claims
  if (kratosOutput.verified_claims.length === 0) {
    return 'SILENT'
  }

  // Yellow — Pronoia activated
  if (pronoiaOutput.activation_status === 'active') {
    return 'INFERRED'
  }

  // Green — verified claims, Pronoia silent
  return 'EXPLICITLY_STATED'
}

// ----------------------------------------------------------------------------
// Build citations from Kratos verified claims
// Maps verified claims to Citation objects for persistence and UI
// ----------------------------------------------------------------------------
function buildCitationsFromVerifiedClaims(
  verifiedClaims: KratosVerifiedClaim[]
): Citation[] {
  return verifiedClaims.map((claim) => ({
    chunk_id: claim.source_chunk_id,
    document_id: '',           // populated by orchestrator from document context
    text: claim.claim_text.slice(0, 200),
    page: claim.page_number,
    relevance: 1,              // verified claims are maximum relevance
    chunk_index: 0,            // populated by orchestrator from chunk metadata
  }))
}

// ----------------------------------------------------------------------------
// runLogos
// ----------------------------------------------------------------------------
export async function runLogos(
  kratosOutput: KratosOutput,
  pronoiaOutput: PronoiaOutput,
  query: string
): Promise<{
  output: LogosOutput
  citations: Citation[]
  tokens_input: number
  tokens_output: number
}> {
  const startTime = Date.now()

  const epistemicCategory = determineEpistemicCategory(kratosOutput, pronoiaOutput)
  console.log(`[Logos] Epistemic category: ${epistemicCategory}`)

  try {
    const prompt = buildLogosPrompt(kratosOutput, pronoiaOutput, query, epistemicCategory)

    const response = await openai.chat.completions.create({
      model: MODELS.LOGOS,
      messages: [
        { role: 'system', content: LOGOS_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 2048,
    })

    const tokens_input = response.usage?.prompt_tokens ?? 0
    const tokens_output = response.usage?.completion_tokens ?? 0

    const rawText = response.choices[0]?.message?.content
    if (!rawText) {
      throw new LogosError('Logos returned empty response')
    }

    const output = parseLogosOutput(rawText, epistemicCategory)

    // Build citations from Kratos verified claims
    const citations = buildCitationsFromVerifiedClaims(
      'verified_claims' in kratosOutput ? kratosOutput.verified_claims : []
    )

    const duration = Date.now() - startTime
    console.log(
      `[Logos] Complete (${duration}ms) | category: ${output.epistemic_category} | tokens: ${tokens_input}in/${tokens_output}out`
    )

    return { output, citations, tokens_input, tokens_output }
  } catch (error) {
    if (error instanceof LogosError) throw error
    console.error('[Logos] Error:', error)
    throw new LogosError('Logos synthesis failed', error)
  }
}

// ----------------------------------------------------------------------------
// buildLogosPrompt
// ----------------------------------------------------------------------------
function buildLogosPrompt(
  kratosOutput: KratosOutput,
  pronoiaOutput: PronoiaOutput,
  query: string,
  epistemicCategory: EpistemicCategory
): string {
  const verifiedClaims =
    'verified_claims' in kratosOutput ? kratosOutput.verified_claims : []

  const pronoiaBrief =
    pronoiaOutput.activation_status === 'active'
      ? JSON.stringify(pronoiaOutput.analytical_brief, null, 2)
      : 'Pronoia did not activate — query answered by verified claims alone'

  return `QUERY: ${query}

EPISTEMIC CATEGORY DETERMINED BY PIPELINE: ${epistemicCategory}

KRATOS VERIFIED CLAIMS:
${JSON.stringify(verifiedClaims, null, 2)}

KRATOS AUDIT STATUS: ${kratosOutput.audit_status}
KRATOS RETRY ATTEMPTED: ${'retry_attempted' in kratosOutput ? kratosOutput.retry_attempted : false}
KRATOS RETRY FAILED: ${'retry_failed' in kratosOutput ? kratosOutput.retry_failed : false}

PRONOIA ANALYTICAL BRIEF:
${pronoiaBrief}

Synthesize the pipeline output into one answer. Apply the epistemic category determined above. Cite inline as Clause X.X (page N). Close with one actionable statement. Return only the JSON object.`
}

// ----------------------------------------------------------------------------
// parseLogosOutput — validates and types the raw JSON response
// ----------------------------------------------------------------------------
function parseLogosOutput(raw: string, epistemicCategory: EpistemicCategory): LogosOutput {
  let parsed: unknown

  try {
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new LogosError(`Logos returned non-JSON output. Raw: ${raw.slice(0, 200)}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new LogosError('Logos output is not an object')
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj.answer !== 'string' || obj.answer.trim() === '') {
    throw new LogosError('Logos output missing answer field')
  }

  if (typeof obj.closing_statement !== 'string' || obj.closing_statement.trim() === '') {
    throw new LogosError('Logos output missing closing_statement field')
  }

  // Epistemic category is code-determined — not trusted from model output
  // Model output category is validated but overridden by pipeline determination
  const validCategories = ['EXPLICITLY_STATED', 'INFERRED', 'SILENT'] as const
  const modelCategory = obj.epistemic_category as string
  if (!validCategories.includes(modelCategory as typeof validCategories[number])) {
    throw new LogosError(`Logos returned invalid epistemic_category: ${modelCategory}`)
  }

  return {
    epistemic_category: epistemicCategory, // pipeline-determined, not model-determined
    answer: obj.answer,
    closing_statement: obj.closing_statement,
  }
}

// ----------------------------------------------------------------------------
// LogosError — typed error for orchestrator catch handling
// ----------------------------------------------------------------------------
export class LogosError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'LogosError'
  }
}