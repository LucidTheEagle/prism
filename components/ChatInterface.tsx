'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Loader2, CheckCircle2, AlertCircle, FileText,
  Sparkles, ArrowLeft, Moon, Sun, Download, ChevronDown
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
  // Called when user switches document — tells SplitLayout to update
  // the PDFViewer with the new document ID
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

  // ── Active document state ──────────────────────────────────────────
  // Starts with the prop values but can be changed via the selector
  const [activeDocumentId, setActiveDocumentId] = useState(initialDocumentId)
  const [activeDocumentName, setActiveDocumentName] = useState(initialDocumentName)

  // ── Document selector state ────────────────────────────────────────
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [docsLoading, setDocsLoading] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  // ── Chat state ────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // ── Close selector on outside click ───────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Fetch all ready documents when selector opens ─────────────────
  const fetchAllDocuments = useCallback(async () => {
    if (allDocuments.length > 0) return // Already loaded
    setDocsLoading(true)
    try {
      const response = await fetch('/api/documents')
      if (!response.ok) throw new Error('Failed to fetch documents')
      const data = await response.json()
      // Only show documents that are ready for chat
      const ready = (data.documents || []).filter(
        (d: Document) => d.status === 'ready'
      )
      setAllDocuments(ready)
    } catch {
      // Non-fatal — selector just shows empty state
    } finally {
      setDocsLoading(false)
    }
  }, [allDocuments.length])

  const handleSelectorOpen = () => {
    setSelectorOpen(prev => !prev)
    fetchAllDocuments()
  }

  // ── Switch active document ─────────────────────────────────────────
  const handleDocumentSwitch = (doc: Document) => {
    setSelectorOpen(false)
    if (doc.id === activeDocumentId) return

    setActiveDocumentId(doc.id)
    setActiveDocumentName(doc.name)
    setMessages([]) // Clear current conversation
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
      try {
        const response = await fetch(`/api/chat/${activeDocumentId}/messages`)
        if (!response.ok) throw new Error('Failed to load history')
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
      } catch {
        // Non-fatal
      } finally {
        setHistoryLoading(false)
      }
    }

    loadHistory()
  }, [activeDocumentId])

  // ── Persist a message ──────────────────────────────────────────────
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
      // Non-fatal
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

      if (!response.ok) throw new Error('Failed to get response')
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
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
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

          {/* Left: Back + Logo + Document selector */}
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

            {/* Document selector */}
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 shrink-0" />
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

              {/* Dropdown */}
              {selectorOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Ready Documents
                    </p>
                  </div>

                  {docsLoading && (
                    <div className="flex items-center justify-center py-6 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span className="text-xs text-slate-500">Loading...</span>
                    </div>
                  )}

                  {!docsLoading && allDocuments.length === 0 && (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No other documents available
                      </p>
                    </div>
                  )}

                  {!docsLoading && allDocuments.length > 0 && (
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

          {/* Right: AI Ready + Export + Theme toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                AI Ready
              </span>
            </div>

            {/* Export button — only shown when there are messages */}
            {messages.length > 0 && (
              <button
                onClick={handleExport}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Export conversation as Markdown"
              >
                <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            )}

            {/* Theme toggle */}
            {mounted ? (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-slate-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
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

          {historyLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400 mr-2" />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Loading conversation history...
              </span>
            </div>
          )}

          {!historyLoading && messages.length === 0 && (
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
                <button
                  onClick={() => setInput('What are the key terms of this document?')}
                  className="text-left p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all group"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    What are the key terms?
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Overview of important sections
                  </p>
                </button>
                <button
                  onClick={() => setInput('Summarize the main points')}
                  className="text-left p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all group"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    Summarize the main points
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Quick overview of the document
                  </p>
                </button>
              </div>
            </div>
          )}

          {!historyLoading && (
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

                    {/* Citations */}
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

                    {/* Confidence */}
                    {message.confidence !== undefined && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 flex items-center gap-2">
                        {message.confidence >= 0.8 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {message.confidence >= 0.9
                            ? 'High confidence'
                            : message.confidence >= 0.7
                            ? 'Good confidence'
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
                      <span className="text-sm text-slate-600 dark:text-slate-400">Thinking...</span>
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
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
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
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
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