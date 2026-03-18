/**
 * lib/utils/export.ts
 *
 * Forensic Export — generates a print-optimised HTML document and
 * immediately triggers the browser's Save as PDF dialog.
 *
 * No external dependencies. Pure client-side HTML + print CSS.
 * Lawyer clicks the button → OS print dialog appears instantly.
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

function confidenceLabel(score: number): string {
  if (score >= 0.95) return 'High Confidence'
  if (score >= 0.7) return 'Good Confidence'
  return 'Moderate Confidence'
}

function confidenceColor(score: number): string {
  if (score >= 0.95) return '#059669'
  if (score >= 0.7) return '#d97706'
  return '#dc2626'
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function exportConversation(messages: Message[], documentName: string): void {
  const assistantMessages = messages.filter(
    m => m.role === 'assistant' && m.content
  )
  if (assistantMessages.length === 0) return

  const exportedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // ── Build exchange blocks ─────────────────────────────────────────
  const exchangeBlocks: string[] = []

  let exchangeIndex = 0
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue

    // Find the user message that preceded this assistant response
    let userQuery = ''
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].role === 'user') {
        userQuery = messages[j].content
        break
      }
    }

    exchangeIndex++
    const confidence = msg.confidence ?? 0
    const citations = msg.citations ?? []

    // Build citations column
    const citationsHtml = citations.length > 0
      ? citations.map((c, idx) => `
          <div class="citation-item">
            <div class="citation-header">
              <span class="citation-number">[${idx + 1}]</span>
              <span class="citation-page">Page ${c.page}</span>
              <span class="citation-relevance">${(c.relevance * 100).toFixed(0)}% relevant</span>
            </div>
            ${c.ai_summary ? `<div class="citation-summary">${escapeHtml(c.ai_summary)}</div>` : ''}
            <div class="citation-text">"${escapeHtml(c.text.slice(0, 300))}${c.text.length > 300 ? '…' : ''}"</div>
          </div>
        `).join('')
      : '<div class="no-citations">No source citations for this response.</div>'

    exchangeBlocks.push(`
      <div class="exchange">
        <div class="exchange-header">
          <span class="exchange-number">Exchange ${exchangeIndex}</span>
          <span class="exchange-time">${msg.timestamp.toLocaleTimeString()}</span>
        </div>

        ${userQuery ? `
          <div class="query-block">
            <div class="block-label">QUERY</div>
            <div class="query-text">${escapeHtml(userQuery)}</div>
          </div>
        ` : ''}

        <div class="split-pane">
          <div class="pane pane-answer">
            <div class="pane-label">AI ANALYSIS</div>
            <div class="answer-text">${escapeHtml(msg.content)}</div>
            <div class="confidence-badge" style="color: ${confidenceColor(confidence)}; border-color: ${confidenceColor(confidence)};">
              ${confidenceLabel(confidence)} — ${(confidence * 100).toFixed(0)}%
            </div>
          </div>
          <div class="pane pane-sources">
            <div class="pane-label">SOURCE CITATIONS</div>
            ${citationsHtml}
          </div>
        </div>
      </div>
    `)
  }

  // ── Build full HTML document ──────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PRISM Intelligence Audit — ${escapeHtml(documentName)}</title>
  <style>
    /* ── Reset ──────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Base ───────────────────────────────────────── */
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }

    /* ── Screen wrapper (web preview) ───────────────── */
    .document-wrapper {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 40px;
    }

    /* ── Cover header ───────────────────────────────── */
    .cover-header {
      border-bottom: 3px solid #1a1a1a;
      padding-bottom: 16px;
      margin-bottom: 32px;
    }
    .cover-title {
      font-size: 18pt;
      font-weight: bold;
      letter-spacing: -0.5px;
      color: #0a0a0a;
    }
    .cover-subtitle {
      font-size: 10pt;
      color: #555;
      margin-top: 6px;
    }
    .cover-meta {
      display: flex;
      gap: 32px;
      margin-top: 12px;
      font-size: 9pt;
      color: #444;
    }
    .cover-meta span strong {
      color: #1a1a1a;
    }

    /* ── Exchange ────────────────────────────────────── */
    .exchange {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .exchange-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f0f0f0;
      padding: 6px 12px;
      font-size: 9pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #333;
      margin-bottom: 12px;
    }
    .exchange-time {
      font-weight: normal;
      color: #666;
    }

    /* ── Query block ─────────────────────────────────── */
    .query-block {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .block-label {
      font-size: 7.5pt;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    .query-text {
      font-style: italic;
      color: #333;
      padding: 8px 12px;
      border-left: 3px solid #1a1a1a;
      background: #fafafa;
      font-size: 10.5pt;
    }

    /* ── Split pane ──────────────────────────────────── */
    .split-pane {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      page-break-inside: avoid;
    }
    .pane {
      border: 1px solid #ddd;
      padding: 14px 16px;
      page-break-inside: avoid;
    }
    .pane-label {
      font-size: 7.5pt;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #666;
      border-bottom: 1px solid #eee;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .pane-answer {
      border-top: 3px solid #059669;
    }
    .pane-sources {
      border-top: 3px solid #1a1a1a;
      background: #fafafa;
    }

    /* ── Answer ──────────────────────────────────────── */
    .answer-text {
      font-size: 10.5pt;
      line-height: 1.7;
      color: #1a1a1a;
      white-space: pre-wrap;
    }
    .confidence-badge {
      display: inline-block;
      margin-top: 12px;
      font-size: 8pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      border: 1px solid;
      padding: 3px 8px;
      text-transform: uppercase;
    }

    /* ── Citations ───────────────────────────────────── */
    .citation-item {
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid #eee;
      page-break-inside: avoid;
    }
    .citation-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .citation-header {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 5px;
    }
    .citation-number {
      font-weight: bold;
      font-size: 9pt;
      color: #1a1a1a;
    }
    .citation-page {
      font-size: 8.5pt;
      color: #444;
      background: #efefef;
      padding: 1px 6px;
    }
    .citation-relevance {
      font-size: 8pt;
      color: #666;
    }
    .citation-summary {
      font-size: 9pt;
      color: #444;
      font-style: italic;
      margin-bottom: 5px;
    }
    .citation-text {
      font-size: 9pt;
      color: #333;
      line-height: 1.5;
      border-left: 2px solid #ccc;
      padding-left: 8px;
    }
    .no-citations {
      font-size: 9pt;
      color: #888;
      font-style: italic;
    }

    /* ── Footer ──────────────────────────────────────── */
    .document-footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #ccc;
      font-size: 8.5pt;
      color: #666;
      display: flex;
      justify-content: space-between;
    }

    /* ── Print styles ────────────────────────────────── */
    @media print {
      body {
        font-size: 10pt;
        background: #fff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .document-wrapper {
        max-width: 100%;
        padding: 0;
        margin: 0;
      }

      .cover-header {
        margin-bottom: 20pt;
      }

      .exchange {
        page-break-inside: avoid;
        margin-bottom: 24pt;
      }

      .split-pane {
        page-break-inside: avoid;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12pt;
      }

      .pane {
        page-break-inside: avoid;
      }

      .citation-item {
        page-break-inside: avoid;
      }

      .query-block {
        page-break-inside: avoid;
      }

      .document-footer {
        position: running(footer);
      }

      @page {
        margin: 20mm 18mm;
        size: A4;

        @bottom-center {
          content: "PRISM Intelligence Audit · " attr(data-document) " · Page " counter(page) " of " counter(pages);
          font-size: 8pt;
          color: #666;
        }
      }
    }
  </style>
</head>
<body>
  <div class="document-wrapper">

    <div class="cover-header">
      <div class="cover-title">PRISM Intelligence Audit</div>
      <div class="cover-subtitle">${escapeHtml(documentName)}</div>
      <div class="cover-meta">
        <span><strong>Exported:</strong> ${exportedAt}</span>
        <span><strong>Exchanges:</strong> ${exchangeIndex}</span>
        <span><strong>System:</strong> PRISM · Precision Document Intelligence</span>
      </div>
    </div>

    ${exchangeBlocks.join('\n')}

    <div class="document-footer">
      <span>PRISM · prism-mu-one.vercel.app</span>
      <span>This is a research tool, not legal advice. Always verify critical information.</span>
    </div>

  </div>

  <script>
    // Auto-trigger print dialog immediately on load
    window.onload = function() {
      setTimeout(function() {
        window.print()
      }, 400)
    }
  </script>
</body>
</html>`

  // ── Open in hidden iframe and trigger print ───────────────────────
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-9999px'
  iframe.style.left = '-9999px'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.border = 'none'
  iframe.src = url
  document.body.appendChild(iframe)

  // Clean up after print dialog is dismissed
  setTimeout(() => {
    document.body.removeChild(iframe)
    URL.revokeObjectURL(url)
  }, 60000)
}