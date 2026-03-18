import OpenAI from 'openai'

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

// Chat client — routes to prism-gpt4o deployment
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

// Embeddings client — routes to prism-embeddings deployment
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

// Deployment names — never hardcode model strings
export const MODELS = {
  GPT4O: process.env.AZURE_DEPLOYMENT_NAME as string,
  EMBEDDING: process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME as string,
} as const

// Token limits
export const TOKEN_LIMITS = {
  GPT4O: 128000,
  EMBEDDING: 8191,
} as const