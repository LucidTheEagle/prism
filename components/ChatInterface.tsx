'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, CheckCircle2, AlertCircle, FileText, Sparkles, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

interface ChatInterfaceProps {
  documentId?: string
  documentName?: string
}

export default function ChatInterface({ documentId, documentName }: ChatInterfaceProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          documentId: documentId || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* SINGLE HEADER - Fixed at top */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Back to home"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">PRISM</h1>
              </div>
            </div>

            {documentName && (
              <>
                <div className="w-px h-6 bg-slate-300" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">{documentName}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-emerald-700">AI Ready</span>
          </div>
        </div>
      </div>

      {/* MESSAGES AREA - Scrollable */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full mb-6">
                <Sparkles className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Ask anything about your document
              </h2>
              <p className="text-slate-600 max-w-md mx-auto mb-8">
                Get instant answers with citations and confidence scores
              </p>
              
              {/* Suggested questions */}
              <div className="grid gap-3 max-w-2xl mx-auto">
                <button
                  onClick={() => setInput('What are the key terms of this document?')}
                  className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group"
                >
                  <p className="text-sm font-medium text-slate-900 group-hover:text-emerald-700">
                    What are the key terms?
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Overview of important sections</p>
                </button>
                <button
                  onClick={() => setInput('Summarize the main points')}
                  className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group"
                >
                  <p className="text-sm font-medium text-slate-900 group-hover:text-emerald-700">
                    Summarize the main points
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Quick overview of the document</p>
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl ${
                    message.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md'
                      : 'bg-white text-slate-900 rounded-2xl rounded-bl-md shadow-sm border border-slate-200'
                  } px-5 py-4`}
                >
                  <div className="prose prose-sm max-w-none">
                    {message.role === 'assistant' ? (
                      <div className="whitespace-pre-wrap leading-relaxed text-slate-900">
                        {message.content}
                      </div>
                    ) : (
                      <p className="m-0">{message.content}</p>
                    )}
                  </div>

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Sources:</p>
                      <div className="space-y-2">
                        {message.citations.map((citation, idx) => (
                          <div
                            key={citation.chunk_id}
                            className="text-xs bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <p className="text-slate-900 font-medium">Page {citation.page}</p>
                                {citation.ai_summary && (
                                  <p className="text-slate-600 mt-1">{citation.ai_summary}</p>
                                )}
                                <p className="text-slate-500 mt-1 text-[11px] line-clamp-2">
                                  {citation.text}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {message.confidence !== undefined && (
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                      {message.confidence >= 0.8 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      )}
                      <span className="text-xs text-slate-600">
                        {message.confidence >= 0.9
                          ? 'High confidence'
                          : message.confidence >= 0.7
                          ? 'Good confidence'
                          : 'Moderate confidence'}
                        {' '}
                        ({(message.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="mt-2 text-xs opacity-60">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-md shadow-sm border border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span className="text-sm text-slate-600">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* INPUT AREA - Fixed at bottom */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isLoading}
                rows={1}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Press Enter to send • Shift + Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}