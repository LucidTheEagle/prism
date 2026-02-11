import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Model configurations
export const MODELS = {
  // For reasoning and analysis
  GPT4_TURBO: 'gpt-4-turbo',
  
  // For embeddings (1536 dimensions)
  EMBEDDING: 'text-embedding-3-small',
} as const

// Token limits
export const TOKEN_LIMITS = {
  GPT4_TURBO: 128000,
  EMBEDDING: 8191,
} as const