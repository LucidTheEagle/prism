import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ============================================================================
// AZURE OPENAI — LOGOS (GPT-5.1)
// ============================================================================

if (!process.env.AI_API_KEY) {
  throw new Error('Missing AI_API_KEY environment variable')
}

if (!process.env.AI_BASE_URL) {
  throw new Error('Missing AI_BASE_URL environment variable')
}

if (!process.env.AZURE_DEPLOYMENT_NAME) {
  throw new Error('Missing AZURE_DEPLOYMENT_NAME environment variable')
}

if (!process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME) {
  throw new Error('Missing AZURE_EMBEDDINGS_DEPLOYMENT_NAME environment variable')
}

// ============================================================================
// ANTHROPIC — KRATOS (Claude Haiku 4.5) + PRONOIA (Claude Sonnet 4.6)
// ============================================================================

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable')
}

// ============================================================================
// GOOGLE AI — ALETHEIA (Gemini 2.5 Pro)
// ============================================================================

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error('Missing GOOGLE_AI_API_KEY environment variable')
}

// ----------------------------------------------------------------------------
// Logos — Azure OpenAI chat client (GPT-5.1)
// ----------------------------------------------------------------------------
export const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: `${process.env.AI_BASE_URL}openai/deployments/${process.env.AZURE_DEPLOYMENT_NAME}`,
  defaultHeaders: {
    'api-key': process.env.AI_API_KEY,
  },
  defaultQuery: {
    'api-version': '2025-01-01-preview',
  },
})

// ----------------------------------------------------------------------------
// Embeddings — Azure OpenAI embeddings client (text-embedding-3-small)
// Unchanged — not part of the pipeline characters
// ----------------------------------------------------------------------------
export const openaiEmbeddings = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: `${process.env.AI_BASE_URL}openai/deployments/${process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME}`,
  defaultHeaders: {
    'api-key': process.env.AI_API_KEY,
  },
  defaultQuery: {
    'api-version': '2025-01-01-preview',
  },
})

// ----------------------------------------------------------------------------
// Kratos + Pronoia — Anthropic client
// Kratos uses MODELS.KRATOS, Pronoia uses MODELS.PRONOIA
// Same API key, different model strings, completely separate system prompts
// ----------------------------------------------------------------------------
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ----------------------------------------------------------------------------
// Aletheia — Google AI client (Gemini 2.5 Pro)
// ----------------------------------------------------------------------------
export const googleAI = new GoogleGenerativeAI(
  process.env.GOOGLE_AI_API_KEY
)

// ============================================================================
// MODEL STRINGS — never hardcode elsewhere in the codebase
// ============================================================================
export const MODELS = {
  // Logos — Azure deployment name (GPT-5.1 via Azure AI Foundry)
  LOGOS: process.env.AZURE_DEPLOYMENT_NAME as string,

  // Backward compatibility alias — files not yet migrated to pipeline still reference GPT4O
  // Removed when answer-generation.ts, self-critique.ts, metadata-enrichment.ts,
  // query-analysis.ts, reranking.ts, and documentAnalyzer.ts are replaced in Sub-sprints 1.10+
  GPT4O: process.env.AZURE_DEPLOYMENT_NAME as string,

  // Kratos — Claude Haiku 4.5
  KRATOS: 'claude-haiku-4-5-20251001',

  // Pronoia — Claude Sonnet 4.6
  PRONOIA: 'claude-sonnet-4-6',

  // Aletheia — Gemini 2.5 Pro
  ALETHEIA: 'gemini-2.5-pro',

  // Embeddings — unchanged
  EMBEDDING: process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME as string,
} as const

// ============================================================================
// TOKEN LIMITS
// ============================================================================
export const TOKEN_LIMITS = {
  LOGOS: 128000,
  KRATOS: 200000,    // Claude Haiku 4.5 context window
  PRONOIA: 200000,   // Claude Sonnet 4.6 context window
  ALETHEIA: 1000000, // Gemini 2.5 Pro — 1M token window, full document input
  EMBEDDING: 8191,
} as const