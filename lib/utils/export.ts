/**
 * lib/utils/export.ts
 *
 * Serializes a chat conversation to Markdown and triggers a browser download.
 * Pure client-side — no API route needed. Uses Blob + URL.createObjectURL.
 */

interface Citation {
    chunk_id: string
    document_id: string
    text: string
    page: number
    relevance: number
    ai_summary?: string
    chunk_index: number
  }
  
  interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    confidence?: number
    citations?: Citation[]
    timestamp: Date
  }
  
  /**
   * exportConversation
   *
   * Converts messages to a clean Markdown document and downloads it.
   *
   * @param messages     - The full conversation history
   * @param documentName - Name of the source PDF (used in filename + header)
   */
  export function exportConversation(messages: Message[], documentName: string): void {
    if (messages.length === 0) return
  
    const timestamp = new Date().toLocaleString()
    const safeDocName = documentName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `PRISM_${safeDocName}_${Date.now()}.md`
  
    const lines: string[] = []
  
    // ── Document header ──────────────────────────────────────────────
    lines.push(`# PRISM Conversation Export`)
    lines.push(``)
    lines.push(`**Document:** ${documentName}`)
    lines.push(`**Exported:** ${timestamp}`)
    lines.push(`**Messages:** ${messages.length}`)
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
  
    // ── Messages ─────────────────────────────────────────────────────
    messages.forEach((message, idx) => {
      const time = message.timestamp.toLocaleTimeString()
  
      if (message.role === 'user') {
        lines.push(`### 🧑 You — ${time}`)
        lines.push(``)
        lines.push(message.content)
        lines.push(``)
      } else {
        lines.push(`### 🤖 PRISM — ${time}`)
        lines.push(``)
        lines.push(message.content)
        lines.push(``)
  
        // Confidence
        if (message.confidence !== undefined) {
          const pct = (message.confidence * 100).toFixed(0)
          const label =
            message.confidence >= 0.9
              ? 'High confidence'
              : message.confidence >= 0.7
              ? 'Good confidence'
              : 'Moderate confidence'
          lines.push(`*${label} (${pct}%)*`)
          lines.push(``)
        }
  
        // Citations
        if (message.citations && message.citations.length > 0) {
          lines.push(`**Sources:**`)
          lines.push(``)
          message.citations.forEach((citation, cidx) => {
            lines.push(`**[${cidx + 1}] Page ${citation.page}**`)
            if (citation.ai_summary) {
              lines.push(`> ${citation.ai_summary}`)
            }
            if (citation.text) {
              // Truncate long excerpts in the export
              const excerpt = citation.text.length > 200
                ? citation.text.slice(0, 200) + '...'
                : citation.text
              lines.push(`> *"${excerpt}"*`)
            }
            lines.push(``)
          })
        }
      }
  
      // Divider between messages (not after last)
      if (idx < messages.length - 1) {
        lines.push(`---`)
        lines.push(``)
      }
    })
  
    // ── Footer ───────────────────────────────────────────────────────
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
    lines.push(`*Exported from PRISM — Precision Document Intelligence*`)
    lines.push(`*This is a research tool, not legal advice. Always verify critical information.*`)
  
    // ── Trigger download ─────────────────────────────────────────────
    const markdown = lines.join('\n')
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
  
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  
    // Clean up the object URL after the download is triggered
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }