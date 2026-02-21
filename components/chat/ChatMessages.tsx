'use client'

import { useRef, useEffect } from 'react'
import {
  Loader2, AlertCircle, Sparkles, CheckCircle2, RefreshCw,
} from 'lucide-react'
import { CitationCard } from './CitationCard'

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

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  historyLoading: boolean
  historyError: string | null
  onCitationClick?: (page: number) => void
  onSuggestedQuestion: (q: string) => void
  onHistoryRetry: () => void
}

export function ChatMessages({
  messages,
  isLoading,
  historyLoading,
  historyError,
  onCitationClick,
  onSuggestedQuestion,
  onHistoryRetry,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 prism-scroll"
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* History loading */}
        {historyLoading && (
          <div
            className="flex items-center justify-center py-12"
            role="status"
            aria-live="polite"
            aria-label="Loading conversation history"
          >
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400 mr-2" aria-hidden="true" />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Loading conversation history…
            </span>
          </div>
        )}

        {/* History error */}
        {!historyLoading && historyError && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            role="alert"
            aria-live="assertive"
          >
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center mb-3" aria-hidden="true">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Could not load history
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
              {historyError}
            </p>
            <button
              onClick={onHistoryRetry}
              aria-label="Retry loading conversation history"
              className="inline-flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-1"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!historyLoading && !historyError && messages.length === 0 && (
          <section aria-label="Getting started suggestions" className="text-center py-8 sm:py-12">
            <div
              className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 rounded-full mb-4 sm:mb-6"
              aria-hidden="true"
            >
              <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Ask anything about your document
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-6 sm:mb-8 text-sm">
              Get instant answers with citations and confidence scores
            </p>
            <ul className="grid gap-3 text-left list-none" aria-label="Suggested questions">
              {[
                { q: 'What are the key terms of this document?', sub: 'Overview of important sections' },
                { q: 'Summarize the main points', sub: 'Quick overview of the document' },
              ].map(({ q, sub }) => (
                <li key={q}>
                  <button
                    onClick={() => onSuggestedQuestion(q)}
                    aria-label={`Ask: ${q}`}
                    className="w-full text-left p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-h-[44px]"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      {q}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Message list */}
        {!historyLoading && !historyError && (
          <div className="space-y-4 sm:space-y-6">
            {messages.map((message) => (
              <article
                key={message.id}
                aria-label={`${message.role === 'user' ? 'You' : 'PRISM AI'}: ${message.content.slice(0, 60)}${message.content.length > 60 ? '…' : ''}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-full ${
                    message.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md shadow-sm border border-slate-200 dark:border-slate-700'
                  } px-4 sm:px-5 py-3 sm:py-4`}
                >
                  {/* Message content */}
                  {message.role === 'assistant' ? (
                    <div className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-slate-900 dark:text-slate-100">
                      {message.content}
                    </div>
                  ) : (
                    <p className="m-0 text-sm sm:text-base">{message.content}</p>
                  )}

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <section
                      className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600"
                      aria-label={`${message.citations.length} source${message.citations.length > 1 ? 's' : ''} cited`}
                    >
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Sources:
                      </p>
                      <ul className="space-y-2 list-none">
                        {message.citations.map((citation, idx) => (
                          <li key={citation.chunk_id}>
                            <CitationCard
                              citation={citation}
                              index={idx}
                              onCitationClick={onCitationClick}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Confidence score */}
                  {message.confidence !== undefined && (
                    <div
                      className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 flex items-center gap-2"
                      aria-label={`Confidence: ${(message.confidence * 100).toFixed(0)}%`}
                    >
                      {message.confidence >= 0.8 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                      )}
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {message.confidence >= 0.9 ? 'High confidence'
                          : message.confidence >= 0.7 ? 'Good confidence'
                          : 'Moderate confidence'}{' '}
                        ({(message.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <time
                    dateTime={message.timestamp.toISOString()}
                    className="block mt-2 text-xs opacity-60"
                    aria-label={`Sent at ${message.timestamp.toLocaleTimeString()}`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </time>
                </div>
              </article>
            ))}

            {/* AI thinking indicator */}
            {isLoading && (
              <div
                className="flex justify-start"
                role="status"
                aria-live="polite"
                aria-label="PRISM AI is thinking"
              >
                <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-md shadow-sm border border-slate-200 dark:border-slate-700 px-4 sm:px-5 py-3 sm:py-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Thinking…</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}