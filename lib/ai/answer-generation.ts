import { runPipeline } from '@/lib/ai/pipeline/orchestrator'
import type { PipelineResult } from '@/lib/types'

// ============================================================================
// PRISM ANSWER GENERATION — V1 PIPELINE
// Replaces the three-pass GPT-4o self-critique system with the four-character
// sequential pipeline: Aletheia → Kratos → Pronoia → Logos
//
// Previous implementation archived below — self-critique.ts preserved as
// reference for ruleBasedCritique chunk ID validation utility.
// ============================================================================

export interface GenerationConfig {
  max_answer_length?: number
  citation_style?: 'inline' | 'endnotes'
  include_reasoning?: boolean
  temperature?: number
}

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  max_answer_length: 300,
  citation_style: 'inline',
  include_reasoning: true,
  temperature: 0.3,
}

// ============================================================================
// PRIMARY EXPORT — replaces generateMultiPassAnswer
// Called by app/api/chat/route.ts after Sub-sprint 1.11 update
// ============================================================================

export async function generateAnswer(
  query: string,
  documentText: string,
  documentId: string,
  userId: string,
  _config: GenerationConfig = DEFAULT_GENERATION_CONFIG
): Promise<PipelineResult> {
  return runPipeline({
    query,
    documentText,
    documentId,
    userId,
  })
}

// ============================================================================
// ARCHIVED — generateMultiPassAnswer
// Kept as reference during transition. Removed after Sub-sprint 1.11 confirms
// the chat route fully consumes PipelineResult with no regressions.
// ============================================================================

// import { openai, MODELS } from '@/lib/openai/client'
// import type { SearchResult, Citation, AnswerGeneration } from '@/lib/types'
// import { critiqueAnswer, type SelfCritique } from './self-critique'
//
// export async function generateInitialAnswer(
//   query: string,
//   searchResults: SearchResult[],
//   config: GenerationConfig = DEFAULT_GENERATION_CONFIG
// ): Promise<{ result: AnswerGeneration; tokens_input: number; tokens_output: number }> {
//   ... [archived — full implementation preserved in git history]
// }
//
// export async function refineAnswer(
//   query: string,
//   initialAnswer: AnswerGeneration,
//   critique: SelfCritique,
//   searchResults: SearchResult[]
// ): Promise<{ result: AnswerGeneration; tokens_input: number; tokens_output: number }> {
//   ... [archived — full implementation preserved in git history]
// }
//
// export interface MultiPassResult {
//   initial_answer: AnswerGeneration
//   critique: SelfCritique
//   final_answer: AnswerGeneration
//   total_passes: number
//   was_revised: boolean
//   total_time_ms: number
//   cost_estimate: number
//   tokens_input: number
//   tokens_output: number
// }
//
// export async function generateMultiPassAnswer(
//   query: string,
//   searchResults: SearchResult[],
//   config: GenerationConfig = DEFAULT_GENERATION_CONFIG
// ): Promise<MultiPassResult> {
//   ... [archived — full implementation preserved in git history]
// }
//
// function estimateGenerationCost(sourceCount: number, wasRevised: boolean): number {
//   ... [archived]
// }