'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Loader2, CheckCircle2, AlertCircle, FileText,
  Sparkles, ArrowLeft, Moon, Sun, Download, ChevronDown,
  RefreshCw, WifiOff,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { exportConversation } from '@/lib/utils/export'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  confidence?: number
  citations?: Citation[]
  timestamp: Date
}

interface Citation {
  chunk_id: string
  document_id: string
  text: string
  page: number
  relevance: number
  ai_summary?: string
  chunk_index: number
}

interface Document {
  id: string
  name: string
  status: string
  page_count: number
  document_type: string
  created_at: string
}

interface ChatInterfaceProps {
  documentId?: string
  documentName?: string
  onCitationClick?: (page: number) => void
  onDocumentChange?: (documentId: string, documentName: string) => void
}

export default function ChatInterface({
  documentId: initialDocumentId,
  documentName: initialDocumentName,
  onCitationClick,
  onDocumentChange,
}: ChatInterfaceProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [activeDocumentId, setActiveDocumentId] = useState(initialDocumentId)
  const [activeDocumentName, setActiveDocumentName] = useState(initialDocumentName)

  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)
  const selectorRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Fetch all documents for selector ──────────────────────────────
  const fetchAllDocuments = useCallback(async () => {
    if (allDocuments.length > 0) return
    setDocsLoading(true)
    setDocsError(null)
    try {
      const response = await fetch('/api/documents')
      if (response.status === 401) {
        setDocsError('Session expired. Please sign in again.')
        return
      }
      if (!response.ok) throw new Error(`Failed to fetch documents (${response.status})`)
      const data = await response.json()
      const ready = (data.documents || []).filter(
        (d: Document) => d.status === 'ready'
      )
      setAllDocuments(ready)
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setDocsLoading(false)
    }
  }, [allDocuments.length])

  const handleSelectorOpen = () => {
    setSelectorOpen(prev => !prev)
    fetchAllDocuments()
  }

  const handleDocumentSwitch = (doc: Document) => {
    setSelectorOpen(false)
    if (doc.id === activeDocumentId) return
    setActiveDocumentId(doc.id)
    setActiveDocumentName(doc.name)
    setMessages([])
    setHistoryError(null)
    setSubmitError(null)
    setHistoryLoading(true)
    onDocumentChange?.(doc.id, doc.name)
  }

  // ── Load message history ───────────────────────────────────────────
  useEffect(() => {
    if (!activeDocumentId) {
      setHistoryLoading(false)
      return
    }

    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const response = await fetch(`/api/chat/${activeDocumentId}/messages`)
        if (response.status === 401) {
          setHistoryError('Session expired. Please sign in again.')
          return
        }
        if (!response.ok) throw new Error(`Failed to load history (${response.status})`)
        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          const restored: Message[] = data.messages.map((row: {
            id: string
            role: 'user' | 'assistant'
            content: string
            confidence?: number
            citations?: Citation[]
            created_at: string
          }) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            confidence: row.confidence ?? undefined,
            citations: row.citations ?? undefined,
            timestamp: new Date(row.created_at),
          }))
          setMessages(restored)
        } else {
          setMessages([])
        }
      } catch (err) {
        setHistoryError(
          err instanceof Error ? err.message : 'Failed to load conversation history'
        )
      } finally {
        setHistoryLoading(false)
      }
    }

    loadHistory()
  }, [activeDocumentId])

  // ── Persist message (fire-and-forget, non-fatal) ───────────────────
  const persistMessage = async (message: Message) => {
    if (!activeDocumentId) return
    try {
      await fetch(`/api/chat/${activeDocumentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          confidence: message.confidence ?? null,
          citations: message.citations ?? null,
        }),
      })
    } catch {
      // Non-fatal — message is still displayed in UI
      console.warn('[ChatInterface] Failed to persist message')
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!historyLoading) inputRef.current?.focus()
  }, [historyLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setSubmitError(null)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    persistMessage(userMessage)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          documentId: activeDocumentId || undefined,
        }),
      })

      if (response.status === 401) {
        setSubmitError('Session expired. Please sign in again to continue.')
        return
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Request failed (${response.status})`)
      }

      const data = await response.json()

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer,
          confidence: data.confidence_score,
          citations: data.citations,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
        persistMessage(assistantMessage)
      } else {
        throw new Error(data.error || 'The AI returned an unsuccessful response')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setSubmitError(message)

      // Also add an error message bubble so context is preserved in the thread
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I encountered an error processing your request. Please try again.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
    }
  }

  const handleExport = () => {
    exportConversation(messages, activeDocumentName || 'Document')
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900">

      {/* ── ZONE 1: HEADER ─────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 z-10">
        <div className="flex items-center justify-between gap-2">

          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/')}
              className="shrink-0 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Back to home"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-50">PRISM</h1>
            </div>

            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 shrink-0" />

            {/* Document selector */}
            <div ref={selectorRef} className="relative min-w-0">
              <button
                onClick={handleSelectorOpen}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors max-w-[200px] group"
                title="Switch document"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {activeDocumentName || 'Select document'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
              </button>

              {selectorOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Ready Documents
                    </p>
                  </div>

                  {/* Selector loading */}
                  {docsLoading && (
                    <div className="flex items-center justify-center py-6 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span className="text-xs text-slate-500">Loading…</span>
                    </div>
                  )}

                  {/* Selector error — visible, not silent */}
                  {!docsLoading && docsError && (
                    <div className="px-3 py-4 text-center">
                      <WifiOff className="w-5 h-5 text-red-400 mx-auto mb-2" />
                      <p className="text-xs text-red-600 dark:text-red-400">{docsError}</p>
                      <button
                        onClick={() => { setDocsError(null); setAllDocuments([]); fetchAllDocuments() }}
                        className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!docsLoading && !docsError && allDocuments.length === 0 && (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No other documents available
                      </p>
                    </div>
                  )}

                  {!docsLoading && !docsError && allDocuments.length > 0 && (
                    <div className="max-h-60 overflow-y-auto prism-scroll">
                      {allDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => handleDocumentSwitch(doc)}
                          className={`w-full text-left px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 ${
                            doc.id === activeDocumentId
                              ? 'bg-emerald-50 dark:bg-emerald-900/20'
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                {doc.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {doc.page_count ? `${doc.page_count} pages` : 'PDF'}
                                {doc.document_type ? ` · ${doc.document_type}` : ''}
                              </p>
                            </div>
                            {doc.id === activeDocumentId && (
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">AI Ready</span>
            </div>

            {messages.length > 0 && (
              <button
                onClick={handleExport}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Export conversation as Markdown"
              >
                <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            )}

            {mounted ? (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4 text-slate-400" />
                  : <Moon className="w-4 h-4 text-slate-600" />
                }
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
          </div>
        </div>
      </div>

      {/* ── ZONE 2: MESSAGES ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 prism-scroll">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* History loading */}
          {historyLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400 mr-2" />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Loading conversation history…
              </span>
            </div>
          )}

          {/* History error — visible, not silent */}
          {!historyLoading && historyError && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Could not load history
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
                {historyError}
              </p>
              <button
                onClick={() => {
                  setHistoryError(null)
                  setHistoryLoading(true)
                  setMessages([])
                }}
                className="inline-flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!historyLoading && !historyError && messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 rounded-full mb-6">
                <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                Ask anything about your document
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-8 text-sm">
                Get instant answers with citations and confidence scores
              </p>
              <div className="grid gap-3">
                {[
                  { q: 'What are the key terms of this document?', sub: 'Overview of important sections' },
                  { q: 'Summarize the main points', sub: 'Quick overview of the document' },
                ].map(({ q, sub }) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all group"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      {q}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {!historyLoading && !historyError && (
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-full ${
                      message.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md shadow-sm border border-slate-200 dark:border-slate-700'
                    } px-5 py-4`}
                  >
                    <div className="prose prose-sm max-w-none">
                      {message.role === 'assistant' ? (
                        <div className="whitespace-pre-wrap leading-relaxed text-slate-900 dark:text-slate-100">
                          {message.content}
                        </div>
                      ) : (
                        <p className="m-0">{message.content}</p>
                      )}
                    </div>

                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Sources:
                        </p>
                        <div className="space-y-2">
                          {message.citations.map((citation, idx) => (
                            <div
                              key={citation.chunk_id}
                              onClick={() => onCitationClick?.(citation.page)}
                              className="text-xs bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer group"
                              title={`Jump to page ${citation.page}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                                  {idx + 1}
                                </span>
                                <div className="flex-1">
                                  <p className="text-slate-900 dark:text-slate-100 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                    Page {citation.page} ↗
                                  </p>
                                  {citation.ai_summary && (
                                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                                      {citation.ai_summary}
                                    </p>
                                  )}
                                  <p className="text-slate-500 dark:text-slate-500 mt-1 text-[11px] line-clamp-2">
                                    {citation.text}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.confidence !== undefined && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 flex items-center gap-2">
                        {message.confidence >= 0.8 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {message.confidence >= 0.9 ? 'High confidence'
                            : message.confidence >= 0.7 ? 'Good confidence'
                            : 'Moderate confidence'}{' '}
                          ({(message.confidence * 100).toFixed(0)}%)
                        </span>
                      </div>
                    )}

                    <div className="mt-2 text-xs opacity-60">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-md shadow-sm border border-slate-200 dark:border-slate-700 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── ZONE 3: INPUT BAR ──────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 z-10">

        {/* Submit error banner — sits above the input */}
        {submitError && (
          <div className="max-w-2xl mx-auto mb-3 flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">{submitError}</p>
            <button
              onClick={() => setSubmitError(null)}
              className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question…"
                disabled={isLoading || historyLoading}
                rows={1}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading || historyLoading}
              className="shrink-0 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
            >
              {isLoading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Send className="w-5 h-5" />
              }
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 text-center">
            Press Enter to send • Shift + Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}