'use client'

import { useRef, useEffect, useState } from 'react'
import {
  AlertCircle, CheckCircle2, RefreshCw, XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CitationCard } from './CitationCard'
import { getEpistemicConfig } from '@/lib/utils/trustScore'
import type { ChatMessage, EpistemicCategory } from '@/lib/types'

// ── Citation deduplication ─────────────────────────────────────────────────

interface Citation {
  chunk_id: string
  document_id: string
  text: string
  page: number
  relevance: number
  ai_summary?: string
  chunk_index: number
  section_reference?: string
}

function normalizeCitationText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

function getCitationDedupKey(citation: Citation) {
  const normalizedText = normalizeCitationText(citation.text)
  const start = normalizedText.slice(0, 120)
  const end = normalizedText.slice(-80)
  return `p${citation.page}|${start}|${end}`
}

function dedupeAndRankCitations(citations: Citation[]) {
  const byKey = new Map<string, Citation>()

  citations.forEach(citation => {
    const key = getCitationDedupKey(citation)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, citation)
      return
    }
    const currentScore = citation.relevance + (citation.ai_summary ? 0.01 : 0)
    const existingScore = existing.relevance + (existing.ai_summary ? 0.01 : 0)
    if (currentScore > existingScore) byKey.set(key, citation)
  })

  return [...byKey.values()].sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance
    if (a.page !== b.page) return a.page - b.page
    return a.chunk_index - b.chunk_index
  })
}

// ── Epistemic badge ────────────────────────────────────────────────────────

function EpistemicBadge({ category }: { category: EpistemicCategory }) {
  const config = getEpistemicConfig(category)

  const Icon =
    category === 'EXPLICITLY_STATED'
      ? CheckCircle2
      : category === 'INFERRED'
      ? AlertCircle
      : XCircle

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bgClass} ${config.borderClass} mb-3`}
      aria-label={`Epistemic category: ${config.label}`}
      title={config.description}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${config.textClass}`} aria-hidden="true" />
      <Badge variant={config.badgeVariant} className="text-[10px] uppercase tracking-wider px-1.5 py-0">
        {config.label}
      </Badge>
      <span className={`text-[10px] ${config.textClass} hidden sm:inline`}>
        {config.sublabel}
      </span>
    </div>
  )
}

// ── Glass Box inference stages ─────────────────────────────────────────────
// Updated to reflect four-character pipeline progression
// Character names are not exposed to the user — stages are user-facing language

const INFERENCE_STAGES = [
  'Scanning document structure…',
  'Extracting relevant clauses…',
  'Verifying claims against source…',
  'Running legal risk analysis…',
  'Assembling verified answer…',
]

function GlassBoxIndicator() {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex(prev => {
        if (prev < INFERENCE_STAGES.length - 1) return prev + 1
        clearInterval(interval)
        return prev
      })
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="flex justify-start"
      role="status"
      aria-live="polite"
      aria-label="PRISM is processing your request"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-md shadow-sm border border-slate-200 dark:border-slate-700 px-4 sm:px-5 py-3 sm:py-4 max-w-xs">
        <div className="space-y-2">
          {INFERENCE_STAGES.map((stage, idx) => (
            <div
              key={stage}
              className={`flex items-center gap-2 transition-all duration-500 ${
                idx < stageIndex
                  ? 'opacity-40'
                  : idx === stageIndex
                  ? 'opacity-100'
                  : 'opacity-20'
              }`}
              aria-hidden={idx !== stageIndex}
            >
              {idx < stageIndex ? (
                <CheckCircle2
                  className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                  aria-hidden="true"
                />
              ) : idx === stageIndex ? (
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span
                className={`text-xs ${
                  idx === stageIndex
                    ? 'text-slate-700 dark:text-slate-300 font-medium'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {stage}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Suggested questions ────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  {
    q: 'What are the key obligations of each party?',
    sub: 'Identify who is responsible for what',
  },
  {
    q: 'Are there any clauses that create risk or liability?',
    sub: 'Surface hidden exposure before signing',
  },
  {
    q: 'What happens if either party breaches this agreement?',
    sub: 'Understand the consequences of non-performance',
  },
  {
    q: 'Does this document contain a governing law clause?',
    sub: 'Confirm jurisdiction for any disputes',
  },
]

// ── ChatMessages props ─────────────────────────────────────────────────────

interface ChatMessagesProps {
  messages: ChatMessage[]
  isLoading: boolean
  historyLoading: boolean
  historyError: string | null
  onCitationClick?: (page: number) => void
  onSuggestedQuestion: (q: string) => void
  onHistoryRetry: () => void
}

// ── ChatMessages ───────────────────────────────────────────────────────────

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
  }, [messages, isLoading])

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
            <div
              className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mr-2"
              aria-hidden="true"
            />
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
            <div
              className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center mb-3"
              aria-hidden="true"
            >
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
              className="inline-flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Empty state — suggested questions */}
        {!historyLoading && !historyError && messages.length === 0 && (
          <section
            aria-label="Getting started suggestions"
            className="text-center py-8 sm:py-12"
          >
            <div
              className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 rounded-full mb-4 sm:mb-6"
              aria-hidden="true"
            >
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Ask anything about your document
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-6 sm:mb-8 text-sm">
              Every answer verified against the source. Every claim traced to an exact location.
            </p>
            <ul
              className="grid gap-3 text-left list-none"
              aria-label="Suggested questions"
            >
              {SUGGESTED_QUESTIONS.map(({ q, sub }) => (
                <li key={q}>
                  <button
                    onClick={() => onSuggestedQuestion(q)}
                    aria-label={`Ask: ${q}`}
                    className="w-full text-left p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 min-h-[44px]"
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
                aria-label={`${message.role === 'user' ? 'You' : 'PRISM'}: ${message.content.slice(0, 60)}${message.content.length > 60 ? '…' : ''}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-full ${
                    message.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md shadow-sm border border-slate-200 dark:border-slate-700'
                  } px-4 sm:px-5 py-3 sm:py-4`}
                >
                  {message.role === 'assistant' ? (
                    <div>
                      {/* Epistemic badge — above answer, always visible when present */}
                      {message.epistemic_category && (
                        <EpistemicBadge category={message.epistemic_category} />
                      )}

                      {/* Answer body */}
                      <div className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        {message.content}
                      </div>                        

                        {/* Silent state — verified absence block */}
                        {message.epistemic_category === 'SILENT' && (
                          <div
                            className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                            role="status"
                            aria-label="Verified absence confirmation"
                          >
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                              Verified Absence
                            </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            PRISM conducted an exhaustive search across this document and confirmed this information is not present. This is a verified absence, not an error.
                          </p>
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              What you can do: rephrase your question, check a different document, or upload additional materials.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Closing statement — Logos one-sentence actionable close */}
                      {message.closing_statement && (
                        <div
                          className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700"
                          aria-label="Actionable guidance"
                        >
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
                            {message.closing_statement}
                          </p>
                        </div>
                      )}

                      {/* Citations */}
                      {message.citations && message.citations.length > 0 && (() => {
                        const dedupedCitations = dedupeAndRankCitations(
                          message.citations as Citation[]
                        )
                        return (
                          <section
                            className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600"
                            aria-label={`${dedupedCitations.length} source${dedupedCitations.length > 1 ? 's' : ''} cited`}
                          >
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Sources:
                            </p>
                            <ul className="space-y-2 list-none">
                              {dedupedCitations.map((citation, idx) => (
                                <li key={`${citation.chunk_id}-${citation.page}-${citation.chunk_index}`}>
                                  <CitationCard
                                    citation={citation}
                                    index={idx}
                                    onCitationClick={onCitationClick}
                                  />
                                </li>
                              ))}
                            </ul>
                          </section>
                        )
                      })()}
                    </div>
                  ) : (
                    <p className="m-0 text-sm sm:text-base">{message.content}</p>
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

            {isLoading && <GlassBoxIndicator />}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}