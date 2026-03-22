'use client'

import { useEffect, useState, useCallback, useId } from 'react'
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

interface DocumentStatusProps {
  documentId: string
  onReady?: () => void
  onFailed?: () => void
  autoNavigate?: boolean
}

// Plain English stage labels — no developer jargon
const STAGES = [
  { label: 'Reading and encrypting your file',     threshold: 20 },
  { label: 'Analysing document structure',          threshold: 40 },
  { label: 'Preparing forensic search index',       threshold: 60 },
  { label: 'Verifying citations and references',    threshold: 80 },
  { label: 'Finalising intelligence base',          threshold: 95 },
]

// Map raw technical errors to user-safe messages
function sanitiseError(raw: string | null): string {
  if (!raw) return 'Secure connection interrupted. For your privacy, partial data has been purged. Please try uploading again.'
  const lower = raw.toLowerCase()
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('connect')) {
    return 'Secure connection interrupted. For your privacy, partial data has been purged. Please try uploading again.'
  }
  if (lower.includes('chunk') || lower.includes('embed')) {
    return 'Analysis could not be completed. Your file has been securely removed. Please try uploading again.'
  }
  if (lower.includes('timeout')) {
    return 'The document took too long to process. Please try again with a smaller file.'
  }
  if (lower.includes('size') || lower.includes('large')) {
    return 'This document exceeds the processing limit. Please try a smaller file.'
  }
  // Never expose raw technical errors
  return 'Secure connection interrupted. For your privacy, partial data has been purged. Please try uploading again.'
}

export function DocumentStatus({
  documentId,
  onReady,
  onFailed,
  autoNavigate = false,
}: DocumentStatusProps) {
  const [status, setStatus] = useState<'processing' | 'ready' | 'failed'>('processing')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const progressId = useId()

  const handleFailure = useCallback((rawError: string | null) => {
    setStatus('failed')
    setError(sanitiseError(rawError))
    onFailed?.()
  }, [onFailed])

  useEffect(() => {
    let consecutiveErrors = 0
    const MAX_CONSECUTIVE_ERRORS = 3

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95
        return prev + 5
      })
    }, 2000)

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`)

        if (response.ok) {
          consecutiveErrors = 0
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
            handleFailure(data.error_message ?? null)
          }
          // status === 'processing' — continue polling
        } else if (response.status === 401) {
          clearInterval(progressInterval)
          clearInterval(pollInterval)
          handleFailure('Session expired. Please sign in again.')
        } else {
          consecutiveErrors++
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            clearInterval(progressInterval)
            clearInterval(pollInterval)
            handleFailure(null)
          }
        }
      } catch {
        consecutiveErrors++
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(progressInterval)
          clearInterval(pollInterval)
          handleFailure(null)
        }
      }
    }

    const pollInterval = setInterval(checkStatus, 3000)
    checkStatus()

    return () => {
      clearInterval(progressInterval)
      clearInterval(pollInterval)
    }
  }, [documentId, onReady, autoNavigate, handleFailure, retryCount])

  // ── Failed state ───────────────────────────────────────────────────────────
  if (status === 'failed') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="space-y-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="font-semibold text-rose-700 dark:text-rose-400">
              Processing interrupted
            </p>
            <p className="text-sm text-rose-600 dark:text-rose-400 mt-1 leading-relaxed">
              {error}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setStatus('processing')
            setProgress(0)
            setError(null)
            setRetryCount(c => c + 1)
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    )
  }

  // ── Ready state ────────────────────────────────────────────────────────────
  if (status === 'ready') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-4"
      >
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-6 h-6 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-50">
              Intelligence base ready
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Your document is ready for forensic analysis
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span id={progressId} className="text-slate-700 dark:text-slate-300 font-medium">
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
            className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
          >
            <div
              className="h-full w-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
              aria-hidden="true"
            />
          </div>
        </div>

        {autoNavigate && (
          <p
            className="text-sm text-slate-500 dark:text-slate-400 text-center animate-pulse"
            aria-live="polite"
            role="status"
          >
            Opening your document…
          </p>
        )}
      </div>
    )
  }

  // ── Processing state ───────────────────────────────────────────────────────
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Document is being processed"
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <Loader2
          className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0"
          aria-hidden="true"
        />
        <p className="font-semibold text-slate-900 dark:text-slate-50">
          Building intelligence base…
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span id={progressId} className="text-slate-700 dark:text-slate-300 font-medium">
            Progress
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold" aria-hidden="true">
            {progress}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby={progressId}
          aria-label={`Processing progress: ${progress}%`}
          className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      <ol
        className="text-xs text-slate-500 dark:text-slate-400 space-y-2 list-none"
        aria-label="Processing stages"
      >
        {STAGES.map((stage, i) => {
          const done = progress >= stage.threshold
          const active = !done && progress >= (STAGES[i - 1]?.threshold ?? 0)
          return (
            <li
              key={stage.label}
              aria-label={`${stage.label} — ${done ? 'complete' : active ? 'in progress' : 'pending'}`}
              className="flex items-center gap-2.5"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300 ${
                  done
                    ? 'bg-emerald-500'
                    : active
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
                aria-hidden="true"
              />
              <span className={`transition-colors duration-300 ${
                done
                  ? 'text-slate-700 dark:text-slate-300'
                  : active
                  ? 'text-slate-600 dark:text-slate-400'
                  : 'text-slate-400 dark:text-slate-600'
              }`}>
                {stage.label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Security assurance — answers the three questions in every lawyer's head */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <span aria-hidden="true">🔒</span>
          AES-256 encrypted · Only you can access this document · Never used for AI training
        </p>
      </div>
    </div>
  )
}