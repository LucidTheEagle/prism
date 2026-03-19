'use client'

import { useEffect, useRef } from 'react'
import { X, Zap, FileText, MessageSquare } from 'lucide-react'
import { TIER_LIMITS, SubscriptionTier } from '@/lib/types'

interface UpgradeModalProps {
  open: boolean
  code: 'QUERY_LIMIT_REACHED' | 'UPLOAD_LIMIT_REACHED'
  currentTier: SubscriptionTier
  limit?: number
  current?: number
  onClose: () => void
  onUpgrade: () => void
}

const CODE_COPY = {
  QUERY_LIMIT_REACHED: {
    title: 'Query limit reached',
    icon: MessageSquare,
    description: (tier: SubscriptionTier, limit?: number) =>
      `You have used all ${limit ?? TIER_LIMITS[tier].query_limit} queries available on the ${TIER_LIMITS[tier].label} plan this billing period.`,
  },
  UPLOAD_LIMIT_REACHED: {
    title: 'Document limit reached',
    icon: FileText,
    description: (tier: SubscriptionTier, limit?: number) =>
      `You have reached the ${limit ?? TIER_LIMITS[tier].document_limit} document limit on the ${TIER_LIMITS[tier].label} plan.`,
  },
}

const PRO_FEATURES = [
  `${TIER_LIMITS.pro.document_limit} documents per billing period`,
  `${TIER_LIMITS.pro.query_limit} queries per billing period`,
  `Up to ${TIER_LIMITS.pro.file_size_limit_mb}MB per document`,
  'Full audit log access',
  'Priority processing',
]

export function UpgradeModal({
  open,
  code,
  currentTier,
  limit,
  current,
  onClose,
  onUpgrade,
}: UpgradeModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus trap — close button on open
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus()
    }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const copy = CODE_COPY[code]
  const Icon = copy.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2
                id="upgrade-modal-title"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight"
              >
                {copy.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {TIER_LIMITS[currentTier].label} plan
                {current !== undefined && limit !== undefined
                  ? ` · ${current} / ${limit} used`
                  : ''}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {copy.description(currentTier, limit)}
          </p>

          {/* Pro feature list */}
          <div className="border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Pro plan includes
            </p>
            <ul className="space-y-2">
              {PRO_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Starting at $29 / month. Cancel anytime.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={onUpgrade}
            className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold px-4 py-2.5 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
          >
            Upgrade to Pro
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Not now
          </button>
        </div>

      </div>
    </div>
  )
}