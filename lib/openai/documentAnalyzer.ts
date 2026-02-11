import { openai, MODELS } from './client'
import type { DocumentAnalysis } from '@/lib/types'

/**
 * AI Document Analyzer
 * Analyzes document structure BEFORE chunking to determine optimal strategy
 */
export async function analyzeDocument(
  text: string,
  filename: string
): Promise<DocumentAnalysis> {
  // Take first 5000 characters for analysis (representative sample)
  const sample = text.slice(0, 5000)
  
  const prompt = `Analyze this document structure and return ONLY a JSON object (no markdown, no explanation):

DOCUMENT: ${filename}
SAMPLE TEXT (first 5000 chars):
${sample}

Return JSON with this exact structure:
{
  "document_type": "contract|research_paper|legal_brief|technical_manual|report|other",
  "has_table_of_contents": boolean,
  "section_headers": ["header1", "header2", ...],
  "optimal_chunk_size": number,
  "key_entities": ["entity1", "entity2", ...],
  "complexity_score": number
}

RULES:
- document_type: Best guess based on structure and language
- has_table_of_contents: true if you see "Table of Contents" or numbered sections
- section_headers: Extract main section titles (max 10)
- optimal_chunk_size: Recommended tokens per chunk (500-1500)
  * Complex legal: 800-1000 (need context)
  * Technical docs: 600-800 (precise sections)
  * General text: 500-700 (balanced)
- key_entities: Extract people, companies, dates, locations (max 20)
- complexity_score: 1-10 (1=simple, 10=very complex legal/technical)

RESPOND WITH ONLY THE JSON OBJECT, NO OTHER TEXT.`

  try {
    const response = await openai.chat.completions.create({
      model: MODELS.GPT4_TURBO,
      messages: [
        {
          role: 'system',
          content: 'You are a document analysis expert. Return only valid JSON, no markdown formatting, no explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Clean response (remove markdown if present)
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Parse JSON
    const analysis = JSON.parse(cleanedContent) as DocumentAnalysis

    // Validate and set defaults
    return {
      document_type: analysis.document_type || 'other',
      has_table_of_contents: analysis.has_table_of_contents || false,
      section_headers: analysis.section_headers || [],
      optimal_chunk_size: Math.min(Math.max(analysis.optimal_chunk_size || 700, 500), 1500),
      key_entities: analysis.key_entities || [],
      complexity_score: Math.min(Math.max(analysis.complexity_score || 5, 1), 10),
    }

  } catch (error) {
    console.error('Document analysis error:', error)
    
    // Return safe defaults if analysis fails
    return {
      document_type: 'other',
      has_table_of_contents: false,
      section_headers: [],
      optimal_chunk_size: 700,
      key_entities: [],
      complexity_score: 5,
    }
  }
}

/**
 * Quick document type detection (fallback without AI)
 */
export function detectDocumentType(text: string, filename: string): string {
  const lowerText = text.toLowerCase()
  const lowerFilename = filename.toLowerCase()

  // Contract indicators
  if (
    lowerText.includes('whereas') ||
    lowerText.includes('hereby agree') ||
    lowerText.includes('termination clause') ||
    lowerFilename.includes('contract') ||
    lowerFilename.includes('agreement')
  ) {
    return 'contract'
  }

  // Legal brief indicators
  if (
    lowerText.includes('plaintiff') ||
    lowerText.includes('defendant') ||
    lowerText.includes('court') ||
    lowerFilename.includes('brief')
  ) {
    return 'legal_brief'
  }

  // Research paper indicators
  if (
    lowerText.includes('abstract') ||
    lowerText.includes('methodology') ||
    lowerText.includes('references') ||
    lowerFilename.includes('paper') ||
    lowerFilename.includes('research')
  ) {
    return 'research_paper'
  }

  // Technical manual indicators
  if (
    lowerText.includes('installation') ||
    lowerText.includes('configuration') ||
    lowerText.includes('troubleshooting') ||
    lowerFilename.includes('manual') ||
    lowerFilename.includes('guide')
  ) {
    return 'technical_manual'
  }

  return 'other'
}