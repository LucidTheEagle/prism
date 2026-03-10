import { supabaseAdmin } from '@/lib/supabase/server'
import { Subscription, SubscriptionTier } from '@/lib/types'

/**
 * getSubscription
 *
 * Reads the user's current subscription record from our local table.
 * Never queries Stripe at runtime — Stripe webhook keeps this in sync.
 *
 * Returns a default free-tier object if no record exists yet.
 * This covers the case where a user registers but hasn't gone through
 * checkout — they get free tier limits, not a hard block.
 */
export async function getSubscription(userId: string): Promise<Subscription> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    // No subscription record — return free tier defaults
    return buildFreeSubscription(userId)
  }

  return data as Subscription
}

function buildFreeSubscription(userId: string): Subscription {
  return {
    id: '',
    user_id: userId,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    status: 'free',
    price_id: null,
    tier: 'free' as SubscriptionTier,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}