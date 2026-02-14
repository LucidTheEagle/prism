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
  }
}

// ============================================================================
// CHAT TYPES (Checkpoint 3.4, 3.5, 3.6)
// ============================================================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  
  // AI Response Metadata
  confidence_score?: number
  citations?: Citation[]
  reasoning?: string
  was_revised?: boolean // After self-critique
  
  // Multi-pass tracking
  generation_pass?: number // 1, 2, or 3
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