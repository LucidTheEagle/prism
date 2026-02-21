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
    /*
     * Loading skeleton
     * role="status" + aria-label — screen readers announce this as a
     * loading state rather than an empty region. aria-busy signals the
     * panel is not yet ready for interaction.
     */
    <div
      className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-950"
      role="status"
      aria-label="Loading PDF viewer"
      aria-busy="true"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
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
    /*
     * Root layout container
     * On mobile: vertical stack (PDF on top, chat below).
     * On lg+: horizontal split side by side.
     *
     * aria-label on the root gives the overall workspace a name.
     * Screen reader users navigating by landmarks see
     * "Document workspace" as the page region.
     */
    <div
      className="h-full flex flex-col lg:flex-row overflow-hidden"
      aria-label="Document workspace"
    >

      {/*
       * LEFT PANEL — PDF Viewer
       *
       * role="region" + aria-label makes this a named landmark.
       * Screen reader users can jump directly to "PDF viewer panel"
       * via the landmarks list without tabbing through chat.
       *
       * Mobile height: h-[45vh] gives slightly more room than 40vh
       * and feels less cramped on 667px (iPhone SE landscape) screens.
       * On portrait phones h-[45vh] still leaves 55vh for chat which
       * is enough to see messages and the input bar without scrolling.
       * lg: reverts to full height with 50/50 horizontal split.
       *
       * min-h-0 on mobile prevents flex children from overflowing
       * when content is taller than the allocated height.
       *
       * Independent ErrorBoundary — if react-pdf throws (corrupt PDF,
       * unsupported encoding, worker crash), this catches it and shows
       * a recovery UI without touching the chat panel at all.
       */}
      <div
        role="region"
        aria-label="PDF viewer panel"
        className="h-[45vh] min-h-0 lg:h-full lg:w-1/2 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        <ErrorBoundary panel="pdf">
          <PDFViewer
            documentId={activePdfDocumentId}
            targetPage={targetPage}
          />
        </ErrorBoundary>
      </div>

      {/*
       * RIGHT PANEL — Chat
       *
       * role="region" + aria-label makes this a named landmark.
       * Screen reader users can jump directly to "Chat panel"
       * without navigating through the PDF viewer.
       *
       * flex-1 + min-h-0 — on mobile this takes the remaining viewport
       * height after the PDF panel. min-h-0 is required on flex children
       * that contain scrollable content, otherwise the browser won't
       * constrain the height and the inner scroll won't work.
       *
       * Independent ErrorBoundary — if ChatInterface throws (malformed
       * message data, citation parse error), this catches it without
       * affecting the PDF panel.
       */}
      <div
        role="region"
        aria-label="Chat panel"
        className="flex-1 min-h-0 overflow-hidden"
      >
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