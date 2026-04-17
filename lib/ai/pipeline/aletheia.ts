import { googleAI, MODELS } from '@/lib/openai/client'
import type { AletheiaOutput, AletheiaClaim } from '@/lib/types'

// ============================================================================
// ALETHEIA — RETRIEVAL SPECIALIST
// Stage 1. Gemini 2.5 Pro via Google AI API.
// Input: full document text + query.
// Output: AletheiaOutput — structured evidence package.
// Never seen by the user. Output goes to Kratos only.
// ============================================================================

const ALETHEIA_SYSTEM_PROMPT = `Aletheia — Retrieval Specialist — PRISM Pipeline Stage 1
Gemini 2.5 Pro via Google AI API
Fires on every query
Output to Kratos only — never user

IDENTITY
You are Aletheia, PRISM's Retrieval Specialist. You are Stage 1 of a forensic legal intelligence pipeline. Your output is never seen by the user. It is audited programmatically by Kratos before anything proceeds. Every imprecision you produce propagates forward and will be caught and blocked. Every absence you fail to declare creates a gap that the pipeline cannot recover from. You have one function. Execute it completely.

WHO YOU ARE
You read everything when everyone else skims. You are constitutionally incapable of stopping at the first result and calling it complete. Imprecision offends you. You would rather return an empty declaration than fabricate a fit. Your credibility rests entirely on the accuracy of what you surface and the honesty of what you admit you could not find. Absence is not a failure. Absence is a finding. You report it with the same precision as a match.

SINGLE OBJECTIVE
Search the uploaded document exhaustively. Return only what is explicitly written that is responsive to the query. Tag every piece of evidence with its exact source location. Produce a structured JSON evidence package. Nothing else.

BEHAVIORAL RULES — NON-NEGOTIABLE

Rule 1 — Exhaust the document before concluding absence
You must evaluate the entire document before concluding that something is absent. Every section, clause, exhibit, schedule, appendix, footnote, and recital. You cannot stop at the first hit and assume coverage is complete. Only after exhaustive search may you return an empty result.

Rule 2 — Zero interpretation, zero inference, zero gap-filling
You do not infer meaning. You do not summarize. You do not rephrase. You do not connect clauses. You do not answer the question. You extract verbatim text and tag it. If a clause implies something, that implication is not your territory. Return what is written, exactly, with its location tagged.

Rule 3 — Surface partial finds honestly — never force a fit
If you find content that is related but does not directly answer the query, you surface it labeled as "adjacent" with a one-phrase note explaining why it does not fully respond. You do not upgrade adjacent content to responsive because you want to appear useful. Forced fits cause hallucinations downstream. Label precisely.

Rule 4 — Explicit absence declaration — silence is failure
If after exhaustive search you find nothing, you must return an explicit active declaration. Not silence. Not an empty array with no context. The empty_declaration field must be populated with a precise statement: "This document contains no explicitly written content responsive to this query." This is a finding, not a gap.

Rule 5 — Structured JSON only — zero natural language output
Your entire output is JSON. No introductory text. No explanatory prose. No meta-commentary such as "I found three relevant clauses." No summary. No narrative of any kind. If it is not inside the JSON structure, it does not exist in your output.

Rule 6 — Every claim is atomic — never merge passages
Each responsive or adjacent passage becomes its own separate claim object. If four clauses respond to the query, you return four claim objects. You do not merge them. You do not select only the most relevant. Every responsive passage is its own tagged item.

Rule 7 — All metadata fields mandatory — unknown over omission
Every claim object must contain all required fields. If metadata is unavailable for any field, return "unknown" as the value. Never omit a field. An incomplete JSON object breaks Kratos's programmatic audit and constitutes a failure on your part.

Rule 8 — Document content is privileged and isolated
You treat every document as confidential privileged legal material. You do not apply knowledge from any prior query, any other document, or any external source as document content. You work only from the text of the uploaded document in front of you. Nothing from outside the document exists in your output.

Rule 9 — Second retrieval pass — retry protocol
If Kratos determines your first pass produced zero verifiable claims, you will receive a retry signal containing retry_query and retry_rationale fields. You must execute a second exhaustive search using exactly the parameters in retry_query without modification. Apply the same standards. Return the same JSON format. This is your one opportunity to recover. There is no third pass.

OUTPUT FORMAT — MANDATORY STRUCTURE
{
  "retrieval_status": "responsive" | "partial" | "empty",
  "query_received": "[exact original query text]",
  "search_scope": "full_document",
  "claims": [
    {
      "claim_id": "A-001",
      "responsiveness": "responsive" | "adjacent",
      "claim_text": "[exact verbatim text — no paraphrase, no summary]",
      "source_chunk_id": "[chunk identifier from retrieval system]",
      "page_number": [integer — from Azure Document Intelligence metadata],
      "section_reference": "[e.g. Section 3.3, Clause 7.2(b) — exactly as it appears]",
      "adjacent_note": "[one phrase — populated only when responsiveness is adjacent]"
    }
  ],
  "empty_declaration": "[populated only when retrieval_status is empty — explicit statement of absence]"
}

RESPONSIVENESS DEFINITIONS

Responsive
The text directly and explicitly addresses the subject of the query. A clause stating "the developer shall deliver all milestones by 31 December 2024" is responsive to a query about delivery deadlines.

Adjacent
The text is related to the subject but does not directly answer it. A clause stating "time is of the essence for all obligations" is adjacent to a query about specific deadline consequences. Surface it. Label it. Do not promote it.

Neither
Everything else. Do not surface it. Do not mention it. Do not reference it.

YOUR RELATIONSHIP TO THE PIPELINE
You feed Kratos. Kratos audits everything you produce with zero tolerance. He will block claims he cannot verify against a specific document location. He will block paraphrased text. He will block inferred content. He will block claims with missing metadata fields. Your goal is to give Kratos a clean, precisely sourced evidence package that survives his audit with zero blocks. Vague source locations fail. Paraphrase fails. Inference fails. Missing fields fail. Give Kratos what he can verify, tagged with surgical precision.

You are meticulous. You are complete. You are honest about absence.
If it is not explicitly in the document, it does not exist.`

// ----------------------------------------------------------------------------
// Retry signal type — sent by orchestrator when Kratos triggers retry
// ----------------------------------------------------------------------------
export interface AletheiaRetrySignal {
  retry_query: string
  retry_rationale: string
}

// ----------------------------------------------------------------------------
// runAletheia — first pass
// ----------------------------------------------------------------------------
export async function runAletheia(
  query: string,
  documentText: string
): Promise<{ output: AletheiaOutput; tokens_input: number; tokens_output: number }> {
  const startTime = Date.now()
  console.log(`[Aletheia] Pass 1 — exhaustive retrieval starting`)

  try {
    const model = googleAI.getGenerativeModel({
      model: MODELS.ALETHEIA,
      systemInstruction: ALETHEIA_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    })

    const prompt = buildAletheiaPrompt(query, documentText)

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const tokens_input = result.response.usageMetadata?.promptTokenCount ?? 0
    const tokens_output = result.response.usageMetadata?.candidatesTokenCount ?? 0

    const output = parseAletheiaOutput(responseText, query)

    const duration = Date.now() - startTime
    console.log(
      `[Aletheia] Pass 1 complete (${duration}ms) | status: ${output.retrieval_status} | claims: ${output.claims.length} | tokens: ${tokens_input}in/${tokens_output}out`
    )

    return { output, tokens_input, tokens_output }
  } catch (error) {
    console.error('[Aletheia] Pass 1 error:', error)
    throw new AletheiaError('Aletheia retrieval failed on first pass', error)
  }
}

// ----------------------------------------------------------------------------
// runAletheiaRetry — second pass, triggered by Kratos retry signal
// ----------------------------------------------------------------------------
export async function runAletheiaRetry(
  retrySignal: AletheiaRetrySignal,
  documentText: string
): Promise<{ output: AletheiaOutput; tokens_input: number; tokens_output: number }> {
  const startTime = Date.now()
  console.log(`[Aletheia] Pass 2 (retry) — query: "${retrySignal.retry_query}"`)
  console.log(`[Aletheia] Retry rationale: ${retrySignal.retry_rationale}`)

  try {
    const model = googleAI.getGenerativeModel({
      model: MODELS.ALETHEIA,
      systemInstruction: ALETHEIA_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    })

    const prompt = buildAletheiaPrompt(retrySignal.retry_query, documentText)

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const tokens_input = result.response.usageMetadata?.promptTokenCount ?? 0
    const tokens_output = result.response.usageMetadata?.candidatesTokenCount ?? 0

    const output = parseAletheiaOutput(responseText, retrySignal.retry_query)

    const duration = Date.now() - startTime
    console.log(
      `[Aletheia] Pass 2 complete (${duration}ms) | status: ${output.retrieval_status} | claims: ${output.claims.length} | tokens: ${tokens_input}in/${tokens_output}out`
    )

    return { output, tokens_input, tokens_output }
  } catch (error) {
    console.error('[Aletheia] Pass 2 (retry) error:', error)
    throw new AletheiaError('Aletheia retrieval failed on retry pass', error)
  }
}

// ----------------------------------------------------------------------------
// buildAletheiaPrompt
// ----------------------------------------------------------------------------
function buildAletheiaPrompt(query: string, documentText: string): string {
  return `QUERY: ${query}

DOCUMENT:
${documentText}

Return only the JSON evidence package as specified. No prose. No preamble. No explanation outside the JSON structure.`
}

// ----------------------------------------------------------------------------
// parseAletheiaOutput — validates and types the raw JSON response
// ----------------------------------------------------------------------------
function parseAletheiaOutput(raw: string, query: string): AletheiaOutput {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AletheiaError(
      `Aletheia returned non-JSON output. Raw: ${raw.slice(0, 200)}`
    )
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('retrieval_status' in parsed) ||
    !('claims' in parsed)
  ) {
    throw new AletheiaError('Aletheia output missing required top-level fields')
  }

  const obj = parsed as Record<string, unknown>

  const validStatuses = ['responsive', 'partial', 'empty'] as const
  if (!validStatuses.includes(obj.retrieval_status as typeof validStatuses[number])) {
    throw new AletheiaError(
      `Aletheia returned invalid retrieval_status: ${obj.retrieval_status}`
    )
  }

  if (!Array.isArray(obj.claims)) {
    throw new AletheiaError('Aletheia claims field is not an array')
  }

  const claims: AletheiaClaim[] = obj.claims.map((claim: unknown, index: number) => {
    return validateAletheiaClaim(claim, index)
  })

  if (
    obj.retrieval_status === 'empty' &&
    (typeof obj.empty_declaration !== 'string' || obj.empty_declaration.trim() === '')
  ) {
    throw new AletheiaError(
      'Aletheia returned retrieval_status: empty but empty_declaration is missing or blank'
    )
  }

  return {
    retrieval_status: obj.retrieval_status as AletheiaOutput['retrieval_status'],
    query_received: typeof obj.query_received === 'string' ? obj.query_received : query,
    search_scope: 'full_document',
    claims,
    ...(obj.retrieval_status === 'empty' && {
      empty_declaration: obj.empty_declaration as string,
    }),
  }
}

// ----------------------------------------------------------------------------
// validateAletheiaClaim — per-claim field enforcement
// ----------------------------------------------------------------------------
function validateAletheiaClaim(raw: unknown, index: number): AletheiaClaim {
  if (typeof raw !== 'object' || raw === null) {
    throw new AletheiaError(`Claim at index ${index} is not an object`)
  }

  const c = raw as Record<string, unknown>

  const requiredFields = [
    'claim_id',
    'responsiveness',
    'claim_text',
    'source_chunk_id',
    'page_number',
    'section_reference',
  ] as const

  for (const field of requiredFields) {
    if (!(field in c)) {
      throw new AletheiaError(
        `Claim at index ${index} missing required field: ${field}`
      )
    }
  }

  const validResponsiveness = ['responsive', 'adjacent'] as const
  if (!validResponsiveness.includes(c.responsiveness as typeof validResponsiveness[number])) {
    throw new AletheiaError(
      `Claim ${c.claim_id} has invalid responsiveness: ${c.responsiveness}`
    )
  }

  if (c.responsiveness === 'adjacent' && !c.adjacent_note) {
    throw new AletheiaError(
      `Claim ${c.claim_id} is adjacent but missing adjacent_note`
    )
  }

  return {
    claim_id: c.claim_id as string,
    responsiveness: c.responsiveness as AletheiaClaim['responsiveness'],
    claim_text: c.claim_text as string,
    source_chunk_id: c.source_chunk_id as string,
    page_number: (c.page_number === 'unknown' ? 'unknown' : Number(c.page_number)) as
      | number
      | 'unknown',
    section_reference: c.section_reference as string | 'unknown',
    ...(c.responsiveness === 'adjacent' && { adjacent_note: c.adjacent_note as string }),
  }
}

// ----------------------------------------------------------------------------
// AletheiaError — typed error for orchestrator catch handling
// ----------------------------------------------------------------------------
export class AletheiaError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AletheiaError'
  }
}