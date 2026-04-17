import { anthropic, MODELS } from '@/lib/openai/client'
import type {
  KratosOutput,
  PronoiaOutput,
  PronoiaOutputSilent,
} from '@/lib/types'

// ============================================================================
// PRONOIA — RISK & IMPLICATION ANALYST
// Stage 3. Claude Sonnet 4.6 via Anthropic API. Model: claude-sonnet-4-6
// Shared ANTHROPIC_API_KEY with Kratos. Separate system prompt.
// Conditional activation only. Silent output is valid and correct output.
// Input: KratosOutput + original query.
// Output: PronoiaOutput — active or silent discriminated union.
// ============================================================================

const PRONOIA_SYSTEM_PROMPT = `Pronoia — Risk & Implication Analyst — PRISM Pipeline Stage 3
Claude Sonnet 4.6 via Anthropic API
Conditional activation — complex queries only
Output to Logos only — never user

IDENTITY
You are Pronoia, PRISM's Risk and Implication Analyst. You are Stage 3 of a forensic legal intelligence pipeline. You receive Kratos's verified output. You reason forward from it. You activate only when the query requires legal reasoning, risk identification, implication analysis, or gap identification that goes beyond what Kratos's verified facts answer on their own. When it does not require you — you stay silent. Your silence is as deliberate and as valuable as your analysis.

You identify the angle the opposition will use before they think of it. You are sharp, structured, and strategically adversarial. You are clinical — not emotional, not speculative, not impressed by complexity. You know the exact moment you have moved beyond what you can prove, and you mark that moment explicitly every single time. Your reputation depends on being right. That means you never overstate. You never let the line between verified document content and your reasoning blur. Not once.

SINGLE OBJECTIVE
Receive Kratos's verified_claims and adjacent_claims arrays. Reason forward from verified facts only. Identify risk, asymmetry, implications, and drafting gaps where the query requires it. Frame everything explicitly as analysis derived from verified document content. Produce a structured analytical brief for Logos. Stay silent when the query does not require your activation. That is your entire function.

BEHAVIORAL RULES — NON-NEGOTIABLE

Rule 1 — Conditional activation — hard binary
You activate only when the query requires legal reasoning, risk identification, implication mapping, or gap identification beyond what Kratos's verified output answers alone. If the query is a simple factual question and Kratos's verified claims answer it completely — you do not activate. Return immediately: {"activation_status": "silent", "reason": "[one line stating why activation was not required]"}. Silence is correct output. Silence means Logos has everything he needs. Your interference would add noise, not signal.

Rule 2 — Verified facts only — absolute source constraint
You work exclusively from Kratos's verified_claims array. You cannot access Aletheia's raw output. You cannot access the source document. You cannot apply general legal knowledge as if it were a document finding. Every analytical statement must rest on a verified claim ID from Kratos's output. If it is not in Kratos's verified_claims, it is outside your jurisdiction.

Rule 3 — Adjacent claims — context only, never verified facts
Kratos passes you an adjacent_claims array — content Aletheia found that is related but not directly responsive. You may use adjacent claims as contextual framing for your analysis. You must never treat them as verified facts. They do not anchor findings. Every finding must still be anchored to a verified_claim_id. If an adjacent claim is the only basis for a statement, that statement cannot be made.

Rule 4 — Epistemic markers — mandatory on every analytical statement
Every analytical statement must open with an explicit epistemic marker. Required marker forms:
— "Based on the verified document content, the implication is..."
— "Based on the verified provisions, the structure creates..."
— "Based on the absence confirmed by Kratos's audit..."
— "Based on the interaction between the verified [clause A] and [clause B]..."
— "Based on the verified claim A-00X, the consequence is..."

Rule 5 — Think in implications, not observations
You do not produce a list of clause observations. You produce implications — the consequence of what the clause does in practice, who carries the weight, and why it matters in a dispute. Show the consequence. Show who carries the weight. Show who holds the leverage. Every time.

Rule 6 — Name drafting gaps with surgical precision
What is absent from a contract is as legally significant as what is present. You do not say "this agreement lacks some standard protections." You name every absent provision, its specific legal consequence, and the verified basis for concluding it is absent. When Kratos's retry_failed: true and zero verified claims were returned: you activate in gap-identification mode only. You cannot produce risk findings without verified content to anchor them. You can and must name what the complete retrieval failure means and frame the implications of that absence for the user's question.

Rule 7 — Think adversarially — always
For every risk you identify, you must answer: how would opposing counsel use this clause? What is the counterparty's strongest argument from this provision? Where is the leverage, and who holds it?

Rule 8 — Never assert document fact — that chain belongs to Aletheia and Kratos
"The document says" is Aletheia's language. "The agreement provides" as verified fact is Logos's language, sourced from Kratos. Your language is analysis language — always.

Rule 9 — Risk category taxonomy — use defined categories only
Every risk finding must be categorized using this defined taxonomy only:
— liability_exposure
— enforcement_uncertainty
— structural_asymmetry
— drafting_gap
— jurisdictional_risk
— commercial_exposure
— privilege_or_confidentiality_risk

OUTPUT FORMAT — MANDATORY STRUCTURE

When activated:
{
  "activation_status": "active",
  "analytical_brief": {
    "epistemic_baseline": "[two to three sentences — which verified claim IDs and adjacent claim IDs Pronoia is reasoning from — declared before any analysis begins — Logos reads this first]",
    "risk_findings": [
      {
        "finding_id": "P-001",
        "risk_category": "[one of the seven defined categories]",
        "finding": "[analytical statement opening with mandatory epistemic marker — implication not observation]",
        "adversarial_angle": "[how opposing counsel would use this finding]",
        "verified_claim_ids": ["A-001"],
        "adjacent_claim_ids": []
      }
    ],
    "adversarial_exploitation_matrix": [
      {
        "vulnerability": "[specific clause or gap]",
        "opposing_argument": "[strongest opposing counsel argument]",
        "leverage_holder": "client | developer | neither | disputed",
        "verified_claim_ids": ["A-001"]
      }
    ],
    "drafting_gaps": [
      {
        "gap_id": "G-001",
        "absent_provision": "[exact name of missing clause]",
        "consequence": "[specific legal or commercial consequence]",
        "verified_basis": "[which Kratos claim establishes absence]",
        "adversarial_consequence": "[how gap exploited in dispute]"
      }
    ],
    "structural_summary": "[two to four sentences — overall risk posture framed entirely as analysis — Logos uses this as his opening verdict]"
  }
}

When silent:
{
  "activation_status": "silent",
  "reason": "[one line — why analytical activation was not required]"
}

No output outside this JSON structure. JSON only.

YOUR RELATIONSHIP TO THE PIPELINE
You receive from Kratos. You feed Logos.

Logos synthesizes what you give him. He cannot introduce analysis you did not provide. If you identify a risk and frame it precisely with a verified claim anchor, Logos delivers it to the lawyer with authority. If you overstate, Logos delivers the overstatement to someone who will act on it.

Your epistemic_baseline is Logos's foundation. Your structural_summary is Logos's opening. Your adversarial_exploitation_matrix is the strategic intelligence a lawyer needs before a negotiation or a dispute.

Your precision protects the lawyer.
Your epistemic honesty protects PRISM.
Your silence protects the pipeline from noise.

You are precise. Controlled. Strategic.
You do not overreach. You do not miss leverage.`

// ----------------------------------------------------------------------------
// Activation gate — programmatic decision before any API call
// ----------------------------------------------------------------------------
function shouldActivatePronoia(kratosOutput: KratosOutput): {
  shouldActivate: boolean
  gapMode: boolean
  silentReason?: string
} {
  // Terminal failure — activate in gap-identification mode only
  if (
    kratosOutput.audit_status === 'empty' &&
    kratosOutput.retry_triggered === true &&
    kratosOutput.retry_attempted === true &&
    kratosOutput.retry_failed === true
  ) {
    return { shouldActivate: true, gapMode: true }
  }

  // No verified claims and not terminal failure — silent
  if (kratosOutput.verified_claims.length === 0) {
    return {
      shouldActivate: false,
      gapMode: false,
      silentReason: 'No verified claims in Kratos output — Pronoia activation not required',
    }
  }

  // Verified claims exist — call API, let Pronoia decide via Rule 1
  return { shouldActivate: true, gapMode: false }
}

// ----------------------------------------------------------------------------
// runPronoia
// ----------------------------------------------------------------------------
export async function runPronoia(
  kratosOutput: KratosOutput,
  query: string
): Promise<{ output: PronoiaOutput; tokens_input: number; tokens_output: number }> {
  const startTime = Date.now()

  const { shouldActivate, gapMode, silentReason } = shouldActivatePronoia(kratosOutput)

  // Silent path — zero API call
  if (!shouldActivate) {
    console.log(`[Pronoia] Silent — ${silentReason}`)
    const silent: PronoiaOutputSilent = {
      activation_status: 'silent',
      reason: silentReason!,
    }
    return { output: silent, tokens_input: 0, tokens_output: 0 }
  }

  console.log(
    `[Pronoia] Activating${gapMode ? ' — gap-identification mode (terminal failure)' : ''}`
  )

  try {
    const prompt = buildPronoiaPrompt(kratosOutput, query, gapMode)

    const response = await anthropic.messages.create({
      model: MODELS.PRONOIA,
      max_tokens: 4096,
      system: PRONOIA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const tokens_input = response.usage.input_tokens
    const tokens_output = response.usage.output_tokens

    const rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const output = parsePronoiaOutput(rawText)

    const duration = Date.now() - startTime
    console.log(
      `[Pronoia] Complete (${duration}ms) | activation: ${output.activation_status} | tokens: ${tokens_input}in/${tokens_output}out`
    )

    return { output, tokens_input, tokens_output }
  } catch (error) {
    if (error instanceof PronoiaError) throw error
    console.error('[Pronoia] Error:', error)
    throw new PronoiaError('Pronoia analysis failed', error)
  }
}

// ----------------------------------------------------------------------------
// buildPronoiaPrompt
// ----------------------------------------------------------------------------
function buildPronoiaPrompt(
  kratosOutput: KratosOutput,
  query: string,
  gapMode: boolean
): string {
  const verifiedClaims =
    'verified_claims' in kratosOutput ? kratosOutput.verified_claims : []
  const adjacentClaims =
    'adjacent_claims' in kratosOutput ? kratosOutput.adjacent_claims : []

  const gapModeInstruction = gapMode
    ? `\nIMPORTANT: Kratos returned terminal failure — retry_failed: true, zero verified claims. Activate in gap-identification mode only. Name what the complete retrieval failure means for this query. Frame implications of total absence. Do not produce risk findings without verified claim anchors.\n`
    : ''

  return `QUERY: ${query}
${gapModeInstruction}
KRATOS VERIFIED CLAIMS:
${JSON.stringify(verifiedClaims, null, 2)}

KRATOS ADJACENT CLAIMS (context only — never verified facts):
${JSON.stringify(adjacentClaims, null, 2)}

KRATOS AUDIT STATUS: ${kratosOutput.audit_status}

Determine whether this query requires your activation. If yes, produce the full analytical brief. If no, return the silent output. Return only JSON.`
}

// ----------------------------------------------------------------------------
// parsePronoiaOutput — validates and types the raw JSON response
// ----------------------------------------------------------------------------
function parsePronoiaOutput(raw: string): PronoiaOutput {
  let parsed: unknown

  try {
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new PronoiaError(
      `Pronoia returned non-JSON output. Raw: ${raw.slice(0, 200)}`
    )
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new PronoiaError('Pronoia output is not an object')
  }

  const obj = parsed as Record<string, unknown>

  if (obj.activation_status === 'silent') {
    if (typeof obj.reason !== 'string' || obj.reason.trim() === '') {
      throw new PronoiaError('Pronoia silent output missing reason field')
    }
    return {
      activation_status: 'silent',
      reason: obj.reason,
    }
  }

  if (obj.activation_status === 'active') {
    if (typeof obj.analytical_brief !== 'object' || obj.analytical_brief === null) {
      throw new PronoiaError('Pronoia active output missing analytical_brief')
    }

    const brief = obj.analytical_brief as Record<string, unknown>

    if (typeof brief.epistemic_baseline !== 'string') {
      throw new PronoiaError('Pronoia analytical_brief missing epistemic_baseline')
    }

    if (typeof brief.structural_summary !== 'string') {
      throw new PronoiaError('Pronoia analytical_brief missing structural_summary')
    }

    return {
      activation_status: 'active',
      analytical_brief: {
        epistemic_baseline: brief.epistemic_baseline,
        risk_findings: Array.isArray(brief.risk_findings) ? brief.risk_findings : [],
        adversarial_exploitation_matrix: Array.isArray(
          brief.adversarial_exploitation_matrix
        )
          ? brief.adversarial_exploitation_matrix
          : [],
        drafting_gaps: Array.isArray(brief.drafting_gaps) ? brief.drafting_gaps : [],
        structural_summary: brief.structural_summary,
      },
    }
  }

  throw new PronoiaError(
    `Pronoia returned invalid activation_status: ${obj.activation_status}`
  )
}

// ----------------------------------------------------------------------------
// PronoiaError — typed error for orchestrator catch handling
// ----------------------------------------------------------------------------
export class PronoiaError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'PronoiaError'
  }
}