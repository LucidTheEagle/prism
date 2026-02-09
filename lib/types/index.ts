// Core Document Types
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
    
    // AI Enrichment
    ai_summary: string | null
    keywords: string[]
    semantic_category: string | null
    
    created_at: string
  }
  
  // Chat Types
  export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    
    // AI Response Metadata
    confidence_score?: number
    citations?: Citation[]
    reasoning?: string
    was_revised?: boolean
    
    timestamp: Date
    isStreaming?: boolean
  }
  
  export interface Citation {
    chunk_id: string
    text: string
    page: number
    relevance: number
    metadata?: unknown
  }
  
  // AI Analysis Types
  export interface QueryAnalysis {
    query_type: 'factual' | 'conceptual' | 'comparative' | 'extractive'
    requires_exact_match: boolean
    temporal_context: boolean
    vector_weight: number
    bm25_weight: number
    chunk_count: number
    needs_cross_reference: boolean
    confidence_threshold: number
  }
  
  export interface DocumentAnalysis {
    document_type: string
    has_table_of_contents: boolean
    section_headers: string[]
    optimal_chunk_size: number
    key_entities: string[]
    complexity_score: number
  }
  
  // Search Results
  export interface SearchResult {
    id: string
    document_id: string
    content: string
    metadata: unknown
    ai_summary: string | null
    keywords: string[]
    combined_score: number
    vector_similarity: number
    bm25_rank: number
  }
  
  // ROI Tracking
  export interface ROIMetrics {
    queries_processed: number
    avg_time_saved_per_query: number
    total_hours_saved: number
    hourly_rate: number
    total_money_saved: number
    confidence_score_avg: number
    documents_processed: number
  }
  
  // Interaction Logging
  export interface InteractionLog {
    id: string
    document_id: string
    query: string
    query_type: string | null
    
    // Search Strategy
    vector_weight: number
    bm25_weight: number
    chunks_retrieved: number
    
    // Answer Quality
    confidence_score: number
    was_revised: boolean
    
    // User Engagement
    citations_clicked: number
    time_spent_seconds: number
    user_feedback: 'helpful' | 'not_helpful' | null
    follow_up_query: string | null
    
    // Performance
    query_duration_ms: number
    
    created_at: string
  }