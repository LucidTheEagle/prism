import { supabaseAdmin } from '@/lib/supabase/server'
import { Subscription, TIER_LIMITS, SubscriptionTier } from '@/lib/types'

export interface AccessDecision {
  allowed: boolean
  reason?: string
  tier: SubscriptionTier
  limit?: number
  current?: number
}

/**
 * checkUploadAccess
 *
 * Verifies the user can upload another document under their tier.
 * Counts existing documents in the documents table for this user.
 */
export async function checkUploadAccess(
  subscription: Subscription,
  userId: string
): Promise<AccessDecision> {
  const tier = subscription.tier
  const limits = TIER_LIMITS[tier]

  // Active gate — past_due gets a grace pass, canceled and free get limits
  const blockedStatuses = ['canceled', 'incomplete']
  if (blockedStatuses.includes(subscription.status) && tier !== 'free') {
    return {
      allowed: false,
      reason: 'Your subscription is inactive. Please update your billing details.',
      tier,
    }
  }

  // No document limit for this tier
  if (limits.document_limit === null) {
    return { allowed: true, tier }
  }

  // Count user's current documents
  const { count, error } = await supabaseAdmin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'failed')

  if (error) {
    // Fail open — don't block user due to a count query failure
    console.error('[checkUploadAccess] Count query failed:', error)
    return { allowed: true, tier }
  }

  const current = count ?? 0

  if (current >= limits.document_limit) {
    return {
      allowed: false,
      reason: `You have reached the ${limits.label} plan limit of ${limits.document_limit} document${limits.document_limit === 1 ? '' : 's'}. Upgrade to upload more.`,
      tier,
      limit: limits.document_limit,
      current,
    }
  }

  return { allowed: true, tier, limit: limits.document_limit, current }
}

/**
 * checkQueryAccess
 *
 * Verifies the user can run another query under their tier.
 * Reads from usage_tracking for the current billing period.
 */
export async function checkQueryAccess(
  subscription: Subscription,
  userId: string
): Promise<AccessDecision> {
  const tier = subscription.tier
  const limits = TIER_LIMITS[tier]

  // Hard block for canceled non-free subscriptions
  const blockedStatuses = ['canceled', 'incomplete']
  if (blockedStatuses.includes(subscription.status) && tier !== 'free') {
    return {
      allowed: false,
      reason: 'Your subscription is inactive. Please update your billing details.',
      tier,
    }
  }

  // No query limit for this tier
  if (limits.query_limit === null) {
    return { allowed: true, tier }
  }

  // Get current period start — used to find the active usage_tracking row
  const periodStart = subscription.current_period_start
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data: usage, error } = await supabaseAdmin
    .from('usage_tracking')
    .select('query_count')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found — that's fine, means zero usage
    console.error('[checkQueryAccess] Usage query failed:', error)
    return { allowed: true, tier }
  }

  const current = usage?.query_count ?? 0

  if (current >= limits.query_limit) {
    return {
      allowed: false,
      reason: `You have used all ${limits.query_limit} queries on the ${limits.label} plan this period. Upgrade for unlimited queries.`,
      tier,
      limit: limits.query_limit,
      current,
    }
  }

  return { allowed: true, tier, limit: limits.query_limit, current }
}