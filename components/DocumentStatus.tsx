'use client'

import { useEffect, useState, useCallback, useId } from 'react'
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  return 'Secure connection interrupted. For your privacy, partial data has been purged. Please try uploading again.'
}

export function DocumentStatus({
  documentId,
  onReady,
  onFailed,
  autoNavigate = false,
}: DocumentStatusProps) {
  const [status, setStatus] = useState<'queued' | 'processing' | 'ready' | 'failed'>('queued')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const progressId = useId()

  const handleReady = useCallback(() => {
    setStatus('ready')
    setProgress(100)
    onReady?.()
    if (autoNavigate) {
      setTimeout(() => {
        window.location.href = `/chat?doc=${documentId}`
      }, 2000)
    }
  }, [onReady, autoNavigate, documentId])

  const handleFailure = useCallback((rawError: string | null) => {
    setStatus('failed')
    setError(sanitiseError(rawError))
    onFailed?.()
  }, [onFailed])

  useEffect(() => {
    const supabase = createClient()
    let progressInterval: ReturnType<typeof setInterval> | null = null

    // ── Step 1: Fetch current status immediately ───────────────────────────
    // Handles the case where the document was already processed before
    // the component mounted — no waiting for the first Realtime event
    const fetchInitialStatus = async () => {
      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('ingestion_status, ingestion_error')
        .eq('id', documentId)
        .single()

      if (fetchError || !data) return

      if (data.ingestion_status === 'ready') {
        handleReady()
        return
      }

      if (data.ingestion_status === 'failed') {
        handleFailure(data.ingestion_error ?? null)
        return
      }

      // queued or processing — start progress animation and subscribe
      setStatus(data.ingestion_status as 'queued' | 'processing')
      startProgressAnimation()
    }

    // ── Step 2: Progress animation ─────────────────────────────────────────
    // Visual feedback while pipeline runs — advances to 95% max
    // Resets when status transitions to ready or failed
    const startProgressAnimation = () => {
      if (progressInterval) clearInterval(progressInterval)
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return 95
          return prev + 5
        })
      }, 2000)
    }

    // ── Step 3: Supabase Realtime subscription ─────────────────────────────
    // Subscribes to changes on this specific document row
    // Receives ingestion_status transitions pushed by runIngestionPipeline
    const channel = supabase
      .channel(`document-status-${documentId}-${retryCount}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`,
        },
        (payload) => {
          const newStatus = payload.new.ingestion_status as string
          const newError = payload.new.ingestion_error as string | null

          console.log(`[DocumentStatus] Realtime update — ingestion_status: ${newStatus}`)

          if (newStatus === 'processing') {
            setStatus('processing')
            return
          }

          if (newStatus === 'ready') {
            if (progressInterval) clearInterval(progressInterval)
            handleReady()
            return
          }

          if (newStatus === 'failed') {
            if (progressInterval) clearInterval(progressInterval)
            handleFailure(newError ?? null)
            return
          }
        }
      )
      .subscribe()

    fetchInitialStatus()

    return () => {
      if (progressInterval) clearInterval(progressInterval)
      supabase.removeChannel(channel)
    }
  }, [documentId, retryCount, handleReady, handleFailure])

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
            setStatus('queued')
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
            <span
              className="text-emerald-600 dark:text-emerald-400 font-bold"
              aria-hidden="true"
            >
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

  // ── Queued state ───────────────────────────────────────────────────────────
  if (status === 'queued') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Document is queued for processing"
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <Loader2
            className="w-5 h-5 text-slate-400 dark:text-slate-500 animate-spin shrink-0"
            aria-hidden="true"
          />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Preparing your document…
          </p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Processing will begin shortly.
        </p>
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            AES-256 encrypted · Only you can access this document · Never used for AI training
          </p>
        </div>
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
          <span
            className="text-emerald-600 dark:text-emerald-400 font-bold"
            aria-hidden="true"
          >
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

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          AES-256 encrypted · Only you can access this document · Never used for AI training
        </p>
      </div>
    </div>
  )
}