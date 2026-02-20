'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ChatInterface from './ChatInterface'
import { ErrorBoundary } from './ErrorBoundary'
import { Loader2 } from 'lucide-react'

/*
 * PDFViewer must never be server-rendered.
 * pdfjs-dist references browser-only DOM APIs at module evaluation time.
 * next/dynamic with ssr:false defers the import to the client bundle only.
 */
const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Loading PDF viewer…
        </span>
      </div>
    </div>
  ),
})

interface SplitLayoutProps {
  documentId: string
  documentName: string
}

export default function SplitLayout({ documentId, documentName }: SplitLayoutProps) {
  const [targetPage, setTargetPage] = useState<number | undefined>(undefined)

  /*
   * Active PDF document — starts with the prop value but updates when the
   * user switches documents via the ChatInterface selector. This keeps the
   * PDF panel in sync with whatever document is active in the chat panel.
   */
  const [activePdfDocumentId, setActivePdfDocumentId] = useState(documentId)

  const handleCitationClick = useCallback((page: number) => {
    setTargetPage(page)
  }, [])

  const handleDocumentChange = useCallback((newDocumentId: string) => {
    setActivePdfDocumentId(newDocumentId)
    setTargetPage(undefined)
  }, [])

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">

      {/* ── LEFT PANEL: PDF Viewer ──────────────────────────────────── */}
      {/*
       * Independent ErrorBoundary — if react-pdf throws during render
       * (corrupt PDF, unsupported encoding, worker crash), this catches it
       * and shows a recovery UI without touching the chat panel at all.
       * The user can still ask questions; they just lose the visual viewer.
       */}
      <div className="h-[40vh] lg:h-full lg:w-1/2 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 overflow-hidden">
        <ErrorBoundary panel="pdf">
          <PDFViewer
            documentId={activePdfDocumentId}
            targetPage={targetPage}
          />
        </ErrorBoundary>
      </div>

      {/* ── RIGHT PANEL: Chat ───────────────────────────────────────── */}
      {/*
       * Independent ErrorBoundary — if ChatInterface throws during render
       * (malformed message data, citation parse error, etc.), this catches
       * it without affecting the PDF panel. The user can reload just the
       * chat without losing their place in the document.
       */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary panel="chat">
          <ChatInterface
            documentId={documentId}
            documentName={documentName}
            onCitationClick={handleCitationClick}
            onDocumentChange={handleDocumentChange}
          />
        </ErrorBoundary>
      </div>

    </div>
  )
}