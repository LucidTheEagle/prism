'use client'

import { useRef, useEffect } from 'react'
import {
  ArrowLeft, Sparkles, FileText, ChevronDown,
  Loader2, WifiOff, Download, Sun, Moon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

interface Document {
  id: string
  name: string
  status: string
  page_count: number
  document_type: string
  created_at: string
}

interface ChatHeaderProps {
  activeDocumentId?: string
  activeDocumentName?: string
  allDocuments: Document[]
  selectorOpen: boolean
  docsLoading: boolean
  docsError: string | null
  hasMessages: boolean
  mounted: boolean
  onSelectorOpen: () => void
  onDocumentSwitch: (doc: Document) => void
  onDocsRetry: () => void
  onExport: () => void
}

export function ChatHeader({
  activeDocumentId,
  activeDocumentName,
  allDocuments,
  selectorOpen,
  docsLoading,
  docsError,
  hasMessages,
  mounted,
  onSelectorOpen,
  onDocumentSwitch,
  onDocsRetry,
  onExport,
}: ChatHeaderProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const selectorRef = useRef<HTMLDivElement>(null)

  // Close selector on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        if (selectorOpen) onSelectorOpen()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectorOpen, onSelectorOpen])

  // Close selector on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectorOpen) onSelectorOpen()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectorOpen, onSelectorOpen])

  return (
    <header
      className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 z-10"
      role="banner"
    >
      <div className="flex items-center justify-between gap-2">

        {/* Left: Back + Logo + Document selector */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to home"
            className="shrink-0 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" aria-label="PRISM">
            <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg" aria-hidden="true">
              <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            <span className="text-base font-bold text-slate-900 dark:text-slate-50">PRISM</span>
          </div>

          <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 shrink-0" aria-hidden="true" />

          {/* Document selector */}
          <div ref={selectorRef} className="relative min-w-0">
            <button
              onClick={onSelectorOpen}
              aria-haspopup="listbox"
              aria-expanded={selectorOpen}
              aria-label={`Current document: ${activeDocumentName || 'None selected'}. Click to switch document.`}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors max-w-[140px] sm:max-w-[200px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                {activeDocumentName || 'Select document'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${selectorOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown */}
            {selectorOpen && (
              <div
                role="listbox"
                aria-label="Available documents"
                className="absolute top-full left-0 mt-1 w-[280px] sm:w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Ready Documents
                  </p>
                </div>

                {docsLoading && (
                  <div className="flex items-center justify-center py-6 gap-2" role="status" aria-live="polite">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" aria-hidden="true" />
                    <span className="text-xs text-slate-500">Loading…</span>
                  </div>
                )}

                {!docsLoading && docsError && (
                  <div className="px-3 py-4 text-center" role="alert">
                    <WifiOff className="w-5 h-5 text-red-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-xs text-red-600 dark:text-red-400">{docsError}</p>
                    <button
                      onClick={onDocsRetry}
                      className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!docsLoading && !docsError && allDocuments.length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No other documents available
                    </p>
                  </div>
                )}

                {!docsLoading && !docsError && allDocuments.length > 0 && (
                  <ul className="max-h-60 overflow-y-auto" aria-label="Document list">
                    {allDocuments.map((doc) => {
                      const isActive = doc.id === activeDocumentId
                      return (
                        <li key={doc.id} role="option" aria-selected={isActive}>
                          <button
                            onClick={() => onDocumentSwitch(doc)}
                            aria-label={`Switch to ${doc.name}${isActive ? ' (currently active)' : ''}`}
                            className={`w-full text-left px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-700 ${
                              isActive ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {doc.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {doc.page_count ? `${doc.page_count} pages` : 'PDF'}
                                  {doc.document_type ? ` · ${doc.document_type}` : ''}
                                </p>
                              </div>
                              {isActive && (
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                              )}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Ready + Export + Theme toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"
            aria-label="AI system ready"
            role="status"
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">AI Ready</span>
          </div>

          {hasMessages && (
            <button
              onClick={onExport}
              aria-label="Export conversation as Markdown file"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
            </button>
          )}

          {mounted ? (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 text-slate-400" aria-hidden="true" />
                : <Moon className="w-4 h-4 text-slate-600" aria-hidden="true" />
              }
            </button>
          ) : (
            <div className="w-9 h-9" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  )
}