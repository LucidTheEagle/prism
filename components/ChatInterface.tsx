'use client'

import { useState, useEffect, useCallback } from 'react'
import { exportConversation } from '@/lib/utils/export'
import { ChatHeader } from './chat/ChatHeader'
import { ChatMessages } from './chat/ChatMessages'
import { ChatInput } from './chat/ChatInput'
import { UpgradeModal } from './UpgradeModal'
import type { ChatMessage, Citation, EpistemicCategory } from '@/lib/types'

// Re-export for subcomponents — single source of truth
export type { ChatMessage, Citation }

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Upgrade modal state
  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean
    code: 'QUERY_LIMIT_REACHED' | 'UPLOAD_LIMIT_REACHED'
    tier: 'free' | 'pro' | 'enterprise'
    limit?: number
    current?: number
  }>({
    open: false,
    code: 'QUERY_LIMIT_REACHED',
    tier: 'free',
  })

  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    setMounted(true)
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setUserEmail(user.email ?? '')
          setUserName(
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            ''
          )
        }
      })
    })
  }, [])

  // ── Document selector ────────────────────────────────────────────────────
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
        if (response.status === 401) {
          setHistoryError('Session expired. Please sign in again.')
          return
        }
        if (!response.ok) throw new Error(`Failed to load history (${response.status})`)
        const data = await response.json()
        if (data.messages?.length > 0) {
          setMessages(data.messages.map((row: {
            id: string
            role: 'user' | 'assistant'
            content: string
            // Handle both old float confidence rows and new epistemic_category rows
            confidence?: number | null
            epistemic_category?: EpistemicCategory | null
            closing_statement?: string | null
            citations?: Citation[] | null
            created_at: string
          }) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            // Graceful transition — old rows have confidence float, new rows have epistemic_category
            epistemic_category: row.epistemic_category ?? undefined,
            closing_statement: row.closing_statement ?? undefined,
            citations: row.citations ?? undefined,
            timestamp: new Date(row.created_at),
          })))
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

  // ── Persist message (fire-and-forget) ───────────────────────────────────
  const persistMessage = async (message: ChatMessage) => {
    if (!activeDocumentId) return
    try {
      await fetch(`/api/chat/${activeDocumentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          epistemic_category: message.epistemic_category ?? null,
          closing_statement: message.closing_statement ?? null,
          citations: message.citations ?? null,
        }),
      })
    } catch {
      console.warn('[ChatInterface] Failed to persist message')
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    setSubmitError(null)

    const userMessage: ChatMessage = {
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
        setSubmitError('Session expired. Please sign in again.')
        return
      }

      if (response.status === 403) {
        const errData = await response.json().catch(() => ({}))
        if (errData.upgrade_required) {
          setUpgradeModal({
            open: true,
            code: errData.code ?? 'QUERY_LIMIT_REACHED',
            tier: errData.tier ?? 'free',
            limit: errData.limit,
            current: errData.current,
          })
          setMessages(prev => prev.filter(m => m.id !== userMessage.id))
          return
        }
        throw new Error(errData.error || 'Access to this resource was denied. Please sign in again.')
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Request failed (${response.status})`)
      }

      const data = await response.json()
      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer,
          epistemic_category: data.epistemic_category ?? undefined,
          closing_statement: data.closing_statement ?? undefined,
          citations: data.citations ?? undefined,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
        persistMessage(assistantMessage)
      } else {
        throw new Error(data.error || 'The AI returned an unsuccessful response')
      }
    } catch (error) {
      // Silent auto-retry — one automatic retry before surfacing any error
      try {
        setSubmitError('PRISM is taking longer than expected. Your document is secure. Retrying automatically.')

        const retryResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: userMessage.content,
            documentId: activeDocumentId || undefined,
          }),
        })

        if (!retryResponse.ok) throw new Error('Retry failed')

        const retryData = await retryResponse.json()
        if (retryData.success) {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: retryData.answer,
            epistemic_category: retryData.epistemic_category ?? undefined,
            closing_statement: retryData.closing_statement ?? undefined,
            citations: retryData.citations ?? undefined,
            timestamp: new Date(),
          }
          setMessages(prev => [...prev, assistantMessage])
          persistMessage(assistantMessage)
          setSubmitError(null)
        } else {
          throw new Error(retryData.error || 'Retry unsuccessful')
        }
      } catch {
        setSubmitError(null)
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'PRISM is temporarily unavailable. Please try your query again in a few minutes. Your document and conversation history are secure.',
          timestamp: new Date(),
        }])
        console.error('[ChatInterface] Both attempts failed:', error)
      }
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
        userEmail={userEmail}
        userName={userName}
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

      <UpgradeModal
        open={upgradeModal.open}
        code={upgradeModal.code}
        currentTier={upgradeModal.tier}
        limit={upgradeModal.limit}
        current={upgradeModal.current}
        onClose={() => setUpgradeModal(prev => ({ ...prev, open: false }))}
        onUpgrade={() => {
          setUpgradeModal(prev => ({ ...prev, open: false }))
          window.location.href = '/billing'
        }}
      />
    </div>
  )
}