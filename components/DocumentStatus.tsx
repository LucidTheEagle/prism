'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Loader2, FileSearch, Brain, CheckCircle, XCircle } from 'lucide-react'
import type { Document } from '@/lib/types'

interface DocumentStatusProps {
  documentId: string
}

export function DocumentStatus({ documentId }: DocumentStatusProps) {
  const [status, setStatus] = useState<Document['status']>('processing')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Subscribe to realtime updates
    const channel = supabase
      .channel('document-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`
        },
        (payload: unknown) => {
          if (
            typeof payload === 'object' &&
            payload !== null &&
            'new' in payload &&
            payload.hasOwnProperty('new') &&
            typeof (payload as { new: unknown }).new === 'object' &&
            (payload as { new: unknown }).new !== null
          ) {
            const data = (payload as { new: { status?: Document['status']; error_message?: string } }).new
            console.log('Status update:', data)
            if (data.status !== undefined) {
              setStatus(data.status)
            }
            setError(data.error_message ?? null)

            if (data.status === 'ready') {
              setProgress(100)
            }
          }
        }
      )
      .subscribe()

    // Initial fetch
    supabase
      .from('documents')
      .select('status, error_message')
      .eq('id', documentId)
      .single()
      .then(({ data }) => {
        if (data) {
          setStatus(data.status)
          setError(data.error_message)
        }
      })

    // Simulate progress (real progress will come from backend in Phase 2)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (status === 'ready') return 100
        if (prev >= 90) return 90
        return prev + 5
      })
    }, 500)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(progressInterval)
    }
  }, [documentId, status])

  if (status === 'failed') {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3">
        <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-rose-700">Processing failed</p>
          <p className="text-sm text-rose-600 mt-1">{error || 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
        <CheckCircle className="w-5 h-5 text-emerald-500" />
        <p className="text-sm font-medium text-emerald-700">Ready to query! 🎉</p>
      </div>
    )
  }

  // Processing state
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {progress < 40 ? (
          <>
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            <p className="text-sm font-medium text-slate-700">Uploading to secure storage...</p>
          </>
        ) : progress < 70 ? (
          <>
            <FileSearch className="w-5 h-5 text-emerald-500 animate-pulse" />
            <p className="text-sm font-medium text-slate-700">Analyzing document structure...</p>
          </>
        ) : (
          <>
            <Brain className="w-5 h-5 text-emerald-500 animate-pulse" />
            <p className="text-sm font-medium text-slate-700">AI processing (Phase 2 coming soon)...</p>
          </>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500 shadow-sm"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-xs text-slate-500">
        {progress < 100 ? `${progress}% complete` : 'Finalizing...'}
      </p>
    </div>
  )
}