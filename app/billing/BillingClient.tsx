'use client'

import { useState } from 'react'
import { Subscription, SubscriptionTier, TIER_LIMITS, PRICE_IDS } from '@/lib/types'
import { CheckCircle, AlertCircle, XCircle, Zap, FileText, MessageSquare, Shield } from 'lucide-react'

interface BillingClientProps {
  subscription: Subscription
  tierLimits: typeof TIER_LIMITS
  priceIds: typeof PRICE_IDS
  userEmail: string
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active' || status === 'trialing') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle className="w-3 h-3" />
        {status === 'trialing' ? 'Trial' : 'Active'}
      </span>
    )
  }
  if (status === 'past_due') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
        <AlertCircle className="w-3 h-3" />
        Past Due
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <XCircle className="w-3 h-3" />
      {status === 'free' ? 'Free' : 'Canceled'}
    </span>
  )
}

const TIER_FEATURES: Record<SubscriptionTier, { icon: React.ElementType; label: string; value: string }[]> = {
  free: [
    { icon: FileText, label: 'Documents', value: '3 per period' },
    { icon: MessageSquare, label: 'Queries', value: '10 per period' },
    { icon: Zap, label: 'File size', value: '10MB max' },
  ],
  pro: [
    { icon: FileText, label: 'Documents', value: '20 per period' },
    { icon: MessageSquare, label: 'Queries', value: '200 per period' },
    { icon: Zap, label: 'File size', value: '100MB max' },
    { icon: Shield, label: 'Audit log', value: 'Full access' },
  ],
  enterprise: [
    { icon: FileText, label: 'Documents', value: '100 per period' },
    { icon: MessageSquare, label: 'Queries', value: 'Unlimited' },
    { icon: Zap, label: 'File size', value: '500MB max' },
    { icon: Shield, label: 'Audit log', value: 'Full access' },
  ],
}

export default function BillingClient({
  subscription,
  userEmail,
}: BillingClientProps) {
  const [loading, setLoading] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tier = subscription.tier
  const features = TIER_FEATURES[tier]
  const hasBillingAccount = !!subscription.stripe_customer_id

  async function handleUpgrade() {
    setLoading('checkout')
    setError(null)
    try {
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'pro' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(null)
    }
  }

  async function handleManageBilling() {
    setLoading('portal')
    setError(null)
    try {
      const response = await fetch('/api/billing/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to open billing portal')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">

      {/* Page header */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
          Billing
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {userEmail}
        </p>
      </div>

      {/* Current plan card */}
      <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">

        {/* Plan header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
              Current plan
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-50 capitalize">
              {TIER_LIMITS[tier].label}
            </p>
          </div>
          <StatusBadge status={subscription.status} />
        </div>

        {/* Plan features */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <ul className="space-y-3">
            {features.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                  <Icon className="w-4 h-4 text-slate-400" />
                  {label}
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Billing period */}
        {subscription.current_period_end && (
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subscription.cancel_at_period_end
                ? 'Access ends'
                : 'Renews'}{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-6 py-3 bg-rose-50 dark:bg-rose-950 border-b border-rose-200 dark:border-rose-800">
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-5 flex flex-col sm:flex-row gap-3">
          {tier === 'free' && (
            <button
              onClick={handleUpgrade}
              disabled={loading !== null}
              className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold px-4 py-2.5 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'checkout' ? 'Redirecting...' : 'Upgrade to Solo Lawyer — $29/mo'}
            </button>
          )}

          {hasBillingAccount && (
            <button
              onClick={handleManageBilling}
              disabled={loading !== null}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'portal' ? 'Redirecting...' : 'Manage billing'}
            </button>
          )}

          {!hasBillingAccount && tier !== 'free' && (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
              Contact support to manage your Enterprise plan.
            </p>
          )}
        </div>

      </div>

      {/* Past due warning */}
      {subscription.status === 'past_due' && (
        <div className="mt-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-5 py-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Payment failed
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            Update your payment method to restore full access.
          </p>
        </div>
      )}

      {/* Enterprise CTA */}
      {tier !== 'enterprise' && (
        <div className="mt-6 border border-slate-200 dark:border-slate-700 px-6 py-5">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Need Enterprise?
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Unlimited documents, 500MB uploads, SSO, custom contracts, and dedicated support.
          </p>
          <a
            href="mailto:lucid@epopteia.io"
            className="inline-block mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Contact us
          </a>
        </div>
      )}

    </div>
  )
}