'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

interface DocumentStatusProps {
  documentId: string
  onReady?: () => void
  autoNavigate?: boolean
}

export function DocumentStatus({ documentId, onReady, autoNavigate = false }: DocumentStatusProps) {
  const [status, setStatus] = useState<'processing' | 'ready' | 'failed'>('processing')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // FIX: Use const instead of let (ESLint)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90 // Stop at 90%
        return prev + 10
      })
    }, 2000)

    // Poll for document status
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`)
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.status === 'ready') {
            clearInterval(progressInterval)
            clearInterval(pollInterval)
            
            // Complete the progress to 100%
            setProgress(100)
            setStatus('ready')
            
            // Call onReady callback if provided
            if (onReady) {
              onReady()
            }

            // Auto-navigate if enabled (wait 2s to show completion)
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
          // Log error but continue polling
          console.log(`Status check returned ${response.status}, continuing to poll...`)
        }
      } catch (err) {
        // Log error but continue polling
        console.error('Failed to check status:', err)
      }
    }

    // Start polling every 3 seconds
    const pollInterval = setInterval(checkStatus, 3000)
    
    // Check immediately
    checkStatus()

    // Cleanup
    return () => {
      clearInterval(progressInterval)
      clearInterval(pollInterval)
    }
  }, [documentId, onReady, autoNavigate])

  if (status === 'failed') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-semibold">Processing Failed</p>
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-emerald-600">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-semibold">Processing Complete!</p>
            <p className="text-sm text-slate-600 mt-1">
              Your document is ready for intelligent Q&A
            </p>
          </div>
        </div>

        {/* Progress bar at 100% */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700 font-medium">Progress</span>
            <span className="text-emerald-600 font-bold">100%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {autoNavigate && (
          <p className="text-sm text-slate-500 text-center animate-pulse">
            Redirecting to chat...
          </p>
        )}
      </div>
    )
  }

  // Processing state
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
        <div>
          <p className="font-semibold text-slate-900">Processing Document...</p>
          <p className="text-sm text-slate-600 mt-1">
            AI is analyzing your document
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700 font-medium">Progress</span>
          <span className="text-emerald-600 font-bold">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Processing stages */}
      <div className="text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${progress >= 10 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span>Parsing PDF content</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${progress >= 30 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span>AI document analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${progress >= 50 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span>Generating vector embeddings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${progress >= 70 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span>Enriching with AI metadata</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${progress >= 90 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span>Building search index</span>
        </div>
      </div>
    </div>
  )
}