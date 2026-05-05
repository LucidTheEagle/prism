'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Trash2, MessageSquare, AlertCircle,
  CheckCircle2, Loader2, Clock, ArrowLeft,
} from 'lucide-react'

interface Document {
  id: string
  name: string
  status: string
  page_count: number | null
  document_type: string | null
  file_size_bytes: number | null
  created_at: string
  file_hash: string | null
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
        Ready
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        Processing
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-full">
      <AlertCircle className="w-3 h-3" aria-hidden="true" />
      Failed
    </span>
  )
}

interface DeleteState {
  documentId: string
  status: 'confirming' | 'deleting' | 'done' | 'error'
  error?: string
}

export default function DocumentsClient({ documents: initialDocuments }: { documents: Document[] }) {
  const router = useRouter()
  const [documents, setDocuments] = useState(initialDocuments)
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function handleDelete(documentId: string) {
    setDeleteState({ documentId, status: 'deleting' })

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete document')
      }

      // Download the Destruction Receipt PDF
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `Destruction_Receipt_${documentId}.pdf`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setDocuments(prev => prev.filter(d => d.id !== documentId))
      setDeleteState({ documentId, status: 'done' })
      setTimeout(() => setDeleteState(null), 2000)

    } catch (err) {
      setDeleteState({
        documentId,
        status: 'error',
        error: err instanceof Error ? err.message : 'Deletion failed',
      })
    }
  }

  async function handleBulkDelete() {
    const readyDocs = documents.filter(d => d.status === 'ready')
    if (readyDocs.length === 0) return

    setBulkDeleting(true)

    for (const doc of readyDocs) {
      try {
        const response = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
        if (response.ok) {
          setDocuments(prev => prev.filter(d => d.id !== doc.id))
        }
      } catch {
        // Continue deleting remaining documents
      }
    }

    setBulkDeleting(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to PRISM
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
              My Documents
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {documents.length} document{documents.length !== 1 ? 's' : ''} in your secure enclave
            </p>
          </div>
          {documents.length > 1 && (
            <button
              onClick={() => {
                if (window.confirm(`Permanently delete all ${documents.filter(d => d.status === 'ready').length} ready documents? This cannot be undone.`)) {
                  handleBulkDelete()
                }
              }}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {bulkDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              )}
              {bulkDeleting ? 'Deleting…' : 'Delete all'}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
            No documents yet
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Upload a PDF to get started
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Upload a document
          </Link>
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-3" role="list" aria-label="Your documents">
          {documents.map((doc) => {
            const isDeleting = deleteState?.documentId === doc.id && deleteState.status === 'deleting'
            const isDone = deleteState?.documentId === doc.id && deleteState.status === 'done'
            const isError = deleteState?.documentId === doc.id && deleteState.status === 'error'
            const isConfirming = deleteState?.documentId === doc.id && deleteState.status === 'confirming'

            return (
              <div
                key={doc.id}
                role="listitem"
                className={`flex items-center gap-4 p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all ${
                  isDone ? 'opacity-0 scale-95' : 'opacity-100'
                }`}
              >
                {/* Icon */}
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-center shrink-0" aria-hidden="true">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                      {doc.name}
                    </p>
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    {doc.page_count && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        {doc.page_count} pages
                      </span>
                    )}
                    {doc.document_type && (
                      <span>{doc.document_type}</span>
                    )}
                    {doc.file_size_bytes && (
                      <span>{formatBytes(doc.file_size_bytes)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {new Date(doc.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                  {isError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {deleteState?.error ?? 'Deletion failed. Try again.'}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {doc.status === 'ready' && (
                    <button
                      onClick={() => router.push(`/chat?doc=${doc.id}`)}
                      aria-label={`Open ${doc.name} in chat`}
                      className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <MessageSquare className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}

                  {!isConfirming && !isDeleting && (
                    <button
                      onClick={() => setDeleteState({ documentId: doc.id, status: 'confirming' })}
                      aria-label={`Delete ${doc.name}`}
                      disabled={isDeleting || bulkDeleting}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}

                  {isConfirming && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Confirm?</span>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteState(null)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {isDeleting && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Deleting…
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Security note */}
      <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
          <span>
            Deleting a document permanently purges the original PDF, all vector embeddings, text chunks, and chat history from our servers. A timestamped Destruction Receipt is downloaded as cryptographic proof.
          </span>
        </p>
      </div>

    </div>
  )
}