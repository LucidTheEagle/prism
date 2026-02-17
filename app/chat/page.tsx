'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ChatInterface from '@/components/ChatInterface'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Document {
  id: string
  name: string
  status: string
  page_count: number
  document_type: string
  created_at: string
}

export default function ChatPage() {
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
        const response = await fetch(`/api/documents/${documentId}`)
        
        if (!response.ok) {
          throw new Error('Document not found')
        }

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

  // Loading state - full screen
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading document...</p>
        </div>
      </div>
    )
  }

  // Error state - full screen
  if (error || !document) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {error || 'Document not found'}
          </h2>
          <p className="text-slate-600 mb-6">
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

  // Chat interface - full screen, no wrapper
  return (
    <ChatInterface 
      documentId={document.id}
      documentName={document.name}
    />
  )
}