'use client'

import { useState, useEffect, useCallback } from 'react'
import { exportConversation } from '@/lib/utils/export'
import { ChatHeader } from './chat/ChatHeader'
import { ChatMessages } from './chat/ChatMessages'
import { ChatInput } from './chat/ChatInput'

// ── Types (shared across subcomponents via re-export) ──────────────────────
export interface Citation {
  chunk_id: string
  document_id: string
  text: string
  page: number
  relevance: number
  ai_summary?: string
  chunk_index: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  confidence?: number
  citations?: Citation[]
  timestamp: Date
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

// ── ChatInterface — state orchestrator only ────────────────────────────────
// All rendering is delegated to ChatHeader, ChatMessages, ChatInput.
// This component owns state and async logic; subcomponents are pure UI.
export default function ChatInterface({
  documentId: initialDocumentId,
  documentName: initialDocumentName,
  onCitationClick,
  onDocumentChange,
}: ChatInterfaceProps) {
  const [mounted, setMounted] = useState(false)

  // Document state
  const [activeDocumentId, setActiveDocumentId] = useState(initialDocumentId)
  const [activeDocumentName, setActiveDocumentName] = useState(initialDocumentName)
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)

  // Message state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // ── Document selector ────────────────────────────────────────────────────
  const fetchAllDocuments = useCallback(async () => {
    if (allDocuments.length > 0) return
    setDocsLoading(true)
    setDocsError(null)
    try {
      const response = await fetch('/api/documents')
      if (response.status === 401) { setDocsError('Session expired. Please sign in again.'); return }
      if (!response.ok) throw new Error(`Failed to fetch documents (${response.status})`)
      const data = await response.json()
      setAllDocuments((data.documents || []).filter((d: Document) => d.status === 'ready'))
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setDocsLoading(false)
    }
  }, [allDocuments.length])

  const handleSelectorOpen = useCallback(() => {
    setSelectorOpen(prev => !prev)
    fetchAllDocuments()
  }, [fetchAllDocuments])

  const handleDocumentSwitch = useCallback((doc: Document) => {
    setSelectorOpen(false)
    if (doc.id === activeDocumentId) return
    setActiveDocumentId(doc.id)
    setActiveDocumentName(doc.name)
    setMessages([])
    setHistoryError(null)
    setSubmitError(null)
    setHistoryLoading(true)
    onDocumentChange?.(doc.id, doc.name)
  }, [activeDocumentId, onDocumentChange])

  const handleDocsRetry = useCallback(() => {
    setDocsError(null)
    setAllDocuments([])
    fetchAllDocuments()
  }, [fetchAllDocuments])

  // ── Message history ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDocumentId) { setHistoryLoading(false); return }

    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const response = await fetch(`/api/chat/${activeDocumentId}/messages`)
        if (response.status === 401) { setHistoryError('Session expired. Please sign in again.'); return }
        if (!response.ok) throw new Error(`Failed to load history (${response.status})`)
        const data = await response.json()
        if (data.messages?.length > 0) {
          setMessages(data.messages.map((row: {
            id: string; role: 'user' | 'assistant'; content: string
            confidence?: number; citations?: Citation[]; created_at: string
          }) => ({
            id: row.id, role: row.role, content: row.content,
            confidence: row.confidence ?? undefined,
            citations: row.citations ?? undefined,
            timestamp: new Date(row.created_at),
          })))
        } else {
          setMessages([])
        }
      } catch (err) {
        setHistoryError(err instanceof Error ? err.message : 'Failed to load conversation history')
      } finally {
        setHistoryLoading(false)
      }
    }
    loadHistory()
  }, [activeDocumentId])

  // ── Persist message (fire-and-forget) ───────────────────────────────────
  const persistMessage = async (message: Message) => {
    if (!activeDocumentId) return
    try {
      await fetch(`/api/chat/${activeDocumentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role, content: message.content,
          confidence: message.confidence ?? null,
          citations: message.citations ?? null,
        }),
      })
    } catch { console.warn('[ChatInterface] Failed to persist message') }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    setSubmitError(null)

    const userMessage: Message = {
      id: Date.now().toString(), role: 'user',
      content: input.trim(), timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    persistMessage(userMessage)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content, documentId: activeDocumentId || undefined }),
      })
      if (response.status === 401) { setSubmitError('Session expired. Please sign in again.'); return }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Request failed (${response.status})`)
      }
      const data = await response.json()
      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(), role: 'assistant',
          content: data.answer, confidence: data.confidence_score,
          citations: data.citations, timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
        persistMessage(assistantMessage)
      } else {
        throw new Error(data.error || 'The AI returned an unsuccessful response')
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unknown error')
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900">

      <ChatHeader
        activeDocumentId={activeDocumentId}
        activeDocumentName={activeDocumentName}
        allDocuments={allDocuments}
        selectorOpen={selectorOpen}
        docsLoading={docsLoading}
        docsError={docsError}
        hasMessages={messages.length > 0}
        mounted={mounted}
        onSelectorOpen={handleSelectorOpen}
        onDocumentSwitch={handleDocumentSwitch}
        onDocsRetry={handleDocsRetry}
        onExport={() => exportConversation(messages, activeDocumentName || 'Document')}
      />

      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        historyLoading={historyLoading}
        historyError={historyError}
        onCitationClick={onCitationClick}
        onSuggestedQuestion={setInput}
        onHistoryRetry={() => {
          setHistoryError(null)
          setHistoryLoading(true)
          setMessages([])
        }}
      />

      <ChatInput
        input={input}
        isLoading={isLoading}
        historyLoading={historyLoading}
        submitError={submitError}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onDismissError={() => setSubmitError(null)}
      />

    </div>
  )
}