'use client'

import { useEffect, useState, useId } from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

interface DocumentStatusProps {
  documentId: string
  onReady?: () => void
  autoNavigate?: boolean
}

const STAGES = [
  { label: 'Parsing PDF content',        threshold: 10 },
  { label: 'AI document analysis',        threshold: 30 },
  { label: 'Generating vector embeddings',threshold: 50 },
  { label: 'Enriching with AI metadata',  threshold: 70 },
  { label: 'Building search index',       threshold: 90 },
]

export function DocumentStatus({
  documentId,
  onReady,
  autoNavigate = false,
}: DocumentStatusProps) {
  const [status, setStatus] = useState<'processing' | 'ready' | 'failed'>('processing')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const progressId = useId()
  const statusId = useId()

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90
        return prev + 10
      })
    }, 2000)

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`)
        if (response.ok) {
          const data = await response.json()

          if (data.status === 'ready') {
            clearInterval(progressInterval)
            clearInterval(pollInterval)
            setProgress(100)
            setStatus('ready')
            onReady?.()
            if (autoNavigate) {
              setTimeout(() => {
                window.location.href = `/chat?doc=${documentId}`
              }, 2000)
            }
          } else if (data.status === 'failed') {
            clearInterval(progressInterval)
            clearInterval(pollInterval)
            setStatus('failed')
            setError(data.error_message || 'Processing failed')
          }
        } else {
          console.log(`Status check returned ${response.status}, continuing to poll…`)
        }
      } catch (err) {
        console.error('Failed to check status:', err)
      }
    }

    const pollInterval = setInterval(checkStatus, 3000)
    checkStatus()

    return () => {
      clearInterval(progressInterval)
      clearInterval(pollInterval)
    }
  }, [documentId, onReady, autoNavigate])

  // ── Failed state ───────────────────────────────────────────────────────────
  if (status === 'failed') {
    return (
      /*
       * role="alert" + aria-live="assertive"
       * Processing failures are urgent — the user needs to know immediately
       * so they can retry. assertive interrupts screen reader speech now.
       */
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="space-y-4"
      >
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Processing Failed</p>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Ready state ────────────────────────────────────────────────────────────
  if (status === 'ready') {
    return (
      /*
       * role="status" + aria-live="polite"
       * Completion is good news — polite waits for current speech to finish
       * before announcing. aria-atomic reads the full region as one unit.
       */
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-4"
      >
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-6 h-6 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Processing Complete!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Your document is ready for intelligent Q&amp;A
            </p>
          </div>
        </div>

        {/* Progress bar at 100% */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span
              id={progressId}
              className="text-slate-700 dark:text-slate-300 font-medium"
            >
              Progress
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold" aria-hidden="true">
              100%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={100}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-labelledby={progressId}
            aria-label="Document processing progress: complete"
            className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
          >
            <div
              className="h-full w-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
              aria-hidden="true"
            />
          </div>
        </div>

        {/*
         * Auto-navigate notice
         * aria-live="polite" announces the redirect countdown to screen
         * reader users so they're not confused when the page changes.
         */}
        {autoNavigate && (
          <p
            className="text-sm text-slate-500 dark:text-slate-400 text-center animate-pulse"
            aria-live="polite"
            role="status"
          >
            Redirecting to chat…
          </p>
        )}
      </div>
    )
  }

  // ── Processing state ───────────────────────────────────────────────────────
  /*
   * aria-live="polite" on the outer container means any text changes
   * (progress %, stage completions) are announced after current speech.
   *
   * We deliberately do NOT put aria-live on the progress bar itself —
   * role="progressbar" with aria-valuenow is the correct pattern for
   * numeric progress. Screen readers announce value changes automatically.
   */
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Document is being processed"
      className="space-y-4"
    >
      {/* Status heading */}
      <div className="flex items-center gap-3">
        <Loader2
          className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0"
          aria-hidden="true"
        />
        <div>
          <p
            id={statusId}
            className="font-semibold text-slate-900 dark:text-slate-50"
          >
            Processing Document…
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            AI is analysing your document
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span
            id={progressId}
            className="text-slate-700 dark:text-slate-300 font-medium"
          >
            Progress
          </span>
          {/*
           * aria-hidden — the progressbar already announces the value.
           * Showing it visually without duplicating the announcement.
           */}
          <span
            className="text-emerald-600 dark:text-emerald-400 font-bold"
            aria-hidden="true"
          >
            {progress}%
          </span>
        </div>

        {/*
         * role="progressbar" with aria-valuenow/min/max
         * Screen readers announce "Progress bar, X percent" when the
         * value changes. aria-labelledby links to the "Progress" label.
         * This replaces the visual-only progress bar in the original.
         */}
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby={progressId}
          aria-label={`Document processing progress: ${progress}%`}
          className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/*
       * Processing stages
       *
       * Originally: decorative dots with adjacent <span> text.
       * The dots conveyed completion state visually but were invisible
       * to screen readers — a user couldn't tell which stages were done.
       *
       * Now: <ol> (ordered — sequence matters) with aria-label on each
       * <li> combining the stage name with its completion state.
       * The dot is aria-hidden; the state is conveyed via aria-label.
       *
       * Screen reader announces: "1 of 5, Parsing PDF content, complete"
       * or "3 of 5, Generating vector embeddings, in progress".
       */}
      <ol
        className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-none"
        aria-label="Processing stages"
      >
        {STAGES.map((stage, i) => {
          const done = progress >= stage.threshold
          return (
            <li
              key={stage.label}
              aria-label={`Stage ${i + 1} of ${STAGES.length}: ${stage.label} — ${done ? 'complete' : 'pending'}`}
              className="flex items-center gap-2"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300 ${
                  done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                aria-hidden="true"
              />
              <span className={done ? 'text-slate-700 dark:text-slate-300' : ''}>
                {stage.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}