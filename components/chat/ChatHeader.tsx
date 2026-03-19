'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  FileText, ChevronDown, Loader2, WifiOff,
  Download, LogOut, User, CreditCard,
  LayoutDashboard,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  userEmail?: string
  userName?: string
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
  userEmail,
  userName,
  onSelectorOpen,
  onDocumentSwitch,
  onDocsRetry,
  onExport,
}: ChatHeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const selectorRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const [avatarOpen, setAvatarOpen] = useState(false)

  // Document selector — close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        if (selectorOpen) onSelectorOpen()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectorOpen, onSelectorOpen])

  // Avatar menu — close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Escape key closes both
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectorOpen) onSelectorOpen()
        setAvatarOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectorOpen, onSelectorOpen])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }, [supabase, router])

  // Generate initials from name or email
  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail
    ? userEmail[0].toUpperCase()
    : 'U'

  return (
    <header
      className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 sm:px-4 py-2.5 z-10"
      role="banner"
      aria-label="PRISM Command Header"
    >
      <div className="flex items-center justify-between gap-2">

        {/* ── LEFT FLANK — Retreat + Document selector ─────────── */}
        <div className="flex items-center gap-2 min-w-0">

          {/* Back to Vault */}
          <button
            onClick={() => router.push('/documents')}
            aria-label="Back to My Documents"
            title="Back to My Documents"
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[36px]"
          >
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">My Documents</span>
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 shrink-0" aria-hidden="true" />

          {/* ── CENTER — Document name + security badge ─────────── */}
          <div ref={selectorRef} className="relative min-w-0">
            <button
              onClick={onSelectorOpen}
              aria-haspopup="listbox"
              aria-expanded={selectorOpen}
              aria-label={`Active document: ${activeDocumentName || 'None selected'}. Click to switch.`}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors max-w-[140px] sm:max-w-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {activeDocumentName || 'Select document'}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${selectorOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {/* Document selector dropdown */}
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
                      className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
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
                            className={`w-full text-left px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-700 ${
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

          {/* AES-256 security badge */}
          <div
            className="hidden md:flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-emerald-700 dark:text-emerald-400"
            aria-label="Document encrypted with AES-256"
            title="AES-256 Encrypted — isolated to your account"
          >
            <span className="text-[10px]" aria-hidden="true">🔒</span>
            <span className="text-[10px] font-semibold tracking-wide">AES-256</span>
          </div>

        </div>

        {/* ── RIGHT FLANK — Export + Avatar ────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* AI Ready indicator */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded"
            aria-label="AI system ready"
            role="status"
          >
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">AI Ready</span>
          </div>

          {/* Forensic PDF export */}
          {hasMessages && (
            <button
              onClick={onExport}
              aria-label="Export Forensic PDF — opens print dialog"
              title="Export Forensic PDF"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[36px]"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          )}

          {/* Avatar dropdown */}
          {mounted && (
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={avatarOpen}
                aria-label="Account menu"
                className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full text-white text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 hover:from-emerald-600 hover:to-emerald-700 transition-all"
              >
                {initials}
              </button>

              {avatarOpen && (
                <div
                  role="menu"
                  aria-label="Account options"
                  className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50"
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {userName || 'Account'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {userEmail}
                    </p>
                  </div>

                  {/* Profile & Security */}
                  <button
                    role="menuitem"
                    onClick={() => { setAvatarOpen(false); router.push('/profile') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:bg-slate-50 min-h-[44px]"
                  >
                    <User className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    Profile & Security
                  </button>

                  {/* Billing */}
                  <button
                    role="menuitem"
                    onClick={() => { setAvatarOpen(false); router.push('/billing') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:bg-slate-50 min-h-[44px]"
                  >
                    <CreditCard className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    Billing
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1" />

                  {/* Sign Out */}
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus-visible:outline-none focus-visible:bg-rose-50 min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}