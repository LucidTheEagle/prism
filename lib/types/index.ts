// ============================================================================
// PRISM TYPE DEFINITIONS - COMPLETE SYSTEM
// ============================================================================

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export interface Document {
  id: string
  name: string
  file_url: string
  file_size_bytes: number
  page_count: number | null
  
  // AI Analysis Results
  document_type: string | null
  complexity_score: number | null
  has_toc: boolean
  key_entities: string[]
  
  status: 'processing' | 'ready' | 'failed'
  error_message: string | null
  
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  
  metadata: {
    page?: number
    start_char?: number
    end_char?: number
    section_header?: string
  }
  
  // Vector embedding
  embedding: number[] | null
  
  // AI Enrichment (Checkpoint 2.4)
  ai_summary: string | null
  keywords: string[]
  semantic_category: string | null
  
  created_at: string
}

// ============================================================================
// QUERY ANALYSIS TYPES (Checkpoint 3.1)
// ============================================================================

export type QueryType = 'factual' | 'conceptual' | 'comparative' | 'extractive'

export interface QueryAnalysis {
  // Query Classification
  query_type: QueryType
  requires_exact_match: boolean
  temporal_context: boolean
  needs_cross_reference: boolean
  
  // Search Strategy
  vector_weight: number      // 0-1 (higher = more semantic)
  bm25_weight: number        // 0-1 (higher = more keyword)
  chunk_count: number        // 5-20 chunks to retrieve
  confidence_threshold: number // 0.5-0.9
  
  // Context Metadata
  detected_entities: string[]
  key_terms: string[]
  temporal_indicators: string[]
  
  // Reasoning
  reasoning: string
}

// ============================================================================
// SEARCH TYPES (Checkpoint 3.2 & 3.3)
// ============================================================================

export interface SearchResult {
  id: string
  document_id: string
  content: string
  chunk_index: number
  metadata: {
    page?: number
    start_char?: number
    end_char?: number
    section_header?: string
  }
  
  // Enrichment
  ai_summary: string | null
  keywords: string[]
  semantic_category: string | null
  
  // Search Scores
  vector_similarity: number
  bm25_rank: number
  combined_score: number
  reranked_score?: number // After AI re-ranking
}

export interface SearchResponse {
  success: boolean
  query: string
  results: SearchResult[]
  analysis: QueryAnalysis
  metadata: {
    total_chunks_searched: number
    results_returned: number
    search_time_ms: number
    vector_weight_used: number
    bm25_weight_used: number
    avg_combined_score?: number
    unique_pages?: number
    results_with_summaries?: number
  }
}

// ============================================================================
// CHAT TYPES (Checkpoint 3.4, 3.5, 3.6)
// ============================================================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string

  // V1 Pipeline fields — replaces confidence_score float
  epistemic_category?: EpistemicCategory
  closing_statement?: string
  citations?: Citation[]

  // Pipeline audit metadata — preserved for chain of custody
  was_revised?: boolean
  generation_pass?: number
  critique_notes?: string

  timestamp: Date
  isStreaming?: boolean
}

export interface Citation {
  chunk_id: string
  document_id: string
  text: string // The cited text snippet
  page: number
  relevance: number // How relevant to answer
  ai_summary?: string
  chunk_index: number
}

export interface AnswerGeneration {
  answer: string
  confidence_score: number
  citations: Citation[]
  reasoning: string
  sources_used: number
  generation_time_ms: number
}

export interface SelfCritique {
  is_accurate: boolean
  is_complete: boolean
  citation_quality: number // 0-1
  suggested_improvements: string[]
  overall_score: number // 0-1
  should_revise: boolean
}

export interface MultiPassAnswer {
  // Pass 1: Initial generation
  initial_answer: AnswerGeneration
  
  // Pass 2: Self-critique
  critique: SelfCritique
  
  // Pass 3: Refined answer (if needed)
  final_answer: AnswerGeneration
  
  // Metadata
  total_passes: number
  was_revised: boolean
  total_time_ms: number
}

// ============================================================================
// DOCUMENT ANALYSIS TYPES (Checkpoint 2.1)
// ============================================================================

export interface DocumentAnalysis {
  document_type: string
  has_table_of_contents: boolean
  section_headers: string[]
  optimal_chunk_size: number
  key_entities: string[]
  complexity_score: number
}

// ============================================================================
// ROI & ANALYTICS TYPES
// ============================================================================

export interface ROIMetrics {
  queries_processed: number
  avg_time_saved_per_query: number // minutes
  total_hours_saved: number
  hourly_rate: number // user's billing rate
  total_money_saved: number
  confidence_score_avg: number
  documents_processed: number
  avg_citations_per_answer: number
}

export interface InteractionLog {
  id: string
  document_id: string
  query: string
  query_type: QueryType | null
  
  // Search Strategy Used
  vector_weight: number
  bm25_weight: number
  chunks_retrieved: number
  
  // Answer Quality
  confidence_score: number
  was_revised: boolean
  generation_passes: number
  
  // User Engagement
  citations_clicked: number
  time_spent_seconds: number
  user_feedback: 'helpful' | 'not_helpful' | null
  follow_up_query: string | null
  
  // Performance
  query_duration_ms: number
  
  created_at: string
}

// ============================================================================
// SYSTEM IMPROVEMENT TYPES (Learning System - Phase 5)
// ============================================================================

export interface SystemImprovement {
  id: string
  improvement_type: 'search_weight' | 'chunk_size' | 'confidence_threshold' | 'other'
  old_value: number
  new_value: number
  confidence_delta: number // Change in avg confidence
  queries_analyzed: number
  auto_applied: boolean
  created_at: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  duration_ms?: number
}

export interface UploadResponse {
  success: boolean
  documentId: string
  filename: string
  size: number
}

export interface IngestionResponse {
  success: boolean
  documentId: string
  document: {
    name: string
    pages: number
    characters: number
    type: string
    complexity: number
  }
  processing: {
    analysis: DocumentAnalysis
    chunking: {
      total_chunks: number
      avg_size: number
      chunks_with_headers: number
    }
    embeddings: {
      successful: number
      failed: number
      tokens: number
      cost: number
      time_ms: number
    }
    enrichment: {
      successful: number
      failed: number
      tokens: number
      cost: number
      time_ms: number
    }
  }
  performance: {
    total_duration_ms: number
    total_duration_seconds: number
    total_cost: number
    stages: {
      download: number
      parse: number
      analysis: number
      chunking: number
      embeddings: number
      enrichment: number
    }
  }
  message: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DocumentStatus = 'processing' | 'ready' | 'failed'
export type UserFeedback = 'helpful' | 'not_helpful' | null
export type SemanticCategory = 
  | 'introduction'
  | 'definition'
  | 'obligation'
  | 'right'
  | 'limitation'
  | 'procedure'
  | 'timeline'
  | 'payment'
  | 'termination'
  | 'dispute_resolution'
  | 'general_provision'
  | 'signature'
  | 'other'

  // ============================================================================
// BILLING TYPES (v1.1)
// ============================================================================

export type SubscriptionStatus =
| 'free'
| 'active'
| 'trialing'
| 'past_due'
| 'canceled'
| 'incomplete'

export type SubscriptionTier = 'free' | 'pro' | 'enterprise'

export type AuditEventType =
| 'document_upload'
| 'document_query'
| 'document_view'
| 'pdf_stream'
| 'citation_click'
| 'document_delete'
| 'subscription_change'

export interface Subscription {
  id: string
  user_id: string
  paystack_customer_code: string | null
  paystack_subscription_code: string | null
  status: SubscriptionStatus
  price_id: string | null
  tier: SubscriptionTier
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface UsageTracking {
id: string
user_id: string
period_start: string
period_end: string
query_count: number
document_count: number
tokens_consumed: number
tokens_input: number
tokens_output: number
created_at: string
updated_at: string
}

export interface AuditLog {
id: string
user_id: string
document_id: string | null
event_type: AuditEventType
query_text: string | null
response_confidence: number | null
chunks_accessed: number
ip_address: string | null
user_agent: string | null
duration_ms: number | null
metadata: Record<string, unknown>
created_at: string
}

// Tier limits — single source of truth
export const TIER_LIMITS: Record<SubscriptionTier, {
  document_limit: number | null
  query_limit: number | null
  file_size_limit_mb: number
  label: string
  }> = {
  free: {
    document_limit: 3,
    query_limit: 10,
    file_size_limit_mb: 10,
    label: 'Beta Free'
  },
  pro: {
    document_limit: 20,
    query_limit: 200,
    file_size_limit_mb: 100,
    label: 'Solo Lawyer'
  },
  enterprise: {
    document_limit: 100,
    query_limit: null,
    file_size_limit_mb: 500,
    label: 'Small Firm'
  }
  }

// Price ID constants — swap mock values for real Stripe price IDs at go-live
export const PRICE_IDS = {
  free: process.env.PAYSTACK_PLAN_FREE ?? 'plan_free_mock_2026',
  pro: process.env.PAYSTACK_PLAN_PRO ?? 'plan_pro_mock_2026',
  enterprise: process.env.PAYSTACK_PLAN_ENTERPRISE ?? 'plan_enterprise_mock_2026',
} as const

// ============================================================================
// PIPELINE TYPES — PRISM INTELLIGENCE PIPELINE (V1)
// ============================================================================

// ----------------------------------------------------------------------------
// EPISTEMIC CATEGORY
// ----------------------------------------------------------------------------

export type EpistemicCategory =
  | 'EXPLICITLY_STATED'
  | 'INFERRED'
  | 'SILENT'

// ----------------------------------------------------------------------------
// CHUNK METADATA — LOCKED SCHEMA (Fix 5)
// All five fields mandatory. Non-optional. Enforced at ingestion and chunking.
// ----------------------------------------------------------------------------

export interface ChunkMetadata {
  tenant_id: string
  document_id: string
  page_number: number
  section_header: string
  chunk_index: number
}

// ----------------------------------------------------------------------------
// ALETHEIA — RETRIEVAL SPECIALIST
// Stage 1. Gemini 2.5 Pro via Google AI API.
// Input: full document text + query.
// Output: AletheiaOutput — structured evidence package.
// ----------------------------------------------------------------------------

export type AletheiaRetrievalStatus = 'responsive' | 'partial' | 'empty'
export type AletheiaResponsiveness = 'responsive' | 'adjacent'

export interface AletheiaClaim {
  claim_id: string                    // e.g. "A-001"
  responsiveness: AletheiaResponsiveness
  claim_text: string                  // verbatim — no paraphrase
  source_chunk_id: string
  page_number: number | 'unknown'
  section_reference: string | 'unknown'
  adjacent_note?: string              // populated only when responsiveness is 'adjacent'
}

export interface AletheiaOutput {
  retrieval_status: AletheiaRetrievalStatus
  query_received: string
  search_scope: 'full_document'       // always full_document — locked
  claims: AletheiaClaim[]
  empty_declaration?: string          // populated only when retrieval_status is 'empty'
}

// ----------------------------------------------------------------------------
// KRATOS — VERIFICATION AUDITOR
// Stage 2. Claude Haiku 4.5 via Anthropic API. Model: claude-haiku-4-5-20251001
// Input: AletheiaOutput + source document content.
// Output: KratosOutput — discriminated union on audit_status.
// ----------------------------------------------------------------------------

export type KratosAuditStatus =
  | 'verified'
  | 'partial'
  | 'empty'
  | 'retry_triggered'

export interface KratosVerifiedClaim {
  claim_id: string                    // matches Aletheia's claim_id exactly
  claim_text: string                  // unchanged from Aletheia's output
  verified: true
  source_chunk_id: string
  page_number: number                 // confirmed or corrected — never 'unknown'
  section_reference: string           // confirmed or corrected
  failure_reason: null
}

export interface KratosBlockedClaim {
  claim_id: string
  claim_text: string                  // unchanged from Aletheia's output
  verified: false
  source_chunk_id: string
  page_number: number | 'unknown'
  section_reference: string | 'unknown'
  failure_reason: string              // precise reason — never null
}

export interface KratosAdjacentClaim {
  claim_id: string
  claim_text: string                  // unchanged from Aletheia's output
  responsiveness: 'adjacent'
  adjacent_note: string               // Aletheia's note — unchanged
  source_chunk_id: string
  page_number: number | 'unknown'
  section_reference: string | 'unknown'
}

// Schema A — standard output, no retry
export interface KratosOutputStandard {
  audit_status: 'verified' | 'partial' | 'empty'
  claims_audited: number
  claims_verified: number
  claims_blocked: number
  retry_triggered: false
  retry_attempted: false
  retry_failed: false
  verified_claims: KratosVerifiedClaim[]
  adjacent_claims: KratosAdjacentClaim[]
  blocked_claims: KratosBlockedClaim[]
}

// Schema B — retry triggered, moment of triggering
export interface KratosOutputRetryTriggered {
  audit_status: 'retry_triggered'
  claims_audited: number
  claims_verified: 0
  claims_blocked: number
  retry_triggered: true
  retry_attempted: false
  retry_failed: false
  retry_query: string                 // reformulated — not a restatement
  retry_rationale: string             // specific reason original search failed
  verified_claims: []
  adjacent_claims: []
  blocked_claims: KratosBlockedClaim[]
}

// Schema C — terminal failure
export interface KratosOutputTerminal {
  audit_status: 'empty'
  claims_audited: number              // cumulative across both passes
  claims_verified: 0
  claims_blocked: number              // cumulative
  retry_triggered: true
  retry_attempted: true
  retry_failed: true
  verified_claims: []
  adjacent_claims: []
  blocked_claims: KratosBlockedClaim[]
}

// Discriminated union — the type the orchestrator works with
export type KratosOutput =
  | KratosOutputStandard
  | KratosOutputRetryTriggered
  | KratosOutputTerminal

// ----------------------------------------------------------------------------
// PRONOIA — RISK & IMPLICATION ANALYST
// Stage 3. Claude Sonnet 4.6 via Anthropic API. Model: claude-sonnet-4-6
// Shared ANTHROPIC_API_KEY with Kratos. Separate system prompt.
// Conditional activation only. Silent output is valid and correct output.
// ----------------------------------------------------------------------------

export type PronoiaActivationStatus = 'active' | 'silent'

export type PronoiaRiskCategory =
  | 'liability_exposure'
  | 'enforcement_uncertainty'
  | 'structural_asymmetry'
  | 'drafting_gap'
  | 'jurisdictional_risk'
  | 'commercial_exposure'
  | 'privilege_or_confidentiality_risk'

export interface PronoiaRiskFinding {
  finding_id: string                  // e.g. "P-001"
  risk_category: PronoiaRiskCategory  // locked taxonomy — no free-text
  finding: string                     // opens with mandatory epistemic marker
  adversarial_angle: string           // how opposing counsel uses this finding
  verified_claim_ids: string[]        // anchors to Kratos verified_claims
  adjacent_claim_ids: string[]        // contextual only — never verified facts
}

export interface PronoiaAdversarialEntry {
  vulnerability: string
  opposing_argument: string
  leverage_holder: 'client' | 'developer' | 'neither' | 'disputed'
  verified_claim_ids: string[]
}

export interface PronoiaDraftingGap {
  gap_id: string                      // e.g. "G-001"
  absent_provision: string            // exact name of missing clause
  consequence: string                 // specific legal/commercial consequence
  verified_basis: string              // which Kratos claim establishes absence
  adversarial_consequence: string     // how gap would be exploited in dispute
}

export interface PronoiaAnalyticalBrief {
  epistemic_baseline: string          // declared before any analysis — Logos reads first
  risk_findings: PronoiaRiskFinding[]
  adversarial_exploitation_matrix: PronoiaAdversarialEntry[]
  drafting_gaps: PronoiaDraftingGap[]
  structural_summary: string          // Logos opening — 2-4 sentences
}

// Active output
export interface PronoiaOutputActive {
  activation_status: 'active'
  analytical_brief: PronoiaAnalyticalBrief
}

// Silent output — correct and valid
export interface PronoiaOutputSilent {
  activation_status: 'silent'
  reason: string                      // one line — why activation not required
}

// Discriminated union
export type PronoiaOutput = PronoiaOutputActive | PronoiaOutputSilent

// ----------------------------------------------------------------------------
// LOGOS — SYNTHESIS & VERDICT
// Stage 4. GPT-5.1 via Azure AI Foundry.
// The only voice the user sees. Synthesizes from pipeline only.
// ----------------------------------------------------------------------------

export interface LogosOutput {
  epistemic_category: EpistemicCategory
  answer: string                      // calibrated to category — inline citations
  closing_statement: string           // one sentence — category-appropriate
}

// ----------------------------------------------------------------------------
// PIPELINE RESULT — COMPLETE ORCHESTRATOR OUTPUT
// Carries all four agent outputs for chain of custody log.
// ----------------------------------------------------------------------------

export interface PipelineResult {
  // Final output
  logos: LogosOutput

  // Audit trail — all four agent outputs preserved
  aletheia: AletheiaOutput
  kratos: KratosOutput
  pronoia: PronoiaOutput

  // Pipeline metadata
  query: string
  document_id: string
  retry_attempted: boolean
  total_time_ms: number
  tokens_per_agent: {
    aletheia: { input: number; output: number }
    kratos: { input: number; output: number }
    pronoia: { input: number; output: number }
    logos: { input: number; output: number }
  }
  citations: Citation[]
}