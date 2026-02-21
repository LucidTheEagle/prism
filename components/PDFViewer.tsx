'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

/*
 * PDF.js worker setup for Next.js + Turbopack.
 * REQUIRED SETUP (one-time):
 *   cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
 */
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PDFViewerProps {
  documentId: string
  targetPage?: number
}

export default function PDFViewer({ documentId, targetPage }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(600)

  const containerRef = useRef<HTMLDivElement>(null)
  const errorId = useId()
  const pageStatusId = useId()

  // Measure container width so PDF page fills available space
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Jump to citation page when parent signals a click
  useEffect(() => {
    if (targetPage != null && targetPage >= 1 && targetPage <= numPages) {
      const page = targetPage
      queueMicrotask(() => setCurrentPage(page))
    }
  }, [targetPage, numPages])

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || 'Failed to load PDF')
    setIsLoading(false)
  }, [])

  const goToPreviousPage = useCallback(() => setCurrentPage(p => Math.max(1, p - 1)), [])
  const goToNextPage = useCallback(() => setCurrentPage(p => Math.min(numPages, p + 1)), [numPages])
  const zoomIn = useCallback(() => setScale(s => Math.min(2.0, parseFloat((s + 0.2).toFixed(1)))), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(0.6, parseFloat((s - 0.2).toFixed(1)))), [])

  /*
   * Keyboard shortcuts — only fires when focus is inside the PDF panel
   * so it doesn't hijack typing in the chat textarea.
   * Arrow keys / j/k navigate pages · +/- zoom
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        goToPreviousPage()
        break
      case 'ArrowRight':
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        goToNextPage()
        break
      case '+':
      case '=':
        e.preventDefault()
        zoomIn()
        break
      case '-':
        e.preventDefault()
        zoomOut()
        break
    }
  }, [goToPreviousPage, goToNextPage, zoomIn, zoomOut])

  const pdfUrl = `/api/documents/${documentId}/pdf`
  const zoomPercent = Math.round(scale * 100)

  return (
    /*
     * tabIndex={0} — allows the PDF panel to receive keyboard focus,
     * enabling the keyboard shortcut handler above.
     * focus-visible:ring — shows a focus ring only for keyboard users
     * (not on mouse click) via the :focus-visible CSS pseudo-class.
     */
    <div
      className="h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="PDF document viewer"
      aria-describedby={error ? errorId : pageStatusId}
    >

      {/* ── TOOLBAR ──────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        role="toolbar"
        aria-label="PDF viewer controls"
      >

        {/* Page navigation */}
        <div role="group" aria-label="Page navigation" className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1 || isLoading}
            aria-label={`Go to previous page (currently page ${currentPage} of ${numPages})`}
            aria-disabled={currentPage <= 1 || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          </button>

          {/*
           * Page counter
           * aria-live="polite" announces page changes to screen readers
           * when navigating or when a citation jump occurs.
           * aria-atomic="true" reads the whole string ("3 / 12") not
           * just the changed portion.
           */}
          <span
            id={pageStatusId}
            className="text-xs text-slate-600 dark:text-slate-400 tabular-nums min-w-[56px] sm:min-w-[80px] text-center select-none"
            aria-live="polite"
            aria-atomic="true"
            aria-label={isLoading ? 'Loading document' : `Page ${currentPage} of ${numPages}`}
          >
            {isLoading ? '— / —' : `${currentPage} / ${numPages}`}
          </span>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages || isLoading}
            aria-label={`Go to next page (currently page ${currentPage} of ${numPages})`}
            aria-disabled={currentPage >= numPages || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          </button>
        </div>

        {/* Zoom controls */}
        <div role="group" aria-label="Zoom controls" className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.6 || isLoading}
            aria-label={`Zoom out (current zoom ${zoomPercent}%)`}
            aria-disabled={scale <= 0.6 || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <ZoomOut className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          </button>

          <span
            className="text-xs text-slate-600 dark:text-slate-400 tabular-nums w-8 sm:w-10 text-center select-none"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Zoom level ${zoomPercent} percent`}
          >
            {zoomPercent}%
          </span>

          <button
            onClick={zoomIn}
            disabled={scale >= 2.0 || isLoading}
            aria-label={`Zoom in (current zoom ${zoomPercent}%)`}
            aria-disabled={scale >= 2.0 || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          </button>
        </div>

        {/* Keyboard hint — desktop only, hidden on mobile to save space */}
        <p className="hidden lg:block text-xs text-slate-400 dark:text-slate-500 select-none" aria-hidden="true">
          ← → navigate · +/− zoom
        </p>
      </div>

      {/* ── PDF RENDER AREA ──────────────────────────────────────────── */}
      <div
        ref={containerRef}
        id="pdf-render-area"
        className="flex-1 overflow-auto flex justify-center py-4 px-2 prism-scroll"
        role="document"
        aria-label={isLoading ? 'PDF loading' : `PDF document, page ${currentPage} of ${numPages}`}
        aria-busy={isLoading}
      >
        {/* Error state */}
        {error && (
          <div
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="flex flex-col items-center justify-center h-full gap-3 text-center px-6"
          >
            <AlertCircle className="w-10 h-10 text-rose-500" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Failed to load PDF
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        )}

        {/* PDF Document */}
        {!error && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            aria-label="PDF document content"
            loading={
              <div
                className="flex items-center justify-center h-full"
                role="status"
                aria-label="Loading PDF content"
                aria-busy="true"
              >
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              width={(containerWidth - 32) * scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              aria-label={`Page ${currentPage} of ${numPages}`}
              loading={
                <div
                  className="flex items-center justify-center"
                  style={{ width: (containerWidth - 32) * scale, height: 400 }}
                  role="status"
                  aria-label={`Loading page ${currentPage}`}
                  aria-busy="true"
                >
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  )
}