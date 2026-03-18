'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, Shield, Trash2, ArrowLeft,
  Loader2, CheckCircle2, AlertCircle,
  FileText, MessageSquare, Upload, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AuditEntry {
  id: string
  event_type: string
  document_id: string | null
  created_at: string
  metadata: Record<string, unknown>
  ip_address: string | null
}

interface ProfileClientProps {
  userId: string
  userEmail: string
  userName: string
  auditEntries: AuditEntry[]
  documentCount: number
}

type Tab = 'account' | 'security' | 'custody'

function eventLabel(eventType: string): { label: string; icon: React.ElementType } {
  switch (eventType) {
    case 'document_upload': return { label: 'Document uploaded', icon: Upload }
    case 'document_query': return { label: 'Document queried', icon: MessageSquare }
    case 'document_delete': return { label: 'Document deleted', icon: Trash2 }
    case 'document_view': return { label: 'Document viewed', icon: FileText }
    case 'pdf_stream': return { label: 'PDF accessed', icon: FileText }
    default: return { label: eventType.replace(/_/g, ' '), icon: Clock }
  }
}

export default function ProfileClient({
  userId,
  userEmail,
  userName: initialName,
  auditEntries,
  documentCount,
}: ProfileClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<Tab>('account')

  // Account settings state
  const [displayName, setDisplayName] = useState(initialName)
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Password reset state
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // Purge state
  const [purgeConfirmText, setPurgeConfirmText] = useState('')
  const [purging, setPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) return
    setSavingName(true)
    setNameError(null)
    setNameSaved(false)

    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim(), name: displayName.trim() },
    })

    if (error) {
      setNameError(error.message)
    } else {
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 3000)
    }
    setSavingName(false)
  }

  async function handlePasswordReset() {
    setResetLoading(true)
    setResetError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
    })

    if (error) {
      setResetError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  async function handlePurge() {
    if (purgeConfirmText !== 'DELETE MY DATA') return
    setPurging(true)
    setPurgeError(null)

    try {
      const response = await fetch('/api/account/purge', { method: 'POST' })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Purge failed')
      }

      // Download destruction receipt
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `PRISM_Account_Destruction_Receipt_${Date.now()}.pdf`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      // Sign out and redirect
      await supabase.auth.signOut()
      router.push('/?purged=true')

    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : 'Purge failed. Please try again.')
      setPurging(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'account', label: 'Account Settings', icon: User },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'custody', label: 'Data Custody', icon: Trash2 },
  ]

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
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
          Profile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {userEmail}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              activeTab === id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Account Settings ─────────────────────────────────── */}
      {activeTab === 'account' && (
        <div id="panel-account" role="tabpanel" aria-labelledby="tab-account" className="space-y-6">

          {/* Display name */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-4">
              Display Name
            </h2>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-transparent transition-shadow min-h-[44px]"
                />
              </div>
              {nameError && (
                <p className="text-sm text-rose-600 dark:text-rose-400">{nameError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={savingName || !displayName.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {savingName ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Saving…
                    </span>
                  ) : 'Save Name'}
                </button>
                {nameSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    Saved
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Email — read only */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-4">
              Email Address
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={userEmail}
                readOnly
                aria-label="Email address — read only"
                className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed min-h-[44px]"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">Read only</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Email changes are not supported. Contact support if needed.
            </p>
          </div>

          {/* Password reset */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">
              Password
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              We will send a secure password reset link to your email address.
            </p>
            {resetError && (
              <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{resetError}</p>
            )}
            {resetSent ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Reset link sent to {userEmail}
              </div>
            ) : (
              <button
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {resetLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Sending…
                  </span>
                ) : 'Send Reset Link'}
              </button>
            )}
          </div>

        </div>
      )}

      {/* ── Tab: Security & Access ────────────────────────────────── */}
      {activeTab === 'security' && (
        <div id="panel-security" role="tabpanel" aria-labelledby="tab-security" className="space-y-6">

          {/* 2FA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">
                  Two-Factor Authentication
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Add a second layer of protection to your account.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full">
                Coming Soon
              </span>
            </div>
          </div>

          {/* Audit log */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Recent Activity
              </h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Last 5 events
              </span>
            </div>

            {auditEntries.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                No activity recorded yet.
              </p>
            ) : (
              <div className="space-y-3" role="list" aria-label="Recent account activity">
                {auditEntries.map((entry) => {
                  const { label, icon: Icon } = eventLabel(entry.event_type)
                  const docName = entry.metadata?.document_name as string | undefined

                  return (
                    <div
                      key={entry.id}
                      role="listitem"
                      className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0" aria-hidden="true">
                        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {label}
                        </p>
                        {docName && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {docName}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(entry.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short',
                          })}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(entry.created_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-4">
              Account Information
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Account ID</span>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Documents in enclave</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{documentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Data encryption</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">AES-256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">AI training use</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Never</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Tab: Data Custody ─────────────────────────────────────── */}
      {activeTab === 'custody' && (
        <div id="panel-custody" role="tabpanel" aria-labelledby="tab-custody" className="space-y-6">

          {/* Data summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-4">
              Your Data Footprint
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Documents in secure enclave</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{documentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Individual document deletion</span>
                <Link
                  href="/documents"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                >
                  Manage documents →
                </Link>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="border-2 border-rose-200 dark:border-rose-800 rounded-xl overflow-hidden">
            <div className="bg-rose-50 dark:bg-rose-950/40 px-6 py-4 border-b border-rose-200 dark:border-rose-800">
              <h2 className="text-base font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
                Enterprise Data Purge
              </h2>
              <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">
                Permanently delete all uploaded documents, vector embeddings, chat history, and usage data associated with this account. This action is immediate and cannot be undone.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 px-6 py-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  What will be destroyed:
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" aria-hidden="true" />
                    All PDF files from encrypted storage
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" aria-hidden="true" />
                    All vector embeddings and text chunks
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" aria-hidden="true" />
                    All chat history and conversation records
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" aria-hidden="true" />
                    All usage tracking data
                  </li>
                </ul>
              </div>

              <div>
                <label
                  htmlFor="purgeConfirm"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Type <strong className="text-rose-600 dark:text-rose-400 font-mono">DELETE MY DATA</strong> to confirm
                </label>
                <input
                  id="purgeConfirm"
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder="DELETE MY DATA"
                  disabled={purging}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:border-transparent transition-shadow disabled:opacity-60 min-h-[44px] font-mono"
                />
              </div>

              {purgeError && (
                <div role="alert" className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {purgeError}
                </div>
              )}

              <button
                onClick={handlePurge}
                disabled={purgeConfirmText !== 'DELETE MY DATA' || purging}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 min-h-[44px]"
              >
                {purging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Purging all data…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Purge All Account Data
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                A timestamped Destruction Receipt will be downloaded as cryptographic proof.
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}