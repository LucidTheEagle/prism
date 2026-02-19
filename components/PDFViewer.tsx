'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

/*
 * PDF.js worker setup for Next.js + Turbopack.
 *
 * We point workerSrc at the pdfjs-dist worker file served from /public.
 * This avoids webpack/Turbopack worker bundling issues entirely.
 *
 * REQUIRED SETUP (one-time, run in your terminal):
 *   cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
 *
 * This copies the worker file into /public so Next.js serves it as a
 * static asset. Without this step the PDF viewer will fail to render.
 */
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PDFViewerProps {
  documentId: string
  // When a citation is clicked in ChatInterface, the parent passes the
  // target page number here. PDFViewer watches this prop and scrolls.
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

  // When parent signals a citation click, jump to that page.
  // Defer setState so we don't trigger a synchronous cascading render (React guidance).
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

  const goToPreviousPage = () => setCurrentPage(p => Math.max(1, p - 1))
  const goToNextPage = () => setCurrentPage(p => Math.min(numPages, p + 1))
  const zoomIn = () => setScale(s => Math.min(2.0, parseFloat((s + 0.2).toFixed(1))))
  const zoomOut = () => setScale(s => Math.max(0.6, parseFloat((s - 0.2).toFixed(1))))

  const pdfUrl = `/api/documents/${documentId}/pdf`

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">

      {/* ── PDF TOOLBAR ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>

          <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums min-w-[80px] text-center">
            {isLoading ? '— / —' : `${currentPage} / ${numPages}`}
          </span>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.6 || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>

          <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums w-10 text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            disabled={scale >= 2.0 || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* ── PDF RENDER AREA ───────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center py-4 px-2"
      >
        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <AlertCircle className="w-10 h-10 text-rose-500" />
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
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              /*
               * Width calculation:
               * containerWidth is measured by ResizeObserver.
               * We subtract 16px (px-2 padding on each side = 32px total,
               * but we leave some breathing room) and multiply by scale.
               * This makes the PDF fill the panel width at 100% zoom.
               */
              width={(containerWidth - 32) * scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div className="flex items-center justify-center"
                  style={{ width: (containerWidth - 32) * scale, height: 400 }}
                >
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  )
}