'use client'

import { useEffect, useState, Suspense, lazy } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const SplitLayout = lazy(() => import('@/components/SplitLayout'))

interface Document {
  id: string
  name: string
  status: string
  page_count: number
  document_type: string
  created_at: string
}

function SplitLayoutSkeleton() {
  return (
    <div className="h-full flex">
      <div className="w-1/2 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex flex-col">
        <div className="h-12 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 flex items-center gap-3">
          <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading PDF viewer…</p>
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-white dark:bg-slate-900 flex flex-col">
        <div className="h-12 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center gap-3">
          <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-16 border-t border-slate-200 dark:border-slate-700 px-4 flex items-center">
          <div className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Loading document…</p>
      </div>
    </div>
  )
}

function PageError({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center max-w-md px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          {message}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Please select a document from the home page.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  )
}

/**
 * ChatContent
 *
 * Isolated into its own component so useSearchParams() is contained
 * here and wrapped in <Suspense> by the parent page export.
 * Same pattern as the login page fix — Next.js requires this for
 * any component calling useSearchParams() during static generation.
 */
function ChatContent() {
  const searchParams = useSearchParams()
  const documentId = searchParams.get('doc')

  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      setError('No document selected')
      setLoading(false)
      return
    }

    const fetchDocument = async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setError('Session expired. Please sign in again.')
          setLoading(false)
          return
        }

        const response = await fetch(`/api/documents/${documentId}`)

        if (response.status === 401) {
          setError('Session expired. Please sign in again.')
          return
        }

        if (!response.ok) throw new Error('Document not found')

        const data = await response.json()

        if (data.status !== 'ready') {
          throw new Error('Document is not ready for chat')
        }

        setDocument(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [documentId])

  if (loading) return <PageLoader />
  if (error || !document) return <PageError message={error ?? 'Document not found'} />

  return (
    <Suspense fallback={<SplitLayoutSkeleton />}>
      <SplitLayout documentId={document.id} documentName={document.name} />
    </Suspense>
  )
}

/**
 * ChatPage
 *
 * Shell — wraps ChatContent (which uses useSearchParams) in Suspense
 * so Next.js static generation doesn't fail at build time.
 */
export default function ChatPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ChatContent />
    </Suspense>
  )
}